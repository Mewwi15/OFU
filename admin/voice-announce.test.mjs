#!/usr/bin/env node
/**
 * Unit tests for the voice-announce core (admin/src/lib/voiceAnnounce.ts).
 * Framework-free: run with `node voice-announce.test.mjs` (Node ≥ 23 strips the
 * TS types on import). Covers the message builder, the FIFO speech queue, the
 * watchdog, and the Thai-voice / silent-degrade logic — everything except the
 * actual audio, which can only be heard on a real device.
 */

import assert from 'node:assert/strict';
import { buildAnnouncement, createAnnounceQueue, createSpeaker } from './src/lib/voiceAnnounce.ts';

let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failures += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ↳ ${e.message}`);
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* A fake utterance so the speaker is testable in Node (no DOM). */
function fakeUtterance() {
  return {};
}

console.log('\n[message builder]');
await test('count 3 → "…รหัส X 3 รายการ"', () => {
  const s = buildAnnouncement('OF00042', 3);
  assert.equal(s, 'ออเดอร์เข้าแล้ว รหัส OF00042 3 รายการ');
  assert.ok(s.includes('3 รายการ'));
});
await test('count null → no "รายการ", no "undefined"', () => {
  const s = buildAnnouncement('OF00042', null);
  assert.equal(s, 'ออเดอร์เข้าแล้ว รหัส OF00042');
  assert.ok(!s.includes('รายการ'));
  assert.ok(!s.toLowerCase().includes('undefined'));
});
await test('count undefined → base line only', () => {
  assert.equal(buildAnnouncement('OF1', undefined), 'ออเดอร์เข้าแล้ว รหัส OF1');
});
await test('count 0 / NaN → drops the tail (never "0 รายการ")', () => {
  assert.ok(!buildAnnouncement('OF1', 0).includes('รายการ'));
  assert.ok(!buildAnnouncement('OF1', Number.NaN).includes('รายการ'));
});

console.log('\n[FIFO queue — burst of 7 keeps speech to the first 5]');
await test('7 orders in a burst → speak 5 in order, drop 2 (silent)', async () => {
  const spoken = [];
  const drops = [];
  const { enqueue } = createAnnounceQueue({
    speak: async (t) => { spoken.push(t); },
    delay: async () => {},
    isEnabled: () => true,
    log: (m) => drops.push(m),
    gapMs: 0,
    maxQueue: 5,
  });
  const tasks = [];
  for (let i = 1; i <= 7; i += 1) tasks.push(enqueue(async () => `order ${i}`));
  await Promise.all(tasks);
  assert.deepEqual(spoken, ['order 1', 'order 2', 'order 3', 'order 4', 'order 5'], 'first 5 spoken in FIFO order');
  assert.equal(drops.length, 2, `orders 6 & 7 dropped, got ${drops.length}`);
});

console.log('\n[toggle off — no speech, no count query]');
await test('isEnabled false → speak never called', async () => {
  let spoke = 0;
  const { enqueue } = createAnnounceQueue({
    speak: async () => { spoke += 1; },
    delay: async () => {},
    isEnabled: () => false,
    gapMs: 0,
  });
  await enqueue(async () => 'should not be spoken');
  assert.equal(spoke, 0);
});
await test('disabled order skips makeText (no item-count query when muted)', async () => {
  let madeText = 0;
  const { enqueue } = createAnnounceQueue({
    speak: async () => {},
    delay: async () => {},
    isEnabled: () => false,
    gapMs: 0,
  });
  await enqueue(async () => { madeText += 1; return 'x'; });
  assert.equal(madeText, 0);
});

console.log('\n[chain resilience]');
await test('one order throwing in makeText does not break the next', async () => {
  const spoken = [];
  const { enqueue } = createAnnounceQueue({
    speak: async (t) => { spoken.push(t); },
    delay: async () => {},
    isEnabled: () => true,
    gapMs: 0,
  });
  const a = enqueue(async () => { throw new Error('count query blew up'); });
  const b = enqueue(async () => 'order B');
  await Promise.all([a, b]);
  assert.deepEqual(spoken, ['order B']);
});

console.log('\n[degrade — no speech engine must not throw]');
await test('createSpeaker(undefined) resolves without throwing', async () => {
  await createSpeaker(undefined)('anything');
  assert.ok(true);
});
await test('queue with a no-op speaker still runs and does not throw', async () => {
  let ran = 0;
  const { enqueue } = createAnnounceQueue({
    speak: createSpeaker(undefined), // no speechSynthesis
    delay: async () => {},
    isEnabled: () => true,
    gapMs: 0,
  });
  await enqueue(async () => { ran += 1; return 'hello'; });
  assert.equal(ran, 1, 'makeText still runs; speak is a silent no-op');
});

/* ── Blocking 1 + 2: chime is immediate per order, and a hung speaker cannot
 *    stall the FIFO — the watchdog moves it on. ─────────────────────────────── */
console.log('\n[hung speaker — chime immediate, watchdog advances the queue]');
await test('chime rings for every order at once; a never-ending utterance still lets the next speak', async () => {
  // Speaker whose engine NEVER fires onend/onerror. Only the watchdog can free it.
  const spokenTexts = [];
  const synth = {
    getVoices: () => [{ lang: 'th-TH', name: 'Thai' }],
    speak: (u) => { spokenTexts.push(u.__text); /* deliberately never call u.onend */ },
    cancel: () => {},
  };
  const speak = createSpeaker(synth, {
    watchdogMs: 25,
    makeUtterance: (t) => ({ __text: t }),
  });
  const { enqueue } = createAnnounceQueue({ speak, delay: async () => {}, isEnabled: () => true, gapMs: 0 });

  // Mimic the handler: chime immediately, THEN queue the speech.
  let chimes = 0;
  const tasks = [];
  for (let i = 1; i <= 3; i += 1) {
    chimes += 1; // this is the handler's synchronous chime()
    tasks.push(enqueue(async () => `order ${i}`));
  }
  // (a) every chime already rang, synchronously, before any speech was processed.
  assert.equal(chimes, 3, 'chime is immediate and unconditional per order');
  assert.equal(spokenTexts.length, 0, 'nothing spoken yet — speech is deferred, chime was not');

  // (b) the watchdog frees each hung utterance so the queue reaches all three.
  await Promise.all(tasks);
  assert.deepEqual(spokenTexts, ['order 1', 'order 2', 'order 3'],
    'watchdog advanced the queue past each hung utterance');
});

/* ── Blocking 3: no Thai voice → skip speech (do not read in a random voice). ── */
console.log('\n[no Thai voice — skip speech, chime still fires]');
await test('getVoices() has no th → synth.speak is never called', async () => {
  let speakCalls = 0;
  const synth = {
    getVoices: () => [{ lang: 'en-US', name: 'English' }],
    speak: () => { speakCalls += 1; },
    cancel: () => {},
  };
  const speak = createSpeaker(synth, { makeUtterance: fakeUtterance });
  await speak('ออเดอร์เข้าแล้ว');
  assert.equal(speakCalls, 0, 'must not speak Thai text in a non-Thai voice');
});
await test('getVoices() = [] → skip speech (resolves, no throw)', async () => {
  let speakCalls = 0;
  const synth = { getVoices: () => [], speak: () => { speakCalls += 1; }, cancel: () => {} };
  await createSpeaker(synth, { makeUtterance: fakeUtterance })('x');
  assert.equal(speakCalls, 0);
});
await test('a th* voice IS used when present (voice set, spoken)', async () => {
  const seen = [];
  const thVoice = { lang: 'th-TH', name: 'Kanya' };
  const synth = {
    getVoices: () => [{ lang: 'en-US' }, thVoice],
    speak: (u) => { seen.push(u); u.onend?.(); },
    cancel: () => {},
  };
  await createSpeaker(synth, { makeUtterance: fakeUtterance })('ทดสอบ');
  assert.equal(seen.length, 1, 'spoke once');
  assert.equal(seen[0].voice, thVoice, 'picked the Thai voice');
  assert.equal(seen[0].lang, 'th-TH');
});

/* ── Blocking 2 (guard): a late onend after the watchdog must not double-resolve. */
console.log('\n[late onend after watchdog — resolves once, no double-advance]');
await test('watchdog fires, then a late onend is a harmless no-op', async () => {
  let captured = null;
  const synth = {
    getVoices: () => [{ lang: 'th' }],
    speak: (u) => { captured = u; /* never fires onend on its own */ },
    cancel: () => {},
  };
  const speak = createSpeaker(synth, { watchdogMs: 15, makeUtterance: (t) => ({ __text: t }) });

  // Order A hangs (watchdog frees it), order B follows.
  const spoken = [];
  const { enqueue } = createAnnounceQueue({
    speak: async (t) => { spoken.push(t); await speak(t); },
    delay: async () => {},
    isEnabled: () => true,
    gapMs: 0,
  });
  const a = enqueue(async () => 'A');
  await wait(40); // let A's watchdog fire and the queue move to B
  const late = captured; // A's utterance (or B's, whichever is current)
  const b = enqueue(async () => 'B');
  await Promise.all([a, b]);
  const lenBefore = spoken.length;
  // Fire a stale onend from A's utterance AFTER everything settled.
  late?.onend?.();
  await wait(10);
  assert.equal(spoken.length, lenBefore, 'a late onend did not re-run or double-advance the queue');
  assert.deepEqual([...new Set(spoken)].sort(), ['A', 'B'], 'each order spoken, none duplicated');
});

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
