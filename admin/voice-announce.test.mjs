#!/usr/bin/env node
/**
 * Unit tests for the voice-announce core (admin/src/lib/voiceAnnounce.ts).
 * Framework-free: run with `node voice-announce.test.mjs` (Node ≥ 23 strips the
 * TS types on import). Covers the message builder, the FIFO speech queue, the
 * speaking-based completion detection (never cuts active speech), and the
 * Thai-voice / silent-degrade logic — everything except the actual audio.
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

/** A controllable speechSynthesis stand-in: `speaking` is mutable, `cancel` is
 *  counted, and `speak` stores the utterance so a test can fire onend/onerror. */
function mockSynth({ voices = [{ lang: 'th-TH', name: 'Thai' }], speaking = false } = {}) {
  return {
    _speaking: speaking,
    last: null,
    cancelCount: 0,
    get speaking() {
      return this._speaking;
    },
    set speaking(v) {
      this._speaking = v;
    },
    getVoices() {
      return voices;
    },
    speak(u) {
      this.last = u;
    },
    cancel() {
      this.cancelCount += 1;
      this._speaking = false;
    },
  };
}
const fakeUtterance = (t) => ({ __text: t });

console.log('\n[message builder]');
await test('count 3 → "…รหัส X 3 รายการ"', () => {
  assert.equal(buildAnnouncement('OF00042', 3), 'ออเดอร์เข้าแล้ว รหัส OF00042 3 รายการ');
});
await test('count null → no "รายการ", no "undefined"', () => {
  const s = buildAnnouncement('OF00042', null);
  assert.equal(s, 'ออเดอร์เข้าแล้ว รหัส OF00042');
  assert.ok(!s.includes('รายการ') && !s.toLowerCase().includes('undefined'));
});
await test('count undefined → base line only', () => {
  assert.equal(buildAnnouncement('OF1', undefined), 'ออเดอร์เข้าแล้ว รหัส OF1');
});
await test('count 0 / NaN → drops the tail (never "0 รายการ")', () => {
  assert.ok(!buildAnnouncement('OF1', 0).includes('รายการ'));
  assert.ok(!buildAnnouncement('OF1', Number.NaN).includes('รายการ'));
});

console.log('\n[FIFO queue]');
await test('burst of 7 → speak 5 in order, drop 2 (silent)', async () => {
  const spoken = [];
  const drops = [];
  const { enqueue } = createAnnounceQueue({
    speak: async (t) => { spoken.push(t); },
    delay: async () => {}, isEnabled: () => true, log: (m) => drops.push(m), gapMs: 0, maxQueue: 5,
  });
  await Promise.all(Array.from({ length: 7 }, (_, i) => enqueue(async () => `order ${i + 1}`)));
  assert.deepEqual(spoken, ['order 1', 'order 2', 'order 3', 'order 4', 'order 5']);
  assert.equal(drops.length, 2);
});
await test('toggle off → speak never called, count query skipped', async () => {
  let spoke = 0, made = 0;
  const { enqueue } = createAnnounceQueue({
    speak: async () => { spoke += 1; }, delay: async () => {}, isEnabled: () => false, gapMs: 0,
  });
  await enqueue(async () => { made += 1; return 'x'; });
  assert.equal(spoke, 0);
  assert.equal(made, 0);
});
await test('one order throwing in makeText does not break the next', async () => {
  const spoken = [];
  const { enqueue } = createAnnounceQueue({
    speak: async (t) => { spoken.push(t); }, delay: async () => {}, isEnabled: () => true, gapMs: 0,
  });
  await Promise.all([enqueue(async () => { throw new Error('boom'); }), enqueue(async () => 'B')]);
  assert.deepEqual(spoken, ['B']);
});

