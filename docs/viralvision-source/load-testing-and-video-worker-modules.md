// tests/load/k6_distributed_benchmark.js
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// --- Custom Telemetry Metrics ---
const videoGenLatency = new Trend('viralvision_video_gen_duration_ms');
const videoRenderSuccess = new Rate('viralvision_video_render_success_rate');
const s3ChunkUploadTime = new Trend('viralvision_s3_chunk_upload_ms');
const s3UploadSuccess = new Rate('viralvision_s3_upload_success_rate');
const wsRoundtripLatency = new Trend('viralvision_ws_roundtrip_latency_ms');
const activeWsConnections = new Counter('viralvision_active_ws_connections');

// --- Configuration & Thresholds ---
const BASE_URL = __ENV.TARGET_URL || 'https://api.viralvision.io';
const WS_URL = __ENV.WS_TARGET_URL || 'wss://collab.viralvision.io/ws';
const API_KEY = __ENV.API_KEY || 'vv_live_loadtest_secret_token_4411';

export const options = {
  scenarios: {
    // 1. Asynchronous Video Generation & Polling Workflow
    video_generation: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 100,
      stages: [
        { duration: '1m', target: 5 },   // Ramp up to 5 jobs/sec
        { duration: '3m', target: 15 },  // Peak load: 15 jobs/sec
        { duration: '1m', target: 0 },   // Cool-down
      ],
      exec: 'videoGenerationWorkflow',
    },

    // 2. S3 / Storage Lake Resumable Multipart Uploads
    s3_multipart_upload: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },  // Ramp to 10 concurrent uploaders
        { duration: '3m', target: 30 },  // Peak to 30 concurrent uploaders
        { duration: '1m', target: 0 },
      ],
      exec: 's3MultipartWorkflow',
    },

    // 3. Real-Time Collaborative Timeline WebSocket Pressure
    websocket_timeline_collab: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      exec: 'websocketCollabWorkflow',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<800', 'p(99)<2000'],
    'viralvision_video_render_success_rate': ['rate>0.98'],
    'viralvision_s3_upload_success_rate': ['rate>0.99'],
    'viralvision_s3_chunk_upload_ms': ['p(95)<1200'],
    'viralvision_ws_roundtrip_latency_ms': ['p(95)<75', 'p(99)<150'],
  },
};

const commonHeaders = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
};

// ==========================================
// Scenario 1: Video Generation & Polling
// ==========================================
export function videoGenerationWorkflow() {
  const payload = JSON.stringify({
    topic: '3 high-leverage terminal hacks for engineers',
    brand_context: 'developer_tools',
    target_platform: 'tiktok',
    quality_tier: 'standard',
    duration_seconds: 15,
    voice_id: '21m00Tcm4TlvDq8ikWAM',
  });

  const startDispatch = Date.now();
  const initRes = http.post(`${BASE_URL}/api/v1/videos/generate`, payload, {
    headers: commonHeaders,
    tags: { name: 'DispatchVideoGeneration' },
  });

  const dispatched = check(initRes, {
    'video dispatch accepted (202)': (r) => r.status === 202,
    'job_id present': (r) => JSON.parse(r.body).job_id !== undefined,
  });

  if (!dispatched) {
    videoRenderSuccess.add(0);
    return;
  }

  const jobId = JSON.parse(initRes.body).job_id;
  let isComplete = false;
  let attempts = 0;
  const maxAttempts = 30; // 30 * 2s = 60s timeout threshold

  while (!isComplete && attempts < maxAttempts) {
    sleep(2);
    attempts++;

    const pollRes = http.get(`${BASE_URL}/api/v1/videos/${jobId}/status`, {
      headers: commonHeaders,
      tags: { name: 'PollVideoStatus' },
    });

    if (pollRes.status === 200) {
      const data = JSON.parse(pollRes.body);
      if (data.status === 'completed') {
        isComplete = true;
        videoRenderSuccess.add(1);
        videoGenLatency.add(Date.now() - startDispatch);
        break;
      } else if (data.status === 'failed') {
        videoRenderSuccess.add(0);
        break;
      }
    }
  }

  if (!isComplete && attempts >= maxAttempts) {
    videoRenderSuccess.add(0);
  }
}

