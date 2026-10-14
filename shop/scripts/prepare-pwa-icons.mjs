// Generates the PNG app icons the PWA manifest needs (PWABuilder's Android
// packaging flags this: the manifest only had an SVG icon, and Android/TWA
// packaging wants real PNGs at 192x192 and 512x512, plus a maskable variant).
//
// Source is app-icon.png (repo root) — a purpose-made square icon (gold
// rounded-square frame baked into the art itself), supplied directly for
// this. Already square, so "any" icons are a plain resize; the maskable
// variant still needs its own treatment (see below).
//
// Three outputs per app:
//   icon-192.png            192x192, transparent, "any" purpose
//   icon-512.png            512x512, transparent, "any" purpose
//   icon-512-maskable.png   512x512, opaque app-colour background, "maskable"
//
// Android/Chrome crop a maskable icon to their own shape (circle, squircle,
// ...) — content has to stay inside the middle ~65% or corners/edges get
// clipped, and since the source is transparent outside its own rounded
// frame, a transparent maskable icon can render with a black or
// broken-looking fill on some Android launchers. So the maskable variant
// shrinks the source further inside a safe margin and composites it onto
// an opaque, app-coloured background instead of leaving it transparent.
//
// Usage: node scripts/prepare-pwa-icons.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { decodePng, encodePng, resampleRgba } from "./lib/png.mjs";

const SOURCE = "app-icon.png";

const APPS = [
  { publicDir: "worker-app/public", maskableBg: [20, 21, 26, 255] }, // #14151A
  { publicDir: "owner-app/public", maskableBg: [250, 250, 248, 255] }, // #FAFAF8
];

const { width: srcW, height: srcH, rgba: srcRgba } = decodePng(readFileSync(SOURCE));

/** Resamples the whole source (no cropping — it's already tightly framed)
 *  into a square canvas of `size`, centred, at `scale` of the frame. */
function toSquareCanvas(size, scale, bg) {
  const canvas = new Uint8Array(size * size * 4);
  if (bg) {
    for (let p = 0; p < size * size; p++) {
      canvas[p * 4] = bg[0];
      canvas[p * 4 + 1] = bg[1];
      canvas[p * 4 + 2] = bg[2];
      canvas[p * 4 + 3] = bg[3];
    }
  }

  // Fit the (non-square) source into a `scale`-fraction box of the canvas,
  // preserving aspect ratio — the taller/wider side hits the box edge.
  const boxSize = Math.round(size * scale);
  const srcAspect = srcW / srcH;
  const dstW = srcAspect >= 1 ? boxSize : Math.round(boxSize * srcAspect);
  const dstH = srcAspect >= 1 ? Math.round(boxSize / srcAspect) : boxSize;

  const resized = resampleRgba(srcRgba, srcW, srcH, { minX: 0, minY: 0, width: srcW, height: srcH }, dstW, dstH);

  const offsetX = Math.round((size - dstW) / 2);
  const offsetY = Math.round((size - dstH) / 2);

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcO = (y * dstW + x) * 4;
      const alpha = resized[srcO + 3] / 255;
      const dstX = offsetX + x;
      const dstY = offsetY + y;
      if (dstX < 0 || dstX >= size || dstY < 0 || dstY >= size) continue;
      const dstO = (dstY * size + dstX) * 4;

      if (!bg) {
        // Transparent canvas: straight copy, source alpha wins outright.
        canvas[dstO] = resized[srcO];
        canvas[dstO + 1] = resized[srcO + 1];
        canvas[dstO + 2] = resized[srcO + 2];
        canvas[dstO + 3] = resized[srcO + 3];
      } else {
        // Opaque canvas: alpha-composite the logo over the background colour.
        canvas[dstO] = Math.round(resized[srcO] * alpha + canvas[dstO] * (1 - alpha));
        canvas[dstO + 1] = Math.round(resized[srcO + 1] * alpha + canvas[dstO + 1] * (1 - alpha));
        canvas[dstO + 2] = Math.round(resized[srcO + 2] * alpha + canvas[dstO + 2] * (1 - alpha));
        canvas[dstO + 3] = 255;
      }
    }
  }
  return canvas;
}

for (const { publicDir, maskableBg } of APPS) {
  const icon192 = toSquareCanvas(192, 1, null);
  writeFileSync(`${publicDir}/icon-192.png`, encodePng(icon192, 192, 192, 6));

  const icon512 = toSquareCanvas(512, 1, null);
  writeFileSync(`${publicDir}/icon-512.png`, encodePng(icon512, 512, 512, 6));

  // 0.65 rather than the full frame — Android's safe zone is roughly the
  // inner 66% for a circular mask; a little extra margin beyond that so a
  // squircle or rounded-square mask doesn't nick the logo's own corners.
  const maskable = toSquareCanvas(512, 0.65, maskableBg);
  writeFileSync(`${publicDir}/icon-512-maskable.png`, encodePng(maskable, 512, 512, 6));

  console.log(`${publicDir}: icon-192.png, icon-512.png, icon-512-maskable.png written`);
}
