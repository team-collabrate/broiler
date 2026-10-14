import "./StatCard.css";

/** Semantic colouring for figures that can turn bad — kept separate from the
 *  brand accent so it reads as a state, not as emphasis. */
export type StatTone = "neutral" | "spend" | "positive" | "negative";

export interface StatCardProps {
  label: string;
  value: string;
  tone?: StatTone;
}

/** Design Brief §6/§7 — top summary cards, readable "at a glance". */
export function StatCard({ label, value, tone = "neutral" }: StatCardProps) {
  return (
    <div className="stat-card">
      <p className="stat-card__label">{label}</p>
      <p className={`stat-card__value stat-card__value--${tone}`}>{value}</p>
    </div>
  );
}
