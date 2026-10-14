import { LanguageToggle, useLanguage } from "@kumbakonam/shared";
import { SalesSection } from "../components/SalesSection";
import { ExpensesSection } from "../components/ExpensesSection";
import { LoanSection } from "../components/LoanSection";
import "./ItemSalesReport.css";

const STRINGS = {
  logout: { en: "Log out", ta: "வெளியேறு" },
  navSales: { en: "Sales", ta: "விற்பனை" },
  navExpenses: { en: "Expenses", ta: "செலவுகள்" },
  navLoan: { en: "Loan", ta: "கடன்" },
};

/** Jump-to-section targets, in the order they appear on the page — one
 *  source of both the nav buttons and what each button scrolls to, so the
 *  two can't drift out of sync. */
const NAV_TARGETS = [
  { id: "section-sales", label: "navSales" },
  { id: "section-expenses", label: "navExpenses" },
  { id: "section-loan", label: "navLoan" },
] as const;

export interface ItemSalesReportProps {
  onLogout: () => void;
}

/** Standalone page (its own Firebase Hosting site — kumbakonam-reports)
 *  now covering three separate downloadable reports (requested 2026-09-04
 *  after Sales alone shipped: "download the Spending and Khata in the
 *  reports page... with details"), each its own section with its own data
 *  subscription and its own per-day (or, for Loan, single) Download
 *  button — see SalesSection/ExpensesSection/LoanSection. Gated by the
 *  same owner PIN login as owner-app; modeled loosely on the
 *  dairy-reports.vercel.app reference the owner first pointed at
 *  (date-grouped cards + an Export button), rebuilt for this app's own
 *  data rather than that app's vendor-bill data. */
export function ItemSalesReport({ onLogout }: ItemSalesReportProps) {
  const { language } = useLanguage();

  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="sales-report">
      <header className="sales-report__header">
        {/* Logo instead of a "Reports" text heading — requested 2026-09-04.
            Same asset/onError pattern as PinEntryScreen's own logo (shared
            package has no asset pipeline; each app serves its own
            public/logo.png), copied into reports-app/public for this. */}
        <img
          className="sales-report__logo"
          src="/logo.png"
          alt="Kumbakonam Cafe"
          width={44}
          height={40}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        <div className="sales-report__actions">
          <LanguageToggle />
          <button type="button" className="sales-report__logout" onClick={onLogout}>
            {STRINGS.logout[language]}
          </button>
        </div>
      </header>

      {/* Sticky, not just top-of-page — three long day-grouped sections made
          getting back to Expenses/Loan from further down mean scrolling all
          the way back up first (requested 2026-09-04: "hard to scroll to
          down... give sales - expenses - loan button to navigate"). Stays
          reachable from anywhere on the page instead. */}
      <nav className="sales-report__nav" aria-label="Jump to section">
        {NAV_TARGETS.map((target) => (
          <button key={target.id} type="button" className="sales-report__nav-btn" onClick={() => jumpTo(target.id)}>
            {STRINGS[target.label][language]}
          </button>
        ))}
      </nav>

      <SalesSection />
      <ExpensesSection />
      <LoanSection />
    </div>
  );
}
