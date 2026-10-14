/**
 * Classic Bluetooth (RFCOMM/SPP) transport for the ESC/POS receipt bytes —
 * only reachable at all once the app is running inside the native Android
 * shell (see main.tsx / capacitor.config.ts), never from a plain browser
 * tab. webBluetoothPrinter.ts stays as the fallback for that case.
 *
 * This exists because Web Bluetooth (webBluetoothPrinter.ts) is BLE/GATT
 * only — a hard browser-level restriction, not a setting — and every
 * chunk-size/delay/heating-time tuning round this printer went through
 * was working around GATT's small per-write limit, something classic SPP
 * doesn't have at all: it's a plain stream socket, and the OS handles
 * fragmentation and flow control underneath it. Confirmed by decompiling
 * the old native app (vpos), which printed to this exact printer with
 * nothing more than:
 *
 *   BluetoothSocket socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
 *   socket.connect();
 *   OutputStream out = socket.getOutputStream();
 *   out.write(wholeReceiptBytes);
 *   out.flush();
 *
 * — one write, no chunk size, no delay. printClassic() below is that same
 * shape, via @fmesasc/capacitor-bluetooth-serial (a fork of
 * @e-is/capacitor-bluetooth-serial chosen specifically because the
 * upstream write() only accepts a JS string and converts it with
 * `value.getBytes(StandardCharsets.UTF_8)` — lossy for raw binary raster
 * data, since bytes >= 0x80 don't round-trip through UTF-8 as single
 * bytes. This fork's write() also accepts a plain `number[]`, converted
 * on the native side with `(byte) array.optInt(i)` — a real byte-for-byte
 * copy, verified by reading that fork's actual Android source before
 * depending on it).
 */
import { BluetoothSerial, type BluetoothDevice as ScannedDevice } from "@fmesasc/capacitor-bluetooth-serial";

export interface ClassicPrinterConnection {
  address: string;
  name: string;
}

const STORAGE_KEY = "kumbakonam.classicPrinterAddress";

/** The last address a print actually succeeded to — not proof it's still in
 *  range, just where to try reconnecting without asking the worker to pick
 *  it from the list again on every app load. */
export function getStoredPrinterAddress(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storePrinterAddress(address: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, address);
  } catch {
    // Falls back to asking again next load — not worth surfacing.
  }
}

/** Thrown when the plugin's own rejection says Bluetooth is genuinely off
 *  (its ERROR_DISABLED string, from BluetoothSerialPlugin.java's
 *  rejectIfDisabled — only reached once permission is already granted, so
 *  this is never confused with the permission case below). Distinguished
 *  from a generic connect failure so the UI can tell the worker the one
 *  thing that actually fixes it (usePrinter.ts matches on this class, not
 *  the message text). */
export class BluetoothDisabledError extends Error {
  constructor() {
    super("Bluetooth is off.");
    this.name = "BluetoothDisabledError";
  }
}

/** Thrown when Android's own Bluetooth/location permission prompt was
 *  denied (the plugin's ERROR_PERMISSION_DENIED). Distinct from
 *  BluetoothDisabledError — turning Bluetooth on doesn't fix this one, only
 *  granting the app permission does (Settings > Apps > this app >
 *  Permissions, since a second in-app prompt won't reappear once denied). */
export class BluetoothPermissionDeniedError extends Error {
  constructor() {
    super("Bluetooth/location permission was denied.");
    this.name = "BluetoothPermissionDeniedError";
  }
}

/** Turns the plugin's raw rejection into one of the two errors above when
 *  recognisable, or passes it through unchanged otherwise. */
function classifyBluetoothError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (/disabled/i.test(message)) return new BluetoothDisabledError();
  if (/permission/i.test(message)) return new BluetoothPermissionDeniedError();
  return err instanceof Error ? err : new Error(message);
}

