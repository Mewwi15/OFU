#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const DEFAULT_COMPANY_ID = "39ac6e67-5742-41b1-b88f-ed52dbfacbb9";
const ACTIVE_RUN_STATUSES = new Set(["queued", "running"]);
const DONE_RUN_STATUSES = new Set(["succeeded", "failed", "cancelled"]);

const args = parseArgs(process.argv.slice(2));
const paperclipUrl = trimSlash(args.paperclipUrl || process.env.PAPERCLIP_API_URL || "http://127.0.0.1:3100");
const paperclipToken = args.paperclipToken || process.env.PAPERCLIP_API_KEY || "";
const companyId = args.companyId || process.env.PAPERCLIP_COMPANY_ID || DEFAULT_COMPANY_ID;
const workspaceCwd = args.cwd || process.env.PIXEL_BRIDGE_CWD || process.cwd();
const pollMs = Math.max(1000, Number(args.pollMs || process.env.PIXEL_BRIDGE_POLL_MS || 5000));
const providerId = args.provider || process.env.PIXEL_BRIDGE_PROVIDER || "claude";
const serverJsonPath =
  args.serverJson ||
  process.env.PIXEL_AGENTS_SERVER_JSON ||
  path.join(homedir(), ".pixel-agents", "server.json");

const sessions = new Map();
const runState = new Map();
let stopping = false;

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

main().catch((error) => {
  console.error(`[pixel-bridge] ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const pixel = await readPixelServer(serverJsonPath);
  log(`bridging Paperclip ${companyId} -> Pixel Agents ${pixel.url}/api/hooks/${providerId}`);
  log(`polling every ${pollMs}ms; cwd=${workspaceCwd}`);

  await tick(pixel, true);
  if (args.once) return;

  while (!stopping) {
    await sleep(pollMs);
    await tick(pixel, false).catch((error) => log(`poll failed: ${error.message}`));
  }
}

async function tick(pixel, firstPoll) {
  const [agents, runs] = await Promise.all([fetchPaperclipAgents(), fetchHeartbeatRuns()]);
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));

  for (const agent of agents) {
    const previous = sessions.get(agent.id);
    if (agent.status === "error" && previous?.lastAgentStatus !== "error") {
      await ensureSession(pixel, agent);
      await sendNotification(pixel, agent.id, "idle_prompt");
      log(`${agent.name || agent.id} is waiting after agent error`);
    }
    sessions.set(agent.id, { ...getSession(agent.id), lastAgentStatus: agent.status });
  }

  for (const run of [...runs].reverse()) {
    if (!run.id || !run.agentId) continue;
    const previous = runState.get(run.id);
    const agent = agentsById.get(run.agentId) || { id: run.agentId, name: run.agentId };
    const status = String(run.status || "");

    if (!previous) {
      runState.set(run.id, { status, emittedStart: false });
      if (ACTIVE_RUN_STATUSES.has(status)) {
        await emitRunStart(pixel, agent, run);
      } else if (!firstPoll && DONE_RUN_STATUSES.has(status)) {
        await emitRunStart(pixel, agent, run);
        await emitRunEnd(pixel, agent, run, status);
      }
      continue;
    }

    if (previous.status === status) continue;
    runState.set(run.id, { ...previous, status });

    if (ACTIVE_RUN_STATUSES.has(status) && !previous.emittedStart) {
      await emitRunStart(pixel, agent, run);
      continue;
    }

    if (DONE_RUN_STATUSES.has(status) && previous.emittedStart) {
      await emitRunEnd(pixel, agent, run, status);
    }
  }

  pruneRunState(runs);
}

async function emitRunStart(pixel, agent, run) {
  await ensureSession(pixel, agent);
  await postHook(pixel, {
    session_id: sessionIdFor(agent.id),
    hook_event_name: "PreToolUse",
    tool_name: "Edit",
    tool_input: {
      file_path: `paperclip://${run.id}`,
      description: `${agent.name || agent.id} heartbeat ${run.status || "started"}`,
    },
  });
  runState.set(run.id, { status: String(run.status || ""), emittedStart: true });
  log(`${agent.name || agent.id} started ${run.id}`);
}

async function emitRunEnd(pixel, agent, run, status) {
  if (status === "succeeded") {
    await postHook(pixel, {
      session_id: sessionIdFor(agent.id),
      hook_event_name: "Stop",
    });
  } else {
    await sendNotification(pixel, agent.id, "idle_prompt");
  }
  log(`${agent.name || agent.id} ${status} ${run.id}`);
}

async function ensureSession(pixel, agent) {
  const current = getSession(agent.id);
  if (current.started) return;

  await postHook(pixel, {
    session_id: sessionIdFor(agent.id),
    hook_event_name: "SessionStart",
    source: "startup",
    cwd: cwdForAgent(agent),
  });
  sessions.set(agent.id, { ...current, started: true, name: agent.name });
}

async function sendNotification(pixel, agentId, notificationType) {
  await postHook(pixel, {
    session_id: sessionIdFor(agentId),
    hook_event_name: "Notification",
    notification_type: notificationType,
  });
}

async function postHook(pixel, body) {
  const response = await fetch(`${pixel.url}/api/hooks/${providerId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${pixel.authToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Pixel Agents hook ${body.hook_event_name} failed: HTTP ${response.status}`);
  }
}

async function fetchPaperclipAgents() {
  return asArray(await paperclipGet(`/api/companies/${companyId}/agents`));
}

async function fetchHeartbeatRuns() {
  return asArray(await paperclipGet(`/api/companies/${companyId}/heartbeat-runs?limit=25`));
}

async function paperclipGet(route) {
  const headers = paperclipToken ? { Authorization: `Bearer ${paperclipToken}` } : {};
  const response = await fetch(`${paperclipUrl}${route}`, { headers });
  if (!response.ok) throw new Error(`Paperclip ${route} failed: HTTP ${response.status}`);
  return response.json();
}

async function readPixelServer(file) {
  let raw;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    throw new Error(`cannot read ${file}; start Pixel Agents first with: npx pixel-agents --port 3200`);
  }

  const parsed = JSON.parse(raw);
  const port = Number(parsed.port);
  const authToken = String(parsed.authToken || parsed.token || "");
  if (!port || !authToken) throw new Error(`${file} is missing port/authToken`);
  return { url: `http://127.0.0.1:${port}`, authToken };
}

function getSession(agentId) {
  return sessions.get(agentId) || { started: false };
}

function sessionIdFor(agentId) {
  return `paperclip-${agentId}`;
}

function cwdForAgent(agent) {
  const label = String(agent.name || agent.id)
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return path.join(workspaceCwd, ".paperclip-pixel", label || agent.id);
}

function pruneRunState(runs) {
  const liveIds = new Set(runs.map((run) => run.id).filter(Boolean));
  for (const runId of runState.keys()) {
    if (!liveIds.has(runId)) runState.delete(runId);
  }
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--once") {
      parsed.once = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      parsed[key] = argv[i + 1];
      i += 1;
    }
  }
  return parsed;
}

function trimSlash(value) {
  return String(value).replace(/\/$/, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stop() {
  stopping = true;
}

function log(message) {
  console.log(`[pixel-bridge] ${message}`);
}
