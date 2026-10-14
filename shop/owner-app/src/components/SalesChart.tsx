import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, useLanguage } from "@kumbakonam/shared";
import type { ChartBucket } from "../utils/chartBuckets";
import "./SalesChart.css";

const EMPTY = { en: "No sales yet in this period.", ta: "இந்தக் காலத்தில் இதுவரை விற்பனை இல்லை." };

export interface SalesChartProps {
  data: ChartBucket[];
}

export function SalesChart({ data }: SalesChartProps) {
  const { language } = useLanguage();
  if (data.length === 0) {
    return <p className="sales-chart__empty">{EMPTY[language]}</p>;
  }

  return (
    <div className="sales-chart">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          {/* A flat fill read as slightly heavy against this light card —
              a subtle top-to-bottom gradient of the same accent gives the
              bars depth without introducing a second colour. */}
          <defs>
            <linearGradient id="salesBarFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={1} />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.75} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            // Recharts' default hover cursor is a flat grey block that
            // reads as harsher than anything else on this card — a soft
            // tint of the card's own border colour matches every other
            // hover/press state in the app instead of standing apart.
            cursor={{ fill: "var(--color-border)", opacity: 0.5 }}
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 13,
              boxShadow: "var(--shadow-md)",
            }}
          />
          <Bar
            dataKey="total"
            fill="url(#salesBarFill)"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
            // Full-strength on hover (the gradient above is already 75%
            // at its base) — a real hover response instead of the
            // near-invisible one behind Recharts' own default.
            activeBar={{ fill: "var(--color-accent)", fillOpacity: 1 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
