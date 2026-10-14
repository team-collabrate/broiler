/**
 * Renders a bill to a 1-bit-friendly canvas.
 *
 * Thermal printers can only print Latin text from a single-byte codepage, so
 * Tamil (and a logo) can't go out as ESC/POS *text* at all. Instead the whole
 * receipt is drawn here — where the browser's own Tamil font shaping is
 * available — and printed as a raster bitmap (see escposRaster.ts).
 *
 * The same canvas backs the on-screen bill, so what the worker sees and what
 * the customer is handed cannot drift apart.
 */
import { CAFE_DETAILS, RECEIPT_LOGO_URL } from "./cafeDetails";
import { buildRasterReceipt } from "./escposRaster";
import type { BillInput } from "./receipt";

/** 80mm paper at 203 dpi: 576 printable dots. The printer rejects wider rasters. */
export const RECEIPT_WIDTH = 576;

const PAD = 8;
const CONTENT_LEFT = PAD;
const CONTENT_RIGHT = RECEIPT_WIDTH - PAD;
const CENTER = RECEIPT_WIDTH / 2;

/** Tamil first — the system Tamil face shapes the script correctly; the Latin
 *  fallbacks only ever handle digits and the few ASCII labels. */
const FONT_STACK = '"Noto Sans Tamil", "Latha", "Nirmala UI", system-ui, sans-serif';

const font = (size: number, weight: "normal" | "bold" = "normal") =>
  `${weight} ${size}px ${FONT_STACK}`;

/** Logo box, in printer dots. `scripts/prepare-receipt-logo.mjs` trims and
 *  resamples the source artwork to exactly this width, so the draw below is
 *  1:1 — resampling it a second time here would soften the fine temple
 *  linework right before the print path crushes it to 1-bit. Height is the
 *  ceiling for a taller mark, not a target.
 *
 *  Every dot of logo height costs 72 bytes over the air and a dot of paper,
 *  so this is a print-speed setting as much as a design one. Kept small by
 *  request (2026-09-01) — 104x91 is exactly what
 *  `node scripts/prepare-receipt-logo.mjs logo-b-w.png 104` produces from
 *  the current mark; regenerate at a new width after changing either of
 *  these, and update both together so they still match the file. */
const LOGO_MAX_W = 104;
const LOGO_MAX_H = 91;

/** Size of the அளவு / விலை / தொகை label row. Smaller than the figures it
 *  labels: the Tamil words are much wider than the numbers, so every point
 *  here comes straight out of the item-name column. */
const HEADER_SIZE = 22;

/** Space between columns, applied identically to all of them — this single
 *  value is what makes the three labels evenly spaced. */
const COL_GUTTER = 14;

/** Widest figure each column has to hold. Used as a floor on column width so
 *  a large bill can't push its amount into the column to its left. */
const WIDEST = { qty: "99", price: "999.00", amount: "9999.00" } as const;

/** Every label on the paper is Tamil — the receipt is for the customer, so it
 *  reads in one language regardless of the app's current UI language. */
const L = {
  item: "பொருள்",
  qty: "அளவு",
  price: "விலை",
  amount: "தொகை",
  date: "தேதி",
  billNo: "பில் எண்",
  subtotal: "கூட்டுத்தொகை",
  total: "மொத்தம்",
  payment: "பணம்",
  phone: "தொலைபேசி",
} as const;

const money = (n: number) => n.toFixed(2);

interface Columns {
  qtyRight: number;
  priceRight: number;
  amountRight: number;
  itemMax: number;
}

/**
 * Works out the table geometry by measuring the text, rather than carrying
 * hard-coded x-positions.
 *
 * The positions used to be constants, and they silently stopped matching the
 * headers: விலை and தொகை overlapped by 5 dots on the printed bill because
 * nothing tied the numbers to the words they sat under. Deriving each column
 * from the wider of its label and its biggest figure, then stepping right to
 * left with one shared gutter, makes even spacing a property of the layout
 * instead of something to re-tune by hand whenever a font or a word changes.
 */
function deriveColumns(ctx: CanvasRenderingContext2D): Columns {
  ctx.font = font(HEADER_SIZE, "bold");
  const headerW = {
    qty: ctx.measureText(L.qty).width,
    price: ctx.measureText(L.price).width,
    amount: ctx.measureText(L.amount).width,
  };

  ctx.font = font(26);
  const qtyW = Math.max(headerW.qty, ctx.measureText(WIDEST.qty).width);
  const priceW = Math.max(headerW.price, ctx.measureText(WIDEST.price).width);
  const amountW = Math.max(headerW.amount, ctx.measureText(WIDEST.amount).width);

  const amountRight = CONTENT_RIGHT;
  const priceRight = amountRight - amountW - COL_GUTTER;
  const qtyRight = priceRight - priceW - COL_GUTTER;

  return {
    qtyRight,
    priceRight,
    amountRight,
    // Whatever is left after the figures have taken what they need.
    itemMax: qtyRight - qtyW - COL_GUTTER - CONTENT_LEFT,
  };
}

