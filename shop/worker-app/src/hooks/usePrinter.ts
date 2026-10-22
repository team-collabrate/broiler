import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { classifyPrintError, type PrintProblem } from "@kumbakonam/shared/core";
import {
  connectClassic,
  getStoredPrinterConnection,
  printClassic,
  scanForPrinters,
  type ClassicPrinterConnection,
} from "../printing/classicBluetoothPrinter";
import {
  getPairedPrinter,
  getPrinterName,
  isWebBluetoothSupported,
  printToDevice,
  reconnectPrinter,
  requestPrinter,
  type PrinterConnection,
  type PrintEvent,
} from "../printing/webBluetoothPrinter";
import type { ReceiptRasterTiming } from "../printing/receiptCanvas";

/**
 * Two transports, chosen once at startup and never mixed mid-session:
 *
 *  - "native": inside the Capacitor/Android shell, classic Bluetooth SPP (classicBluetoothPrinter.ts), a single
 *    unchunked write. This is the reliable one and the one the shop uses.
 *  - "web": a plain browser tab or the installed web app, where classic Bluetooth is unreachable: Web Bluetooth
 *    (webBluetoothPrinter.ts), the BLE/GATT path, which only works with Bluetooth LE printers.
 *
 * Capacitor.isNativePlatform() is false for a plain web build and true inside the wrapped native shell, so this same
 * hook serves both without a build-time flag.
 */
const PLATFORM: "native" | "web" = Capacitor.isNativePlatform() ? "native" : "web";

export type PrinterStatus =
  | "unsupported"
  | "checking"
  /** No printer has been chosen on this tablet yet. */
  | "unpaired"
  | "connecting"
  /** Native only: a scan finished and the list is waiting for a tap. */
  | "picking"
  /** A printer is remembered. This does not mean it is switched on: that is found out when a bill is printed. */
  | "ready";

/** What can go wrong with the printer, for the screen to word in Tamil. `no-printer` means none has been chosen. */
export type PrinterProblem = PrintProblem | "no-printer";

export type PrintResult = { ok: true } | { ok: false; problem: PrinterProblem };

/** Live numbers for the optional on-screen speed readout (PrintDiagnosticsOverlay). */
export interface PrintProgress {
  chunkIndex: number;
  bytesSent: number;
  totalBytes: number;
  elapsedMs: number;
  kbPerSec: number;
  /** null until at least one chunk has gone out: nothing to extrapolate from yet. */
  etaMs: number | null;
  /** How many times the printer refused the chunk size and forced a smaller one (web/GATT path only). */
  fallbackCount: number;
}

export interface UsePrinterResult {
  status: PrinterStatus;
  /** The last thing that went wrong with the printer; cleared by the next successful connect or print. */
  problem: PrinterProblem | null;
  deviceName: string | null;
  /** Which transport this session is actually using, so the screen can show the right flow. */
  platform: "native" | "web";
  /** Native only: the nearby devices found by the latest scan, shown as a list while status is "picking". */
  printerDevices: ClassicPrinterConnection[];
  /** Opens the Bluetooth picker (web: the browser's own; native: starts a scan). Must run inside a user gesture. */
  connect: () => Promise<void>;
  /** Native only: call with an address from printerDevices once one is tapped. */
  selectPrinter: (address: string) => Promise<void>;
  /** Prints the bytes. Never throws: the result says whether they went out and, if not, why. */
  print: (data: Uint8Array, renderTiming?: ReceiptRasterTiming) => Promise<PrintResult>;
  /** [PRINT START] / [COMPLETE] / [FAILED] lines from the most recent print. */
  printLogs: string[];
  /** null when nothing is printing. */
  printProgress: PrintProgress | null;
}

/** How often chunk progress may trigger a re-render (web/GATT path only; the native path reports once). */
const UI_FLUSH_INTERVAL_MS = 150;

