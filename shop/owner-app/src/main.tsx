import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@kumbakonam/shared/theme.css";
import { initFirebase, LanguageProvider, SessionProvider } from "@kumbakonam/shared";
import { App } from "./App";

// Owner app is read-mostly (dashboard + menu edits) — no offline write queue needed (TDD §4).
initFirebase({ offlinePersistence: false });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <SessionProvider expectedRole="owner">
        <App />
      </SessionProvider>
    </LanguageProvider>
  </StrictMode>,
);