console.log('\n[speaker — never cuts active speech (the fix)]');
await test('speaking stays true → does NOT finish, does NOT cancel; finishes when it stops', async () => {
  const synth = mockSynth({ speaking: true }); // begins speaking immediately, never fires onend
  const speak = createSpeaker(synth, { makeUtterance: fakeUtterance, pollMs: 5, startGraceMs: 1000, ceilingMs: 5000 });
  let resolved = false;
  const p = speak('ออเดอร์เข้าแล้ว รหัส OF00042 3 รายการ').then(() => { resolved = true; });
  await wait(40); // many poll ticks while still speaking
  assert.equal(resolved, false, 'must not finish while speech is still playing');
  assert.equal(synth.cancelCount, 0, 'must NEVER cancel active speech (this was the bug)');
  synth.speaking = false; // speech finished naturally — Chrome may not fire onend
  await wait(20);
  await p;
  assert.equal(resolved, true, 'finishes once the engine stops speaking');
  assert.equal(synth.cancelCount, 0, 'still never cancelled — full sentence spoken');
});
await test('onend fires normally → finishes immediately, not via poll/ceiling', async () => {
  const synth = mockSynth();
  synth.speak = function (u) { this.last = u; u.onend?.(); }; // synchronous natural end
  // Huge poll/ceiling so, if it resolves, it can only be the onend path.
  const speak = createSpeaker(synth, { makeUtterance: fakeUtterance, pollMs: 100000, startGraceMs: 100000, ceilingMs: 100000 });
  await speak('quick');
  assert.equal(synth.cancelCount, 0);
});
await test('stuck engine (speaking forever) → ceiling cancels so the queue proceeds', async () => {
  const synth = mockSynth({ speaking: true });
  const speak = createSpeaker(synth, { makeUtterance: fakeUtterance, pollMs: 5, startGraceMs: 1000, ceilingMs: 30 });
  const spoken = [];
  const { enqueue } = createAnnounceQueue({
    speak: async (t) => { spoken.push(t); await speak(t); }, delay: async () => {}, isEnabled: () => true, gapMs: 0,
  });
  await Promise.all([enqueue(async () => 'A'), enqueue(async () => 'B')]);
  assert.deepEqual(spoken, ['A', 'B'], 'ceiling frees the stuck utterance so the next order speaks');
  assert.equal(synth.cancelCount, 2, 'each stuck utterance cancelled only at the ceiling');
});
await test('engine never starts (idle, no onend) → start-grace finishes it', async () => {
  const synth = mockSynth({ speaking: false }); // never speaks, never fires onend
  const speak = createSpeaker(synth, { makeUtterance: fakeUtterance, pollMs: 5, startGraceMs: 25, ceilingMs: 5000 });
  await speak('x'); // resolves at the grace window, not the ceiling
  assert.equal(synth.cancelCount, 0, 'nothing to cancel — it never played');
});
await test('late onend after ceiling is a harmless no-op (resolves once)', async () => {
  const synth = mockSynth({ speaking: true });
  const speak = createSpeaker(synth, { makeUtterance: fakeUtterance, pollMs: 1000, startGraceMs: 1000, ceilingMs: 25 });
  await speak('x'); // ceiling → cancel + finish
  const before = synth.cancelCount;
  synth.last.onend?.(); // stale onend arrives late
  await wait(10);
  assert.equal(synth.cancelCount, before, 'a late onend does nothing');
});

console.log('\n[degrade / voice]');
await test('createSpeaker(undefined) resolves without throwing', async () => {
  await createSpeaker(undefined)('anything');
});
await test('no th voice → synth.speak never called, resolves', async () => {
  const synth = mockSynth({ voices: [{ lang: 'en-US' }] });
  let calls = 0;
  synth.speak = () => { calls += 1; };
  await createSpeaker(synth, { makeUtterance: fakeUtterance })('ออเดอร์');
  assert.equal(calls, 0);
});
await test('getVoices() = [] → skip speech (resolves, no throw)', async () => {
  const synth = mockSynth({ voices: [] });
  let calls = 0;
  synth.speak = () => { calls += 1; };
  await createSpeaker(synth, { makeUtterance: fakeUtterance })('x');
  assert.equal(calls, 0);
});
await test('a th* voice is picked and used', async () => {
  const th = { lang: 'th-TH', name: 'Kanya' };
  const synth = mockSynth({ voices: [{ lang: 'en-US' }, th] });
  synth.speak = function (u) { this.last = u; u.onend?.(); };
  await createSpeaker(synth, { makeUtterance: fakeUtterance })('ทดสอบ');
  assert.equal(synth.last.voice, th);
  assert.equal(synth.last.lang, 'th-TH');
});

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
