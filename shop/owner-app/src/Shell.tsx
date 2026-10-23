import { useState } from "react";
import { useOwnerData } from "./data";
import { Bills } from "./Bills";
import { Credit } from "./Credit";
import { Dashboard } from "./Dashboard";
import { Rates } from "./Rates";
import { Reports } from "./Reports";
import { Notice, Sheet, TabIcon } from "./ui";
import { timeText } from "./fmt";

type Tab = "dashboard" | "reports" | "bills" | "credit" | "rates";

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "முகப்பு" },
  { key: "reports", label: "கணக்கு" },
  { key: "bills", label: "பில்" },
  { key: "credit", label: "கடன்" },
  { key: "rates", label: "விலை" },
];

/** The billing counter. The admin was usually opened from its gear button, so a button leads back. */
const COUNTER_URL = "https://broiler-pos.web.app";
const fromCounter = (() => {
  try {
    // Not when the admin is shown inside the counter app: the counter has its own way back.
    return window.self === window.top && document.referrer.startsWith(COUNTER_URL);
  } catch {
    return false;
  }
})();

/** The signed-in owner: a header, the four screens and the tab bar. */
export function Shell({ onLogout }: { onLogout: () => void }) {
  const data = useOwnerData();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  return (
    <div className="ow-app">
      <header className="ow-header">
        <img className="ow-header__logo" src="/logo.png" alt="" />
        <div className="ow-header__text">
          <h1 className="ow-header__title">HONEY BROILERS</h1>
          <p className="ow-header__sub">{data.busy ? "புதுப்பிக்கிறது…" : data.status === "ready" ? `புதுப்பித்தது ${timeText(data.now)}` : "நிர்வாகம்"}</p>
        </div>
        {fromCounter && (
          <button type="button" className="ow-header__button" onClick={() => window.location.assign(COUNTER_URL)}>
            ◀ கவுண்டர்
          </button>
        )}
        <button type="button" className="ow-header__button" disabled={data.busy} onClick={() => void data.refresh()}>
          புதுப்பி
        </button>
        <button type="button" className="ow-header__button ow-header__button--quiet" onClick={() => setConfirmingLogout(true)}>
          வெளியேறு
        </button>
      </header>

      <main className="ow-main">
        {data.error && <Notice tone="error">{data.error}</Notice>}
        {data.tidyNote && <Notice tone="info">{data.tidyNote}</Notice>}
        {data.status === "loading" ? (
          <p className="ow-empty">ஏற்றுகிறது…</p>
        ) : data.status === "error" ? (
          <p className="ow-empty">கணக்கு வரவில்லை. "புதுப்பி" அழுத்தி மீண்டும் முயற்சிக்கவும்.</p>
        ) : (
          <>
            {tab === "dashboard" && <Dashboard data={data} onOpenCredit={() => setTab("credit")} onOpenRates={() => setTab("rates")} />}
            {tab === "reports" && <Reports data={data} />}
            {tab === "bills" && <Bills data={data} />}
            {tab === "credit" && <Credit data={data} />}
            {tab === "rates" && <Rates data={data} />}
          </>
        )}
      </main>

      <nav className="ow-tabs" aria-label="பக்கங்கள்">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`ow-tab${tab === t.key ? " is-active" : ""}`} aria-current={tab === t.key ? "page" : undefined} onClick={() => setTab(t.key)}>
            <TabIcon name={t.key} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {confirmingLogout && (
        <Sheet
          title="வெளியேறவா?"
          subtitle="மீண்டும் உள்நுழைய நிர்வாகம் PIN வேண்டும்."
          onClose={() => setConfirmingLogout(false)}
          footer={
            <>
              <button type="button" className="ow-btn" onClick={() => setConfirmingLogout(false)}>
                வேண்டாம்
              </button>
              <button type="button" className="ow-btn ow-btn--primary" onClick={onLogout}>
                வெளியேறு
              </button>
            </>
          }
        >
          <p className="ow-text">வெளியேறினால் கணக்குகள் இந்த போனில் இருக்காது.</p>
        </Sheet>
      )}
    </div>
  );
}
