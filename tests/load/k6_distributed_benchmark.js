// k6 load test exercising three of services/api's hot paths: async video
// generation + polling, S3 multipart upload, and the collab websocket.
// Run with real env vars, never the placeholder API_KEY default below.
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const videoGenLatency = new Trend('viralvision_video_gen_duration_ms');
const videoRenderSuccess = new Rate('viralvision_video_render_success_rate');
const s3ChunkUploadTime = new Trend('viralvision_s3_chunk_upload_ms');
const s3UploadSuccess = new Rate('viralvision_s3_upload_success_rate');
const wsRoundtripLatency = new Trend('viralvision_ws_roundtrip_latency_ms');
const activeWsConnections = new Counter('viralvision_active_ws_connections');

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8000';
const WS_URL = __ENV.WS_TARGET_URL || 'ws://localhost:1234';
// Placeholder only -- always pass a real key via the API_KEY env var.
const API_KEY = __ENV.API_KEY || 'REPLACE_WITH_REAL_API_KEY';

export const options = {
  scenarios: {
    video_generation: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 100,
      stages: [
        { duration: '1m', target: 5 },
        { duration: '3m', target: 15 },
        { duration: '1m', target: 0 },
      ],
      exec: 'videoGenerationWorkflow',
    },
    s3_multipart_upload: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '3m', target: 30 },
        { duration: '1m', target: 0 },
      ],
      exec: 's3MultipartWorkflow',
    },
    websocket_timeline_collab: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      exec: 'websocketCollabWorkflow',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
    viralvision_video_render_success_rate: ['rate>0.98'],
    viralvision_s3_upload_success_rate: ['rate>0.99'],
    viralvision_s3_chunk_upload_ms: ['p(95)<1200'],
    viralvision_ws_roundtrip_latency_ms: ['p(95)<75', 'p(99)<150'],
  },
};

const commonHeaders = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
};

export function videoGenerationWorkflow() {
  const payload = JSON.stringify({
    source_url: 'https://example.com/sample-source.mp4',
    quality_tier: 'standard',
  });

  const startDispatch = Date.now();
  const initRes = http.post(`${BASE_URL}/api/v1/videos/generate`, payload, {
    headers: commonHeaders,
    tags: { name: 'DispatchVideoGeneration' },
  });

  const dispatched = check(initRes, {
    'video dispatch accepted (202)': (r) => r.status === 202,
    'job_id present': (r) => JSON.parse(r.body).job_id !== undefined,
  });

  if (!dispatched) {
    videoRenderSuccess.add(0);
    return;
  }

  const jobId = JSON.parse(initRes.body).job_id;
  let isComplete = false;
  let attempts = 0;
  const maxAttempts = 30; // 30 * 2s = 60s timeout

  while (!isComplete && attempts < maxAttempts) {
    sleep(2);
    attempts++;

    const pollRes = http.get(`${BASE_URL}/api/v1/videos/${jobId}/status`, {
      headers: commonHeaders,
      tags: { name: 'PollVideoStatus' },
    });

    if (pollRes.status === 200) {
      const data = JSON.parse(pollRes.body);
      if (data.status === 'completed') {
        isComplete = true;
        videoRenderSuccess.add(1);
        videoGenLatency.add(Date.now() - startDispatch);
        break;
      } else if (data.status === 'failed') {
        videoRenderSuccess.add(0);
        break;
      }
    }
  }

  if (!isComplete && attempts >= maxAttempts) {
    videoRenderSuccess.add(0);
  }
}

export function s3MultipartWorkflow() {
  const partCount = 3;
  const chunkSize = 5 * 1024 * 1024; // 5 MB
  const totalSizeBytes = partCount * chunkSize;

  const initiatePayload = JSON.stringify({
    filename: `bench_raw_${__VU}_${__ITER}.mp4`,
    file_size_bytes: totalSizeBytes,
    content_type: 'video/mp4',
    part_count: partCount,
  });

  const initRes = http.post(`${BASE_URL}/api/v1/storage/multipart/initiate`, initiatePayload, {
    headers: commonHeaders,
    tags: { name: 'InitiateMultipart' },
  });

  const initOk = check(initRes, {
    'multipart initiated (200)': (r) => r.status === 200,
    'upload_id returned': (r) => JSON.parse(r.body).upload_id !== undefined,
  });

  if (!initOk) {
    s3UploadSuccess.add(0);
    return;
  }

  const { upload_id, key, parts } = JSON.parse(initRes.body);
  const completedParts = [];
  const syntheticChunk = '0'.repeat(chunkSize);

  let allPartsSucceeded = true;
  for (let i = 0; i < parts.length; i++) {
    const partInfo = parts[i];
    const chunkStart = Date.now();

    const uploadRes = http.put(partInfo.upload_url, syntheticChunk, {
      headers: { 'Content-Type': 'video/mp4' },
      tags: { name: 'UploadChunk' },
    });

    const chunkOk = check(uploadRes, {
      'chunk upload successful (200)': (r) => r.status === 200,
      'etag header returned': (r) => r.headers['Etag'] !== undefined || r.headers['ETag'] !== undefined,
    });

    if (chunkOk) {
      s3ChunkUploadTime.add(Date.now() - chunkStart);
      const rawEtag = uploadRes.headers['Etag'] || uploadRes.headers['ETag'];
      completedParts.push({ PartNumber: partInfo.part_number, ETag: rawEtag.replace(/"/g, '') });
    } else {
      allPartsSucceeded = false;
      break;
    }
  }

  if (!allPartsSucceeded) {
    s3UploadSuccess.add(0);
    return;
  }

  const completePayload = JSON.stringify({ upload_id, key, parts: completedParts });
  const completeRes = http.post(`${BASE_URL}/api/v1/storage/multipart/complete`, completePayload, {
    headers: commonHeaders,
    tags: { name: 'CompleteMultipart' },
  });

  const finalized = check(completeRes, { 'multipart finalized (200)': (r) => r.status === 200 });
  s3UploadSuccess.add(finalized ? 1 : 0);
  sleep(1);
}

export function websocketCollabWorkflow() {
  const roomId = `video_timeline_bench_${__VU % 5}`;
  const url = `${WS_URL}?room=${roomId}`;

  const res = ws.connect(url, {}, function (socket) {
    activeWsConnections.add(1);

    socket.on('open', function () {
      socket.setInterval(function () {
        const sendTimestamp = Date.now();
        socket.send(JSON.stringify({
          type: 'cursor_sync',
          user_id: `vu_${__VU}`,
          timestamp: sendTimestamp,
          timeline_position_sec: (Math.random() * 15).toFixed(2),
          active_track: 'b_roll_visuals',
        }));
      }, 500);
    });

    socket.on('message', function (data) {
      try {
        const msg = JSON.parse(data);
        if (msg.timestamp) {
          wsRoundtripLatency.add(Date.now() - msg.timestamp);
        }
      } catch (e) {
        // Raw binary Yjs sync updates pass through without a JSON timestamp.
      }
    });

    socket.on('close', function () {
      activeWsConnections.add(-1);
    });

    socket.on('error', function () {
      activeWsConnections.add(-1);
    });

    socket.setTimeout(function () {
      socket.close();
    }, 30000);
  });

  check(res, { 'websocket handshake established (101)': (r) => r && r.status === 101 });
}
