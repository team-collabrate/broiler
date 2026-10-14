import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@kumbakonam/shared/theme.css";
import { initFirebase, LanguageProvider, SessionProvider } from "@kumbakonam/shared";
import { App } from "./App";

// Standalone report page — read-only, its own Firebase Hosting site, same
// project/data as the owner app. No offline queue: nothing here is ever
// written, only read and exported.
initFirebase({ offlinePersistence: false });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      {/* Same PIN gate as the owner app (expectedRole="owner") — this is a
          separate URL, not a separate access model. Firestore rules only
          require *some* signed-in (anonymous) user, so the PIN screen is
          the actual barrier keeping sales figures away from anyone who
          just has the link; a standalone page skipping it, like the
          dairy-reports.vercel.app reference does, would leave the data
          open to anyone who found the URL. */}
      <SessionProvider expectedRole="owner">
        <App />
      </SessionProvider>
    </LanguageProvider>
  </StrictMode>,
);
