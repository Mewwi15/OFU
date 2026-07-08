/**
 * Flight recorder — a black box for the barcode-scanner haunting.
 *
 * Records (a) every keydown the browser delivers, with key/code/modifiers,
 * inter-key gap, target and whether any handler preventDefault'ed it, and
 * (b) every route change. When the page "jumps by itself" after a scan, the
 * interleaved log shows exactly which key (or which prefix/suffix the scanner
 * secretly sends) caused it. Read + copy at /scan-lab.
 */

export type FlightEvent = {
  seq: number;
  t: number; // ms since recorder start
  kind: 'key' | 'nav';
  // key events
  key?: string;
  code?: string;
  mods?: string; // e.g. "Alt+Ctrl"
  gap?: number; // ms since previous key
  target?: string; // TAG#id
  prevented?: boolean; // set at bubble phase (after app handlers ran)
  // nav events
  path?: string;
};

const MAX = 400;
const events: FlightEvent[] = [];
let seq = 0;
let started = 0;
let lastKeyT = 0;
let installed = false;

function push(e: FlightEvent) {
  events.push(e);
  if (events.length > MAX) events.shift();
}

export function recordNav(path: string) {
  if (!installed) return;
  push({ seq: ++seq, t: Math.round(performance.now() - started), kind: 'nav', path });
}

export function getFlightLog(): FlightEvent[] {
  return [...events];
}

export function clearFlightLog() {
  events.length = 0;
}

export function formatFlightLog(): string {
  const lines = events.map((e) => {
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

  // Capture phase: log the raw key before any app handler can touch it.
  window.addEventListener(
    'keydown',
    (e) => {
      const now = performance.now();
      const gap = lastKeyT ? Math.round(now - lastKeyT) : 0;
      lastKeyT = now;
      const t = e.target as HTMLElement | null;
      const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.metaKey && 'Meta', e.shiftKey && 'Shift']
        .filter(Boolean)
        .join('+');
      const entry: FlightEvent = {
        seq: ++seq,
        t: Math.round(now - started),
        kind: 'key',
        key: e.key,
        code: e.code,
        mods: mods || undefined,
        gap,
        target: t ? `${t.tagName}${t.id ? '#' + t.id : ''}` : '?',
        prevented: false,
      };
      push(entry);
      // Bubble phase on the same event: see whether an app handler consumed it.
      const mark = () => {
        entry.prevented = e.defaultPrevented;
      };
      window.addEventListener('keydown', mark, { once: true });
    },
    { capture: true },
  );
}
