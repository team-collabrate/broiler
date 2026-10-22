import { useState } from "react";
import { useOwnerData } from "./data";
import { Bills } from "./Bills";
import { Credit } from "./Credit";
import { Dashboard } from "./Dashboard";
import { Reports } from "./Reports";
import { Notice, Sheet, TabIcon } from "./ui";
import { timeText } from "./fmt";

type Tab = "dashboard" | "reports" | "bills" | "credit";

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "reports", label: "Reports" },
  { key: "bills", label: "Bills" },
  { key: "credit", label: "Credit" },
];

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
          <h1 className="ow-header__title">Honey Broilers</h1>
          <p className="ow-header__sub">{data.busy ? "Updating…" : data.status === "ready" ? `Updated ${timeText(data.now)}` : "Owner"}</p>
        </div>
        <button type="button" className="ow-header__button" disabled={data.busy} onClick={() => void data.refresh()}>
          Refresh
        </button>
        <button type="button" className="ow-header__button ow-header__button--quiet" onClick={() => setConfirmingLogout(true)}>
          Log out
        </button>
      </header>

      <main className="ow-main">
        {data.error && <Notice tone="error">{data.error}</Notice>}
        {data.tidyNote && <Notice tone="info">{data.tidyNote}</Notice>}
        {data.status === "loading" ? (
          <p className="ow-empty">Loading…</p>
        ) : data.status === "error" ? (
          <p className="ow-empty">The figures could not be loaded. Press Refresh to try again.</p>
        ) : (
          <>
            {tab === "dashboard" && <Dashboard data={data} onOpenCredit={() => setTab("credit")} />}
            {tab === "reports" && <Reports data={data} />}
            {tab === "bills" && <Bills data={data} />}
            {tab === "credit" && <Credit data={data} />}
          </>
        )}
      </main>

      <nav className="ow-tabs" aria-label="Screens">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`ow-tab${tab === t.key ? " is-active" : ""}`} aria-current={tab === t.key ? "page" : undefined} onClick={() => setTab(t.key)}>
            <TabIcon name={t.key} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {confirmingLogout && (
        <Sheet
          title="Log out?"
          subtitle="You will need the managing PIN to get back in."
          onClose={() => setConfirmingLogout(false)}
          footer={
            <>
              <button type="button" className="ow-btn" onClick={() => setConfirmingLogout(false)}>
                Stay
              </button>
              <button type="button" className="ow-btn ow-btn--primary" onClick={onLogout}>
                Log out
              </button>
            </>
          }
        >
          <p className="ow-text">Your figures are not kept on this phone after you log out.</p>
        </Sheet>
      )}
    </div>
  );
}
