import { PinEntryScreen, useLanguage, useSession } from "@kumbakonam/shared";
import { ItemSalesReport } from "./pages/ItemSalesReport";
import "./App.css";

const STRINGS = {
  subtitleReady: { en: "Enter your PIN", ta: "உங்கள் பின் எண்ணை உள்ளிடவும்" },
  subtitleConnecting: { en: "Connecting…", ta: "இணைக்கிறது…" },
};

export function App() {
  const { ready, sessionUser, loading, error, login, logout } = useSession();
  const { language } = useLanguage();

  if (!sessionUser) {
    return (
      <PinEntryScreen
        theme="light"
        title="Sales Report"
        subtitle={ready ? STRINGS.subtitleReady[language] : STRINGS.subtitleConnecting[language]}
        onSubmit={login}
        loading={loading}
        error={error}
      />
    );
  }

  // Same cold-boot ordering note as owner-app's App.tsx: a restored session
  // can set sessionUser before anonymous auth finishes, so wait for `ready`
  // before mounting anything that queries Firestore.
  if (!ready) {
    return <div className="app-loading">{STRINGS.subtitleConnecting[language]}</div>;
  }

  return <ItemSalesReport onLogout={logout} />;
}
