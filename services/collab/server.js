// Yjs WebSocket collaboration server for real-time multi-user timeline
// editing. Each browser tab connects to `/?room=<video-id>` and gets a
// shared Yjs document; the y-websocket utility handles the CRDT sync.
//
// Status: standalone, unwired. Nothing in the Next.js app currently
// points at this yet -- see docs/PLATFORM_ROADMAP.md for how it's meant
// to connect to components/timeline/CollaborativeTimeline.tsx.
const http = require("http");
const WebSocket = require("ws");
const { setupWSConnection } = require("y-websocket/bin/utils");

const PORT = process.env.COLLAB_PORT || 1234;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "online", timestamp: Date.now() }));
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (conn, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const docName = url.searchParams.get("room") || "default_timeline";

  setupWSConnection(conn, req, { docName, gc: true });
});

server.listen(PORT, () => {
  console.log(`Yjs collaboration server listening on port ${PORT}`);
});
