# Paperclip to Pixel Agents bridge

This daemon translates live Paperclip heartbeat state into Pixel Agents hook
events. It does not fork Pixel Agents; it posts to the standalone hook server
described by `~/.pixel-agents/server.json`.

## Start

Run Pixel Agents on a port that does not collide with Paperclip:

```sh
npx pixel-agents --port 3200
```

In this repo, start the bridge:

```sh
node agent-board/pixel-bridge/bridge.mjs
```

```sh
node agent-board/pixel-bridge/bridge.mjs \
  --paperclip-url http://127.0.0.1:3100 \
  --company-id 39ac6e67-5742-41b1-b88f-ed52dbfacbb9 \
  --poll-ms 5000
```

The bridge also reads `PAPERCLIP_API_URL`, `PAPERCLIP_API_KEY`,
`PAPERCLIP_COMPANY_ID`, `PIXEL_AGENTS_SERVER_JSON`, `PIXEL_BRIDGE_CWD`, and
`PIXEL_BRIDGE_POLL_MS`.

## Behavior

- Paperclip `queued` or `running` heartbeat run: sends `SessionStart` once for
  that agent, then `PreToolUse(Edit)` so the Pixel Agents character types.
- Paperclip `succeeded` heartbeat run: sends `Stop` so the character stops.
- Paperclip failed or cancelled run, or agent `error` status: sends
  `Notification(idle_prompt)` so Pixel Agents shows a waiting bubble.

Session IDs are stable per Paperclip agent: `paperclip-<agent-id>`.

## Verification

With both Pixel Agents and the bridge running, invoke Narin:

```sh
curl -s -X POST \
  http://127.0.0.1:3100/api/agents/71c19d1b-c6f0-4ed2-b2f7-68bffed9cd47/heartbeat/invoke \
  -H "Content-Type: application/json" \
  -d "{}"
```

Expected result: Narin appears in Pixel Agents, starts typing within about one
poll interval, and stops after the Paperclip heartbeat run succeeds.
