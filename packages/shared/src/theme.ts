// One look for both apps: green and white. Tokens only, so the client's own palette is a change to
// this file and nothing else. Text on `primary` (`onPrimary`) and on the plain surfaces is kept at
// 4.5:1 contrast or better; check that again when the palette changes.
export const colors = {
  bg: '#F3F8F4',
  surface: '#FFFFFF',
  text: '#14201A',
  muted: '#56665C',
  border: '#D9E5DC',
  /** Buttons, selected states and the brand colour. */
  primary: '#17703F',
  onPrimary: '#FFFFFF',
  primarySoft: '#E2F2E8',
  /** A confirmation that must read differently from a plain button, such as "Added ✓". */
  success: '#0B4A29',
  /** Something that needs attention but is not an error: a rate not set today, a changed price. */
  warning: '#B45309',
  warningSoft: '#FEF0D8',
  /** Something that went wrong. */
  danger: '#B3261E',
  dangerSoft: '#FBE9E7',
  disabled: '#C3CCC6',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
