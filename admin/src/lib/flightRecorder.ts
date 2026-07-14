/**
 * Flight recorder — a black box for the barcode-scanner haunting.
 *
 * Records (a) every keydown the browser delivers, with key/code/modifiers,
 * inter-key gap, target and whether any handler preventDefault'ed it,
 * (b) every SPA route change, and (c) every app BOOT (full page load, with
 * whether it was a reload or a fresh navigation). Persisted in sessionStorage
 * so the tape SURVIVES full page reloads — the first copied tape came back
 * empty, which itself suggested the "jump" is a full browser navigation (the
 * SPA reboots → index route redirects to /pos). Read + copy at /scan-lab.
 *
 * Keys typed into any INPUT/TEXTAREA are recorded as REDACTED by default
 * (customer phone numbers, chat replies, tracking numbers — anything a staff
 * member deliberately types is someone's data, not scanner noise) — see
 * isSecretTarget. Only fields explicitly marked data-flight-log="true" (the
 * barcode/scan boxes this tool exists to debug) keep their raw key/code.
 */

export type FlightEvent = {
  seq: number;
  t: number; // ms since recorder start (per boot)
  kind: 'key' | 'nav' | 'boot';
  // key events
  key?: string;
  code?: string;
  mods?: string;
  gap?: number;
  target?: string;
  prevented?: boolean;
  // nav events
  path?: string;
  // boot events
  bootType?: string; // 'reload' | 'navigate' | 'back_forward' | ...
};

const MAX = 400;
const STORE_KEY = 'ofu.flightlog';
const REDACTED = '•';
let events: FlightEvent[] = [];
let seq = 0;
let started = 0;
let lastKeyT = 0;
let installed = false;

function save() {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify({ seq, events }));
  } catch {
    /* full/unavailable — keep in-memory only */
  }
}

function load() {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { seq: number; events: FlightEvent[] };
    events = parsed.events ?? [];
    seq = parsed.seq ?? 0;
  } catch {
    /* corrupted — start fresh */
  }
}

/**
 * The tape is readable (and copyable) by anyone who can open /scan-lab, so it
 * must default to redacted. Any keydown targeting an INPUT/TEXTAREA is
 * someone deliberately typing — customer phone search, chat drafts, broadcast
 * text, reject reasons, tax IDs — and stays redacted unless the field opts in
 * via data-flight-log="true" (the barcode/scan boxes on POS, Products and
 * Settings). Keydowns that land on anything else (a button, the page body —
 * where a keyboard-wedge scan lands when nothing is focused, the actual
 * phenomenon under investigation) are not text a human meant to type, so they
 * keep their raw key/code.
 */
function isSecretTarget(el: HTMLElement | null): boolean {
  if (location.pathname.startsWith('/login')) return true;
  const input = el as HTMLInputElement | null;
  if (!input) return false;
  if (input.type === 'password') return true;
  const ac = input.autocomplete ?? '';
  if (ac === 'current-password' || ac === 'new-password' || ac === 'one-time-code') return true;
  if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
    return input.dataset.flightLog !== 'true';
  }
  return false;
}

function push(e: FlightEvent) {
  events.push(e);
  if (events.length > MAX) events.shift();
  save();
}

export function recordNav(path: string) {
  if (!installed) return;
  push({ seq: ++seq, t: Math.round(performance.now() - started), kind: 'nav', path });
}

export function getFlightLog(): FlightEvent[] {
  return [...events];
}

export function clearFlightLog() {
  events = [];
  save();
}

export function formatFlightLog(): string {
  const lines = events.map((e) => {
    if (e.kind === 'boot') return `#${e.seq} ===== เปิดหน้าใหม่ (${e.bootType}) → ${e.path} =====`;
    if (e.kind === 'nav') return `#${e.seq} +${e.t}ms  >>> เปลี่ยนหน้า → ${e.path}`;
    const mods = e.mods ? `${e.mods}+` : '';
    return `#${e.seq} +${e.t}ms  key=${mods}${e.key} code=${e.code} gap=${e.gap}ms target=${e.target}${e.prevented ? ' [ถูกดักไว้]' : ''}`;
  });
  return lines.join('\n');
}

export function installFlightRecorder() {
  if (installed) return;
  installed = true;
  started = performance.now();
  load();

  // Mark this boot: a 'reload' here right after a scan = the smoking gun that
  // something performed a full browser navigation (e.g. native form submit).
  const navEntry = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  push({
    seq: ++seq,
    t: 0,
    kind: 'boot',
    bootType: navEntry?.type ?? 'unknown',
    path: location.pathname,
  });

  // Capture phase: log the raw key before any app handler can touch it.
  window.addEventListener(
    'keydown',
    (e) => {
      const now = performance.now();
      const gap = lastKeyT ? Math.round(now - lastKeyT) : 0;
      lastKeyT = now;
      const t = e.target as HTMLElement | null;
      const secret = isSecretTarget(t);
      const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.metaKey && 'Meta', e.shiftKey && 'Shift']
        .filter(Boolean)
        .join('+');
      const entry: FlightEvent = {
        seq: ++seq,
        t: Math.round(now - started),
        kind: 'key',
        key: secret ? REDACTED : e.key,
        code: secret ? REDACTED : e.code,
        mods: mods || undefined,
        gap,
        target: t ? `${t.tagName}${t.id ? '#' + t.id : ''}` : '?',
        prevented: false,
      };
      push(entry);
      // Bubble phase on the same event: see whether an app handler consumed it.
      const mark = () => {
        entry.prevented = e.defaultPrevented;
        save();
      };
      window.addEventListener('keydown', mark, { once: true });
    },
    { capture: true },
  );

  // A native <form> submission would full-reload the page (and wipe an
  // in-memory log — hence sessionStorage). Record any submit we can see.
  window.addEventListener(
    'submit',
    (e) => {
      const f = e.target as HTMLFormElement | null;
      push({
        seq: ++seq,
        t: Math.round(performance.now() - started),
        kind: 'nav',
        path: `(FORM SUBMIT${e.defaultPrevented ? ' — ถูกดักไว้' : ' — ไม่ถูกดัก!'}) ${f?.id || f?.className?.slice?.(0, 40) || ''}`,
      });
    },
    { capture: true },
  );
}
