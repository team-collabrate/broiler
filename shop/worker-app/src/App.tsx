import { useRef } from "react";
import { rememberPin, signInCounterOrOwner, signInWithPin, useScreenLock, useShopSession } from "@kumbakonam/shared/shop";
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
  const { session, signOut } = useShopSession({ developmentSignIn: DEV_SIGN_IN });
  const role = session.status === "in" ? session.role : null;
  // The screen locks after 30 idle minutes but the tablet stays signed in, so waiting bills keep uploading and the
  // till can be unlocked with no internet.
  const lock = useScreenLock({ enabled: role !== null && !DEV_SIGN_IN, role });
  // The PIN that signed this till in, kept in memory only, so it can sign back in after the owner has been in to set
  // today's rates.
  const counterPin = useRef<string | null>(null);

  if (session.status === "loading") return (
      <div className="ct-boot">
        <img className="ct-boot__logo" src="/logo.png" alt="" />
      </div>
    );

  if (session.status === "out") {
    return (
      <PinScreen
        logoUrl="/logo.png"
        title={t.signInTitle}
        subtitle={t.signInSubtitle}
        onSubmit={async (pin) => {
          // Starts the idle clock before the sign-in, so the screen cannot lock itself the moment it opens.
          lock.reset();
          const signedInAs = await signInCounterOrOwner(pin);
          counterPin.current = pin;
          await rememberPin(signedInAs, pin);
        }}
      />
    );
  }

  return (
    // Any touch counts as activity.
    <div className="ct-root" onPointerDownCapture={lock.touch} onKeyDownCapture={lock.touch}>
      {/* Kept mounted while locked, hidden, so a half-built bill is still there after the PIN. */}
      <div style={{ height: "100%", display: lock.locked ? "none" : undefined }}>
        <CounterScreen
          role={session.role}
          signInOwner={(pin) => signInWithPin("owner", pin)}
          restoreCounter={async () => {
            const pin = counterPin.current;
            try {
              if (pin === null) throw new Error("no PIN in memory");
              await signInCounterOrOwner(pin);
            } catch (error) {
              // Never leave the owner's session open at the counter: sign out, and the PIN screen takes over.
              await signOut();
              throw error;
            }
          }}
          onLock={lock.lock}
        />
      </div>
      {lock.locked && (
        <PinScreen
          logoUrl="/logo.png"
          title={t.lockedTitle}
          subtitle={t.lockedSubtitle}
          onSubmit={async (pin) => {
            await lock.unlock(pin);
            counterPin.current = pin;
          }}
        />
      )}
    </div>
  );
}