// ==========================================
// Scenario 2: S3 Multipart Video Ingestion
// ==========================================
export function s3MultipartWorkflow() {
  const partCount = 3;
  const chunkSize = 5 * 1024 * 1024; // 5 MB chunks
  const totalSizeBytes = partCount * chunkSize;

  // 1. Initiate Multipart Session
  const initiatePayload = JSON.stringify({
    filename: `bench_raw_${__VU}_${__ITER}.mp4`,
    file_size_bytes: totalSizeBytes,
    content_type: 'video/mp4',
    part_count: partCount,
  });

  const initRes = http.post(
    `${BASE_URL}/api/v1/storage/multipart/initiate`,
    initiatePayload,
    { headers: commonHeaders, tags: { name: 'InitiateMultipart' } }
  );

  const initOk = check(initRes, {
    'multipart initiated (200)': (r) => r.status === 200,
    'upload_id returned': (r) => JSON.parse(r.body).upload_id !== undefined,
  });

  if (!initOk) {
    s3UploadSuccess.add(0);
    return;
  }

  const { upload_id, key, parts } = JSON.parse(initRes.body);
  const completedParts = [];
  const syntheticChunk = '0'.repeat(chunkSize); // 5 MB allocation

  // 2. Upload Chunks via Presigned URLs
  let allPartsSucceeded = true;
  for (let i = 0; i < parts.length; i++) {
    const partInfo = parts[i];
    const chunkStart = Date.now();

    const uploadRes = http.put(partInfo.upload_url, syntheticChunk, {
      headers: { 'Content-Type': 'video/mp4' },
      tags: { name: 'UploadChunk' },
    });

    const chunkOk = check(uploadRes, {
      'chunk upload successful (200)': (r) => r.status === 200,
      'etag header returned': (r) => r.headers['Etag'] !== undefined || r.headers['ETag'] !== undefined,
    });

    if (chunkOk) {
      s3ChunkUploadTime.add(Date.now() - chunkStart);
      const rawEtag = uploadRes.headers['Etag'] || uploadRes.headers['ETag'];
      completedParts.push({
        PartNumber: partInfo.part_number,
        ETag: rawEtag.replace(/"/g, ''),
      });
    } else {
      allPartsSucceeded = false;
      break;
    }
  }

  if (!allPartsSucceeded) {
    s3UploadSuccess.add(0);
    return;
  }

  // 3. Finalize Multipart Assembly
  const completePayload = JSON.stringify({
    upload_id: upload_id,
    key: key,
    parts: completedParts,
  });

  const completeRes = http.post(
    `${BASE_URL}/api/v1/storage/multipart/complete`,
    completePayload,
    { headers: commonHeaders, tags: { name: 'CompleteMultipart' } }
  );

  const finalized = check(completeRes, {
    'multipart finalized (200)': (r) => r.status === 200,
  });

  s3UploadSuccess.add(finalized ? 1 : 0);
  sleep(1);
}

// ==========================================
// Scenario 3: Collaborative Timeline WebSockets
// ==========================================
export function websocketCollabWorkflow() {
  const roomId = `video_timeline_bench_${__VU % 5}`; // Map VUs across 5 shared rooms
  const url = `${WS_URL}?room=${roomId}`;

  const res = ws.connect(url, {}, function (socket) {
    activeWsConnections.add(1);

    socket.on('open', function () {
      // Periodic operational transform synchronization
      socket.setInterval(function () {
        const sendTimestamp = Date.now();
        const payload = JSON.stringify({
          type: 'cursor_sync',
          user_id: `vu_${__VU}`,
          timestamp: sendTimestamp,
          timeline_position_sec: (Math.random() * 15).toFixed(2),
          active_track: 'b_roll_visuals',
        });

        socket.send(payload);
      }, 500); // 2 ops/sec per collaborator
    });

    socket.on('message', function (data) {
      try {
        const msg = JSON.parse(data);
        if (msg.timestamp) {
          wsRoundtripLatency.add(Date.now() - msg.timestamp);
        }
      } catch (e) {
        // Raw binary Yjs updates pass through without JSON timestamps
      }
    });

    socket.on('close', function () {
      activeWsConnections.add(-1);
    });

    socket.on('error', function (e) {
      activeWsConnections.add(-1);
    });

    // Hold persistent connection for 30 seconds
    socket.setTimeout(function () {
      socket.close();
    }, 30000);
  });

  check(res, {
    'websocket handshake established (101)': (r) => r && r.status === 101,
  });
}

Distributed Kubernetes Deployment Manifest (k8s/testing/k6-testrun.yaml)
Run this distributed test plan across Kubernetes clusters using the official Grafana k6-operator.
apiVersion: k6.io/v1alpha1
kind: TestRun
metadata:
  name: viralvision-peak-benchmark
  namespace: load-testing
spec:
  parallelism: 4 # Distributes test across 4 generator pods
  script:
    configMap:
      name: k6-benchmark-script
      file: load_test.js
  runner:
    image: grafana/k6:0.50.0
    resources:
      limits:
        cpu: "2"
        memory: 2Gi
      requests:
        cpu: "500m"
        memory: 512Mi
    env:
      - name: TARGET_URL
        value: "https://api.viralvision.io"
      - name: WS_TARGET_URL
        value: "wss://collab.viralvision.io/ws"
      - name: API_KEY
        valueFrom:
          secretKeyRef:
            name: benchmark-credentials
            key: api-key

Execution Instructions
1. Local Execution (Direct CLI)
# Export runtime environment endpoints
export TARGET_URL="http://localhost:8000"
export WS_TARGET_URL="ws://localhost:1234/ws"
export API_KEY="vv_live_official_creator_token_8899"

# Execute test suite
k6 run tests/load/k6_distributed_benchmark.js

2. Distributed Cluster Execution (k6-operator)
# Create ConfigMap from test file
kubectl create namespace load-testing --dry-run=client -o yaml | kubectl apply -f -
kubectl create configmap k6-benchmark-script \
  --from-file=load_test.js=tests/load/k6_distributed_benchmark.js \
  -n load-testing

# Create execution secret
kubectl create secret generic benchmark-credentials \
  --from-literal=api-key="vv_live_admin_master_key_889900" \
  -n load-testing

# Start the distributed test run
kubectl apply -f k8s/testing/k6-testrun.yaml

# Tail distributed generator logs
kubectl logs -f -l app=k6 -n load-testing

Semantic B-Roll Search & OpenCLIP pgvector Engine (clip_matcher.py)
Embeds textual visual prompts into 512-dimensional vector space using OpenCLIP (ViT-B-32) and executes fast cosine similarity lookups against indexed B-roll catalogs using the PostgreSQL HNSW index.
import os
import torch
import open_clip
from typing import List, Dict, Any, Optional
from PIL import Image
from sqlalchemy import text
from sqlalchemy.orm import Session
from database import SessionLocal

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CLIP_MODEL_NAME = "ViT-B-32"
CLIP_PRETRAINED = "laion2b_s34b_b79k"

# Lazy-loaded singleton pattern for model weights
_clip_model = None
_clip_preprocess = None
_clip_tokenizer = None

def get_clip_engine():
    global _clip_model, _clip_preprocess, _clip_tokenizer
    if _clip_model is None:
        model, _, preprocess = open_clip.create_model_and_transforms(
            CLIP_MODEL_NAME,
            pretrained=CLIP_PRETRAINED,
            device=DEVICE
        )
        tokenizer = open_clip.get_tokenizer(CLIP_MODEL_NAME)
        _clip_model = model.eval()
        _clip_preprocess = preprocess
        _clip_tokenizer = tokenizer
    return _clip_model, _clip_preprocess, _clip_tokenizer

class SemanticClipMatcher:
    @classmethod
    def encode_text_prompt(cls, prompt: str) -> List[float]:
        """Encodes descriptive scene text into normalized 512-d OpenCLIP embeddings."""
        model, _, tokenizer = get_clip_engine()
        with torch.no_grad():
            text_tokens = tokenizer([prompt]).to(DEVICE)
            text_features = model.encode_text(text_tokens)
            text_features /= text_features.norm(dim=-1, keepdim=True)
            return text_features.cpu().numpy()[0].tolist()

    @classmethod
    def encode_image_frame(cls, image_path: str) -> List[float]:
        """Encodes a video frame bitmap into normalized 512-d OpenCLIP embeddings."""
        model, preprocess, _ = get_clip_engine()
        with torch.no_grad():
            image = Image.open(image_path).convert("RGB")
            tensor = preprocess(image).unsqueeze(0).to(DEVICE)
            image_features = model.encode_image(tensor)
            image_features /= image_features.norm(dim=-1, keepdim=True)
            return image_features.cpu().numpy()[0].tolist()

    @classmethod
    def find_best_b_roll(
        cls,
        db: Session,
        visual_prompt: str,
        min_duration_seconds: float = 3.0,
        limit: int = 5,
        exclude_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Executes an HNSW index vector cosine distance query (<=>) in PostgreSQL.
        Returns the top matching stock clips matching the storyboard direction.
        """
        embedding = cls.encode_text_prompt(visual_prompt)
        embedding_str = f"[{','.join(str(x) for x in embedding)}]"

        exclude_clause = ""
        params: Dict[str, Any] = {
            "embedding": embedding_str,
            "min_duration": min_duration_seconds,
            "limit": limit,
        }

        if exclude_ids:
            exclude_clause = "AND id NOT IN :exclude_ids"
            params["exclude_ids"] = tuple(exclude_ids)

        query = text(f"""
            SELECT 
                id,
                file_url,
                duration_seconds,
                tags,
                1 - (embedding <=> :embedding::vector) AS similarity_score
            FROM b_roll_library
            WHERE duration_seconds >= :min_duration
            {exclude_clause}
            ORDER BY embedding <=> :embedding::vector ASC
            LIMIT :limit;
        """)

        results = db.execute(query, params).fetchall()

        matches = []
        for row in results:
            matches.append({
                "clip_id": row.id,
                "file_url": row.file_url,
                "duration_seconds": float(row.duration_seconds),
                "tags": row.tags,
                "similarity_score": round(float(row.similarity_score), 4),
            })

        return matches

Computer Vision Smart 9:16 Re-Framing Engine (crop_engine.py)
Processes landscape (16:9) footage using MediaPipe Face Detection to extract active subject coordinates. It applies exponential moving average (EMA) trajectory smoothing to eliminate jitter, producing dynamic FFmpeg crop parameters.
import os
import cv2
import numpy as np
import subprocess
from typing import Tuple, List, Dict, Any

try:
    import mediapipe as mp
    mp_face_detection = mp.solutions.face_detection
except ImportError:
    mp = None
    mp_face_detection = None

class SmartCropEngine:
    TARGET_ASPECT_RATIO = 9 / 16  # Vertical Short-Form format

    def __init__(self, smoothing_alpha: float = 0.08):
        """
        smoothing_alpha: Weight given to new frame center coordinates.
        Lower values (e.g. 0.05-0.10) produce slow, cinematic camera panning.
        """
        self.alpha = smoothing_alpha

    def analyze_speaker_centroid_trajectory(
        self,
        video_path: str,
        sample_step_frames: int = 5
    ) -> Tuple[int, int, List[float]]:
        """
        Samples video frames to compute the smoothed horizontal tracking position of the speaker.
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Unable to read input video: {video_path}")

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        default_center_x = width / 2.0
        smoothed_center_x = default_center_x
        center_x_timeline = []

        if mp_face_detection is None:
            # Fallback to center-crop if MediaPipe is not installed
            cap.release()
            return width, height, [default_center_x] * total_frames

        with mp_face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5) as detector:
            current_frame_idx = 0
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                if current_frame_idx % sample_step_frames == 0:
                    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    results = detector.process(rgb_frame)

                    if results.detections:
                        # Identify the primary/largest face in frame
                        largest_box_area = 0
                        target_x = smoothed_center_x

                        for detection in results.detections:
                            bbox = detection.location_data.relative_bounding_box
                            box_w = bbox.width * width
                            box_h = bbox.height * height
                            area = box_w * box_h

                            if area > largest_box_area:
                                largest_box_area = area
                                target_x = (bbox.xmin + bbox.width / 2.0) * width

                        # Apply exponential moving average to prevent camera snapping
                        smoothed_center_x = (self.alpha * target_x) + ((1.0 - self.alpha) * smoothed_center_x)

                center_x_timeline.append(smoothed_center_x)
                current_frame_idx += 1

        cap.release()
        return width, height, center_x_timeline

    def generate_ffmpeg_smart_crop_filter(self, video_path: str) -> str:
        """
        Calculates 9:16 target bounding box and returns the FFmpeg video filter expression.
        """
        src_w, src_h, center_x_series = self.analyze_speaker_centroid_trajectory(video_path)

        target_w = int(src_h * self.TARGET_ASPECT_RATIO)
        target_h = src_h

        # Ensure target width does not exceed source video boundaries
        target_w = min(target_w, src_w)
        # Ensure dimensions are even numbers for H.264/H.265 compatibility
        target_w -= target_w % 2

        # Average horizontal position across entire video duration
        mean_center_x = float(np.mean(center_x_series)) if center_x_series else src_w / 2.0

        # Calculate crop X offset within bounds: [0, src_w - target_w]
        crop_x = int(mean_center_x - (target_w / 2.0))
        crop_x = max(0, min(src_w - target_w, crop_x))
        crop_x -= crop_x % 2

        return f"crop={target_w}:{target_h}:{crop_x}:0,scale=1080:1920"

    def execute_reframing(self, input_video: str, output_video: str) -> str:
        """Executes hardware-assisted cropping to deliver a vertical 1080x1920 MP4."""
        filter_str = self.generate_ffmpeg_smart_crop_filter(input_video)

        cmd = [
            "ffmpeg", "-y",
            "-i", input_video,
            "-vf", filter_str,
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "22",
            "-c:a", "copy",
            "-movflags", "+faststart",
            output_video
        ]

        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"Smart-crop execution failed:\n{res.stderr}")

        return output_video

