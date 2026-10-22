/**
 * Renders a bill to a 1-bit-friendly canvas.
 *
 * Thermal printers can only print Latin text from a single-byte codepage, so Tamil (and a logo) can't go out
 * as ESC/POS *text* at all. Instead the whole receipt is drawn here, where the browser's own Tamil font
 * shaping is available, and printed as a raster bitmap (see escposRaster.ts).
 *
 * The same canvas backs the on-screen bill and the receipt preview, so what the staff see and what the
 * customer is handed cannot drift apart.
 */
import { buildRasterReceipt } from "./escposRaster";
import type { BillInput } from "./receipt";
import { LOGO_SIZE, PAPER_WIDTH_DOTS, RECEIPT_LOGO_URL, SHOP_DETAILS } from "./shopDetails";

/** Printable dots across the paper. See PAPER_WIDTH_DOTS. */
export const RECEIPT_WIDTH = PAPER_WIDTH_DOTS;

/**
 * The layout was drawn for 80 mm paper (576 dots). On narrower paper (58 mm is 384 dots) every size and gap shrinks
 * by this factor so the same bill fits; the type stays large enough to read (a Tamil line is still about 20 dots
 * tall). `size()` scales a size or gap in the 80 mm design.
 */
const SCALE = PAPER_WIDTH_DOTS >= 520 ? 1 : 0.82;
const size = (n: number) => Math.round(n * SCALE);

const PAD = SCALE === 1 ? 8 : 6;
const CONTENT_LEFT = PAD;
const CONTENT_RIGHT = RECEIPT_WIDTH - PAD;
const CENTER = RECEIPT_WIDTH / 2;

/** Tamil first: the system Tamil face shapes the script correctly; the Latin fallbacks only handle digits and the few ASCII labels. */
export const FONT_STACK = '"Noto Sans Tamil", "Latha", "Nirmala UI", system-ui, sans-serif';

export const font = (designSize: number, weight: "normal" | "bold" = "normal") => `${weight} ${Math.round(designSize * SCALE)}px ${FONT_STACK}`;

/** Every label on the paper is Tamil: the receipt is for the customer, so it reads in one language. */
const L = {
  item: "பொருள்",
  amount: "தொகை",
  date: "தேதி",
  billNo: "பில் எண்",
  total: "மொத்தம்",
  totalWeight: "மொத்த எடை",
  totalPieces: "மொத்த எண்ணிக்கை",
  payment: "பணம் செலுத்தும் முறை",
  phone: "தொலைபேசி",
  copy: "நகல்",
} as const;

/** Widest line total the amount column has to hold, used as a floor on its width so a big bill can't push an amount into the name beside it. */
const WIDEST_AMOUNT = "₹99,999.00";

/** Space between the item name column and the amount column. */
const COL_GUTTER = size(14);

async function loadLogo(): Promise<HTMLImageElement | null> {
  const url = RECEIPT_LOGO_URL;
  if (!url) return null; // disabled: skip the fetch entirely
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // no logo file: print without it
    img.src = url;
  });
}

/** Greedy wrap so long item names spill to a second line instead of colliding with the amount. */
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
  return `${pad2(h)}:${pad2(date.getMinutes())} ${period}`;
}

export interface ReceiptRasterTiming {
  /** document.fonts.ready + logo fetch + the two paint() passes. */
  renderMs: number;
  /** packRaster's per-pixel scan + assembling the ESC/POS command stream. */
  rasterMs: number;
}

/**
 * Canvas render + ESC/POS encode in one call, timed: the two steps every print (and print retry) needs
 * back to back, instrumented once here so the numbers can't drift apart from what actually ran.
 */
export async function prepareReceiptRaster(bill: BillInput): Promise<{ bytes: Uint8Array; timing: ReceiptRasterTiming }> {
  const renderStart = performance.now();
  const canvas = await renderReceiptCanvas(bill);
  const renderMs = performance.now() - renderStart;

  const rasterStart = performance.now();
  const bytes = buildRasterReceipt(canvas);
  const rasterMs = performance.now() - rasterStart;

  return { bytes, timing: { renderMs, rasterMs } };
}

export async function renderReceiptCanvas(bill: BillInput): Promise<HTMLCanvasElement> {
  // Tamil glyphs measure as tofu until the face is actually loaded, which would throw off every wrap and
  // right-alignment on the receipt.
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* proceed with whatever is loaded */
    }
  }

  const logo = await loadLogo();

  // Two passes over an identical draw list: the first only advances `y` to learn the height, the second
  // draws for real once the canvas is sized.
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

