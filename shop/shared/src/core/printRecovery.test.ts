import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPrintError, printWithRecovery, type PrinterLink } from './printRecovery.ts';

const BILL = new Uint8Array([1, 2, 3]);

/** A scripted printer: each call takes the next scripted outcome ('ok' or an Error to throw). */
function fakePrinter(script: { connected?: boolean | Error; connect?: (Error | 'ok')[]; write?: (Error | 'ok')[]; disconnect?: Error | 'ok' }) {
  const calls: string[] = [];
  const connectOutcomes = [...(script.connect ?? [])];
  const writeOutcomes = [...(script.write ?? [])];
  const link: PrinterLink = {
    async isConnected() {
      calls.push('isConnected');
      if (script.connected instanceof Error) throw script.connected;
      return script.connected ?? true;
    },
    async connect() {
      calls.push('connect');
      const outcome = connectOutcomes.shift() ?? 'ok';
      if (outcome !== 'ok') throw outcome;
    },
    async disconnect() {
      calls.push('disconnect');
      if (script.disconnect && script.disconnect !== 'ok') throw script.disconnect;
    },
    async write(data) {
      calls.push(`write:${data.length}`);
      const outcome = writeOutcomes.shift() ?? 'ok';
      if (outcome !== 'ok') throw outcome;
    },
  };
  return { link, calls };
}

test('a connected printer just prints', async () => {
  const { link, calls } = fakePrinter({ connected: true });
  assert.deepEqual(await printWithRecovery(link, BILL), { ok: true, reconnected: false });
  assert.deepEqual(calls, ['isConnected', 'write:3']);
});

test('a printer that is not connected yet is connected first, and that is reported', async () => {
  const { link, calls } = fakePrinter({ connected: false });
  assert.deepEqual(await printWithRecovery(link, BILL), { ok: true, reconnected: true });
  assert.deepEqual(calls, ['isConnected', 'connect', 'write:3']);
});

test('a dead link (the printer was switched off and on) is dropped, reconnected and the bill sent again', async () => {
  const { link, calls } = fakePrinter({ connected: true, write: [new Error('Broken pipe'), 'ok'] });
  assert.deepEqual(await printWithRecovery(link, BILL), { ok: true, reconnected: true });
  assert.deepEqual(calls, ['isConnected', 'write:3', 'disconnect', 'connect', 'write:3']);
});

test('a printer that is off or out of range is reported as unreachable after one retry, not retried for ever', async () => {
  const { link, calls } = fakePrinter({ connected: false, connect: [new Error('read failed, socket might closed'), new Error('read failed, socket might closed')] });
  assert.deepEqual(await printWithRecovery(link, BILL), { ok: false, problem: 'unreachable' });
  assert.equal(calls.filter((c) => c === 'connect').length, 2);
  assert.ok(!calls.some((c) => c.startsWith('write')));
});

test('Bluetooth being off is reported at once: a new connection cannot fix it', async () => {
  const off = Object.assign(new Error('Bluetooth is off.'), { name: 'BluetoothDisabledError' });
  const { link, calls } = fakePrinter({ connected: false, connect: [off] });
  assert.deepEqual(await printWithRecovery(link, BILL), { ok: false, problem: 'bluetooth-off' });
  assert.equal(calls.filter((c) => c === 'connect').length, 1);
});

test('a refused permission is reported at once, whichever way the layer words it', async () => {
  for (const error of [Object.assign(new Error('x'), { name: 'BluetoothPermissionDeniedError' }), new Error('Permission denied by user')]) {
    const { link, calls } = fakePrinter({ connected: true, write: [error] });
    assert.deepEqual(await printWithRecovery(link, BILL), { ok: false, problem: 'permission' });
    assert.ok(!calls.includes('disconnect'));
  }
});

test('a link that cannot say whether it is connected is treated as not connected', async () => {
  const { link, calls } = fakePrinter({ connected: new Error('plugin hiccup') });
  assert.deepEqual(await printWithRecovery(link, BILL), { ok: true, reconnected: true });
  assert.deepEqual(calls, ['isConnected', 'connect', 'write:3']);
});

test('a socket that refuses to close does not stop the retry', async () => {
  const { link } = fakePrinter({ connected: true, write: [new Error('Broken pipe'), 'ok'], disconnect: new Error('already closed') });
  assert.deepEqual(await printWithRecovery(link, BILL), { ok: true, reconnected: true });
});

test('a write that fails again after reconnecting is reported as unreachable', async () => {
  const { link } = fakePrinter({ connected: true, write: [new Error('Broken pipe'), new Error('Broken pipe')] });
  assert.deepEqual(await printWithRecovery(link, BILL), { ok: false, problem: 'unreachable' });
});

test('errors are sorted into the three problems', () => {
  assert.equal(classifyPrintError(new Error('Bluetooth is disabled')), 'bluetooth-off');
  assert.equal(classifyPrintError(new Error('ERROR_PERMISSION_DENIED')), 'permission');
  assert.equal(classifyPrintError(new Error('read failed')), 'unreachable');
  assert.equal(classifyPrintError('something odd'), 'unreachable');
  assert.equal(classifyPrintError(undefined), 'unreachable');
});