Procedural Foley SFX Synchronization Engine (foley.py)
Detects scene cut timestamps and keyword transients to dynamically layer, delay, and balance Foley sound effects (whooshes, pops, impacts, risers) into the final master audio mix.
import os
import subprocess
from typing import List, Optional
from pydantic import BaseModel, Field

FOLEY_ASSET_DIR = os.getenv("FOLEY_ASSET_DIR", "/var/viralvision/assets/foley")

class SFXEvent(BaseModel):
    sfx_type: str = Field(..., description="'whoosh', 'pop', 'impact', 'riser', 'click'")
    timestamp: float = Field(..., ge=0.0, description="Exact delay point in seconds")
    volume: float = Field(0.4, ge=0.0, le=1.5, description="Relative gain adjustment")

class FoleyMixEngine:
    SFX_SAMPLE_MAP = {
        "whoosh": "whoosh_high_velocity.wav",
        "pop": "bubble_pop_transient.wav",
        "impact": "cinematic_sub_drop.wav",
        "riser": "tension_riser_2s.wav",
        "click": "interface_mechanical_click.wav",
    }

    def __init__(self, ffmpeg_bin: str = "ffmpeg"):
        self.ffmpeg_bin = ffmpeg_bin

    def build_sfx_filtergraph(
        self,
        base_audio_path: str,
        events: List[SFXEvent],
        output_audio_path: str,
    ) -> List[str]:
        """
        Builds an FFmpeg filtergraph combining base audio stems with time-delayed SFX events.
        """
        cmd = [self.ffmpeg_bin, "-y", "-i", base_audio_path]

        filter_nodes = []
        input_indices = []

        for idx, event in enumerate(events, start=1):
            filename = self.SFX_SAMPLE_MAP.get(event.sfx_type, "whoosh_high_velocity.wav")
            asset_path = os.path.join(FOLEY_ASSET_DIR, filename)

            # Fallback path if assets directory is unmounted
            if not os.path.exists(asset_path):
                asset_path = f"/tmp/{filename}"

            cmd.extend(["-i", asset_path])

            delay_ms = int(event.timestamp * 1000)
            node_label = f"sfx_{idx}"

            # Apply millisecond channel delays and custom volume attenuation
            filter_nodes.append(
                f"[{idx}:a]adelay={delay_ms}|{delay_ms},volume={event.volume}[{node_label}]"
            )
            input_indices.append(f"[{node_label}]")

        # Mix the primary audio track ([0:a]) with all delayed sound effect stems
        amix_inputs = len(events) + 1
        all_inputs = "[0:a]" + "".join(input_indices)
        filter_nodes.append(
            f"{all_inputs}amix=inputs={amix_inputs}:duration=first:dropout_transition=0[final_foley_out]"
        )

        filter_complex_str = ";".join(filter_nodes)

        cmd.extend([
            "-filter_complex", filter_complex_str,
            "-map", "[final_foley_out]",
            "-c:a", "aac",
            "-b:a", "192k",
            "-ar", "48000",
            output_audio_path
        ])

        return cmd

    def execute_mix(
        self,
        base_audio_path: str,
        events: List[SFXEvent],
        output_audio_path: str,
    ) -> str:
        """Executes foley stem generation and exports the final audio composite."""
        if not events:
            # Bypass processing if no sound effects are scheduled
            return base_audio_path

        cmd = self.build_sfx_filtergraph(base_audio_path, events, output_audio_path)
        res = subprocess.run(cmd, capture_output=True, text=True)

        if res.returncode != 0:
            raise RuntimeError(f"Foley mix pipeline failed:\n{res.stderr}")

        return output_audio_path

