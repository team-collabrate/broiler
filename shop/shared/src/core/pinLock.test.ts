import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  afterWrongPin,
  blockedForMs,
  BLOCK_MS,
  checkPinVerifier,
  FREE_ATTEMPTS,
  isPinVerifier,
  makePinVerifier,
  NO_ATTEMPTS,
  parseAttempts,
} from './pinLock.ts';

// A few iterations keep the tests quick; the real value is much higher.
const FAST = 50;

test('the PIN that made a verifier matches it, any other does not', async () => {
  const verifier = await makePinVerifier('4821', FAST);
  assert.equal(await checkPinVerifier('4821', verifier), true);
  assert.equal(await checkPinVerifier('4822', verifier), false);
  assert.equal(await checkPinVerifier('', verifier), false);
  assert.equal(await checkPinVerifier('482', verifier), false);
});

test('the same PIN gives a different verifier each time (random salt) and never contains the PIN', async () => {
  const a = await makePinVerifier('4821', FAST);
  const b = await makePinVerifier('4821', FAST);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
  assert.ok(!JSON.stringify(a).includes('4821'));
});

test('a damaged verifier never matches and never throws', async () => {
  const good = await makePinVerifier('4821', FAST);
  for (const bad of [
    { ...good, salt: 'zz' },
    { ...good, hash: good.hash.slice(2) },
    { ...good, iterations: 0 },
    { ...good, iterations: 1.5 },
  ]) {
    assert.equal(await checkPinVerifier('4821', bad), false);
  }
});

test('stored verifiers are recognised by shape', async () => {
  assert.equal(isPinVerifier(await makePinVerifier('1234', FAST)), true);
  for (const bad of [null, 'x', {}, { salt: 1, hash: 'a', iterations: 1 }]) assert.equal(isPinVerifier(bad), false);
});

test('five wrong PINs are free, then every wrong PIN blocks the next try for 30 seconds', () => {
  let state = NO_ATTEMPTS;
  for (let i = 1; i < FREE_ATTEMPTS; i += 1) {
    state = afterWrongPin(state, 1000);
    assert.equal(blockedForMs(state, 1000), 0, `attempt ${i}`);
  }
  state = afterWrongPin(state, 1000);
  assert.equal(blockedForMs(state, 1000), BLOCK_MS);
  assert.equal(blockedForMs(state, 1000 + BLOCK_MS), 0);
  state = afterWrongPin(state, 50_000);
  assert.equal(blockedForMs(state, 50_000), BLOCK_MS);
});

test('stored attempt counts that are damaged start clean', () => {
  assert.deepEqual(parseAttempts(null), NO_ATTEMPTS);
  assert.deepEqual(parseAttempts('nope'), NO_ATTEMPTS);
  assert.deepEqual(parseAttempts('{"failures":"3","blockedUntil":0}'), NO_ATTEMPTS);
  assert.deepEqual(parseAttempts('{"failures":3,"blockedUntil":99}'), { failures: 3, blockedUntil: 99 });
});
