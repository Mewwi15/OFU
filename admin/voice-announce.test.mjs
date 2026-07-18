#!/usr/bin/env node
/**
 * Unit tests for the voice-announce core (admin/src/lib/voiceAnnounce.ts).
 * Framework-free: run with `node voice-announce.test.mjs` (Node ≥ 23 strips the
 * TS types on import). Covers the message builder, the FIFO drop-after-N queue,
 * and silent degradation — everything except the actual audio, which can only be
 * heard on a real device.
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
const tick = () => new Promise((r) => setImmediate(r));

console.log('\n[message builder]');
await test('count 3 → "…รหัส X 3 รายการ"', () => {
  const s = buildAnnouncement('OF00042', 3);
  assert.equal(s, 'ออเดอร์เข้าแล้ว รหัส OF00042 3 รายการ');
  assert.ok(s.includes('3 รายการ'));
});
await test('count null → no "รายการ", no "undefined"', () => {
  const s = buildAnnouncement('OF00042', null);
  assert.equal(s, 'ออเดอร์เข้าแล้ว รหัส OF00042');
  assert.ok(!s.includes('รายการ'), 'must not mention รายการ');
  assert.ok(!s.toLowerCase().includes('undefined'), 'must not leak undefined');
});
await test('count undefined → base line only', () => {
  assert.equal(buildAnnouncement('OF1', undefined), 'ออเดอร์เข้าแล้ว รหัส OF1');
});
await test('count 0 / NaN → drops the tail (never "0 รายการ")', () => {
  assert.ok(!buildAnnouncement('OF1', 0).includes('รายการ'));
  assert.ok(!buildAnnouncement('OF1', Number.NaN).includes('รายการ'));
});

console.log('\n[FIFO queue — burst of 7 drops speech for 6 & 7]');
await test('7 orders in a burst → chime 7, speak 5, drop 2 (FIFO order)', async () => {
  const chimes = [];
  const spoken = [];
  const drops = [];
  const enqueue = createAnnounceQueue({
    chime: () => chimes.push(chimes.length + 1),
    speak: async (t) => { spoken.push(t); },
    delay: async () => {}, // no real wait in tests
    isEnabled: () => true,
    log: (m) => drops.push(m),
    gapMs: 0,
    maxQueue: 5,
  });
  const tasks = [];
  for (let i = 1; i <= 7; i += 1) tasks.push(enqueue(async () => `order ${i}`));
  await Promise.all(tasks);
  assert.equal(chimes.length, 7, `chime should ring for all 7, got ${chimes.length}`);
  assert.equal(spoken.length, 5, `only the first 5 should speak, got ${spoken.length}`);
  assert.deepEqual(spoken, ['order 1', 'order 2', 'order 3', 'order 4', 'order 5'], 'spoken in FIFO order');
  assert.equal(drops.length, 2, `orders 6 & 7 should be logged as dropped, got ${drops.length}`);
});

console.log('\n[toggle off — chime only, no speech]');
await test('isEnabled false → chime rings, speak is never called', async () => {
  let chimed = 0;
  let spoke = 0;
  const enqueue = createAnnounceQueue({
    chime: () => { chimed += 1; },
    speak: async () => { spoke += 1; },
    delay: async () => {},
    isEnabled: () => false,
    gapMs: 0,
  });
  await enqueue(async () => 'should not be spoken');
  assert.equal(chimed, 1, 'chime still rings when the toggle is off');
  assert.equal(spoke, 0, 'nothing is spoken when the toggle is off');
});

await test('disabled order skips makeText (no item-count query when muted)', async () => {
  let madeText = 0;
  const enqueue = createAnnounceQueue({
    chime: () => {},
    speak: async () => {},
    delay: async () => {},
    isEnabled: () => false,
    gapMs: 0,
  });
  await enqueue(async () => { madeText += 1; return 'x'; });
  assert.equal(madeText, 0, 'makeText (the count query) must not run when muted');
});

console.log('\n[degrade — no speech engine must not throw]');
await test('createSpeaker(undefined) resolves without throwing', async () => {
  const speak = createSpeaker(undefined);
  await speak('anything'); // must resolve, not reject/throw
  assert.ok(true);
});
await test('queue with a no-op speaker still chimes and does not throw', async () => {
  let chimed = 0;
  const enqueue = createAnnounceQueue({
    chime: () => { chimed += 1; },
    speak: createSpeaker(undefined), // simulates a device with no speechSynthesis
    delay: async () => {},
    isEnabled: () => true,
    gapMs: 0,
  });
  await enqueue(async () => 'hello');
  await tick();
  assert.equal(chimed, 1, 'chime still fires even when TTS is absent');
});

await test('one order throwing in makeText does not break the next', async () => {
  const spoken = [];
  const enqueue = createAnnounceQueue({
    chime: () => {},
    speak: async (t) => { spoken.push(t); },
    delay: async () => {},
    isEnabled: () => true,
    gapMs: 0,
  });
  const a = enqueue(async () => { throw new Error('count query blew up'); });
  const b = enqueue(async () => 'order B');
  await Promise.all([a, b]);
  assert.deepEqual(spoken, ['order B'], 'the chain survives a failing order');
});

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
