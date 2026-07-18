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
  /** How often to poll `synth.speaking` for natural completion (default 250ms). */
  pollMs?: number;
  /** Absolute last-resort ceiling for an engine that never starts or gets stuck
   *  — the ONLY case where the utterance is cancelled. Normal speech never
   *  reaches it. Default 30000ms. */
  ceilingMs?: number;
  /** Injectable for tests — defaults to `new SpeechSynthesisUtterance(text)`. */
  makeUtterance?: (text: string) => SpeechSynthesisUtterance;
  /** Injectable for tests — defaults to the first `th*` voice from getVoices(). */
  findThaiVoice?: (synth: SpeechSynthesis) => SpeechSynthesisVoice | null;
};

/**
 * Wrap speechSynthesis into a speak() that resolves when the utterance actually
 * FINISHES — it never cuts off speech that is still playing. The earlier
 * length-based watchdog did: Thai reads an order number digit-by-digit, so a
 * "…รหัส OF00042 3 รายการ" line runs past the estimated time and got cancelled
 * mid-sentence, dropping the "N รายการ" tail on a real POS.
 *
 * Completion is detected two ways:
 *  - onend/onerror → finish immediately (the normal path),
 *  - polling `synth.speaking`: once it has been speaking and then stops, finish
 *    — this covers the real Chrome bug where onend never fires on long text.
 *    `sawSpeaking` is load-bearing here: it distinguishes "hasn't started yet"
 *    (async engine start) from "finished", so the poll can't resolve early.
 *
 * The ONLY place the utterance is cancelled is the absolute ceiling (default
 * 30s). It is the single guard for both "never started" and "stuck": because
 * the ceiling CANCELS before resolving, a slow engine that would otherwise
 * begin speaking after we've moved on is silenced rather than speaking late
 * over the next order. (There is deliberately no earlier "start-grace" resolve
 * — that path resolved WITHOUT cancelling, so a late-starting utterance could
 * play out of order.) A `done` guard resolves exactly once; every
 * timer/interval is cleared on all paths.
 *
 * Still degrades silently: no TTS, or no Thai voice → resolves without speaking
 * (chime + notification carry the alert).
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
  const pollMs = opts.pollMs ?? 250;
  const ceilingMs = opts.ceilingMs ?? 30_000;

  return (text: string) =>
    new Promise<void>((resolve) => {
      let done = false;
      let sawSpeaking = false;
      let poll: ReturnType<typeof setInterval> | undefined;
      let ceilTimer: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (done) return; // resolves exactly once; a late onend after finish is a no-op
        done = true;
        if (poll) clearInterval(poll);
        if (ceilTimer) clearTimeout(ceilTimer);
        resolve();
      };
      try {
        if (!synth) {
          finish();
          return;
        }
        const voice = findThaiVoice(synth);
        if (!voice) {
          finish(); // no Thai voice → skip speech, do not read in a random voice
          return;
        }
        const u = makeUtterance(text);
        u.lang = 'th-TH';
        u.voice = voice;
        u.onend = finish; // normal, fast path
        u.onerror = finish;

        // Arm the timers BEFORE speak() so a synchronous onend inside speak()
        // (some engines fire it inline) still finds them to clear — otherwise a
        // timer created afterwards would leak. `!done` skips arming if onend has
        // already fired synchronously by now.
        if (!done) {
          // Poll for a natural finish, purely from synth.speaking (no reliance on
          // onstart/onend), so it catches Chrome dropping onend on long text
          // WITHOUT ever cancelling active speech.
          poll = setInterval(() => {
            if (synth.speaking) {
              sawSpeaking = true;
              return;
            }
            if (sawSpeaking) finish(); // it spoke and has now stopped
          }, pollMs);

          // The single guard for "never started" AND "stuck": cancel then
          // finish. Cancelling means a slow engine that would start speaking
          // after this can't play late over the next order. Normal speech
          // finishes via the poll long before this.
          ceilTimer = setTimeout(() => {
            try {
              synth.cancel?.();
            } catch {
              /* ignore */
            }
            finish();
          }, ceilingMs);
        }

        synth.speak(u);
      } catch {
        finish();
      }
    });
}
