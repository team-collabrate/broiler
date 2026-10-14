import { useEffect, useState } from "react";
import type { AppTheme } from "../theme";
import { LanguageToggle, useLanguage } from "../../i18n";
import "./PinEntryScreen.css";

const PIN_LENGTH = 4;
const KEYPAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

const STRINGS = {
  checking: { en: "Checking…", ta: "சரிபார்க்கிறது…" },
  backspace: { en: "Backspace", ta: "பின் நீக்கு" },
};

export interface PinEntryScreenProps {
  theme: AppTheme;
  title: string;
  subtitle?: string;
  onSubmit: (pin: string) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
}

/** Shared numeric PIN pad — TDD §5, Design Brief §7 ("PIN pad, 4 digits, masked dots"). */
export function PinEntryScreen({
  theme,
  title,
  subtitle,
  onSubmit,
  loading = false,
  error = null,
}: PinEntryScreenProps) {
  const [pin, setPin] = useState("");
  const { language } = useLanguage();

  const handleDigit = (digit: string) => {
    if (loading || pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      void onSubmit(next);
      setPin("");
    }
  };

  const handleBackspace = () => {
    if (loading) return;
    setPin((p) => p.slice(0, -1));
  };

  // A counter tablet with a keyboard attached should be able to type the PIN too.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, loading]);

  return (
    <div className="pin-screen" data-theme={theme}>
      <div className="pin-screen__panel">
        <div className="pin-screen__lang">
          <LanguageToggle />
        </div>

        {/* Served from each app's own public/ — the shared package has no
            asset pipeline of its own. onError hides it rather than leaving a
            broken-image glyph on the screen staff see most often. */}
        <img
          className="pin-screen__logo"
          src="/logo.png"
          alt=""
          width={132}
          height={119}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />

        <h1 className="pin-screen__title">{title}</h1>
        {subtitle && <p className="pin-screen__subtitle">{subtitle}</p>}

        <div className="pin-screen__dots" aria-hidden="true">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span key={i} className={`pin-screen__dot ${i < pin.length ? "is-filled" : ""}`} />
          ))}
        </div>

        <div className="pin-screen__status" role="status">
          {loading ? STRINGS.checking[language] : error ?? " "}
        </div>

        <div className="pin-screen__keypad">
          {KEYPAD_DIGITS.map((key, i) => {
            if (key === "") return <div key={i} />;
            if (key === "back") {
              return (
                <button
                  key={i}
                  type="button"
                  className="pin-screen__key pin-screen__key--back"
                  onClick={handleBackspace}
                  disabled={loading || pin.length === 0}
                  aria-label={STRINGS.backspace[language]}
                >
                  ⌫
                </button>
              );
            }
            return (
              <button
                key={i}
                type="button"
                className="pin-screen__key"
                onClick={() => handleDigit(key)}
                disabled={loading}
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
