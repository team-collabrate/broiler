/**
 * Canvas -> ESC/POS raster bitmap (GS v 0).
 *
 * Printing the receipt as dots rather than characters is what allows Tamil and
 * a logo on the paper: the printer never sees text, only ink positions, so its
 * single-byte codepage is irrelevant.
 */

const ESC = 0x1b;
const GS = 0x1d;

/** Luminance at/above this prints as blank paper. Thermal output is 1-bit —
 *  there is no grey, so anti-aliased glyph edges must fall to one side. */
const INK_THRESHOLD = 160;

/** Rows per GS v 0 command. Cheap printers hold only a few KB of image at a
 *  time; banding keeps each command well inside that. */
const BAND_ROWS = 128;

/**
 * A run of blank rows at least this tall is fed past instead of transmitted.
 *
 * Roughly a quarter of a receipt is blank paper — the gaps between sections,
 * the space around the logo — and as raster every one of those rows still
 * costs 72 bytes and its share of a BLE round trip. Feeding instead sends
 * three bytes for the whole run.
 *
 * The threshold keeps short gaps in the raster. Below it the three-byte
 * command stops paying for itself, and every feed is a place where the
 * layout depends on the printer's paper step rather than on our own bitmap —
 * so this stays high enough that a bill uses a handful of feeds, not dozens.
 *
 * Re-measured on a realistic 5-item split-payment bill while looking for
 * more print-speed headroom: at the old value of 10, only 8 of the bill's 18
 * blank runs were caught, leaving 51 rows (3.7 KB) of avoidable blank raster
 * on the wire. 5 catches 14 of the 18 (still a handful, not dozens) and
 * leaves only 10 rows (720 B) — pushing lower than 5 stops paying for
 * itself fast (4 only claws back another 288 B for one more feed).
 */
const MIN_FEED_ROWS = 5;

/** ESC J takes a single byte, so longer feeds go out as repeats. */
const MAX_FEED_UNITS = 255;

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Packs the canvas into 1 bit per dot, MSB-first, which is the layout GS v 0 expects. */
function packRaster(canvas: HTMLCanvasElement): {
  data: Uint8Array;
  widthBytes: number;
  height: number;
  rowHasInk: boolean[];
} {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const { width, height } = canvas;
  const { data: pixels } = ctx.getImageData(0, 0, width, height);
  const widthBytes = Math.ceil(width / 8);
  const data = new Uint8Array(widthBytes * height);
  const rowHasInk: boolean[] = new Array(height).fill(false);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = pixels[i + 3];
      // Treat transparent as paper, not as ink.
      const luminance =
        alpha === 0
          ? 255
          : 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      if (luminance < INK_THRESHOLD) {
        data[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
        rowHasInk[y] = true;
      }
    }
  }

  return { data, widthBytes, height, rowHasInk };
}

/**
 * ESC 7 (print density/speed) used to be sent here, tuning heating
 * dots/time/interval away from the printer's factory default in three
 * rounds (80/2 -> 50/1 -> 30/0) chasing the XP-Q600's speed target.
 *
 * Removed entirely — not tuned back to the factory default, just not sent
 * at all — after decompiling the old native app (vpos) that printed to the
 * same hardware: it never sends this command either. It gets whatever
 * darkness/speed the printer ships with and never asked for anything else.
 * If that was good enough for it, there's no reason to keep guessing at a
 * better set of numbers with no way to see the paper from here — every
 * value tried so far was picked blind, since nobody in this loop has the
 * physical printer to check legibility against.
 *
 * If speed still needs work after this, the honest next step is someone
 * with the printer in hand trying real ESC 7 values and reporting what's
 * still legible — not another guess pushed from here.
 */

export interface RasterReceiptOptions {
  /** Feed + full cut after printing. Printers without a cutter ignore it. */
  cut?: boolean;
}

/** Builds the full byte stream for a receipt image, ready for the transport. */
export function buildRasterReceipt(
  canvas: HTMLCanvasElement,
  options: RasterReceiptOptions = {},
): Uint8Array {
  const { cut = true } = options;
  const { data, widthBytes, height, rowHasInk } = packRaster(canvas);

  const chunks: Uint8Array[] = [
    new Uint8Array([ESC, 0x40]), // initialise
    // Pin the motion units to 1/203 inch so ESC J below feeds exact dot rows.
    // Without this the feed height depends on the printer's default vertical
    // unit, and a blank gap could come out taller or shorter than the bitmap
    // it replaced. Printers that ignore GS P are already 1/203 on a 203dpi
    // head, so this is belt and braces rather than a new dependency.
    new Uint8Array([GS, 0x50, 203, 203]),
    new Uint8Array([ESC, 0x61, 0x01]), // centre the image block
  ];

  const raster = (from: number, rows: number) => {
    chunks.push(
      new Uint8Array([
        GS,
        0x76,
        0x30,
        0x00, // mode 0: normal density
        widthBytes & 0xff,
        (widthBytes >> 8) & 0xff,
        rows & 0xff,
        (rows >> 8) & 0xff,
      ]),
    );
    chunks.push(data.subarray(from * widthBytes, (from + rows) * widthBytes));
  };

  /** Emits rows [from, to) as raster, split into bands the printer can hold. */
  const rasterRange = (from: number, to: number) => {
    for (let row = from; row < to; row += BAND_ROWS) {
      raster(row, Math.min(BAND_ROWS, to - row));
    }
  };

  const feed = (rows: number) => {
    let left = rows;
    while (left > 0) {
      const n = Math.min(left, MAX_FEED_UNITS);
      chunks.push(new Uint8Array([ESC, 0x4a, n])); // ESC J: feed n motion units
      left -= n;
    }
  };

  // Walk the page, transmitting inked stretches and feeding past tall blanks.
  let cursor = 0;
  let run = 0;
  for (let row = 0; row <= height; row++) {
    const blank = row < height && !rowHasInk[row];
    if (blank) {
      run++;
      continue;
    }
    if (run >= MIN_FEED_ROWS) {
      const blankStart = row - run;
      rasterRange(cursor, blankStart);
      feed(run);
      cursor = row;
    }
    run = 0;
  }
  rasterRange(cursor, height);

  chunks.push(new Uint8Array([ESC, 0x61, 0x00])); // back to left align
  if (cut) {
    chunks.push(new Uint8Array([0x0a, 0x0a, 0x0a])); // feed clear of the cutter
    chunks.push(new Uint8Array([GS, 0x56, 0x00]));
  }

  return concat(chunks);
}
