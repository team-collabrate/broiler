import { PinEntryScreen, useLanguage, useSession } from "@kumbakonam/shared";
import { WorkerHome } from "./pages/WorkerHome";
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
        theme="dark"
        title="Kumbakonam POS"
        subtitle={ready ? STRINGS.subtitleReady[language] : STRINGS.subtitleConnecting[language]}
        onSubmit={login}
        // Not gated on `ready` — the keypad accepts input immediately;
        // login() itself waits for the same readiness internally, so the
        // background handshake happens while the worker is still typing
        // instead of freezing the keypad before they're allowed to start.
        loading={loading}
        error={error}
      />
    );
  }

  // A restored session (see shared/auth/session.tsx) sets sessionUser
  // synchronously, before anonymous auth has necessarily finished — render
  // WorkerHome (and its Firestore listeners) a beat too early here and
  // they fail once, permanently, rather than just waiting the extra few
  // ms. This only ever shows on that cold-boot path; a fresh PIN login
  // never reaches this branch, since login() itself already waited for
  // `ready` before it could succeed.
  if (!ready) {
    return <div className="app-loading">{STRINGS.subtitleConnecting[language]}</div>;
  }

  return <WorkerHome sessionUser={sessionUser} onLogout={logout} />;
}
