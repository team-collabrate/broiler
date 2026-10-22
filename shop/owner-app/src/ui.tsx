import { useEffect, type ReactNode } from "react";

/** A panel that slides up over the screen, with a title and a close button. */
export function Sheet({ title, subtitle, onClose, busy = false, children, footer }: { title: string; subtitle?: string; onClose: () => void; busy?: boolean; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);
  return (
    <div className="ow-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="ow-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header className="ow-sheet__header">
          <div className="ow-sheet__heading">
            <h2 className="ow-sheet__title">{title}</h2>
            {subtitle && <p className="ow-sheet__sub">{subtitle}</p>}
          </div>
          <button type="button" className="ow-sheet__close" aria-label="Close" disabled={busy} onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="ow-sheet__body">{children}</div>
        {footer && <footer className="ow-sheet__footer">{footer}</footer>}
      </div>
    </div>
  );
}

/** A coloured strip for a warning or an error. */
export function Notice({ tone, children }: { tone: "warn" | "error" | "info"; children: ReactNode }) {
  return (
    <p className={`ow-notice ow-notice--${tone}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}

export interface Bar {
  label: string;
  value: number;
}

/** Simple bars, tallest = full height. `labelEvery` thins the labels under many bars. */
export function BarChart({ bars, labelEvery = 1, format, caption }: { bars: Bar[]; labelEvery?: number; format: (value: number) => string; caption?: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const best = bars.reduce<Bar | null>((top, b) => (b.value > (top?.value ?? 0) ? b : top), null);
  return (
    <div className="ow-chart">
      <div className="ow-chart__bars" role="img" aria-label={caption ?? "Sales chart"}>
        {bars.map((b, i) => (
          <div key={`${i}-${b.label}`} className="ow-chart__col" title={`${b.label}: ${format(b.value)}`}>
            <div className={`ow-chart__bar${best === b ? " is-best" : ""}`} style={{ height: `${b.value > 0 ? Math.max(4, (b.value / max) * 100) : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="ow-chart__labels" aria-hidden="true">
        {bars.map((b, i) => (
          <span key={`${i}-${b.label}`}>{i % labelEvery === 0 ? b.label : ""}</span>
        ))}
      </div>
      {best && (
        <p className="ow-chart__best">
          Best: {best.label} · {format(best.value)}
        </p>
      )}
    </div>
  );
}

/** The small line icons of the tab bar. */
export function TabIcon({ name }: { name: "dashboard" | "reports" | "bills" | "credit" }) {
  const paths: Record<typeof name, ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </>
    ),
    reports: (
      <>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </>
    ),
    bills: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
      </>
    ),
    credit: (
      <>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </>
    ),
  };
  return (
    <svg className="ow-tab__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
