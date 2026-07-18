/**
 * Voice-announce logic for new online orders — the framework-free core so it can
 * be unit-tested without React/antd/supabase (OrderAlerts.tsx wires it to the
 * real chime, speechSynthesis and localStorage). Nothing here touches the DOM at
 * module load; the only browser references are inside createSpeaker(), and even
 * those are injectable so the queue/​speaker are fully testable in Node.
 */

/** localStorage flag for the header toggle. Default OFF (anything but '1'). */
export const VOICE_STORAGE_KEY = 'ofu-voice-announce';

/**
 * The Thai line spoken for a new order. Drops the "N รายการ" tail whenever the
 * count is unknown/invalid so it can never say "undefined รายการ" or "0 รายการ".
 */
export function buildAnnouncement(
  orderNumber: string,
  itemCount: number | null | undefined,
): string {
  const base = `ออเดอร์เข้าแล้ว รหัส ${orderNumber}`;
  if (typeof itemCount === 'number' && Number.isFinite(itemCount) && itemCount > 0) {
    return `${base} ${itemCount} รายการ`;
  }
  return base;
}

export type AnnounceDeps = {
  /** Speak and resolve when the utterance ends (or gives up quietly). */
  speak: (text: string) => Promise<void>;
  delay: (ms: number) => Promise<void>;
  /** Read fresh each time — reflects the header toggle without a re-subscribe. */
  isEnabled: () => boolean;
  log?: (msg: string) => void;
  /** Silence between the (caller's) chime and the speech. */
  gapMs?: number;
  /** Backlog past which extra orders are announced silently (no speech). */
  maxQueue?: number;
};

export type AnnounceQueue = {
  /** Queue the DELAYED speech for one order. The caller chimes separately and
   *  immediately — the chime must never wait on this queue. */
  enqueue: (makeText: () => Promise<string | null>) => Promise<void>;
  /** Invalidate everything still pending (call on unmount/logout) so nothing is
   *  spoken for a session that has ended. The queue stays usable after — a new
   *  mount's enqueues run normally. */
  dispose: () => void;
};

/**
 * FIFO speech queue. Each order runs `gap → count → speak`, one at a time, so
 * two voices never overlap and a later order never speaks over an earlier one.
 * The CHIME is NOT here: the caller rings it immediately per order, so a stuck
 * or slow utterance can never delay or swallow the next order's alert. When more
 * than `maxQueue` orders are already waiting, the extras are silent (no speech)
 * — a burst of 20 must not monologue.
 *
 * `makeText` runs lazily, only when the order is actually going to be spoken, so
 * the item-count query is skipped for the silent (backlog / muted) orders.
 */
export function createAnnounceQueue(deps: AnnounceDeps): AnnounceQueue {
  const gap = deps.gapMs ?? 700;
  const max = deps.maxQueue ?? 5;
  let tail: Promise<void> = Promise.resolve();
  let pending = 0;
  // Bumped by dispose(); an order captured under an older generation stops
  // before it speaks, so a logout can't announce into the next session.
  let generation = 0;

  function enqueue(makeText: () => Promise<string | null>): Promise<void> {
    const gen = generation;
    pending += 1;
    // Decided at arrival: a synchronous burst increments `pending` before any
    // task runs, so orders 6+ of a 7-order burst see pending > max and go silent.
    const dropSpeech = pending > max;
    tail = tail
      .then(async () => {
        if (dropSpeech) {
          deps.log?.(`voice-announce: backlog > ${max}, chimed only (dropped speech for 1 order)`);
          return;
        }
        if (gen !== generation) return; // disposed (logout) before we ran
        if (!deps.isEnabled()) return; // toggle off: the chime already rang, stay silent
        await deps.delay(gap);
        if (gen !== generation) return; // disposed during the gap
        const text = await makeText();
        if (gen !== generation || !text) return; // disposed during the count query
        await deps.speak(text);
      })
      .catch(() => {
        /* one order's failure must never break the chain for the next */
      })
      .finally(() => {
        pending -= 1;
      });
    return tail;
  }

  return { enqueue, dispose: () => { generation += 1; } };
}

export type SpeakerOpts = {
  /** Watchdog ceiling before the utterance is abandoned so the queue can move
   *  on. Number, or a function of the text. Default: clamp(3s..10s) by length. */
  watchdogMs?: number | ((text: string) => number);
  /** Injectable for tests — defaults to `new SpeechSynthesisUtterance(text)`. */
  makeUtterance?: (text: string) => SpeechSynthesisUtterance;
  /** Injectable for tests — defaults to the first `th*` voice from getVoices(). */
  findThaiVoice?: (synth: SpeechSynthesis) => SpeechSynthesisVoice | null;
};

const defaultWatchdog = (text: string) => Math.min(10_000, Math.max(3_000, text.length * 120));

/**
 * Wrap speechSynthesis into a speak() that:
 *  - degrades silently when TTS is absent OR the device has no Thai voice — it
 *    resolves WITHOUT speaking rather than reading Thai in a wrong-language
 *    voice or staying accidentally silent (Blocking 3),
 *  - never leaves the FIFO queue stuck: a watchdog resolves the promise (and
 *    cancels the utterance) if the engine never fires onend/onerror, and a
 *    `done` guard makes a late onend after the watchdog a harmless no-op
 *    (Blocking 2),
 *  - resolves exactly once, when the utterance ends, errors, or times out.
 */
export function createSpeaker(
  synth: SpeechSynthesis | undefined | null,
  opts: SpeakerOpts = {},
): (text: string) => Promise<void> {
  const makeUtterance = opts.makeUtterance ?? ((t: string) => new SpeechSynthesisUtterance(t));
  const findThaiVoice =
    opts.findThaiVoice ??
    ((s: SpeechSynthesis) =>
      (s.getVoices?.() ?? []).find((v) => v.lang?.toLowerCase().startsWith('th')) ?? null);
  const watchdog = opts.watchdogMs ?? defaultWatchdog;

  return (text: string) =>
    new Promise<void>((resolve) => {
      let done = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (done) return; // Blocking 2: a late onend/onerror after the watchdog is a no-op
        done = true;
        if (timer) clearTimeout(timer);
        resolve();
      };
      try {
        if (!synth) {
          finish();
          return;
        }
        const voice = findThaiVoice(synth);
        if (!voice) {
          finish(); // Blocking 3: no Thai voice → skip speech, do not read in a random voice
          return;
        }
        const u = makeUtterance(text);
        u.lang = 'th-TH';
        u.voice = voice;
        u.onend = finish;
        u.onerror = finish;
        const ms = typeof watchdog === 'function' ? watchdog(text) : watchdog;
        timer = setTimeout(() => {
          try {
            synth.cancel?.();
          } catch {
            /* ignore */
          }
          finish();
        }, ms);
        synth.speak(u);
      } catch {
        finish();
      }
    });
}
