/** Design tokens from 04_Design_Brief.md §3-4. */

export type AppTheme = "dark" | "light";

export const colors = {
  accent: "#E8674F",
  success: "#6FCF97",
  warning: "#F2C94C",
  danger: "#D64545",
  dark: {
    bg: "#14151A",
    surface: "#1E1F26",
    text: "#FAFAFA",
    textMuted: "#9A9BA5",
    border: "#2A2B33",
  },
  light: {
    bg: "#FAFAF8",
    surface: "#FFFFFF",
    text: "#14151A",
    textMuted: "#6B6C75",
    border: "#E7E5E0",
  },
} as const;

export const font = {
  family: "'Inter', 'Roboto', system-ui, -apple-system, sans-serif",
} as const;
