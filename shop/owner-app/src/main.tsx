import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@kumbakonam/shared/theme.css";
import { initFirebase } from "@kumbakonam/shared";
import { App } from "./App";
import "./app.css";

// The owner's app reads on demand (opening, Refresh), so it needs no offline cache of the database.
initFirebase({ offlinePersistence: false });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
