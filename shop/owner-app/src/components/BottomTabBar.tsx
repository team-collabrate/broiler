import { useLanguage, type Language } from "@kumbakonam/shared";
import "./BottomTabBar.css";

export type TabKey = "dashboard" | "reports" | "menu" | "settings";

const TABS: Array<{ key: TabKey; label: Record<Language, string>; icon: string }> = [
  { key: "dashboard", label: { en: "Dashboard", ta: "டாஷ்போர்டு" }, icon: "⌂" },
  { key: "reports", label: { en: "Reports", ta: "அறிக்கைகள்" }, icon: "▤" },
  { key: "menu", label: { en: "Menu", ta: "மெனு" }, icon: "☰" },
  { key: "settings", label: { en: "Settings", ta: "அமைப்புகள்" }, icon: "⚙" },
];

const NAV_LABEL = { en: "Main navigation", ta: "முதன்மை வழிசெலுத்தல்" };

export interface BottomTabBarProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

/** Design Brief §6 — bottom tab bar: Dashboard / Reports / Menu / Settings. */
export function BottomTabBar({ active, onChange }: BottomTabBarProps) {
  const { language } = useLanguage();
  return (
    <nav className="bottom-tabs" aria-label={NAV_LABEL[language]}>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`bottom-tabs__item ${active === tab.key ? "is-active" : ""}`}
          onClick={() => onChange(tab.key)}
          aria-current={active === tab.key ? "page" : undefined}
        >
          <span className="bottom-tabs__icon" aria-hidden="true">
            {tab.icon}
          </span>
          <span className="bottom-tabs__label">{tab.label[language]}</span>
        </button>
      ))}
    </nav>
  );
}
