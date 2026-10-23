import { registerSW } from "virtual:pwa-register";

// The counter keeps a copy of itself on the tablet (a service worker), so after a new version is published the tablet
// would go on running the old one until someone reloaded it by hand. This checks for a new version when the app comes
// back to the front and every 10 minutes, and switches to it as soon as the till is quiet: nothing touched for 60
// seconds, or the app sent to the background. A half-made bill is never reloaded under the cashier's hands.

const CHECK_EVERY_MS = 10 * 60 * 1000;
const QUIET_FOR_MS = 60 * 1000;

export function keepCounterUpToDate(): void {
  let waiting = false;
  let lastTouch = Date.now();
  let apply: (() => void) | null = null;

  const maybeApply = () => {
    if (waiting && apply && (document.visibilityState === "hidden" || Date.now() - lastTouch >= QUIET_FOR_MS)) {
      const go = apply;
      apply = null;
      go();
    }
  };

  window.addEventListener("pointerdown", () => (lastTouch = Date.now()), { capture: true, passive: true });
  document.addEventListener("visibilitychange", maybeApply);
  setInterval(maybeApply, 10_000);

  const update = registerSW({
    immediate: true,
    onNeedRefresh() {
      waiting = true;
      apply = () => void update(true);
      maybeApply();
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => void registration.update().catch(() => undefined);
      document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && check());
      setInterval(check, CHECK_EVERY_MS);
    },
  });
}

/**
 * "Update app now": forgets the stored copy of the app (the service worker and its file cache) and loads the newest
 * version from the server. Bills, the upload queue, the sign-in and the printer are not touched: they live in other
 * storage, which this leaves alone. Needs the internet.
 */
export async function refreshApp(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations();
    await Promise.all((registrations ?? []).map((r) => r.unregister()));
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
  } finally {
    window.location.reload();
  }
}
