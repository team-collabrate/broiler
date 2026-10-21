import { useEffect, useState } from "react";
import { collection, disableNetwork, enableNetwork, limit, onSnapshot, query } from "firebase/firestore";
import { getFirestoreDb } from "../firebase";
import { useOnlineStatus } from "../hooks";

/** How long the tablet may serve from its own copy before the screen admits it cannot reach the server. */
const GRACE_MS = 4000;

/**
 * Whether the server can really be reached. The browser's online flag only knows whether the tablet has a network,
 * not whether the internet works behind it (a router with no line looks "online"). Firestore knows: a live
 * listener is answered from the tablet's own copy exactly when the server cannot be reached. The listener is a
 * one-product query on the menu, which every signed-in staff account may read. The first answer after a launch
 * always comes from the copy, so it is given a few seconds before it counts.
 */
export function useServerConnection(): boolean {
  const networkUp = useOnlineStatus();
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = onSnapshot(
      query(collection(getFirestoreDb(), "menu"), limit(1)),
      { includeMetadataChanges: true },
      (snap) => {
        clearTimeout(timer);
        if (snap.metadata.fromCache) timer = setTimeout(() => setReachable(false), GRACE_MS);
        else setReachable(true);
      },
      () => undefined,
    );
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, []);

  return networkUp && reachable;
}

/**
 * Development only: puts `window.__broiler.offline()` and `.online()` on the page so a test can cut and restore
 * Firestore's connection, as switching airplane mode would. `import.meta.env.DEV` is false in a production build,
 * so none of this ships.
 */
export function installDevelopmentNetworkSwitch(): void {
  if (!import.meta.env.DEV) return;
  const db = getFirestoreDb();
  Object.assign(window, {
    __broiler: {
      offline: () => disableNetwork(db),
      online: () => enableNetwork(db),
    },
  });
}
