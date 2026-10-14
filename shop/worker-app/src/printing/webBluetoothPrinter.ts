// Bluetooth transport for the ESC/POS receipt bytes (TDD §6).
//
// Web Bluetooth talks BLE/GATT only — it cannot reach classic Bluetooth
// (SPP/RFCOMM) printers. Most modern pocket thermal printers are BLE; older
// ones that pair as a serial port are not reachable from any browser, and the
// on-screen bill stays the fallback for those.

/** BLE thermal printers cluster around a handful of vendor service UUIDs.
 *  A service must be declared up front or getPrimaryServices() won't return it. */
const KNOWN_PRINTER_SERVICES: string[] = [
  "000018f0-0000-1000-8000-00805f9b34fb", // the common ESC/POS BLE service
  "0000ff00-0000-1000-8000-00805f9b34fb", // Goojprt / Zjiang style
  "0000ffe0-0000-1000-8000-00805f9b34fb", // HM-10 style serial bridge
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC / Microchip transparent UART
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART
];

/**
 * Bytes per BLE write.
 *
 * This is the single biggest lever on how long a bill takes to print, and it
 * is not really about bandwidth. Every acknowledged write costs at least one
 * BLE connection interval — 7.5ms on a fast link, 40ms+ on a power-saving
 * one — so *the number of writes*, not the number of bytes, sets the floor.
 * A receipt with a logo is ~50 KB: at 180 bytes that is 300+ round trips and
 * a visible wait at the counter, which is what staff were feeling.
 *
 * History on this value: started at 512 (the largest value an ATT attribute
 * can hold), overran the printer's input buffer even with a delay in place,
 * dropped to 128 (+ CHUNK_DELAY_MS raised to 50ms), climbed back through
 * 512 with the delay cut to 0, then past it to 1024 chasing a ~5s print
 * target on the XP-Q600.
 *
 * Went to 512 next — the real platform ceiling for a single GATT write,
 * not a tuning choice (this came out of decompiling the old native app,
 * vpos, to see how it printed to the same hardware over classic Bluetooth
 * — see git history for the full comparison). At 512B with
 * writeValueWithoutResponse and CHUNK_DELAY_MS=0, a real print came back
 * with text missing — no ACK means no delivery guarantee, so a dropped
 * write is just gone. Raising the delay (to 10) was the first fallback
 * step; this is the second, tried instead: back to 0 delay, but at half
 * the chunk size, on the theory that whatever's dropping writes at 512B
 * might not at 256B. Untested which of the two actually fixes it — both
 * are live candidates right now, not a confirmed-good progression.
 *
 * If this still garbles or drops text, CHUNK_DELAY_MS is still the next
 * lever (10, then 15, then 20) at this same 256B size before going
 * smaller again.
 */
const CHUNK_SIZE = 256;

/**
 * Progressively smaller writes to fall back to, ending at the 20 bytes a
 * default 23-byte MTU allows.
 *
 * Retrying a rejected write at a smaller size is safe: the printer is being
 * fed one flat byte stream, so where the chunk boundaries fall carries no
 * meaning, and a write that was refused delivered nothing to re-send.
 */
const CHUNK_FALLBACKS = [512, 256, 128, 64, 20];

/** Cheap printers have small input buffers; a gap between chunks stops them
 *  overflowing and printing garbage halfway down the receipt. Back to 0 —
 *  see CHUNK_SIZE's comment above: this is a parallel experiment (smaller
 *  chunks instead of a delay) to the 10ms tried at 512B, not a confirmed
 *  step in one direction. If writes are still getting dropped at 256B/0,
 *  raise this one next (10, then 15, then 20) before shrinking further. */
const CHUNK_DELAY_MS = 0;