/**
 * Development only: `window.__broiler.fakePrinter = "ok" | "unreachable" | "bluetooth-off" | "permission"` stands in
 * for a printer so the screens can be tried in a browser with no Bluetooth. `import.meta.env.DEV` is false in a
 * production build, so none of this ships.
 */
function devFakePrinter(): PrintProblem | "ok" | null {
  if (!import.meta.env.DEV) return null;
  const mode = (window as unknown as { __broiler?: { fakePrinter?: string } }).__broiler?.fakePrinter;
  return mode === "ok" || mode === "unreachable" || mode === "bluetooth-off" || mode === "permission" ? mode : null;
}

/** Bluetooth pairing + ESC/POS printing: classic SPP natively, BLE/GATT as the web fallback. */
export function usePrinter(): UsePrinterResult {
  const [status, setStatus] = useState<PrinterStatus>("checking");
  const [problem, setProblem] = useState<PrinterProblem | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [printerDevices, setPrinterDevices] = useState<ClassicPrinterConnection[]>([]);
  const [printLogs, setPrintLogs] = useState<string[]>([]);
  const [printProgress, setPrintProgress] = useState<PrintProgress | null>(null);
  const connectionRef = useRef<PrinterConnection | null>(null);
  const classicConnectionRef = useRef<ClassicPrinterConnection | null>(null);
  const logsRef = useRef<string[]>([]);
  const lastFlushRef = useRef(0);
  const lastChunkIndexRef = useRef(0);
  const fallbackCountRef = useRef(0);
  // Which device has a gattserverdisconnected listener attached, so a second one is never added. Web/GATT only.
  const watchedDeviceRef = useRef<BluetoothDevice | null>(null);

  /**
   * Web/GATT only: when the browser says the BLE link dropped (routine for a battery printer between customers),
   * reconnect in the background so the reconnect never sits on the Print button's critical path. printToDevice's own
   * lazy reconnect stays as the fallback for whatever this misses. Classic SPP has no such slow step.
   */
  const watchForDisconnect = useCallback((connection: PrinterConnection) => {
    const { device } = connection;
    if (watchedDeviceRef.current === device) return;
    watchedDeviceRef.current = device;
    device.addEventListener("gattserverdisconnected", () => {
      reconnectPrinter(device)
        .then((fresh) => {
          connectionRef.current = fresh;
        })
        .catch((err) => {
          // Not shown: printToDevice tries again at print time, and an error here almost always means "still out of range".
          console.warn("Background printer reconnect failed (will retry at next print)", err);
        });
    });
  }, []);

  useEffect(() => {
    if (PLATFORM === "native") {
      // The remembered printer is read back without connecting: a printer still switched off when the app opens must
      // not be forgotten. The connection is made when a bill is printed.
      const remembered = getStoredPrinterConnection();
      if (remembered) {
        classicConnectionRef.current = remembered;
        setDeviceName(remembered.name);
        setStatus("ready");
      } else {
        setStatus("unpaired");
      }
      return;
    }

    if (!isWebBluetoothSupported()) {
      setStatus("unsupported");
      return;
    }
    getPairedPrinter()
      .then((connection) => {
        if (connection) {
          connectionRef.current = connection;
          watchForDisconnect(connection);
          setDeviceName(getPrinterName(connection));
          setStatus("ready");
        } else {
          setStatus("unpaired");
        }
      })
      .catch(() => setStatus("unpaired"));
  }, [watchForDisconnect]);

  const connect = useCallback(async () => {
    setProblem(null);

    if (PLATFORM === "native") {
      setStatus("connecting");
      try {
        const devices = await scanForPrinters();
        setPrinterDevices(devices);
        setStatus("picking");
      } catch (err) {
        console.error("Printer scan failed", err);
        setProblem(classifyPrintError(err));
        setStatus(classicConnectionRef.current ? "ready" : "unpaired");
      }
      return;
    }

    setStatus("connecting");
    try {
      const connection = await requestPrinter();
      connectionRef.current = connection;
      watchForDisconnect(connection);
      setDeviceName(getPrinterName(connection));
      setStatus("ready");
    } catch (err) {
      console.error("Printer connect failed", err);
      // Dismissing the Bluetooth picker rejects with NotFoundError: a deliberate cancel, not a fault.
      const cancelled = err instanceof Error && err.name === "NotFoundError";
      if (!cancelled) setProblem("unreachable");
      setStatus(connectionRef.current ? "ready" : "unpaired");
    }
  }, [watchForDisconnect]);

  /** Native only: one device from the "picking" list was tapped. */
  const selectPrinter = useCallback(
    async (address: string) => {
      setStatus("connecting");
      setProblem(null);
      const name = printerDevices.find((d) => d.address === address)?.name ?? address;
      try {
        const connection = await connectClassic(address, name);
        classicConnectionRef.current = connection;
        setDeviceName(connection.name);
        setStatus("ready");
      } catch (err) {
        console.error("Printer connect failed", err);
        setProblem(classifyPrintError(err));
        setStatus(classicConnectionRef.current ? "ready" : "unpaired");
      }
    },
    [printerDevices],
  );

  const print = useCallback(
    async (data: Uint8Array, renderTiming?: ReceiptRasterTiming): Promise<PrintResult> => {
      const fake = devFakePrinter();
      if (fake) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (fake === "ok") {
          setProblem(null);
          return { ok: true };
        }
        setProblem(fake);
        return { ok: false, problem: fake };
      }

      if (PLATFORM === "native") {
        const printer = classicConnectionRef.current;
        if (!printer) return { ok: false, problem: "no-printer" };

        logsRef.current = [`[PRINT START] Size: ${(data.length / 1024).toFixed(1)} KB`];
        if (renderTiming) {
          logsRef.current.push(
            `[RENDER] canvas: ${renderTiming.renderMs.toFixed(0)}ms, raster encode: ${renderTiming.rasterMs.toFixed(0)}ms`,
          );
        }
        setPrintLogs(logsRef.current);
        setPrintProgress({ chunkIndex: 0, bytesSent: 0, totalBytes: data.length, elapsedMs: 0, kbPerSec: 0, etaMs: null, fallbackCount: 0 });

        const startedAt = performance.now();
        const attempt = await printClassic(printer, data);
        const writeMs = performance.now() - startedAt;

        if (!attempt.ok) {
          setProblem(attempt.problem);
          logsRef.current.push(`[FAILED] ${attempt.problem} after ${Math.round(writeMs)}ms`);
          setPrintLogs([...logsRef.current]);
          return { ok: false, problem: attempt.problem };
        }

        const kbPerSec = writeMs > 0 ? data.length / 1024 / (writeMs / 1000) : 0;
        // The time from "Print" to "receipt done" is render + raster encode + this write, all in sequence.
        const totalMs = writeMs + (renderTiming ? renderTiming.renderMs + renderTiming.rasterMs : 0);
        logsRef.current.push(
          `[COMPLETE] write: ${Math.round(writeMs)}ms (${kbPerSec.toFixed(1)} KB/s, single write, classic SPP${attempt.reconnected ? ", reconnected" : ""})` +
            (renderTiming ? ` | total: ${Math.round(totalMs)}ms` : ""),
        );
        setPrintLogs([...logsRef.current]);
        setPrintProgress({ chunkIndex: 1, bytesSent: data.length, totalBytes: data.length, elapsedMs: writeMs, kbPerSec, etaMs: 0, fallbackCount: 0 });
        setProblem(null);
        return { ok: true };
      }

      if (!connectionRef.current) return { ok: false, problem: "no-printer" };

      logsRef.current = [`[PRINT START] Size: ${(data.length / 1024).toFixed(1)} KB`];
      lastFlushRef.current = 0;
      lastChunkIndexRef.current = 0;
      fallbackCountRef.current = 0;
      setPrintLogs(logsRef.current);
      setPrintProgress({ chunkIndex: 0, bytesSent: 0, totalBytes: data.length, elapsedMs: 0, kbPerSec: 0, etaMs: null, fallbackCount: 0 });

      const onProgress = (event: PrintEvent) => {
        if (event.kind === "reconnect") {
          // Rare now that watchForDisconnect reconnects in the background; worth knowing about when it happens.
          logsRef.current.push(`[RECONNECT] GATT link re-established in ${Math.round(event.ms)}ms`);
          lastFlushRef.current = performance.now();
          setPrintLogs([...logsRef.current]);
          return;
        }

        if (event.kind === "fallback") {
          fallbackCountRef.current += 1;
          logsRef.current.push(`[RETRY] ${event.fromSize}-byte write refused; falling back to ${event.toSize} bytes`);
          lastFlushRef.current = performance.now();
          setPrintLogs([...logsRef.current]);
          setPrintProgress((prev) => (prev ? { ...prev, fallbackCount: fallbackCountRef.current } : prev));
          return;
        }

        lastChunkIndexRef.current = event.chunkIndex;
        logsRef.current.push(`Chunk ${event.chunkIndex}: ${event.chunkBytes} bytes sent`);

        const seconds = event.elapsedMs / 1000;
        const kbPerSec = seconds > 0 ? event.bytesSent / 1024 / seconds : 0;
        const remainingBytes = event.totalBytes - event.bytesSent;
        const etaMs = kbPerSec > 0 ? (remainingBytes / 1024 / kbPerSec) * 1000 : null;

        // Real-time but throttled; the final chunk always flushes at once.
        const now = performance.now();
        const isLastChunk = event.bytesSent >= event.totalBytes;
        if (isLastChunk || now - lastFlushRef.current >= UI_FLUSH_INTERVAL_MS) {
          lastFlushRef.current = now;
          setPrintLogs([...logsRef.current]);
          setPrintProgress({
            chunkIndex: event.chunkIndex,
            bytesSent: event.bytesSent,
            totalBytes: event.totalBytes,
            elapsedMs: event.elapsedMs,
            kbPerSec,
            etaMs,
            fallbackCount: fallbackCountRef.current,
          });
        }
      };

      try {
        // A dropped BLE link is re-established inside printToDevice, which hands back fresh GATT objects.
        const printStartedAt = performance.now();
        connectionRef.current = await printToDevice(connectionRef.current, data, onProgress);
        watchForDisconnect(connectionRef.current);

        const elapsedMs = performance.now() - printStartedAt;
        const kbPerSec = elapsedMs > 0 ? data.length / 1024 / (elapsedMs / 1000) : 0;
        logsRef.current.push(
          `[COMPLETE] ${data.length} bytes in ${Math.round(elapsedMs)}ms = ${kbPerSec.toFixed(1)} KB/s` +
            (fallbackCountRef.current > 0 ? ` (${fallbackCountRef.current} chunk-size fallback(s))` : ""),
        );
        setPrintLogs([...logsRef.current]);
        setPrintProgress({
          chunkIndex: lastChunkIndexRef.current,
          bytesSent: data.length,
          totalBytes: data.length,
          elapsedMs,
          kbPerSec,
          etaMs: 0,
          fallbackCount: fallbackCountRef.current,
        });
        setProblem(null);
        return { ok: true };
      } catch (err) {
        console.error("Print failed", err);
        const why = classifyPrintError(err);
        setProblem(why);
        logsRef.current.push(`[FAILED] ${err instanceof Error ? err.message : String(err)}`);
        setPrintLogs([...logsRef.current]);
        return { ok: false, problem: why };
      }
    },
    [watchForDisconnect],
  );

  const fake = devFakePrinter();
  return {
    status: fake ? "ready" : status,
    problem,
    deviceName: fake ? "சோதனை பிரிண்டர்" : deviceName,
    platform: PLATFORM,
    printerDevices,
    connect,
    selectPrinter,
    print,
    printLogs,
    printProgress,
  };
}
