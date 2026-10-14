/**
 * Prepares the five category photos (breakfast/lunch/dinner/tea/vada) for
 * the counter's category tabs.
 *
 * breakfast.png, lunch.png and dinner.png already carry a real alpha
 * channel with the studio backdrop cut out — verified by rendering the
 * alpha channel alone, which comes out as a clean plate-shaped silhouette.
 * tea.png and vada.png instead have a checkerboard *pattern* painted into
 * opaque RGB pixels (a common export artifact — some pipelines draw the
 * transparency placeholder instead of encoding real alpha), so those two
 * go through removeCheckerBackground first.
 *
 * Every image is then trimmed to its content and resampled down — the
 * source photography is 1536x1024 art, a couple of MB apiece, for what
 * ends up displayed as a ~72px avatar.
 *
 * Usage: node scripts/prepare-category-images.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { decodePng, contentBounds, resampleRgba, encodePng } from "./lib/png.mjs";
import { removeCheckerBackground } from "./lib/checker-remove.mjs";

/** Longest edge of the output. Displayed around 72-96px in the tab, so this
 *  covers a 2x-3x dense-display avatar with room to spare. */
const TARGET_SIZE = 200;

/** Alpha above this counts as content when trimming the transparent margin. */
const ALPHA_CUTOFF = 8;

const SOURCES = [
  { file: "breakfast.png", out: "breakfast.png", needsCheckerRemoval: false },
  { file: "lunch.png", out: "lunch.png", needsCheckerRemoval: false },
  { file: "dinner.png", out: "dinner.png", needsCheckerRemoval: false },
  { file: "tea.png", out: "tea.png", needsCheckerRemoval: true },
  // The category is "Vadai" (see shared/src/i18n/categoryLabels.ts); the
  // source photo is named "vada.png". Output takes the category's own name
  // so the app-side lookup is a plain, unremarkable string match.
  { file: "vada.png", out: "vadai.png", needsCheckerRemoval: true },
];

const TARGETS = ["worker-app/public/categories"];

for (const { file, out, needsCheckerRemoval } of SOURCES) {
  const input = readFileSync(`images/${file}`);
  let { width, height, rgba } = decodePng(input);
  console.log(`${file}  source ${width}x${height}, ${(input.length / 1024 / 1024).toFixed(2)} MB`);

  if (needsCheckerRemoval) {
    const result = removeCheckerBackground(rgba, width, height);
    rgba = result.rgba;
    console.log(
      `  checker removed: tones ${result.tones.join("/")}, ` +
        `${((result.removedPixels * 100) / (width * height)).toFixed(1)}% of frame`,
    );
  }

  const box = contentBounds(rgba, width, height, (_r, _g, _b, a) => a > ALPHA_CUTOFF);
  console.log(`  content ${box.width}x${box.height} at (${box.minX},${box.minY})`);

  const scale = TARGET_SIZE / Math.max(box.width, box.height);
  const dstW = Math.max(1, Math.round(box.width * scale));
  const dstH = Math.max(1, Math.round(box.height * scale));
  const resampled = resampleRgba(rgba, width, height, box, dstW, dstH);
  const png = encodePng(resampled, dstW, dstH, 6);

  for (const dir of TARGETS) {
    mkdirSync(dir, { recursive: true });
    const path = `${dir}/${out}`;
    writeFileSync(path, png);
    console.log(`  written ${path}  ${dstW}x${dstH}, ${(png.length / 1024).toFixed(1)} KB`);
  }
}
