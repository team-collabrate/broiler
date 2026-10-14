import { useState } from "react";
import { ConfirmDialog, LanguageToggle, useLanguage, type SessionUser } from "@kumbakonam/shared";
import "./SettingsScreen.css";

export interface SettingsScreenProps {
  sessionUser: SessionUser;
  onLogout: () => void;
}

const STRINGS = {
  title: { en: "Settings", ta: "அமைப்புகள்" },
  signedInAs: { en: "Signed in as", ta: "இப்படி உள்நுழைந்துள்ளீர்கள்" },
  language: { en: "Language", ta: "மொழி" },
  logOut: { en: "Log out", ta: "வெளியேறு" },
  logoutTitle: { en: "Log out?", ta: "வெளியேறவா?" },
  logoutMessage: {
    en: "You'll need to enter your PIN again to get back in.",
    ta: "மீண்டும் நுழைய உங்கள் பின் எண்ணை மீண்டும் உள்ளிட வேண்டும்.",
  },
  logoutConfirm: { en: "Log Out", ta: "வெளியேறு" },
};

export function SettingsScreen({ sessionUser, onLogout }: SettingsScreenProps) {
  const { language } = useLanguage();
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  return (
    <div className="settings-screen">
      <h1 className="settings-screen__title">{STRINGS.title[language]}</h1>

      <div className="settings-screen__card">
        <p className="settings-screen__label">{STRINGS.signedInAs[language]}</p>
        <p className="settings-screen__name">{sessionUser.name}</p>
      </div>

      <div className="settings-screen__card settings-screen__card--row">
        <p className="settings-screen__label">{STRINGS.language[language]}</p>
        <LanguageToggle />
      </div>

      <button type="button" className="settings-screen__logout" onClick={() => setConfirmingLogout(true)}>
        {STRINGS.logOut[language]}
      </button>

      {confirmingLogout && (
        <ConfirmDialog
          title={STRINGS.logoutTitle[language]}
          message={STRINGS.logoutMessage[language]}
          confirmLabel={STRINGS.logoutConfirm[language]}
          onConfirm={() => {
            setConfirmingLogout(false);
            onLogout();
          }}
          onCancel={() => setConfirmingLogout(false)}
        />
      )}
    </div>
  );
}
