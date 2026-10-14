import type { FirestoreError } from "firebase/firestore";
import type { Language } from "../i18n";

const MESSAGES: Record<"permission-denied" | "unavailable" | "default", Record<Language, string>> = {
  "permission-denied": {
    en: "You don't have access to this data. Try logging out and back in.",
    ta: "இந்தத் தரவை அணுக உங்களுக்கு அனுமதி இல்லை. மீண்டும் லாக் அவுட் செய்து லாக இன் செய்யவும்.",
  },
  unavailable: {
    en: "Can't reach the server. Check your connection.",
    ta: "சர்வரை அணுக முடியவில்லை. உங்கள் இணைப்பைச் சரிபார்க்கவும்.",
  },
  default: {
    en: "Something went wrong loading this data.",
    ta: "இந்தத் தரவை ஏற்றுவதில் சிக்கல் ஏற்பட்டது.",
  },
};

/** Maps a Firestore subscription error to a short, staff-friendly message. */
export function describeFirestoreError(error: FirestoreError, language: Language = "en"): string {
  switch (error.code) {
    case "permission-denied":
      return MESSAGES["permission-denied"][language];
    case "unavailable":
      return MESSAGES.unavailable[language];
    default:
      return MESSAGES.default[language];
  }
}