async function loadLogo(): Promise<HTMLImageElement | null> {
  const url = RECEIPT_LOGO_URL;
  if (!url) return null; // disabled — skip the fetch entirely
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // no logo file — print without it
    img.src = url;
  });
}

/** Greedy wrap so long item names spill to a second line instead of colliding
 *  with the QTY column. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function dashedRule(ctx: CanvasRenderingContext2D, y: number) {
  ctx.save();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(CONTENT_LEFT, y);
  ctx.lineTo(CONTENT_RIGHT, y);
  ctx.stroke();
  ctx.restore();
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function formatDate(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatTime(date: Date): string {
  let h = date.getHours();
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 === 0 ? 12 : h % 12;
  return `${pad2(h)}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())} ${period}`;
}

export interface ReceiptRasterTiming {
  /** document.fonts.ready + logo fetch + the two paint() passes. */
  renderMs: number;
  /** packRaster's per-pixel scan + assembling the ESC/POS command stream. */
  rasterMs: number;
}

/** Canvas render + ESC/POS encode in one call, timed — the two steps every
 *  print (and print retry) needs back to back, instrumented once here
 *  rather than at each call site so the numbers can't drift apart from what
 *  actually ran. See usePrinter.ts's print() for where these join the
 *  Bluetooth write time into one [PRINT START]..[COMPLETE] log. */
export async function prepareReceiptRaster(
  bill: BillInput,
): Promise<{ bytes: Uint8Array; timing: ReceiptRasterTiming }> {
  const renderStart = performance.now();
  const canvas = await renderReceiptCanvas(bill);
  const renderMs = performance.now() - renderStart;

  const rasterStart = performance.now();
  const bytes = buildRasterReceipt(canvas);
  const rasterMs = performance.now() - rasterStart;

  return { bytes, timing: { renderMs, rasterMs } };
}

export async function renderReceiptCanvas(bill: BillInput): Promise<HTMLCanvasElement> {
  // Tamil glyphs measure as tofu until the face is actually loaded, which
  // would throw off every wrap and right-alignment on the receipt.
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* proceed with whatever is loaded */
    }
  }

  const logo = await loadLogo();

  // Two passes over an identical draw list: the first only advances `y` to
  // learn the height, the second draws for real once the canvas is sized.
  const measure = document.createElement("canvas").getContext("2d")!;
  const height = paint(measure, bill, logo, true);

  const canvas = document.createElement("canvas");
  canvas.width = RECEIPT_WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  paint(ctx, bill, logo, false);

  return canvas;
}

