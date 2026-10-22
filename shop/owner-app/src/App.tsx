import { useEffect } from "react";
import { useShopSession } from "@kumbakonam/shared/shop";
import { Shell } from "./Shell";
import { SignIn } from "./SignIn";

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

  if (session.status === "loading" || wrongAccount) return (
      <div className="ow-boot">
        <img className="ow-boot__logo" src="/logo.png" alt="" />
      </div>
    );
  if (session.status === "out") return <SignIn />;
  return <Shell onLogout={() => void signOut()} />;
}
