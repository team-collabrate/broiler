import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeError } from './errors.ts';

test('describeError maps Firestore and Auth codes to short Tamil messages', () => {
  assert.match(describeError({ code: 'permission-denied' }), /அனுமதி/);
  assert.match(describeError({ code: 'unavailable' }), /இணைப்பை/);
  assert.match(describeError({ code: 'auth/network-request-failed' }), /இணைப்பை/);
  assert.match(describeError({ code: 'auth/api-key-not-valid' }), /தவறு/);
});

test('describeError keeps messages that are already Tamil and hides raw English ones', () => {
  assert.equal(describeError(new Error('ஆர்டரில் குறைந்தது ஒரு பொருள் வேண்டும்')), 'ஆர்டரில் குறைந்தது ஒரு பொருள் வேண்டும்');
  assert.match(describeError(new Error('Firebase: Error (internal)')), /தவறு/);
  assert.match(describeError(undefined), /தவறு/);
  assert.match(describeError(null), /தவறு/);
});

test('describeError gives sign-in failures their own messages', () => {
  for (const code of ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found']) {
    assert.equal(describeError({ code }), 'பின் எண் தவறு.');
  }
  assert.match(describeError({ code: 'auth/too-many-requests' }), /சிறிது நேரம்/);
  assert.match(describeError({ code: 'app/invalid-pin' }), /4 முதல் 6/);
});