function paint(
  ctx: CanvasRenderingContext2D,
  bill: BillInput,
  logo: HTMLImageElement | null,
  measureOnly: boolean,
): number {
  const draw = (fn: () => void) => {
    if (!measureOnly) fn();
  };

  const col = deriveColumns(ctx);

  let y = PAD;

  // --- Invocation -----------------------------------------------------------
  // The one line above the shop's own identity block — a devotional opener,
  // not part of "who this till belongs to", so it gets its own gap below
  // rather than reading as an extra line of the shop name.
  if (CAFE_DETAILS.invocation) {
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = font(24, "bold");
    y += 24;
    draw(() => ctx.fillText(CAFE_DETAILS.invocation, CENTER, y));
    y += 14;
  }

  // --- Logo ---------------------------------------------------------------
  if (logo && logo.width > 0) {
    const scale = Math.min(LOGO_MAX_W / logo.width, LOGO_MAX_H / logo.height, 1);
    const w = logo.width * scale;
    const h = logo.height * scale;
    draw(() => ctx.drawImage(logo, CENTER - w / 2, y, w, h));
    y += h + 12;
  }

  // --- Shop identity ------------------------------------------------------
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.font = font(46, "bold");
  y += 46;
  draw(() => ctx.fillText(CAFE_DETAILS.name, CENTER, y));

  if (CAFE_DETAILS.subtitle) {
    ctx.font = font(28);
    y += 36;
    draw(() => ctx.fillText(CAFE_DETAILS.subtitle, CENTER, y));
  }

  if (CAFE_DETAILS.phone) {
    ctx.font = font(24);
    y += 32;
    draw(() => ctx.fillText(`${L.phone}: ${CAFE_DETAILS.phone}`, CENTER, y));
  }

  // --- Order meta ---------------------------------------------------------
  y += 24;
  ctx.font = font(24);
  y += 32;
  const metaY = y;
  // Date on the left, clock on the right of the same line — the two together
  // were one long left-aligned string that left the right half of the paper
  // empty.
  draw(() => {
    ctx.textAlign = "left";
    ctx.fillText(`${L.date}: ${formatDate(bill.createdAt)}`, CONTENT_LEFT, metaY);
    ctx.textAlign = "right";
    ctx.fillText(formatTime(bill.createdAt), CONTENT_RIGHT, metaY);
  });
  y += 30;
  const billNoY = y;
  draw(() => {
    ctx.textAlign = "left";
    ctx.fillText(`${L.billNo}: ${bill.billNo}`, CONTENT_LEFT, billNoY);
  });

  y += 20;
  draw(() => dashedRule(ctx, y));

  // --- Column headers -----------------------------------------------------
  ctx.font = font(HEADER_SIZE, "bold");
  y += 40;
  const headY = y;
  draw(() => {
    ctx.textAlign = "left";
    ctx.fillText(L.item, CONTENT_LEFT, headY);
    ctx.textAlign = "right";
    ctx.fillText(L.qty, col.qtyRight, headY);
    ctx.fillText(L.price, col.priceRight, headY);
    ctx.fillText(L.amount, col.amountRight, headY);
  });

  y += 12;
  draw(() => dashedRule(ctx, y));
  y += 10;

  // --- Line items ---------------------------------------------------------
  ctx.font = font(26);
  for (const item of bill.items) {
    ctx.textAlign = "left";
    const lines = wrap(ctx, item.name, col.itemMax);
    y += 40;
    const firstLineY = y;
    draw(() => ctx.fillText(lines[0], CONTENT_LEFT, firstLineY));

    // Figures sit on the item's first line; extra name lines hang below.
    draw(() => {
      ctx.textAlign = "right";
      ctx.fillText(String(item.qty), col.qtyRight, firstLineY);
      ctx.fillText(money(item.price), col.priceRight, firstLineY);
      ctx.fillText(money(item.price * item.qty), col.amountRight, firstLineY);
    });

    for (const extra of lines.slice(1)) {
      y += 28;
      const lineY = y;
      draw(() => {
        ctx.textAlign = "left";
        ctx.fillText(extra, CONTENT_LEFT, lineY);
      });
    }

    if (item.note) {
      ctx.font = font(22);
      y += 26;
      const noteY = y;
      draw(() => {
        ctx.textAlign = "left";
        ctx.fillText(`  * ${item.note}`, CONTENT_LEFT, noteY);
      });
      ctx.font = font(26);
    }
  }

  y += 16;
  draw(() => dashedRule(ctx, y));

  // --- Totals -------------------------------------------------------------
  // Subtotal dropped — the cafe gives no discounts, so it always equalled
  // the total anyway and just repeated the one figure that matters (same
  // reasoning the on-screen cart panel already applied to its own totals).
  ctx.font = font(26);
  y += 56;
  draw(() => {
    ctx.font = font(40, "bold");
    ctx.textAlign = "left";
    ctx.fillText(`${L.total} :`, CONTENT_LEFT, y);
    ctx.textAlign = "right";
    // The rupee sign renders from the browser font here — on a raster print
    // there's no codepage to fall foul of.
    ctx.fillText(`₹ ${money(bill.total)}`, col.amountRight, y);
  });

  ctx.font = font(24);
  y += 44;
  draw(() => {
    ctx.textAlign = "left";
    ctx.fillText(`${L.payment}: ${bill.paymentLabel}`, CONTENT_LEFT, y);
    ctx.textAlign = "right";
    ctx.fillText(bill.workerName, col.amountRight, y);
  });

  // A credit slip has to name who it is on account for.
  if (bill.customerName) {
    y += 28;
    const nameY = y;
    draw(() => {
      ctx.textAlign = "left";
      ctx.fillText(`  ${bill.customerName}`, CONTENT_LEFT, nameY);
    });
  }

  // Split bills get the two figures on their own line — the row above is
  // already shared with the right-aligned worker name.
  if (bill.paymentBreakdown) {
    y += 28;
    const breakdownY = y;
    draw(() => {
      ctx.textAlign = "left";
      ctx.fillText(`  ${bill.paymentBreakdown}`, CONTENT_LEFT, breakdownY);
    });
  }

  // --- Footer -------------------------------------------------------------
  if (CAFE_DETAILS.thanks) {
    ctx.font = font(32, "bold");
    y += 48;
    draw(() => {
      ctx.textAlign = "center";
      ctx.fillText(CAFE_DETAILS.thanks, CENTER, y);
    });
  }

  if (CAFE_DETAILS.footer) {
    ctx.font = font(22);
    y += 32;
    draw(() => {
      ctx.textAlign = "center";
      ctx.fillText(CAFE_DETAILS.footer, CENTER, y);
    });
  }

  // Blank tail so the tear-off edge clears the last line — widened along
  // with the rest of the layout above. The cut sequence already feeds
  // three lines past this point on top of it, so this is on top of that
  // margin, not instead of it.
  y += 40;
  return Math.ceil(y);
}
