import { useLanguage, type Language } from "@kumbakonam/shared";
import type { RangeMode } from "../utils/dateRange";
import "./RangeSegmentedControl.css";

const OPTIONS: Array<{ value: RangeMode; label: Record<Language, string> }> = [
  { value: "recent", label: { en: "2 Days", ta: "2 நாட்கள்" } },
  { value: "daily", label: { en: "Daily", ta: "தினசரி" } },
  { value: "weekly", label: { en: "Weekly", ta: "வாரம்" } },
  { value: "monthly", label: { en: "Monthly", ta: "மாதம்" } },
];

const ARIA_LABEL = { en: "Report period", ta: "அறிக்கை காலம்" };

export interface RangeSegmentedControlProps {
  value: RangeMode;
  onChange: (mode: RangeMode) => void;
}

export function RangeSegmentedControl({ value, onChange }: RangeSegmentedControlProps) {
  const { language } = useLanguage();
  return (
    <div className="range-control" role="radiogroup" aria-label={ARIA_LABEL[language]}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={`range-control__option ${value === opt.value ? "is-selected" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label[language]}
        </button>
      ))}
    </div>
  );
}
