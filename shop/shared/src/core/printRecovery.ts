// Getting a bill onto paper when the Bluetooth link is not in the state the tablet thinks it is. A thermal printer is
// switched off and on, goes out of range, or the tablet sleeps: the old socket then looks open but is dead, and the
// first write fails. One quiet reconnect-and-resend fixes that; Bluetooth being off, or the app lacking permission,
// cannot be fixed by retrying and is reported as it is. Pure TypeScript: the printer is passed in as a small interface,
// so every case here runs under Node's test runner with a fake printer.

export type PrintProblem =
  /** Bluetooth is switched off on the tablet. */
  | 'bluetooth-off'
  /** The app is not allowed to use Bluetooth (or the location it needs to find a printer). */
  | 'permission'
  /** Anything else: the printer is off, out of range, busy with another device, or out of paper (printers rarely say). */
  | 'unreachable';

/** What this needs from a connected printer. */
export interface PrinterLink {
  isConnected(): Promise<boolean>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  write(data: Uint8Array): Promise<void>;
}

export type PrintAttempt =
  | { ok: true; /** A fresh connection had to be made for this bill. */ reconnected: boolean }
  | { ok: false; problem: PrintProblem };

/** Which of the three problems an error from the Bluetooth layer means. */
export function classifyPrintError(error: unknown): PrintProblem {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (name === 'BluetoothDisabledError' || /disabled|bluetooth is off|turned off/i.test(message)) return 'bluetooth-off';
  if (name === 'BluetoothPermissionDeniedError' || /permission/i.test(message)) return 'permission';
  return 'unreachable';
}

async function attempt(link: PrinterLink, data: Uint8Array, forceConnect: boolean): Promise<PrintAttempt> {
  try {
    // A link that cannot even say whether it is connected is treated as not connected.
    const connected = forceConnect ? false : await link.isConnected().catch(() => false);
    if (!connected) await link.connect();
    await link.write(data);
    return { ok: true, reconnected: !connected };
  } catch (error) {
    return { ok: false, problem: classifyPrintError(error) };
  }
}

/**
 * Sends the bill. If the first try fails for a reason a fresh connection could cure, the old link is dropped, a new one
 * is made and the bill is sent once more. A retry cannot cure Bluetooth being off or a refused permission, so those
 * are returned at once.
 */
export async function printWithRecovery(link: PrinterLink, data: Uint8Array): Promise<PrintAttempt> {
  const first = await attempt(link, data, false);
  if (first.ok || first.problem !== 'unreachable') return first;
  await link.disconnect().catch(() => undefined); // a socket that is already dead may refuse to close: no matter
  return attempt(link, data, true);
}
