import { useLanguage } from "./LanguageContext";
import "./LanguageToggle.css";

/** Small pill button that switches the whole app between English and Tamil. */
export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();
  return (
    <button
      type="button"
      className="language-toggle"
      onClick={toggleLanguage}
      aria-label={language === "en" ? "தமிழுக்கு மாறு" : "Switch to English"}
    >
      {language === "en" ? "தமிழ்" : "English"}
    </button>
  );
}
