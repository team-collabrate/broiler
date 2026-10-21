import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyPinKey, isValidPin, pinPassword, roleOfEmail, ROLE_EMAILS } from './roles.ts';

test('a PIN is 4 to 6 digits', () => {
  for (const ok of ['1234', '12345', '123456']) assert.equal(isValidPin(ok), true, ok);
  for (const bad of ['', '123', '1234567', '12a4', '12 4', '१२३४']) assert.equal(isValidPin(bad), false, bad);
});

test('the PIN password is always at least the 6 characters Firebase needs', () => {
  assert.equal(pinPassword('1234'), 'broiler-1234');
  assert.ok(pinPassword('1234').length >= 6);
});

test('roleOfEmail recognises only the two role accounts', () => {
  assert.equal(roleOfEmail(ROLE_EMAILS.owner), 'owner');
  assert.equal(roleOfEmail(ROLE_EMAILS.counter), 'counter');
  assert.equal(roleOfEmail(ROLE_EMAILS.owner.toUpperCase()), 'owner');
  for (const other of [null, undefined, '', 'someone@example.com', 'owner@broiler-pos.invalid.evil.com']) {
    assert.equal(roleOfEmail(other), null, String(other));
  }
});

test('applyPinKey builds a PIN key by key, digits only, up to 6', () => {
  const type = (keys: string[]) => keys.reduce(applyPinKey, '');
  assert.equal(type(['1', '2', '3', '4']), '1234');
  assert.equal(type(['1', '2', '3', '4', '5', '6', '7']), '123456');
  assert.equal(type(['1', 'x', '2']), '12');
  assert.equal(type(['1', '2', '⌫']), '1');
  assert.equal(type(['⌫']), '');
});
