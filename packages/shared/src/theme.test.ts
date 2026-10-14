import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colors } from './theme.ts';

/** WCAG relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Every text-on-background pair the apps use. Body text needs 4.5:1.
const PAIRS: [string, string, string][] = [
  ['text on bg', colors.text, colors.bg],
  ['text on surface', colors.text, colors.surface],
  ['text on primarySoft', colors.text, colors.primarySoft],
  ['onPrimary on primary', colors.onPrimary, colors.primary],
  ['onPrimary on primaryDark', colors.onPrimary, colors.primaryDark],
  ['onSecondary on secondary', colors.onSecondary, colors.secondary],
  ['primary on surface (headings, selected chip text)', colors.primary, colors.surface],
  ['primary on primarySoft (selected chip text)', colors.primary, colors.primarySoft],
  ['muted on surface', colors.muted, colors.surface],
  ['muted on bg', colors.muted, colors.bg],
  ['warning on surface', colors.warning, colors.surface],
  ['warning on warningSoft', colors.warning, colors.warningSoft],
  ['danger on dangerSoft', colors.danger, colors.dangerSoft],
  ['text on warningSoft', colors.text, colors.warningSoft],
  ['text on dangerSoft', colors.text, colors.dangerSoft],
];

for (const [name, fg, bg] of PAIRS) {
  test(`contrast: ${name} is at least 4.5:1`, () => {
    const ratio = contrast(fg, bg);
    assert.ok(ratio >= 4.5, `${name}: ${fg} on ${bg} is only ${ratio.toFixed(2)}:1`);
  });
}

test('the brand gold is never used as text on white (it would be too faint), only as a fill', () => {
  assert.ok(contrast(colors.secondary, colors.surface) < 3, 'if this ever passes, gold text became possible; revisit the note on `secondary`');
});
