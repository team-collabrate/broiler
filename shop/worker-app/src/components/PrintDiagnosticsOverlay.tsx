import { useLanguage } from "@kumbakonam/shared";
import type { PrintProgress } from "../hooks/usePrinter";
import "./PrintDiagnosticsOverlay.css";

export interface PrintDiagnosticsOverlayProps {
  progress: PrintProgress;
  logs: string[];
}

const STRINGS = {
  title: { en: "Print speed", ta: "பிரிண்ட் வேகம்" },
  chunk: { en: "Chunk", ta: "பகுதி" },
  remaining: { en: "remaining", ta: "மீதம்" },
  done: { en: "Done", ta: "முடிந்தது" },
  fallback: { en: "size drops", ta: "அளவு குறைப்புகள்" },
};

const fmtMs = (ms: number) => (ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`);

/**
 * On-screen readout of what usePrinter's onProgress callback is tracking —
 * built so the actual print speed (and where a slow bill is losing time)
 * is visible on the tablet itself, without plugging it into a laptop and
 * opening DevTools at the counter. Only ever mounted while printProgress
 * is non-null (see WorkerHome.tsx); disappears a couple of seconds after
 * a print completes rather than lingering as a stale readout on screen.
 */
export function PrintDiagnosticsOverlay({ progress, logs }: PrintDiagnosticsOverlayProps) {
  const { language } = useLanguage();
  const isComplete = progress.bytesSent >= progress.totalBytes;
  const percent = progress.totalBytes > 0 ? Math.min(100, (progress.bytesSent / progress.totalBytes) * 100) : 0;

  return (
    <div className="print-diag" role="status" aria-live="polite">
      <div className="print-diag__header">
        <span>{STRINGS.title[language]}</span>
        <span className="print-diag__speed">{progress.kbPerSec.toFixed(1)} KB/s</span>
      </div>

      <div className="print-diag__bar">
        <div className="print-diag__bar-fill" style={{ width: `${percent}%` }} />
      </div>

      <div className="print-diag__stats">
        <span>
          {STRINGS.chunk[language]} {progress.chunkIndex} · {(progress.bytesSent / 1024).toFixed(1)}/
          {(progress.totalBytes / 1024).toFixed(1)} KB
        </span>
        <span>
          {isComplete
            ? `${STRINGS.done[language]} · ${fmtMs(progress.elapsedMs)}`
            : progress.etaMs !== null
              ? `${fmtMs(progress.etaMs)} ${STRINGS.remaining[language]}`
              : "…"}
        </span>
      </div>

      {/* Only shown when it's actually happened — a print that's much
          slower than the configured chunk size/delay predicts is usually
          this: the printer refusing the configured size and most of the
          receipt going out in much smaller pieces instead. Surfaced as
          its own line, not left buried in the log below, since it's the
          single most likely answer to "why is this slower than expected". */}
      {progress.fallbackCount > 0 && (
        <div className="print-diag__fallback">
          ⚠ {progress.fallbackCount} {STRINGS.fallback[language]}
        </div>
      )}

      {/* Tail of the raw log, not the whole thing — at ~128B chunks a real
          receipt is 300-400+ lines, which would be unreadable as a wall of
          text; the numbers above already summarise it live. This is for
          spotting exactly where a print stalled or a chunk got refused. */}
      <div className="print-diag__log" aria-hidden="true">
        {logs.slice(-6).map((line, i) => (
          <div key={i} className="print-diag__log-line">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