function paint(ctx: CanvasRenderingContext2D, bill: BillInput, logo: HTMLImageElement | null, measureOnly: boolean): number {
  const draw = (fn: () => void) => {
    if (!measureOnly) fn();
  };

  // The amount column is as wide as the widest figure it must hold; the item name gets the rest.
  ctx.font = font(28, "bold");
  const amountW = Math.max(ctx.measureText(WIDEST_AMOUNT).width, ctx.measureText(L.amount).width);
  const itemMax = CONTENT_RIGHT - CONTENT_LEFT - amountW - COL_GUTTER;

  let y = PAD;

  // --- Logo -----------------------------------------------------------------
  if (logo && logo.width > 0) {
    const scale = Math.min(LOGO_SIZE.width / logo.width, LOGO_SIZE.height / logo.height, 1);
    const w = logo.width * scale;
    const h = logo.height * scale;
    draw(() => ctx.drawImage(logo, CENTER - w / 2, y, w, h));
    y += h + size(12);
  }

  // --- Shop identity --------------------------------------------------------
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // The name is as big as will fit between the paper margins (a long name shrinks instead of being cut off).
  let nameSize = 44;
  ctx.font = font(nameSize, "bold");
  while (nameSize > 24 && ctx.measureText(SHOP_DETAILS.name).width > CONTENT_RIGHT - CONTENT_LEFT) {
    nameSize -= 2;
    ctx.font = font(nameSize, "bold");
  }
  y += size(nameSize);
  const nameFont = font(nameSize, "bold");
  draw(() => {
    ctx.font = nameFont;
    ctx.fillText(SHOP_DETAILS.name, CENTER, y);
  });

  if (SHOP_DETAILS.subtitle) {
    ctx.font = font(26);
    y += size(36);
    draw(() => ctx.fillText(SHOP_DETAILS.subtitle, CENTER, y));
  }

  if (SHOP_DETAILS.phone) {
    ctx.font = font(24);
    y += size(32);
    draw(() => ctx.fillText(`${L.phone}: ${SHOP_DETAILS.phone}`, CENTER, y));
  }

  // --- Copy mark ------------------------------------------------------------
  // A reprint says so, in large type between rules, so it cannot be handed over as a second original.
  if (bill.isCopy) {
    y += size(54);
    const copyY = y;
    draw(() => {
      ctx.font = font(36, "bold");
      ctx.textAlign = "center";
      const label = L.copy;
      const half = ctx.measureText(label).width / 2;
      ctx.fillText(label, CENTER, copyY);
      ctx.fillRect(CONTENT_LEFT, copyY - size(14), CENTER - half - size(16) - CONTENT_LEFT, 3);
      ctx.fillRect(CENTER + half + size(16), copyY - 14, CONTENT_RIGHT - (CENTER + half + size(16)), 3);
    });
  }

  // --- Order meta -----------------------------------------------------------
  y += size(20);
  ctx.font = font(24);
  y += size(32);
  const metaY = y;
  // Date on the left, clock on the right of the same line.
  draw(() => {
    ctx.textAlign = "left";
    ctx.fillText(`${L.date}: ${formatDate(bill.createdAt)}`, CONTENT_LEFT, metaY);
    ctx.textAlign = "right";
    ctx.fillText(formatTime(bill.createdAt), CONTENT_RIGHT, metaY);
  });
  y += size(30);
  const billNoY = y;
  draw(() => {
    ctx.textAlign = "left";
    ctx.fillText(`${L.billNo}: ${bill.billNo}`, CONTENT_LEFT, billNoY);
    if (bill.staffName) {
      ctx.textAlign = "right";
      ctx.fillText(bill.staffName, CONTENT_RIGHT, billNoY);
    }
  });

  y += size(20);
  draw(() => dashedRule(ctx, y));

  // --- Column headers -------------------------------------------------------
  ctx.font = font(22, "bold");
  y += size(36);
  const headY = y;
  draw(() => {
    ctx.textAlign = "left";
    ctx.fillText(L.item, CONTENT_LEFT, headY);
    ctx.textAlign = "right";
    ctx.fillText(L.amount, CONTENT_RIGHT, headY);
  });

  y += size(12);
  draw(() => dashedRule(ctx, y));
  y += size(8);

  // --- Line items -----------------------------------------------------------
  // Two rows per item: the name with the line total on the right, then a smaller line that says how much
  // was sold and at what rate. The unit wording (கிலோ, எண்) is wider than a bare number, so this reads
  // better than separate quantity and price columns would on 80 mm.
  for (const item of bill.lines) {
    ctx.font = font(28, "bold");
    ctx.textAlign = "left";
    const nameLines = wrap(ctx, item.name, itemMax);
    y += size(40);
    const firstLineY = y;
    draw(() => {
      ctx.font = font(28, "bold");
      ctx.textAlign = "left";
      ctx.fillText(nameLines[0], CONTENT_LEFT, firstLineY);
      ctx.textAlign = "right";
      ctx.fillText(item.amount, CONTENT_RIGHT, firstLineY);
    });

    for (const extra of nameLines.slice(1)) {
      y += size(34);
      const lineY = y;
      draw(() => {
        ctx.font = font(28, "bold");
        ctx.textAlign = "left";
        ctx.fillText(extra, CONTENT_LEFT, lineY);
      });
    }

    ctx.font = font(24);
    const detail = `${item.quantity} × ${item.rate}`;
    for (const detailLine of wrap(ctx, detail, CONTENT_RIGHT - CONTENT_LEFT - 16)) {
      y += size(30);
      const lineY = y;
      draw(() => {
        ctx.font = font(24);
        ctx.textAlign = "left";
        ctx.fillText(`  ${detailLine}`, CONTENT_LEFT, lineY);
      });
    }

    if (item.note) {
      y += size(28);
      const noteY = y;
      draw(() => {
        ctx.font = font(22);
        ctx.textAlign = "left";
        ctx.fillText(`  * ${item.note}`, CONTENT_LEFT, noteY);
      });
    }
    y += size(4);
  }

  y += size(10);
  draw(() => dashedRule(ctx, y));

  // --- Totals ---------------------------------------------------------------
  ctx.font = font(24);
  if (bill.totalWeight) {
    y += size(34);
    const rowY = y;
    draw(() => {
      ctx.font = font(24);
      ctx.textAlign = "left";
      ctx.fillText(L.totalWeight, CONTENT_LEFT, rowY);
      ctx.textAlign = "right";
      ctx.fillText(bill.totalWeight!, CONTENT_RIGHT, rowY);
    });
  }
  if (bill.totalPieces) {
    y += size(34);
    const rowY = y;
    draw(() => {
      ctx.font = font(24);
      ctx.textAlign = "left";
      ctx.fillText(L.totalPieces, CONTENT_LEFT, rowY);
      ctx.textAlign = "right";
      ctx.fillText(bill.totalPieces!, CONTENT_RIGHT, rowY);
    });
  }

  y += size(56);
  const totalY = y;
  draw(() => {
    ctx.font = font(40, "bold");
    ctx.textAlign = "left";
    ctx.fillText(L.total, CONTENT_LEFT, totalY);
    ctx.textAlign = "right";
    // The rupee sign renders from the browser font here: on a raster print there's no codepage to fall foul of.
    ctx.fillText(bill.total, CONTENT_RIGHT, totalY);
  });

  y += size(44);
  const payY = y;
  draw(() => {
    ctx.font = font(24);
    ctx.textAlign = "left";
    ctx.fillText(`${L.payment}: ${bill.paymentLabel}`, CONTENT_LEFT, payY);
  });

  // A credit slip has to name who it is on account for.
  if (bill.customerName) {
    y += size(30);
    const nameY = y;
    draw(() => {
      ctx.font = font(24);
      ctx.textAlign = "left";
      ctx.fillText(`  ${bill.customerName}`, CONTENT_LEFT, nameY);
    });
  }

  // A split bill's two figures get their own line.
  if (bill.paymentDetail) {
    ctx.font = font(24);
    for (const detailLine of wrap(ctx, bill.paymentDetail, CONTENT_RIGHT - CONTENT_LEFT - 16)) {
      y += size(30);
      const lineY = y;
      draw(() => {
        ctx.font = font(24);
        ctx.textAlign = "left";
        ctx.fillText(`  ${detailLine}`, CONTENT_LEFT, lineY);
      });
    }
  }

  // --- Footer ---------------------------------------------------------------
  if (SHOP_DETAILS.thanks) {
    y += size(56);
    const thanksY = y;
    draw(() => {
      ctx.font = font(32, "bold");
      ctx.textAlign = "center";
      ctx.fillText(SHOP_DETAILS.thanks, CENTER, thanksY);
    });
  }

  if (SHOP_DETAILS.footer) {
    y += size(34);
    const footY = y;
    draw(() => {
      ctx.font = font(22);
      ctx.textAlign = "center";
      ctx.fillText(SHOP_DETAILS.footer, CENTER, footY);
    });
  }

  // Blank tail so the tear-off edge clears the last line. The cut sequence already feeds three lines past
  // this point on top of it, so this is on top of that margin, not instead of it.
  y += size(40);
  return Math.ceil(y);
}
