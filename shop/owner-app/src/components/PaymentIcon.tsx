import type { Order } from "@kumbakonam/shared";

/** Hand-drawn stroke icons, one per payment method — same grid/weight/line
 *  style as the worker app's SidebarIcons.tsx (24x24, stroke=currentColor,
 *  no fill), so a shape brought over from that app still reads as the same
 *  family here. Distinguishes payment method by icon shape, not colour —
 *  WorkerDot right next to this already owns colour on this row (who
 *  billed it); a second colour channel for a different fact (how they
 *  paid) would compete with it rather than add information. */
const BASE = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function CashIcon() {
  return (
    <svg {...BASE}>
      <rect x="3" y="6.5" width="18" height="11" rx="1.6" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 6.5v11M18 6.5v11" />
    </svg>
  );
}

function UpiIcon() {
  return (
    <svg {...BASE}>
      <rect x="6.5" y="3" width="11" height="18" rx="2" />
      <path d="M9.5 7.5h5M9.5 11h5M9.5 14.5h2.5" />
      <circle cx="12" cy="18" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SplitIcon() {
  return (
    <svg {...BASE}>
      <path d="M4 6h4l4 12h8" />
      <path d="M4 18h4l2.5-7.5" />
      <path d="M17 3l3 3-3 3M17 15l3 3-3 3" />
    </svg>
  );
}

/** "Credit" here is the shop's own khata/on-account tab, not a bank credit
 *  card — a ledger reads truer to that than a card glyph would. */
function CreditIcon() {
  return (
    <svg {...BASE}>
      <path d="M5 4.5h11.5a2 2 0 0 1 2 2V19a1.5 1.5 0 0 1-1.5 1.5H7a2 2 0 0 1-2-2z" />
      <path d="M5 18.5a2 2 0 0 1 2-2h9.5" />
      <path d="M8.5 9h6M8.5 12h6" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg {...BASE}>
      <rect x="3" y="5.5" width="18" height="13" rx="1.8" />
      <path d="M3 9.5h18" />
      <path d="M6.5 14.5h4" />
    </svg>
  );
}

const ICONS: Record<Order["paymentMethod"], () => React.JSX.Element> = {
  cash: CashIcon,
  upi: UpiIcon,
  split: SplitIcon,
  credit: CreditIcon,
  card: CardIcon,
};

export function PaymentIcon({ method }: { method: Order["paymentMethod"] }) {
  const Icon = ICONS[method];
  return <Icon />;
}
