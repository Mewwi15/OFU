/**
 * Voice-announce logic for new online orders — the framework-free core so it can
 * be unit-tested without React/antd/supabase (OrderAlerts.tsx wires it to the
 * real chime, speechSynthesis and localStorage). Nothing here touches the DOM at
 * module load; the only browser reference is inside createSpeaker(), evaluated
 * only when a real speaker is used.
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
  /** Always rung, in order, for every announced order. */
  chime: () => void;
  /** Speak and resolve when the utterance ends (or gives up quietly). */
  speak: (text: string) => Promise<void>;
  delay: (ms: number) => Promise<void>;
  /** Read fresh each time — reflects the header toggle without a re-subscribe. */
  isEnabled: () => boolean;
  log?: (msg: string) => void;
  /** Silence between the chime and the speech. */
  gapMs?: number;
  /** Backlog past which extra orders chime only (no speech). */
  maxQueue?: number;
};

/**
 * FIFO announce queue. Each order runs `chime → gap → speak` and the next order
 * waits for the previous to finish, so two voices never overlap and a later
 * order never speaks over an earlier one. When more than `maxQueue` orders are
 * already waiting, the extras chime only — a burst of 20 must not monologue.
 *
 * Returns `enqueue(makeText)`. `makeText` is called lazily, only when the order
 * is actually going to be spoken (not dropped, toggle on), so the item-count
 * query is skipped for chime-only and muted orders.
 */
export function createAnnounceQueue(deps: AnnounceDeps) {
  const gap = deps.gapMs ?? 700;
  const max = deps.maxQueue ?? 5;
  let tail: Promise<void> = Promise.resolve();
  let pending = 0;

  return function enqueue(makeText: () => Promise<string | null>): Promise<void> {
    pending += 1;
    // Decided at arrival: a synchronous burst increments `pending` before any
    // task runs, so orders 6+ of a 7-order burst see pending > max and drop.
    const dropSpeech = pending > max;
    tail = tail
      .then(async () => {
        deps.chime();
        if (dropSpeech) {
          deps.log?.(`voice-announce: backlog > ${max}, chimed only (dropped speech for 1 order)`);
          return;
        }
        if (!deps.isEnabled()) return; // toggle off: the chime already rang, stay silent
        await deps.delay(gap);
        const text = await makeText();
        if (text) await deps.speak(text);
      })
      .catch(() => {
        /* one order's failure must never break the chain for the next */
      })
      .finally(() => {
        pending -= 1;
      });
    return tail;
  };
}

/**
 * Wrap speechSynthesis so a missing engine — or a device with no Thai voice —
 * degrades silently instead of throwing (the chime + notification still fire).
 * Resolves when the utterance ends, errors, or immediately if TTS is absent.
 */
export function createSpeaker(
  synth: SpeechSynthesis | undefined | null,
): (text: string) => Promise<void> {
  return (text: string) =>
    new Promise<void>((resolve) => {
      try {
        if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
          resolve();
          return;
        }
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'th-TH';
        u.onend = () => resolve();
        // No Thai voice / interrupted / any engine error → give up quietly.
        u.onerror = () => resolve();
        synth.speak(u);
      } catch {
        resolve();
      }
    });
}
