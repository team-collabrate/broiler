import { useEffect } from "react";
import { useShopSession } from "@kumbakonam/shared/shop";
import { Shell } from "./Shell";
import { SignIn } from "./SignIn";

/** Where the admin may be opened inside the counter app: the counter locks it again when it is closed (see below). */
const COUNTER_ORIGINS = ["https://broiler-pos.web.app", ...(import.meta.env.DEV ? ["http://localhost:3000", "http://localhost:3002"] : [])];

/**
 * The owner's app. Only the managing PIN gets in: a signed-in session that is not the owner (the billing account)
 * is signed out at once. The server's rules are the real boundary; this just keeps the wrong screen from showing.
 */
export function App() {
  const { session, signOut } = useShopSession();
  const wrongAccount = session.status === "in" && session.role !== "owner";

  useEffect(() => {
    if (wrongAccount) void signOut();
  }, [wrongAccount, signOut]);

  // When the counter closes the admin it says so, and the admin signs out: the next opening asks for the PIN again.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (COUNTER_ORIGINS.includes(event.origin) && (event.data as { type?: string } | null)?.type === "broiler-lock") void signOut();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [signOut]);

  if (session.status === "loading" || wrongAccount) return (
      <div className="ow-boot">
        <img className="ow-boot__logo" src="/logo.png" alt="" />
      </div>
    );
  if (session.status === "out") return <SignIn />;
  return <Shell onLogout={() => void signOut()} />;
}
