// One look for both apps: rooster red and beak gold on a warm white. Tokens only, so a palette change
// is a change to this file and nothing else. The six brand colours come from the client; the soft,
// muted, border and disabled tones are derived from them. Contrast of every text and background pair
// below is checked by theme.test.ts (4.5:1 or better for text).
export const colors = {
  /** Rooster red: main buttons, the selected tab and payment chip, the "+" on cards, headings, the bill's accent line. White text sits on it. */
  primary: '#D71920',
  onPrimary: '#FFFFFF',
  /** A pressed button, and the "Added" confirmation. White text sits on it. */
  primaryDark: '#A80F15',
  /** Beak gold: the shop-name line, the active border, badges. Dark text (`onSecondary`) sits on it; never use it as text on white. */
  secondary: '#F59E0B',
  onSecondary: '#1F1512',
  /** The page behind everything. */
  bg: '#FFFAF2',
  /** Cards, the cart column, popups. */
  surface: '#FFFFFF',
  /** Main text, product names, prices. */
  text: '#1F1512',

  // Derived from the six above.
  /** A light tint of the primary: selected rows, the highlight band behind the wheel, plain cards with no photo. */
  primarySoft: '#FDEBEA',
  /** Secondary text, such as captions and rate details. */
  muted: '#6B5A52',
  /** Card outlines and dividers. */
  border: '#EADCCB',
  /** Buttons that cannot be pressed yet. */
  disabled: '#D8CCC0',
  /** A confirmation that must read differently from a plain button, such as "Added ✓". */
  success: '#A80F15',
  /** Something that needs attention but is not an error: a rate not set today, a changed price. Dark enough to read as text on white. */
  warning: '#9A5B00',
  warningSoft: '#FEF1D6',
  /** Something that went wrong. Shares the brand red's family, so errors always come with words, never colour alone. */
  danger: '#A80F15',
  dangerSoft: '#FBE4E3',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
