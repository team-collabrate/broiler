import { useRef, useState } from "react";
import { t } from "./strings";

/** The admin site, shown inside the counter app (in development, the local admin on port 3003). */
const ADMIN_URL = import.meta.env.DEV ? "http://localhost:3003" : "https://broiler-pos-admin.web.app";
const ADMIN_ORIGIN = new URL(ADMIN_URL).origin;

/**
 * The admin, full screen over the counter, so everything can be done without leaving the app. It is the admin site
 * itself in a frame: it asks for the managing PIN, and the counter's own sign-in is left alone (they keep separate
 * storage). Closing it tells the admin to sign out, so the next opening asks for the PIN again.
 */
export function AdminSheet({ onClose }: { onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [closing, setClosing] = useState(false);

  const close = () => {
    if (closing) return;
    setClosing(true);
    frame.current?.contentWindow?.postMessage({ type: "broiler-lock" }, ADMIN_ORIGIN);
    // Give the message a moment to arrive before the frame goes away.
    setTimeout(onClose, 600);
  };

  return (
    <div className="ct-admin" role="dialog" aria-modal="true" aria-label={t.admin} style={closing ? { visibility: "hidden" } : undefined}>
      <header className="ct-admin__bar">
        <button type="button" className="ct-admin__back" onClick={close}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {t.backToBilling}
        </button>
        <strong className="ct-admin__title">{t.admin}</strong>
      </header>
      <div className="ct-admin__body">
        {!loaded && <p className="ct-admin__loading">{t.loadingAdmin}</p>}
        <iframe ref={frame} className="ct-admin__frame" src={ADMIN_URL} title={t.admin} onLoad={() => setLoaded(true)} />
      </div>
    </div>
  );
}