export interface PrinterConnection {
  device: BluetoothDevice;
  characteristic: BluetoothRemoteGATTCharacteristic;
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export interface BluetoothDiagnostics {
  /** The browser exposes the Web Bluetooth API at all. */
  supported: boolean;
  /** A Bluetooth radio is present and switched on. `null` when unknowable. */
  adapterAvailable: boolean | null;
  /** Web Bluetooth is refused outright on plain http:// origins. */
  secureContext: boolean;
  /** Android is the only mobile platform where Chrome ships Web Bluetooth. */
  android: boolean;
  /** Firefox and Safari have never shipped Web Bluetooth. */
  likelyUnsupportedBrowser: boolean;
}

/** Explains an empty device picker — the failure modes are indistinguishable
 *  from inside requestDevice(), which just resolves to "user picked nothing". */
export async function getBluetoothDiagnostics(): Promise<BluetoothDiagnostics> {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const supported = isWebBluetoothSupported();

  let adapterAvailable: boolean | null = null;
  if (supported && typeof navigator.bluetooth.getAvailability === "function") {
    try {
      adapterAvailable = await navigator.bluetooth.getAvailability();
    } catch {
      adapterAvailable = null;
    }
  }

  return {
    supported,
    adapterAvailable,
    secureContext: typeof window !== "undefined" && window.isSecureContext,
    android: /Android/i.test(ua),
    likelyUnsupportedBrowser: /Firefox|FxiOS|CriOS/i.test(ua) || (/Safari/i.test(ua) && !/Chrome/i.test(ua)),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Finds the first characteristic on the device that we're allowed to write to. */
async function findWritableCharacteristic(
  server: BluetoothRemoteGATTServer,
): Promise<BluetoothRemoteGATTCharacteristic> {
  const services = await server.getPrimaryServices();
  for (const service of services) {
    let characteristics: BluetoothRemoteGATTCharacteristic[];
    try {
      characteristics = await service.getCharacteristics();
    } catch {
      continue; // service exposes nothing readable to us — try the next one
    }
    for (const characteristic of characteristics) {
      const { write, writeWithoutResponse } = characteristic.properties;
      if (write || writeWithoutResponse) return characteristic;
    }
  }
  throw new Error("No writable characteristic found — is this a BLE thermal printer?");
}

async function connect(device: BluetoothDevice): Promise<PrinterConnection> {
  if (!device.gatt) {
    throw new Error("This device doesn't expose a GATT server.");
  }
  const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
  const characteristic = await findWritableCharacteristic(server);
  return { device, characteristic };
}

/**
 * Re-runs the same GATT connect + characteristic lookup printToDevice()
 * falls back to internally, but callable ahead of time — see usePrinter's
 * gattserverdisconnected listener, which uses this to warm a dropped link
 * back up in the background the moment it notices, instead of leaving
 * that (commonly 1-5+ second, all-BLE-round-trips) cost sitting on the
 * print button's own critical path the next time someone taps it. This
 * was previously the single biggest, and entirely unmeasured, contributor
 * to real-world print time — the on-screen speed overlay's clock only
 * ever started once printToDevice's own internal reconnect had already
 * finished.
 */
export async function reconnectPrinter(device: BluetoothDevice): Promise<PrinterConnection> {
  return connect(device);
}

/** Opens the browser's Bluetooth picker — must run inside a user gesture (a click). */
export async function requestPrinter(): Promise<PrinterConnection> {
  // The printer model isn't known in advance, so show every nearby device
  // rather than filtering by service — plenty of printers don't advertise
  // their service UUID and would be invisible behind a filter.
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: KNOWN_PRINTER_SERVICES,
  });
  return connect(device);
}

/** Re-attaches to an already-permitted printer without prompting again.
 *  getDevices() is not in every Chrome build, so absence is not an error. */
export async function getPairedPrinter(): Promise<PrinterConnection | null> {
  if (!isWebBluetoothSupported() || typeof navigator.bluetooth.getDevices !== "function") {
    return null;
  }
  let devices: BluetoothDevice[];
  try {
    devices = await navigator.bluetooth.getDevices();
  } catch {
    return null;
  }
  if (devices.length === 0) return null;
  // Reconnecting needs the printer to be in range and awake; if it isn't,
  // fall back to "unpaired" so the worker is offered the picker again.
  try {
    return await connect(devices[0]);
  } catch {
    return null;
  }
}

export function getPrinterName(connection: PrinterConnection): string {
  return connection.device.name ?? "Bluetooth printer";
}

/** Reported after every chunk write (and every time the printer rejects one
 *  and forces a smaller chunk size), for usePrinter's on-screen speed
 *  display — see that hook for why this is a callback rather than an
 *  event stream: it needs to run synchronously in step with the loop
 *  below, not buffered and replayed after the fact.
 *
 *  The "fallback" case used to only reach console.warn — invisible on the
 *  tablet itself, which defeats the point of a speed overlay built
 *  specifically so nobody needs DevTools at the counter. A print that's
 *  much slower than the chunk size/delay alone would predict is usually
 *  this: the printer refused the configured chunk size and every
 *  remaining byte went out in much smaller pieces instead. */
export type PrintEvent =
  | {
      kind: "chunk";
      chunkIndex: number;
      chunkBytes: number;
      bytesSent: number;
      totalBytes: number;
      /** Since printToDevice() started, not since this specific chunk. */
      elapsedMs: number;
    }
  | {
      kind: "fallback";
      fromSize: number;
      toSize: number;
      elapsedMs: number;
    }
  | {
      kind: "reconnect";
      /** How long the GATT connect + service/characteristic lookup took —
       *  previously invisible: it happened before printToDevice's own
       *  timer even started (see that function's comment). Usually the
       *  actual explanation for a "slow" print, not chunk size or delay. */
      ms: number;
    };

/**
 * Sends the ESC/POS byte stream to the printer, chunked to fit BLE writes.
 *
 * Prefers writeValueWithoutResponse again — measured at 15s on the real
 * XP-Q600 with writeValueWithResponse preferred (43 writes at 512 bytes
 * each, ~349ms per write), which is far more than raw BLE connection-
 * interval overhead (7.5-40ms) explains; the printer's own ACK turnaround
 * is the bottleneck, not the transport or CHUNK_SIZE/CHUNK_DELAY_MS, both
 * already at their limits. Skipping the ACK removes that wait entirely.
 *
 * This reintroduces the real risk flagged the last time this was tried:
 * with no response and CHUNK_DELAY_MS at 0, there is genuinely no
 * backpressure at all on this path — a printer whose buffer can't keep up
 * with an unacknowledged stream has nothing to signal that until it's
 * already garbled the paper. If that happens, CHUNK_DELAY_MS is the first
 * thing to raise (10, then 15, then 20) before touching anything else.
 *
 * Falls back to writeValueWithResponse only if the characteristic doesn't
 * advertise writeWithoutResponse support at all.
 *
 * Returns the connection actually used, since a dropped link is
 * re-established here and yields fresh GATT objects the caller should
 * hold onto. usePrinter's gattserverdisconnected listener means this
 * branch should rarely fire for real anymore (see reconnectPrinter above)
 * — it stays as a safety net for whatever that listener misses, not the
 * primary way a drop gets noticed.
 */
export async function printToDevice(
  connection: PrinterConnection,
  data: Uint8Array,
  onProgress?: (event: PrintEvent) => void,
): Promise<PrinterConnection> {
  // BLE links drop when the printer sleeps or wanders out of range; silently
  // reconnecting is far better counter UX than an error the worker can't act on.
  let active = connection;
  if (!connection.device.gatt?.connected) {
    const reconnectStartedAt = performance.now();
    active = await connect(connection.device);
    onProgress?.({ kind: "reconnect", ms: performance.now() - reconnectStartedAt });
  }

  const { characteristic } = active;
  const canWriteWithoutResponse = characteristic.properties.writeWithoutResponse;

  // Uint8Array is generic over its buffer since TS 5.7, and BufferSource
  // rejects the SharedArrayBuffer case — so this has to be the narrow form
  // that `data.slice()` actually returns, not a bare Uint8Array.
  //
  // Still awaited either way — see the git history on this line before
  // changing it back to a genuinely un-awaited fire-and-forget call: that
  // shape reports every chunk (and the whole print) as instantly complete
  // regardless of whether the browser has even started transmitting, and
  // silently drops any chunk the printer rejects instead of surfacing it
  // to the retry/fallback path below. writeValueWithoutResponse's promise
  // still settles once Chrome has queued the write — what's genuinely
  // gone is only the printer's own acknowledgement.
  const write = async (chunk: Uint8Array<ArrayBuffer>) => {
    if (canWriteWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValueWithResponse(chunk);
    }
    await sleep(CHUNK_DELAY_MS);
  };

  // Starts optimistic and only shrinks. Once a size is known to work on this
  // link it is kept for the rest of the receipt, so a printer that needs
  // small writes pays the discovery cost once rather than on every chunk.
  let size = CHUNK_SIZE;
  let offset = 0;
  let chunkIndex = 0;
  const startedAt = performance.now();

  while (offset < data.length) {
    const chunk = data.slice(offset, offset + size);
    try {
      await write(chunk);
      offset += chunk.length;
      chunkIndex += 1;
      onProgress?.({
        kind: "chunk",
        chunkIndex,
        chunkBytes: chunk.length,
        bytesSent: offset,
        totalBytes: data.length,
        elapsedMs: performance.now() - startedAt,
      });
    } catch (err) {
      const next = CHUNK_FALLBACKS.find((candidate) => candidate < size);
      if (next === undefined) throw err; // already as small as BLE allows
      console.warn(`Printer refused a ${size}-byte write; retrying at ${next}.`);
      onProgress?.({ kind: "fallback", fromSize: size, toSize: next, elapsedMs: performance.now() - startedAt });
      size = next;
    }
  }

  return active;
}
