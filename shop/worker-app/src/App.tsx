import { useRef } from "react";
import { signInCounterOrOwner, signInWithPin, useShopSession } from "@kumbakonam/shared/shop";
import { CounterScreen } from "./counter/CounterScreen";
import { PinScreen } from "./counter/PinScreen";
import { t } from "./counter/strings";
import "./counter/counter.css";

/**
 * Dev only: sign in anonymously so the till can be seen before the PIN accounts exist. `import.meta.env.DEV` is
 * false in a production build, so this can never switch on in a release.
 */
const DEV_SIGN_IN = import.meta.env.DEV && import.meta.env.VITE_DEV_ANON === "1";

export function App() {
  const { session, touch, signOut } = useShopSession({ developmentSignIn: DEV_SIGN_IN });
  // The PIN that signed this till in, kept in memory only, so it can sign back in after the owner has been in to set
  // today's rates.
  const counterPin = useRef<string | null>(null);

  if (session.status === "loading") return <div className="ct-boot">{t.connecting}</div>;

  if (session.status === "out") {
    return (
      <PinScreen
        logoUrl="/logo.png"
        title={t.signInTitle}
        subtitle={t.signInSubtitle}
        onSubmit={async (pin) => {
          await signInCounterOrOwner(pin);
          counterPin.current = pin;
        }}
      />
    );
  }

  return (
    // Any touch counts as activity; the till locks itself after 30 minutes of none.
    <div className="ct-root" onPointerDownCapture={touch} onKeyDownCapture={touch}>
      <CounterScreen
        role={session.role}
        signInOwner={(pin) => signInWithPin("owner", pin)}
        restoreCounter={async () => {
          const pin = counterPin.current;
          if (pin === null) return signOut();
          await signInCounterOrOwner(pin);
        }}
        onLock={() => {
          counterPin.current = null;
          void signOut();
        }}
      />
    </div>
  );
}
