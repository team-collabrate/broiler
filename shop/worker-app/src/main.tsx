import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@kumbakonam/shared/theme.css";
import { initFirebase, LanguageProvider } from "@kumbakonam/shared";
import { App } from "./App";
import { ReceiptPreview } from "./pages/ReceiptPreview";

// The counter keeps an offline cache so the menu and queued sales survive a dropped connection.
initFirebase({ offlinePersistence: true });

// /?receipt shows the bill as the printer will get it, with no sign-in (it shows sample bills only).
if (new URLSearchParams(window.location.search).has("receipt")) {
  createRoot(document.getElementById("root")!).render(<ReceiptPreview />);
} else {
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);
}
