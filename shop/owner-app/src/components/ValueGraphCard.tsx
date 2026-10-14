import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, useLanguage } from "@kumbakonam/shared";
import type { ChartBucket } from "../utils/chartBuckets";
import "./ValueGraphCard.css";

export type GraphMode = "weekly" | "monthly";

const STRINGS = {
  title: { en: "Sales Trend", ta: "விற்பனை போக்கு" },
  weekly: { en: "Weekly", ta: "வாரம்" },
  monthly: { en: "Monthly", ta: "மாதம்" },
  periodLabel: { en: "Graph period", ta: "வரைபட காலம்" },
  loading: { en: "Loading…", ta: "ஏற்றுகிறது…" },
  empty: { en: "No sales yet in this period.", ta: "இந்தக் காலத்தில் இதுவரை விற்பனை இல்லை." },
};

export interface ValueGraphCardProps {
  mode: GraphMode;
  onModeChange: (mode: GraphMode) => void;
  data: ChartBucket[];
  loading: boolean;
}

/** The prominent sales-trend chart at the top of the Dashboard. */
export function ValueGraphCard({ mode, onModeChange, data, loading }: ValueGraphCardProps) {
  const { language } = useLanguage();
  return (
    <div className="value-graph-card">
      <div className="value-graph-card__header">
        <h2 className="value-graph-card__title">{STRINGS.title[language]}</h2>
        <div className="value-graph-card__toggle" role="radiogroup" aria-label={STRINGS.periodLabel[language]}>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "weekly"}
            className={mode === "weekly" ? "is-active" : ""}
            onClick={() => onModeChange("weekly")}
          >
            {STRINGS.weekly[language]}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "monthly"}
            className={mode === "monthly" ? "is-active" : ""}
            onClick={() => onModeChange("monthly")}
          >
            {STRINGS.monthly[language]}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="value-graph-card__status">{STRINGS.loading[language]}</p>
      ) : data.length === 0 ? (
        <p className="value-graph-card__status">{STRINGS.empty[language]}</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="valueGraphFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
            />
            <YAxis tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 13,
              }}
            />
            <Area type="monotone" dataKey="total" stroke="var(--color-accent)" strokeWidth={2} fill="url(#valueGraphFill)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
