/**
 * A minimal PNG codec, good enough to prepare brand assets for this repo.
 *
 * Deliberately dependency-free: decoding and encoding PNG is a few dozen lines
 * on top of node:zlib, and pulling sharp (a native build) or jimp into a
 * project that otherwise has no image toolchain would cost far more than it
 * saves. Handles what our source artwork actually is — 8-bit, non-interlaced,
 * greyscale/RGB/RGBA — and throws clearly on anything else rather than
 * producing quietly wrong pixels.
 */
import { inflateSync, deflateSync } from "node:zlib";

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const CHANNELS_FOR_COLOR_TYPE = { 0: 1, 2: 3, 4: 2, 6: 4 };

// ── Decode ────────────────────────────────────────────────────────────────

function readChunks(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("Not a PNG file.");
  const chunks = [];
  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    chunks.push({ type, data: buf.subarray(off + 8, off + 8 + len) });
    off += len + 12; // length + type + data + crc
  }
  return chunks;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * Decodes to straight (non-premultiplied) RGBA, 4 bytes per pixel, whatever
 * the source colour type — callers get one shape to reason about.
 */
export function decodePng(buf) {
  const chunks = readChunks(buf);
  const ihdr = chunks.find((c) => c.type === "IHDR");
  if (!ihdr) throw new Error("PNG has no IHDR chunk.");

  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const bitDepth = ihdr.data[8];
  const colorType = ihdr.data[9];
  const interlace = ihdr.data[12];

  if (bitDepth !== 8) throw new Error(`Only 8-bit PNGs are handled (got ${bitDepth}-bit).`);
  if (interlace !== 0) throw new Error("Interlaced PNGs are not handled. Re-save without interlacing.");

  const channels = CHANNELS_FOR_COLOR_TYPE[colorType];
  if (!channels) throw new Error(`Unsupported colour type ${colorType}. Use greyscale, RGB or RGBA.`);

  const raw = inflateSync(Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data)));
  const stride = width * channels;
  const flat = new Uint8Array(raw.length - height); // minus one filter byte per scanline

  // Undo the per-scanline filter, referencing bytes already restored above/left.
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    const prev = dst - stride;

    for (let x = 0; x < stride; x++) {
      const value = raw[src + x];
      const a = x >= channels ? flat[dst + x - channels] : 0;
      const b = y > 0 ? flat[prev + x] : 0;
      const c = y > 0 && x >= channels ? flat[prev + x - channels] : 0;

      let restored;
      switch (filter) {
        case 0: restored = value; break;
        case 1: restored = value + a; break;
        case 2: restored = value + b; break;
        case 3: restored = value + ((a + b) >> 1); break;
        case 4: restored = value + paeth(a, b, c); break;
        default: throw new Error(`Unknown scanline filter ${filter} on row ${y}.`);
      }
      flat[dst + x] = restored & 0xff;
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const i = p * channels;
    const o = p * 4;
    if (channels === 1) {
      rgba[o] = rgba[o + 1] = rgba[o + 2] = flat[i];
      rgba[o + 3] = 255;
    } else if (channels === 2) {
      rgba[o] = rgba[o + 1] = rgba[o + 2] = flat[i];
      rgba[o + 3] = flat[i + 1];
    } else {
      rgba[o] = flat[i];
      rgba[o + 1] = flat[i + 1];
      rgba[o + 2] = flat[i + 2];
      rgba[o + 3] = channels === 4 ? flat[i + 3] : 255;
    }
  }

  return { width, height, rgba };
}

// ── Geometry ──────────────────────────────────────────────────────────────

/**
 * Bounding box of pixels the eye would call "content".
 *
 * `test(r, g, b, a)` decides what counts — trimming transparent padding and
 * trimming white padding are different questions, and only the caller knows
 * which one it has.
 */
export function contentBounds(rgba, width, height, test) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (test(rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3])) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error("No content found — the image looks empty by this test.");
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Box-filter resample of an RGBA region.
 *
 * Colour is premultiplied by alpha before averaging and unpremultiplied
 * after. Averaging straight RGBA instead would pull the invisible colour of
 * fully-transparent pixels into every edge — which on artwork matted against
 * white or black leaves a pale or dark fringe around the whole logo.
 */
export function resampleRgba(rgba, srcW, srcH, box, dstW, dstH) {
  const { minX, minY, width: cropW, height: cropH } = box;
  const dst = new Uint8Array(dstW * dstH * 4);
  const xRatio = cropW / dstW;
  const yRatio = cropH / dstH;

  for (let y = 0; y < dstH; y++) {
    const y0 = minY + Math.floor(y * yRatio);
    const y1 = Math.min(srcH, Math.max(y0 + 1, minY + Math.floor((y + 1) * yRatio)));
    for (let x = 0; x < dstW; x++) {
      const x0 = minX + Math.floor(x * xRatio);
      const x1 = Math.min(srcW, Math.max(x0 + 1, minX + Math.floor((x + 1) * xRatio)));

      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const o = (yy * srcW + xx) * 4;
          const alpha = rgba[o + 3] / 255;
          r += rgba[o] * alpha;
          g += rgba[o + 1] * alpha;
          b += rgba[o + 2] * alpha;
          a += rgba[o + 3];
          n++;
        }
      }

      const o = (y * dstW + x) * 4;
      if (!n) continue;
      const avgA = a / n;
      const unmul = avgA > 0 ? 255 / avgA : 0;
      dst[o] = Math.min(255, Math.round((r / n) * unmul));
      dst[o + 1] = Math.min(255, Math.round((g / n) * unmul));
      dst[o + 2] = Math.min(255, Math.round((b / n) * unmul));
      dst[o + 3] = Math.round(avgA);
    }
  }
  return dst;
}

// ── Encode ────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/**
 * Encodes 8-bit PNG. `colorType` 0 (greyscale) expects one byte per pixel;
 * 6 (RGBA) expects four. Every scanline uses filter 0 — the artwork here is
 * flat vector-style graphics, where deflate's own matching already finds the
 * runs that adaptive filtering would.
 */
export function encodePng(data, width, height, colorType = 6) {
  const channels = CHANNELS_FOR_COLOR_TYPE[colorType];
  if (!channels) throw new Error(`Cannot encode colour type ${colorType}.`);
  if (data.length !== width * height * channels) {
    throw new Error(`Expected ${width * height * channels} bytes, got ${data.length}.`);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * channels;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(data.subarray(y * stride, (y + 1) * stride)).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from(SIGNATURE),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Flattens RGBA to one luminance byte per pixel, compositing over white. */
export function toGrayOverWhite(rgba, width, height) {
  const gray = new Uint8Array(width * height);
  for (let p = 0; p < gray.length; p++) {
    const o = p * 4;
    const alpha = rgba[o + 3] / 255;
    const lum = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
    gray[p] = Math.round(lum * alpha + 255 * (1 - alpha));
  }
  return gray;
}