/**
 * Best-effort only — NOT a reliable "is Bluetooth on" check. See the long
 * comment below for why: on every Android version except 12/12L, calling
 * this when Bluetooth is already on and permission hasn't been granted yet
 * reports {enabled:false} without ever asking for that permission, which
 * would make every future call permanently look like "Bluetooth is off"
 * even after the worker turns it on by hand. Because of that, this function
 * never throws — a false/rejected result here means nothing more than "this
 * particular shortcut didn't apply"; scanForPrinters()/connectClassic()
 * below still run scan()/connect() regardless, and it's THEIR rejection
 * message (via classifyBluetoothError) that's actually trustworthy, since
 * BluetoothSerialPlugin.java's rejectIfDisabled() always requests
 * permission first, with no such version gate.
 *
 * Turns Bluetooth on if it's off, requesting the runtime permission first
 * if Android hasn't granted it yet (BLUETOOTH_CONNECT/SCAN on API 31+,
 * BLUETOOTH/BLUETOOTH_ADMIN/ACCESS_FINE_LOCATION below it — the plugin's
 * own manifest declares all of these; see android/app's merged manifest
 * after a build, not this repo's hand-maintained one).
 *
 * IMPORTANT: the underlying plugin (BluetoothSerialPlugin.java,
 * getCanEnable()) only ever attempts to flip Bluetooth on itself for API
 * 31-32 (Android 12/12L) — everywhere else, including Android 13+ and
 * Android <=11 (both real cases seen on real hardware here), it just
 * resolves {enabled:false} immediately, WITHOUT requesting permission or
 * prompting the user at all — even if Bluetooth is already on and the only
 * thing missing is permission. That's not worth patching around in the
 * plugin itself: since API 33, Android requires an explicit system dialog
 * (ACTION_REQUEST_ENABLE) to turn Bluetooth on, which this plugin doesn't
 * implement either way.
 */
async function tryEnableBluetooth(): Promise<void> {
  try {
    await BluetoothSerial.enable();
  } catch {
    // Ignored — see this function's own comment. The real signal comes from
    // scan()/connect()'s own rejection, not from this best-effort attempt.
  }
}

/** Nearby classic-Bluetooth devices — includes already-paired ones and
 *  whatever a live scan turns up. No service-UUID filtering (unlike Web
 *  Bluetooth's requestDevice(), which needed acceptAllDevices for the same
 *  reason): plenty of printers don't advertise in a way that would survive
 *  filtering, and this list is short enough on a real device that
 *  filtering isn't worth the risk of hiding the one that matters. */
export async function scanForPrinters(): Promise<ClassicPrinterConnection[]> {
  await tryEnableBluetooth();
  try {
    const result = await BluetoothSerial.scan();
    return result.devices.map((d: ScannedDevice) => ({
      address: d.address,
      name: d.name || d.address,
    }));
  } catch (err) {
    throw classifyBluetoothError(err);
  }
}

/** Secure RFCOMM first, insecure as the fallback — matches the old app's
 *  own connect order (see this file's top comment), which tried secure,
 *  then insecure, then finally looped channels 1-5 on the plain SPP UUID.
 *  This plugin only exposes the first two of those, which is what covers
 *  the vast majority of real printers; a device needing the channel-probe
 *  fallback too would need a further plugin change, not a code change
 *  here. */
async function connectWithFallback(address: string): Promise<void> {
  try {
    await BluetoothSerial.connect({ address });
  } catch (err) {
    console.warn(`Secure RFCOMM connect failed for ${address}, trying insecure`, err);
    try {
      await BluetoothSerial.connectInsecure({ address });
    } catch (insecureErr) {
      throw classifyBluetoothError(insecureErr);
    }
  }
}

export async function connectClassic(address: string): Promise<ClassicPrinterConnection> {
  await tryEnableBluetooth();
  await connectWithFallback(address);
  storePrinterAddress(address);
  return { address, name: address };
}

/** Re-attaches to the last address that worked, without prompting — the
 *  classic-SPP equivalent of webBluetoothPrinter.ts's getPairedPrinter().
 *  A classic RFCOMM connect is a single socket-open, not BLE's multi
 *  round-trip service/characteristic discovery, so unlike the BLE path
 *  this has never needed a background keep-alive watcher to avoid a slow
 *  reconnect sitting on the print button's critical path. */
export async function getStoredPrinterConnection(): Promise<ClassicPrinterConnection | null> {
  const address = getStoredPrinterAddress();
  if (!address) return null;
  try {
    await tryEnableBluetooth();
    const already = await BluetoothSerial.isConnected({ address });
    if (!already.connected) {
      await connectWithFallback(address);
    }
    return { address, name: address };
  } catch (err) {
    console.warn("Reconnecting to the stored classic printer failed", err);
    return null;
  }
}

/**
 * Sends the ESC/POS byte stream in a single write — no chunking, no
 * per-write delay, no ATT/GATT size ceiling to work around. If the link
 * has dropped, reconnects first (a fast, single-step RFCOMM connect, not
 * BLE's slower service discovery).
 */
export async function printClassic(connection: ClassicPrinterConnection, data: Uint8Array): Promise<void> {
  const { address } = connection;
  const connected = await BluetoothSerial.isConnected({ address });
  if (!connected.connected) {
    await connectWithFallback(address);
  }
  await BluetoothSerial.write({ address, value: Array.from(data) });
}

export async function disconnectClassic(address: string): Promise<void> {
  await BluetoothSerial.disconnect({ address });
}
