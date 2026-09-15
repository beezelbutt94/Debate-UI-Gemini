# Collaboration server (`services/collab`)

Standalone Yjs WebSocket server backing the real-time multi-user video
timeline editor described in the design docs. Run with:

```bash
npm install
npm start   # listens on $COLLAB_PORT, default 1234
```

The Next.js app doesn't connect to this yet. The intended client is
`NEXT_PUBLIC_WS_COLLAB_URL` pointed at this server's `wss://` address,
consumed by a `CollaborativeTimeline` component and `y-websocket`'s
`WebsocketProvider` (see `docs/viralvision-source/platform-buildout-plan-and-core-engine.md`
for the reference implementation). Wiring it in is future work —
it needs the timeline UI it's meant to synchronize, which isn't part of
this scaffold.
