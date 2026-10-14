/**
 * Removes a baked-in checkerboard "transparency" placeholder from an RGB
 * image that has no real alpha channel.
 *
 * Some export pipelines draw the familiar two-tone checker pattern as actual
 * pixels instead of encoding real transparency — the image looks cut out in
 * a generic viewer but is fully opaque. This finds that pattern and turns it
 * into real alpha.
 *
 * The approach is deliberately conservative in two ways:
 *
 * 1. A pixel only counts as a *candidate* background pixel if it is both
 *    near-grey (R≈G≈B — real food is never perfectly desaturated over a
 *    wide area) and within a few luminance levels of one of the two tones
 *    actually sampled from the image's own border. Matching an exact,
 *    image-specific pair of tones is a much narrower test than "is this
 *    pixel light", so it will not eat a genuinely pale ingredient that
 *    merely happens to be bright.
 *
 * 2. Only candidates *reachable from the image edge* (flood fill) are
 *    actually erased. A stray pixel deep inside the food that coincidentally
 *    matches the checker tones — a highlight on white ceramic, say — is not
 *    connected to the border through other candidate pixels, so it is left
 *    alone. This is what stops the removal from punching holes in the food
 *    itself; it only ever eats the connected exterior region.
 */

/** How far a pixel's channels may spread and still count as neutral grey. */
const GREY_TOLERANCE = 6;

/** How close a candidate's luminance must sit to a sampled checker tone. */
const TONE_TOLERANCE = 5;

function luminance(r, g, b) {
  return (r + g + b) / 3;
}

/**
 * Samples the outer ring of the image — reliably background on every file
 * this has been used on — and returns the two dominant luminance tones.
 *
 * The two checker tones sit close together (e.g. 243 and 254), with a thin
 * population of antialiased edge pixels in between where checker squares
 * meet. That rules out picking the widest gap in the sorted samples — edge
 * pixels fill in every intermediate value, so no gap is ever wide. Otsu's
 * method is the right tool for a bimodal histogram like this one: it finds
 * the threshold that best separates the two clusters by maximizing the
 * variance *between* them, rather than looking for an empty gap.
 */
function sampleBorderTones(rgba, width, height, ringWidth = 6) {
  const hist = new Uint32Array(256);
  let total = 0;
  const push = (x, y) => {
    const i = (y * width + x) * 4;
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) <= GREY_TOLERANCE) {
      hist[Math.round(luminance(r, g, b))]++;
      total++;
    }
  };
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < ringWidth; y++) push(x, y);
    for (let y = height - ringWidth; y < height; y++) push(x, y);
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < ringWidth; x++) push(x, y);
    for (let x = width - ringWidth; x < width; x++) push(x, y);
  }
  if (total === 0) throw new Error("Border isn't neutral grey — this image may not use a checker placeholder.");

  let sumAll = 0;
  for (let l = 0; l < 256; l++) sumAll += l * hist[l];

  let sumBelow = 0, weightBelow = 0, bestT = 0, bestVariance = -1;
  for (let t = 0; t < 255; t++) {
    weightBelow += hist[t];
    sumBelow += t * hist[t];
    const weightAbove = total - weightBelow;
    if (weightBelow === 0 || weightAbove === 0) continue;
    const meanBelow = sumBelow / weightBelow;
    const meanAbove = (sumAll - sumBelow) / weightAbove;
    const between = weightBelow * weightAbove * (meanBelow - meanAbove) ** 2;
    if (between > bestVariance) { bestVariance = between; bestT = t; }
  }

  let sumLow = 0, nLow = 0, sumHigh = 0, nHigh = 0;
  for (let l = 0; l <= bestT; l++) { sumLow += l * hist[l]; nLow += hist[l]; }
  for (let l = bestT + 1; l < 256; l++) { sumHigh += l * hist[l]; nHigh += hist[l]; }

  if (nLow === 0 || nHigh === 0) {
    const mean = sumAll / total;
    return [mean, mean]; // border reads as one tone — degenerate but handled below
  }
  return [sumLow / nLow, sumHigh / nHigh];
}

/**
 * Returns a new RGBA buffer with the checker background turned transparent.
 * Input must already be RGBA (alpha 255 throughout, as produced by decoding
 * a colour-type-2 PNG with no tRNS chunk).
 */
export function removeCheckerBackground(rgba, width, height) {
  const [tone1, tone2] = sampleBorderTones(rgba, width, height);

  const lum = new Float32Array(width * height);
  const grey = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    lum[p] = luminance(r, g, b);
    grey[p] = Math.max(r, g, b) - Math.min(r, g, b) <= GREY_TOLERANCE ? 1 : 0;
  }

  // One contiguous range spanning both tones, not "near tone1 OR near
  // tone2" — the seam between two adjacent checker squares antialiases
  // through the luminance values *between* the tones, and excluding that
  // middle band would seal every square off from its neighbours (a first
  // version of this did exactly that: a local-flatness gate rejected every
  // seam pixel, since a window straddling two ~11-apart tones has a
  // standard deviation of ~5.5, and the flood fill below could then only
  // ever reach the outermost ring of squares before hitting a wall on
  // every side). The seam pixels are still unambiguously checkerboard, so
  // including the whole span is correct, not just more permissive.
  //
  // There is no separate "is this flat/uniform" gate here on purpose. The
  // thing that actually protects real food is border connectivity (below):
  // a pale, desaturated food pixel — a white cup rim, milk foam — is only
  // ever erased if a chain of other candidate pixels connects it all the
  // way out to the image edge, which colourful or textured food in between
  // blocks by simply not being candidates. A flatness gate wasn't adding
  // real protection on top of that; it was only breaking the fill.
  const rangeLow = Math.min(tone1, tone2) - TONE_TOLERANCE;
  const rangeHigh = Math.max(tone1, tone2) + TONE_TOLERANCE;

  const candidate = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p++) {
    if (!grey[p]) continue;
    if (lum[p] >= rangeLow && lum[p] <= rangeHigh) candidate[p] = 1;
  }

  // Flood fill from every border pixel that's a candidate — only the
  // connected exterior region is ever removed.
  const isBackground = new Uint8Array(width * height);
  const stack = [];
  const pushIfCandidate = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const p = y * width + x;
    if (candidate[p] && !isBackground[p]) {
      isBackground[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < width; x++) { pushIfCandidate(x, 0); pushIfCandidate(x, height - 1); }
  for (let y = 0; y < height; y++) { pushIfCandidate(0, y); pushIfCandidate(width - 1, y); }

  while (stack.length) {
    const p = stack.pop();
    const x = p % width, y = (p / width) | 0;
    pushIfCandidate(x + 1, y);
    pushIfCandidate(x - 1, y);
    pushIfCandidate(x, y + 1);
    pushIfCandidate(x, y - 1);
  }

  const out = new Uint8Array(rgba); // copy — RGB stays, only alpha changes
  let removed = 0;
  for (let p = 0; p < width * height; p++) {
    if (isBackground[p]) {
      out[p * 4 + 3] = 0;
      removed++;
    }
  }

  return { rgba: out, removedPixels: removed, tones: [Math.round(tone1), Math.round(tone2)] };
}