Client-Side In-Browser Draft Pre-Renderer Hook (hooks/useClientPreRenderer.ts)
Provides in-browser video rendering using @ffmpeg/ffmpeg WebAssembly. Users can preview cuts, watermarks, and subtitle placement with zero server rendering cost before submitting paid render jobs.
"use client";

import { useState, useRef, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

export interface ClientRenderOptions {
  videoFileUrl: string;
  subtitlesAssText?: string;
  watermarkUrl?: string;
  targetDurationSeconds?: number;
}

export function useClientPreRenderer() {
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ffmpegRef = useRef<FFmpeg | null>(null);

  const load = useCallback(async () => {
    if (ffmpegRef.current) return;

    try {
      const ffmpeg = new FFmpeg();
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

      // Load multithreaded WASM core binaries
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });

      ffmpeg.on("progress", ({ progress }) => {
        setProgress(Math.min(100, Math.round(progress * 100)));
      });

      ffmpegRef.current = ffmpeg;
      setIsReady(true);
    } catch (err: any) {
      setError(`Failed to initialize WebAssembly FFmpeg: ${err.message}`);
    }
  }, []);

  const renderDraftPreview = useCallback(
    async ({
      videoFileUrl,
      subtitlesAssText,
      watermarkUrl,
      targetDurationSeconds = 10,
    }: ClientRenderOptions): Promise<string | null> => {
      setIsRendering(true);
      setProgress(0);
      setError(null);

      try {
        if (!ffmpegRef.current) {
          await load();
        }
        const ffmpeg = ffmpegRef.current!;

        // 1. Write video source into virtual FS
        await ffmpeg.writeFile("input.mp4", await fetchFile(videoFileUrl));

        const commandArgs = ["-i", "input.mp4"];
        let filterChain = "scale=540:960"; // 540p lightweight draft resolution

        // 2. Write and overlay watermark logo if present
        if (watermarkUrl) {
          await ffmpeg.writeFile("watermark.png", await fetchFile(watermarkUrl));
          commandArgs.push("-i", "watermark.png");
          filterChain =
            "[0:v]scale=540:960[base];[1:v]scale=80:-1[wm];[base][wm]overlay=W-w-20:H-h-20";
        }

        // 3. Write kinetic subtitle script if present
        if (subtitlesAssText) {
          await ffmpeg.writeFile("subs.ass", subtitlesAssText);
          filterChain += ",ass=subs.ass";
        }

        commandArgs.push(
          "-t", targetDurationSeconds.toString(),
          "-vf", filterChain,
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-crf", "30",
          "-c:a", "aac",
          "-b:a", "96k",
          "preview.mp4"
        );

        // Run client-side transcode
        await ffmpeg.exec(commandArgs);

        // 4. Extract deliverable blob from virtual FS
        const data = (await ffmpeg.readFile("preview.mp4")) as Uint8Array;
        const blob = new Blob([data.buffer], { type: "video/mp4" });
        const url = URL.createObjectURL(blob);

        setPreviewUrl(url);
        return url;
      } catch (err: any) {
        setError(err.message || "WASM draft transcode failed.");
        return null;
      } finally {
        setIsRendering(false);
      }
    },
    [load]
  );

  return {
    isReady,
    isRendering,
    progress,
    previewUrl,
    error,
    load,
    renderDraftPreview,
  };
}

# ab_testing.py
import os
import time
import uuid
import numpy as np
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import redis

from database import get_db
from models import ABExperiment, VideoVariant, VideoFile
from auth import get_current_user

router = APIRouter(prefix="/api/v1/ab", tags=["A/B Testing & Dynamic Optimization"])

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

# ---------------------------------------------------------------------------
# Bayesian Thompson Sampling Hyperparameters
# ---------------------------------------------------------------------------
# Beta prior parameters Beta(alpha_0, beta_0). Alpha=1, Beta=1 yields a standard Uniform(0, 1) prior.
DEFAULT_ALPHA_PRIOR = 1.0
DEFAULT_BETA_PRIOR = 1.0
MIN_IMPRESSIONS_FOR_WINNER = 100
WINNER_PROBABILITY_THRESHOLD = 0.95
MONTE_CARLO_SIMULATION_DRAWS = 10000

# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------
class CreateExperimentPayload(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    duration_hours: int = Field(default=72, ge=1, le=720)
    variants: List[Dict[str, str]] = Field(
        ...,
        min_items=2,
        description="List of dicts containing 'variant_label', 'hook_type', and 'video_file_id'",
    )

class InteractionEventPayload(BaseModel):
    experiment_id: str
    variant_id: str
    event_type: str = Field(..., regex="^(impression|hook_view_3s|completion|share)$")

class VariantAnalyticsReport(BaseModel):
    variant_id: str
    variant_label: str
    hook_type: str
    video_file_id: str
    impressions: int
    hook_views_3s: int
    conversion_rate_3s: float
    completions: int
    shares: int
    posterior_alpha: float
    posterior_beta: float
    probability_of_being_optimal: float
    credible_interval_95: Tuple[float, float]

class ExperimentStatusReport(BaseModel):
    experiment_id: str
    title: str
    status: str
    winner_variant_id: Optional[str]
    has_converged: bool
    total_impressions: int
    variants: List[VariantAnalyticsReport]

# ---------------------------------------------------------------------------
# Core Thompson Sampling Multi-Armed Bandit Engine
# ---------------------------------------------------------------------------
class BayesianBanditRouter:
    @staticmethod
    def _redis_keys(experiment_id: str, variant_id: str) -> Tuple[str, str]:
        base = f"ab:{experiment_id}:var:{variant_id}"
        return f"{base}:impressions", f"{base}:hook_views"

    @classmethod
    def get_variant_counts(
        cls, db: Session, experiment_id: str, variant: VideoVariant
    ) -> Tuple[int, int]:
        """
        Retrieves impressions and 3-second successes using a fast read-through
        pattern against Redis counters, falling back to PostgreSQL if unavailable.
        """
        imp_key, hook_key = cls._redis_keys(experiment_id, variant.id)
        try:
            pipe = redis_client.pipeline()
            pipe.get(imp_key)
            pipe.get(hook_key)
            cached_imp, cached_hook = pipe.execute()

            if cached_imp is not None and cached_hook is not None:
                return int(cached_imp), int(cached_hook)

            # Initialize Redis cache with database ground truth
            impressions = variant.impressions
            hook_views = variant.hook_views_3s

            pipe = redis_client.pipeline()
            pipe.set(imp_key, impressions, ex=86400 * 7)
            pipe.set(hook_key, hook_views, ex=86400 * 7)
            pipe.execute()

            return impressions, hook_views
        except redis.RedisError:
            return variant.impressions, variant.hook_views_3s

    @classmethod
    def select_variant_for_impression(
        cls, db: Session, experiment_id: str
    ) -> Optional[VideoVariant]:
        """
        Samples conversion probabilities from Beta posteriors and routes traffic
        to the variant with the maximum sampled payoff:
        theta_k ~ Beta(alpha_0 + successes_k, beta_0 + failures_k)
        selected_arm = argmax_k(theta_k)
        """
        experiment = db.query(ABExperiment).filter(ABExperiment.id == experiment_id).first()
        if not experiment or experiment.status not in ["active", "concluded"]:
            return None

        variants: List[VideoVariant] = (
            db.query(VideoVariant).filter(VideoVariant.experiment_id == experiment_id).all()
        )
        if not variants:
            return None

        # Short-circuit to the declared winner if the experiment is finalized
        if experiment.winner_variant_id:
            for v in variants:
                if v.id == experiment.winner_variant_id:
                    cls.record_event(db, experiment_id, v.id, "impression")
                    return v

        sampled_payoffs: List[float] = []
        for variant in variants:
            impressions, successes = cls.get_variant_counts(db, experiment_id, variant)
            failures = max(0, impressions - successes)

            alpha_posterior = DEFAULT_ALPHA_PRIOR + successes
            beta_posterior = DEFAULT_BETA_PRIOR + failures

            # Draw sample from Beta distribution
            sample = np.random.beta(alpha_posterior, beta_posterior)
            sampled_payoffs.append(sample)

        # Select arm with the highest posterior draw
        chosen_idx = int(np.argmax(sampled_payoffs))
        selected_variant = variants[chosen_idx]

        cls.record_event(db, experiment_id, selected_variant.id, "impression")
        return selected_variant

    @classmethod
    def record_event(
        cls, db: Session, experiment_id: str, variant_id: str, event_type: str
    ) -> None:
        """
        Increments Redis atomic counters for real-time routing decisions
        and logs events to PostgreSQL.
        """
        imp_key, hook_key = cls._redis_keys(experiment_id, variant_id)

        try:
            if event_type == "impression":
                redis_client.incr(imp_key)
            elif event_type == "hook_view_3s":
                redis_client.incr(hook_key)
        except redis.RedisError:
            pass

        # Update persistent database records
        variant = db.query(VideoVariant).filter(VideoVariant.id == variant_id).first()
        if not variant:
            return

        if event_type == "impression":
            variant.impressions += 1
        elif event_type == "hook_view_3s":
            variant.hook_views_3s += 1
        elif event_type == "completion":
            variant.completions += 1
        elif event_type == "share":
            variant.shares += 1

        if variant.impressions > 0:
            variant.engagement_rate = round(
                (variant.hook_views_3s / variant.impressions) * 100.0, 2
            )

        db.commit()

    @classmethod
    def compute_bayesian_statistics(
        cls, db: Session, experiment_id: str
    ) -> Tuple[List[VariantAnalyticsReport], bool, Optional[str]]:
        """
        Executes Monte Carlo simulation over the joint posterior distributions to calculate
        the probability that each variant is optimal: P(theta_i > max_{j != i} theta_j).
        """
        variants: List[VideoVariant] = (
            db.query(VideoVariant).filter(VideoVariant.experiment_id == experiment_id).all()
        )
        if not variants:
            return [], False, None

        posterior_params: List[Tuple[float, float]] = []
        variant_stats = []

        for v in variants:
            imp, succ = cls.get_variant_counts(db, experiment_id, v)
            fail = max(0, imp - succ)
            alpha = DEFAULT_ALPHA_PRIOR + succ
            beta = DEFAULT_BETA_PRIOR + fail
            posterior_params.append((alpha, beta))

            # Approximate 95% Equal-Tailed Credible Interval
            ci_low = float(np.percentile(np.random.beta(alpha, beta, size=5000), 2.5))
            ci_high = float(np.percentile(np.random.beta(alpha, beta, size=5000), 97.5))
            cr = round((succ / imp) * 100.0, 2) if imp > 0 else 0.0

            variant_stats.append({
                "model": v,
                "impressions": imp,
                "successes": succ,
                "conversion_rate": cr,
                "alpha": alpha,
                "beta": beta,
                "ci": (round(ci_low, 4), round(ci_high, 4)),
            })

        # Draw M simultaneous samples for each arm to calculate win probabilities
        num_variants = len(variants)
        draws = np.zeros((MONTE_CARLO_SIMULATION_DRAWS, num_variants))

        for idx, (alpha, beta) in enumerate(posterior_params):
            draws[:, idx] = np.random.beta(alpha, beta, size=MONTE_CARLO_SIMULATION_DRAWS)

        # Count how often each variant achieves the highest draw
        winning_indices = np.argmax(draws, axis=1)
        win_probabilities = [
            float(np.mean(winning_indices == i)) for i in range(num_variants)
        ]

        reports: List[VariantAnalyticsReport] = []
        has_converged = False
        winner_id = None

        for idx, stats in enumerate(variant_stats):
            v: VideoVariant = stats["model"]
            win_prob = win_probabilities[idx]

            reports.append(
                VariantAnalyticsReport(
                    variant_id=v.id,
                    variant_label=v.variant_label,
                    hook_type=v.hook_type,
                    video_file_id=v.video_file_id,
                    impressions=stats["impressions"],
                    hook_views_3s=stats["successes"],
                    conversion_rate_3s=stats["conversion_rate"],
                    completions=v.completions,
                    shares=v.shares,
                    posterior_alpha=stats["alpha"],
                    posterior_beta=stats["beta"],
                    probability_of_being_optimal=round(win_prob, 4),
                    credible_interval_95=stats["ci"],
                )
            )

            # Check convergence threshold
            if (
                win_prob >= WINNER_PROBABILITY_THRESHOLD
                and stats["impressions"] >= MIN_IMPRESSIONS_FOR_WINNER
            ):
                has_converged = True
                winner_id = v.id

        return reports, has_converged, winner_id

# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------
@router.post("/experiments", status_code=status.HTTP_201_CREATED)
def create_ab_experiment(
    payload: CreateExperimentPayload,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates an A/B hook testing experiment with initialized variants.
    """
    exp_id = str(uuid.uuid4())
    conclude_time = datetime.now(timezone.utc) + np.timedelta64(payload.duration_hours, "h")

    experiment = ABExperiment(
        id=exp_id,
        title=payload.title,
        status="active",
        created_at=datetime.now(timezone.utc),
        concludes_at=conclude_time,
    )
    db.add(experiment)

    for item in payload.variants:
        variant = VideoVariant(
            id=str(uuid.uuid4()),
            experiment_id=exp_id,
            variant_label=item["variant_label"],
            hook_type=item["hook_type"],
            video_file_id=item["video_file_id"],
            impressions=0,
            hook_views_3s=0,
            completions=0,
            shares=0,
            engagement_rate=0.0,
        )
        db.add(variant)

    db.commit()
    return {"experiment_id": exp_id, "status": "active", "concludes_at": conclude_time}

@router.get("/experiments/{experiment_id}/route")
def route_impression(
    experiment_id: str,
    db: Session = Depends(get_db),
):
    """
    Real-time routing endpoint: draws from Beta posteriors to return
    the highest-performing video variant for the incoming impression.
    """
    variant = BayesianBanditRouter.select_variant_for_impression(db, experiment_id)
    if not variant:
        raise HTTPException(status_code=404, detail="Active experiment or variants not found")

    video = db.query(VideoFile).filter(VideoFile.id == variant.video_file_id).first()

    return {
        "experiment_id": experiment_id,
        "variant_id": variant.id,
        "variant_label": variant.variant_label,
        "hook_type": variant.hook_type,
        "video_file_id": variant.video_file_id,
        "video_url": video.output_url if video else None,
    }

@router.post("/events", status_code=status.HTTP_200_OK)
def log_interaction_event(
    payload: InteractionEventPayload,
    db: Session = Depends(get_db),
):
    """
    Logs downstream viewer actions (3-second hook retention, completion, share).
    """
    BayesianBanditRouter.record_event(
        db=db,
        experiment_id=payload.experiment_id,
        variant_id=payload.variant_id,
        event_type=payload.event_type,
    )
    return {"status": "recorded"}

@router.get("/experiments/{experiment_id}/status", response_model=ExperimentStatusReport)
def get_experiment_telemetry(
    experiment_id: str,
    db: Session = Depends(get_db),
):
    """
    Calculates Bayesian win probabilities, credible intervals, and convergence status.
    """
    experiment = db.query(ABExperiment).filter(ABExperiment.id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    reports, has_converged, winner_id = BayesianBanditRouter.compute_bayesian_statistics(
        db, experiment_id
    )

    # Check if we should conclude the experiment
    if has_converged and experiment.status == "active":
        experiment.status = "concluded"
        experiment.winner_variant_id = winner_id
        db.commit()

    total_imp = sum(r.impressions for r in reports)

    return ExperimentStatusReport(
        experiment_id=experiment.id,
        title=experiment.title,
        status=experiment.status,
        winner_variant_id=experiment.winner_variant_id or winner_id,
        has_converged=has_converged,
        total_impressions=total_imp,
        variants=reports,
    )

// app/dashboard/experiments/[id]/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BanditTelemetryCard,
  VariantData,
  BanditTelemetryProps,
} from "@/components/analytics/BanditTelemetryCard";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
  Loader2,
} from "lucide-react";

interface ExperimentStatusResponse {
  experiment_id: string;
  title: string;
  status: "active" | "concluded" | "paused";
  winner_variant_id: string | null;
  has_converged: boolean;
  total_impressions: number;
  variants: VariantData[];
}

export default function ExperimentMonitoringPage() {
  const params = useParams();
  const router = useRouter();
  const experimentId = params.id as string;

  const [data, setData] = useState<ExperimentStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const fetchStatus = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      try {
        const res = await fetch(`/api/v1/ab/experiments/${experimentId}/status`, {
          cache: "no-store",
        });

        if (!res.ok) {
          if (res.status === 404) throw new Error("Experiment ID not found");
          throw new Error(`Failed to load experiment (Status: ${res.status})`);
        }

        const json: ExperimentStatusResponse = await res.json();
        setData(json);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Network error loading experiment status.");
      } finally {
        setLoading(false);
        if (isManualRefresh) setRefreshing(false);
      }
    },
    [experimentId]
  );

  // Initial fetch and automatic polling interval
  useEffect(() => {
    fetchStatus();

    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchStatus();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [fetchStatus, autoRefresh]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-neutral-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-xs font-mono">Loading posterior Beta telemetry...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-neutral-100 min-h-screen space-y-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="text-xs text-neutral-400 hover:text-white">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Dashboard
          </Button>
        </Link>
        <div className="p-6 bg-rose-950/40 border border-rose-800 rounded-2xl flex items-start gap-4">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-rose-200">Unable to Load Experiment</h3>
            <p className="text-xs text-rose-300 font-mono">{error || "Experiment not found"}</p>
            <Button
              size="sm"
              onClick={() => fetchStatus(true)}
              className="mt-3 bg-rose-900/60 hover:bg-rose-900 border border-rose-700 text-xs"
            >
              Retry Connection
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8 text-neutral-100 min-h-screen space-y-8">
      {/* Navigation & Operational Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
        <div className="space-y-1">
          <Link href="/dashboard">
            <span className="text-xs text-neutral-400 hover:text-amber-400 transition-colors flex items-center gap-1 font-mono mb-2">
              <ArrowLeft className="w-3 h-3" /> Back to Analytics
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight">{data.title}</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold border ${
                data.status === "concluded"
                  ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                  : data.status === "active"
                  ? "bg-amber-950/60 border-amber-800 text-amber-300"
                  : "bg-neutral-900 border-neutral-800 text-neutral-400"
              }`}
            >
              {data.status}
            </span>
          </div>
          <span className="text-xs text-neutral-500 font-mono block">
            Experiment ID: {data.experiment_id}
          </span>
        </div>

        {/* Polling & Control Center */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all flex items-center gap-1.5 ${
              autoRefresh
                ? "bg-neutral-900 border-neutral-800 text-emerald-400"
                : "bg-neutral-950 border-neutral-800 text-neutral-500"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-neutral-600"
              }`}
            />
            {autoRefresh ? "Live Polling (5s)" : "Polling Paused"}
          </button>

          <Button
            size="sm"
            variant="outline"
            disabled={refreshing}
            onClick={() => fetchStatus(true)}
            className="border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-xs font-mono"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Link href={`/dashboard/generate?experiment_id=${data.experiment_id}`}>
            <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Deploy New Variant
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary Bayesian Bandit Telemetry Visualizer */}
      <BanditTelemetryCard
        experimentId={data.experiment_id}
        title={data.title}
        status={data.status}
        winnerVariantId={data.winner_variant_id}
        hasConverged={data.has_converged}
        totalImpressions={data.total_impressions}
        variants={data.variants}
      />

      {/* Variant Media Inspector Cards */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-wide flex items-center gap-2">
          <Layers className="w-4 h-4 text-neutral-400" /> Active Creative Assets & Hook Breakdowns
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.variants.map((variant) => {
            const isWinner = variant.variant_id === data.winner_variant_id;
            return (
              <div
                key={variant.variant_id}
                className={`bg-neutral-950 border rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all ${
                  isWinner
                    ? "border-emerald-500/80 shadow-lg shadow-emerald-500/10"
                    : "border-neutral-800 hover:border-neutral-700"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
                      Variant {variant.variant_label}
                    </span>
                    {isWinner ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-[10px] font-mono text-emerald-300 font-bold uppercase flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Winner
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono uppercase text-neutral-500">
                        {variant.hook_type}
                      </span>
                    )}
                  </div>

                  {/* Thumbnail / Video Placeholder Container */}
                  <div className="w-full aspect-[9/16] bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden relative flex flex-col items-center justify-center group">
                    <div className="absolute inset-0 bg-neutral-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Link href={`/dashboard/renders/${variant.video_file_id}`}>
                        <Button size="sm" className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs">
                          <Play className="w-3.5 h-3.5 mr-1" /> View Video
                        </Button>
                      </Link>
                    </div>
                    <span className="text-[11px] font-mono text-neutral-500">Video Asset</span>
                    <span className="text-[10px] font-mono text-neutral-600 truncate max-w-[80%]">
                      {variant.video_file_id}
                    </span>
                  </div>

                  {/* Key Metrics Snapshot */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800/80 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-neutral-500 uppercase block">Traffic</span>
                      <strong className="text-white">{variant.impressions.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-500 uppercase block">3s Ret. Rate</span>
                      <strong className="text-amber-400">{variant.conversion_rate_3s.toFixed(1)}%</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-neutral-500">Arm Probability</span>
                  <span
                    className={`font-bold ${
                      variant.probability_of_being_optimal >= 0.95
                        ? "text-emerald-400"
                        : variant.probability_of_being_optimal >= 0.5
                        ? "text-amber-400"
                        : "text-neutral-400"
                    }`}
                  >
                    {(variant.probability_of_being_optimal * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

Audio VAD Segmentation & Long-Form Video Repurposing Engine (repurpose.py)
Processes long-form recordings (podcasts, webinars, interviews) using acoustic Voice Activity Detection (Silero VAD) and Anthropic Claude Opus to extract viral segment timestamps, crop to 9:16, and compile punchy standalone video drafts.
import os
import subprocess
import torch
import json
from typing import List, Dict, Any
from anthropic import AsyncAnthropic
from pydantic import BaseModel, Field

anthropic_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

class ExtractedClip(BaseModel):
    title: str
    start_time: float
    end_time: float
    duration: float
    viral_hook_score: float = Field(..., ge=0.0, le=100.0)
    topic_summary: str
    suggested_headline: str

class VideoRepurposingEngine:
    def __init__(self, sample_rate: int = 16000):
        self.sample_rate = sample_rate
        # Load Torch Silero VAD model
        self.vad_model, utils = torch.hub.load(
            repo_or_dir="snakers4/silero-vad",
            model="silero_vad",
            force_reload=False,
            onnx=False
        )
        (self.get_speech_timestamps, _, self.read_audio, _, _) = utils

    def extract_speech_windows(self, audio_wav_path: str) -> List[Dict[str, float]]:
        """
        Runs neural Voice Activity Detection to detect contiguous speech blocks
        and remove long silences, pauses, and mic pops.
        """
        wav = self.read_audio(audio_wav_path, sampling_rate=self.sample_rate)
        speech_timestamps = self.get_speech_timestamps(
            wav,
            self.vad_model,
            sampling_rate=self.sample_rate,
            threshold=0.5,
            min_speech_duration_ms=250,
            min_silence_duration_ms=300
        )

        # Convert sample counts to seconds
        windows = []
        for stamp in speech_timestamps:
            windows.append({
                "start": round(stamp["start"] / self.sample_rate, 2),
                "end": round(stamp["end"] / self.sample_rate, 2)
            })
        return windows

    async def identify_viral_moments(
        self,
        transcript_with_timestamps: List[Dict[str, Any]],
        target_clip_count: int = 3
    ) -> List[ExtractedClip]:
        """
        Submits full transcription chunks with second timestamps to Claude Opus 4.6
        to locate self-contained, high-tension conversational segments (15-60 seconds).
        """
        formatted_transcript = "\n".join([
            f"[{t['start']:.1f}s - {t['end']:.1f}s]: {t['text']}"
            for t in transcript_with_timestamps
        ])

        prompt = f"""You are a master short-form video editor specializing in repurposing long-form podcasts into viral TikToks and YouTube Shorts.
Analyze this timestamped transcript and extract the top {target_clip_count} highest-converting viral moments.

Criteria:
1. Duration: strictly between 20 and 55 seconds.
2. Must have a compelling standalone hook in the first 3 seconds.
3. Must convey a complete, high-value thought (no trailing thoughts or abrupt cuts).

Transcript:
{formatted_transcript}

Respond ONLY with valid JSON matching this schema:
[
  {{
    "title": "Short descriptive title",
    "start_time": 12.5,
    "end_time": 45.0,
    "duration": 32.5,
    "viral_hook_score": 94.2,
    "topic_summary": "Why traditional networking is completely obsolete",
    "suggested_headline": "Stop Handing Out Business Cards"
  }}
]
"""
        response = await anthropic_client.messages.create(
            model="claude-opus-4-6",
            max_tokens=2000,
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}]
        )

        content = response.content[0].text.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

        data = json.loads(content)
        return [ExtractedClip(**item) for item in data]

    @staticmethod
    def slice_subclip(
        input_video_path: str,
        output_subclip_path: str,
        start_sec: float,
        end_sec: float
    ) -> str:
        """
        Cuts exact subclip without re-encoding video stream whenever keyframes permit,
        or performs an exact frame-accurate cut.
        """
        duration = end_sec - start_sec
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start_sec),
            "-i", input_video_path,
            "-t", str(duration),
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "20",
            "-c:a", "aac",
            "-b:a", "192k",
            "-avoid_negative_ts", "1",
            output_subclip_path
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"FFmpeg slice failed:\n{res.stderr}")
        return output_subclip_path

FastAPI Content Repurposing Router (repurpose_routes.py)
Handles long-form video URL ingestion, background audio extraction, transcript extraction via Whisper, viral segment analysis, and automated child-job queueing.
import os
import uuid
import subprocess
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from pydantic import BaseModel, HttpUrl
from sqlalchemy.orm import Session

from database import get_db
from models import VideoFile, User, WorkspaceRole
from auth import get_current_user, RoleChecker
from repurpose import VideoRepurposingEngine
from subtitles import KineticSubtitleGenerator
from tasks import process_video_task

router = APIRouter(prefix="/api/v1/repurpose", tags=["Video Repurposing & VAD"])

class RepurposeRequestPayload(BaseModel):
    source_video_url: HttpUrl
    target_clips: int = 3
    brand_kit_id: str | None = None

@router.post("/extract-clips", status_code=status.HTTP_202_ACCEPTED)
async def start_repurposing_job(
    payload: RepurposeRequestPayload,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(RoleChecker(WorkspaceRole.EDITOR)),
    db: Session = Depends(get_db)
):
    parent_job_id = str(uuid.uuid4())

    # Store parent record
    parent_video = VideoFile(
        id=parent_job_id,
        user_id=current_user.id,
        quality_tier="standard",
        status="processing",
        source_url=str(payload.source_video_url),
        brand_kit_id=payload.brand_kit_id
    )
    db.add(parent_video)
    db.commit()

    background_tasks.add_task(
        execute_repurposing_pipeline,
        parent_job_id=parent_job_id,
        user_id=current_user.id,
        source_url=str(payload.source_video_url),
        target_clips=payload.target_clips,
        brand_kit_id=payload.brand_kit_id
    )

    return {
        "parent_job_id": parent_job_id,
        "status": "processing",
        "message": "Long-form VAD analysis and transcription scheduled"
    }

def execute_repurposing_pipeline(
    parent_job_id: str,
    user_id: str,
    source_url: str,
    target_clips: int,
    brand_kit_id: str | None
):
    import asyncio
    from database import SessionLocal

    db = SessionLocal()
    work_dir = f"/tmp/repurpose_{parent_job_id}"
    os.makedirs(work_dir, exist_ok=True)

    raw_video_path = os.path.join(work_dir, "input.mp4")
    raw_audio_path = os.path.join(work_dir, "audio.wav")

    try:
        # 1. Download source video
        dl_cmd = ["curl", "-sL", source_url, "-o", raw_video_path]
        subprocess.run(dl_cmd, check=True)

        # 2. Extract 16kHz mono audio for VAD and Whisper
        extract_audio_cmd = [
            "ffmpeg", "-y", "-i", raw_video_path,
            "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
            raw_audio_path
        ]
        subprocess.run(extract_audio_cmd, check=True)

        # 3. Transcribe with word timestamps
        sub_engine = KineticSubtitleGenerator(model_size="base")
        words = sub_engine.transcribe_with_words(raw_audio_path)

        # Reconstruct timestamped segments (group by ~5 second utterances)
        transcript_segments = []
        current_chunk = []
        for w in words:
            current_chunk.append(w)
            if current_chunk[-1]["end"] - current_chunk[0]["start"] >= 5.0 or w["word"].endswith((".", "!", "?")):
                transcript_segments.append({
                    "start": current_chunk[0]["start"],
                    "end": current_chunk[-1]["end"],
                    "text": " ".join([item["word"] for item in current_chunk])
                })
                current_chunk = []

        if current_chunk:
            transcript_segments.append({
                "start": current_chunk[0]["start"],
                "end": current_chunk[-1]["end"],
                "text": " ".join([item["word"] for item in current_chunk])
            })

        # 4. Analyze viral windows with Claude Opus
        repurposer = VideoRepurposingEngine()
        clips = asyncio.run(repurposer.identify_viral_moments(
            transcript_with_timestamps=transcript_segments,
            target_clip_count=target_clips
        ))

        # 5. Extract subclips and dispatch child transcode jobs
        for idx, clip in enumerate(clips):
            subclip_id = str(uuid.uuid4())
            subclip_path = os.path.join(work_dir, f"clip_{idx}.mp4")

            repurposer.slice_subclip(
                input_video_path=raw_video_path,
                output_subclip_path=subclip_path,
                start_sec=clip.start_time,
                end_sec=clip.end_time
            )

            # Ingest child video record
            child_video = VideoFile(
                id=subclip_id,
                user_id=user_id,
                quality_tier="standard",
                status="queued",
                source_url=f"file://{subclip_path}",
                brand_kit_id=brand_kit_id,
                duration_seconds=clip.duration
            )
            db.add(child_video)
            db.commit()

            # Enqueue into Celery standard transcode queue for 9:16 crop & kinetic styling
            process_video_task.apply_async(args=[subclip_id], queue="standard_jobs")

        # Mark parent job finished
        parent = db.query(VideoFile).filter(VideoFile.id == parent_job_id).first()
        if parent:
            parent.status = "completed"
            db.commit()

    except Exception as exc:
        parent = db.query(VideoFile).filter(VideoFile.id == parent_job_id).first()
        if parent:
            parent.status = "failed"
            parent.error_summary = str(exc)
            db.commit()
    finally:
        db.close()

Next.js Long-Form Repurposing Studio (app/dashboard/repurpose/page.tsx)
Enables creators to paste a long-form video URL (YouTube, Vimeo, S3), define target clip parameters, inspect AI-identified hook candidates, and batch-render vertical shorts.
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Scissors,
  Sparkles,
  Link2,
  Sliders,
  Play,
  ArrowRight,
  Clock,
  CheckCircle2,
  Loader2,
  Film
} from "lucide-react";

interface ClipPreview {
  title: string;
  start_time: number;
  end_time: number;
  duration: number;
  viral_hook_score: number;
  topic_summary: string;
  suggested_headline: string;
}

export default function VideoRepurposeStudio() {
  const [sourceUrl, setSourceUrl] = useState("");
  const [targetClips, setTargetClips] = useState(3);
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  // Simulated extracted preview list
  const [previewClips, setPreviewClips] = useState<ClipPreview[]>([
    {
      title: "Why Code Reviews Fail",
      start_time: 142.5,
      end_time: 178.0,
      duration: 35.5,
      viral_hook_score: 96.4,
      topic_summary: "Explains how synchronous pull request bottlenecks kill developer flow state.",
      suggested_headline: "The Silent Killer of Engineering Teams",
    },
    {
      title: "The Zero-Meeting Playbook",
      start_time: 420.0,
      end_time: 462.5,
      duration: 42.5,
      viral_hook_score: 91.8,
      topic_summary: "Details the asynchronous documentation habit that eliminated 15 hours of recurring meetings.",
      suggested_headline: "How We Killed 15 Hours of Meetings Weekly",
    },
  ]);

  const handleStartExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceUrl.trim()) return;

    setIsProcessing(true);
    try {
      const res = await fetch("/api/v1/repurpose/extract-clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_video_url: sourceUrl,
          target_clips: targetClips,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setJobId(data.parent_job_id);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8 text-neutral-100 min-h-screen space-y-8">
      {/* Studio Header */}
      <div>
        <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest flex items-center gap-1">
          <Scissors className="w-3.5 h-3.5" /> AI Acoustic Extraction & Re-framing
        </span>
        <h1 className="text-3xl font-black mt-1">Long-Form Video Repurposer</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Turn podcasts, product demos, and keynotes into high-retention 9:16 vertical shorts automatically.
        </p>
      </div>

      {/* Input Configuration Card */}
      <div className="p-6 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-4">
        <form onSubmit={handleStartExtraction} className="space-y-4">
          <div>
            <label className="text-xs uppercase font-semibold text-neutral-400 block mb-1">
              Source Video URL (MP4, S3, or Stream Endpoint)
            </label>
            <div className="relative">
              <Link2 className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
              <input
                type="url"
                required
                placeholder="https://storage.viralvision.io/recordings/podcast-ep44.mp4"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-neutral-100 font-mono outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:w-1/3">
              <label className="text-xs uppercase font-semibold text-neutral-400 block mb-1">
                Target Clips to Extract
              </label>
              <select
                value={targetClips}
                onChange={(e) => setTargetClips(parseInt(e.target.value, 10))}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none"
              >
                <option value={1}>1 Viral Clip</option>
                <option value={3}>3 Viral Clips (Recommended)</option>
                <option value={5}>5 Viral Clips</option>
                <option value={10}>10 Batch Clips</option>
              </select>
            </div>

            <div className="w-full sm:w-2/3 sm:pt-5">
              <Button
                type="submit"
                disabled={isProcessing || !sourceUrl.trim()}
                className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs py-2.5 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Analyzing Voice Activity & Hooks...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Extract Viral Clips
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Extracted Candidates Display */}
      {previewClips.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-wide flex items-center gap-2">
              <Film className="w-4 h-4 text-amber-400" /> Extracted High-Retention Moments ({previewClips.length})
            </h3>
            <span className="text-xs font-mono text-emerald-400">9:16 Smart-Crop Active</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {previewClips.map((clip, idx) => (
              <div
                key={idx}
                className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-neutral-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {clip.start_time}s - {clip.end_time}s ({clip.duration}s)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 text-[10px] font-mono text-emerald-300 font-bold">
                      {clip.viral_hook_score} Hook Score
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-white">{clip.suggested_headline}</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">{clip.topic_summary}</p>
                </div>

                <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-neutral-500">Preset: Fast Kinetic Text</span>
                  <Button size="sm" className="bg-neutral-100 hover:bg-white text-neutral-950 font-bold text-xs">
                    Render Subclip <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

