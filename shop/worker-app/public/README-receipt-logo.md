# receipt-logo.png

The mark printed at the top of every bill. Generated — don't hand-edit it.

## Regenerating

The brand master lives at the repo root (`logo-b-w.png`). To rebuild the
printable copy after changing it, pick a target width (see "The width is not
arbitrary" below for how) and run:

```
node scripts/prepare-receipt-logo.mjs logo-b-w.png <width>
```

That trims the artwork to its ink, resamples it, and writes this file. The
current logo (icon + "Kumbakonam Cafe" wordmark, aspect ~1.14:1) went from
1254×1254 (0.84 MB) to 205×180 (16 KB).

## Why it can't just be dropped in

Thermal printing is one-bit: every dot is on or off. Three things follow.

**Whitespace has to go first.** The receipt scales the image to fit its box.
An untrimmed logo scales its *padding* to fit, leaving the artwork a smudge in
the middle of an empty rectangle.

**The size is not arbitrary, and it's two limits, not one.** The receipt caps
the drawn logo at `LOGO_MAX_W` **and** `LOGO_MAX_H` in
`worker-app/src/printing/receiptCanvas.ts` (320×180 as of writing) — whichever
one the logo's aspect ratio hits first wins. A wide, short logo (like the old
icon-only mark) is width-bound; a taller one that includes the wordmark (like
the current one) is height-bound instead, at a *narrower* pixel width than the
320 cap alone would suggest. Get this wrong and the canvas resamples the image
a second time at print, which softens hairlines right before they get crushed
to 1-bit — the file should always be prepared at exactly the size the canvas
will actually draw it. To find that size: run the script once at a generous
width, note the output aspect ratio, then compute the width that lands the
height at exactly `LOGO_MAX_H` (or the width at exactly `LOGO_MAX_W`, if the
logo is wide enough that width binds first) — and regenerate at that number.
Changing either `LOGO_MAX_W`/`LOGO_MAX_H` or the logo's own aspect ratio means
redoing this.

**Line art only.** Solid black on white reproduces. Photographs, grey fills and
soft gradients all threshold to mud.

## Cost per bill

180 dots of logo is about 0.9 in (23 mm) of paper on every receipt. If the
roll is going too fast, regenerate at a smaller width — nothing else needs to
change. Going the other way (a bigger, more detailed print) means raising
`LOGO_MAX_H` in receiptCanvas.ts first, which spends more paper on every
single bill going forward — worth a deliberate call, not a quiet default.

## If the file is missing

The receipt renders without it rather than failing, so a missing or broken logo
degrades to a text-only bill instead of blocking the sale.
