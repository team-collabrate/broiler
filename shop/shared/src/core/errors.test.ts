import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeError, UserError } from './errors.ts';

test('describeError maps Firestore and Auth codes to short English messages', () => {
  assert.match(describeError({ code: 'permission-denied' }), /access/);
  assert.match(describeError({ code: 'unavailable' }), /connection/);
  assert.match(describeError({ code: 'auth/network-request-failed' }), /connection/);
  assert.match(describeError({ code: 'auth/api-key-not-valid' }), /went wrong/);
});

test('describeError shows our own messages as written and hides raw ones', () => {
  assert.equal(describeError(new UserError('The bill needs at least one item')), 'The bill needs at least one item');
  assert.ok(new UserError('x') instanceof Error);
  assert.match(describeError(new Error('Firebase: Error (internal)')), /went wrong/);
  assert.match(describeError(new Error('The bill needs at least one item')), /went wrong/); // only UserError passes through
  assert.match(describeError(undefined), /went wrong/);
  assert.match(describeError(null), /went wrong/);
});

test('describeError gives sign-in failures their own messages', () => {
  for (const code of ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found']) {
    assert.equal(describeError({ code }), 'Wrong PIN.');
  }
  assert.match(describeError({ code: 'auth/too-many-requests' }), /little while/);
  assert.match(describeError({ code: 'app/invalid-pin' }), /4 to 6/);
  assert.match(describeError({ code: 'app/needs-connection' }), /needs the internet/);
  assert.match(describeError({ code: 'app/too-many-attempts' }), /little while/);
});
