import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@kumbakonam/shared/theme.css";
import { initFirebase, LanguageProvider, seedBillCounterFromServer, SessionProvider } from "@kumbakonam/shared";
import { App } from "./App";
import { ReceiptPreview } from "./pages/ReceiptPreview";

// Worker app gets offline persistence — it must keep taking orders on flaky cafe wifi (TDD §4).
initFirebase({ offlinePersistence: true });

// Best-effort, once per app load — catches this device's local bill
// counter up to Firestore's high-water-mark if it's behind (see
// billCounter.ts). Never blocks rendering: if this is offline right now,
// the counter just starts from whatever it already has locally.
seedBillCounterFromServer();

// /?receipt shows the bill as the printer will get it, with no sign-in (it shows sample bills only).
if (new URLSearchParams(window.location.search).has("receipt")) {
  createRoot(document.getElementById("root")!).render(<ReceiptPreview />);
} else {
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <SessionProvider expectedRole="worker">
        <App />
      </SessionProvider>
    </LanguageProvider>
  </StrictMode>,
);
}
