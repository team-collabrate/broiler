/**
 * The calibration sheet: one short print that shows whether the printer's width, darkness and Tamil clarity are
 * right, for the day a new printer (or paper) is set up. Print it from the printer setup screen.
 *
 * What to look for on the paper:
 *  - the frame touches both edges and every corner mark is there: if the right side is missing, the print head is
 *    narrower than PAPER_WIDTH_DOTS (set the width in the printer's manual in shopDetails.ts);
 *  - the ruler numbers run to the end: the last number printed is how many dots fit across;
 *  - the solid block is evenly black and the fine patterns are not smeared or striped: if they are pale or have
 *    white streaks, the darkness or the paper is the problem;
 *  - the Tamil lines are clear at all three sizes, and the rooster is crisp.
 */
import { buildRasterReceipt } from "./escposRaster";
import { font, RECEIPT_WIDTH } from "./receiptCanvas";
import { LOGO_SIZE, RECEIPT_LOGO_URL } from "./shopDetails";

const W = RECEIPT_WIDTH;

async function loadLogo(): Promise<HTMLImageElement | null> {
  const url = RECEIPT_LOGO_URL;
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function renderCalibrationCanvas(): Promise<HTMLCanvasElement> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* use whatever is loaded */
    }
  }
  const logo = await loadLogo();

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = 980;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, canvas.height);
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";

  let y = 0;

  // Frame: touches all four edges, so a clipped side shows at once.
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, W - 4, canvas.height - 4);

  // Title
  ctx.textAlign = "center";
  ctx.font = font(36, "bold");
  y = 64;
  ctx.fillText("அளவு சோதனை", W / 2, y);
  ctx.font = font(22);
  y += 34;
  ctx.fillText(`${W} புள்ளி அகலம்`, W / 2, y);

  // Ruler: a tick and a number every 50 dots, so the last visible number is the real width.
  y += 30;
  const rulerTop = y;
  ctx.font = font(18);
  ctx.textAlign = "left";
  for (let x = 0; x <= W; x += 50) {
    const tickX = Math.min(x, W - 2);
    ctx.fillRect(tickX, rulerTop, 2, x % 100 === 0 ? 26 : 16);
    if (x % 100 === 0 && x < W - 30) ctx.fillText(String(x), x + 10, rulerTop + 48);
  }
  ctx.fillRect(0, rulerTop + 26, W, 2);
  y = rulerTop + 64;

  // Solid block: even, deep black.
  ctx.fillRect(14, y, W - 28, 44);
  y += 44 + 14;

  // Fine patterns: a one-dot checker, then lines 1, 2, 3 and 4 dots thick.
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < Math.floor((W - 28) / 2); col += 1) {
      if ((row + col) % 2 === 0) ctx.fillRect(14 + col * 2, y + row * 2, 2, 2);
    }
  }
  y += 14;
  for (const thickness of [1, 2, 3, 4]) {
    ctx.fillRect(14, y, W - 28, thickness);
    y += thickness + 8;
  }
  y += 10;

  // Tamil at the sizes the bill uses.
  ctx.textAlign = "left";
  ctx.font = font(24);
  ctx.fillText("நாட்டுக்கோழி கறி", 14, y + 24);
  ctx.fillText("1.250 கிலோ × ₹450.00", 14, y + 56);
  ctx.font = font(28, "bold");
  ctx.fillText("கோழி - தோலுடன்", 14, y + 108);
  ctx.textAlign = "right";
  ctx.fillText("₹1,234.50", W - 14, y + 108);
  ctx.textAlign = "left";
  ctx.font = font(40, "bold");
  ctx.fillText("மொத்தம்", 14, y + 170);
  ctx.textAlign = "right";
  ctx.fillText("₹2,468.00", W - 14, y + 170);
  y += 200;

  // Logo
  if (logo && logo.width > 0) {
    const scale = Math.min(LOGO_SIZE.width / logo.width, LOGO_SIZE.height / logo.height, 1);
    const w = logo.width * scale;
    const h = logo.height * scale;
    ctx.drawImage(logo, W / 2 - w / 2, y, w, h);
    y += h + 20;
  }

  ctx.textAlign = "center";
  ctx.font = font(22);
  ctx.fillText("எல்லா கோடுகளும்", W / 2, y + 20);
  ctx.fillText("எண்களும் தெரிய வேண்டும்", W / 2, y + 52);
  y += 70;

  // Trim to what was used.
  const trimmed = document.createElement("canvas");
  trimmed.width = W;
  trimmed.height = Math.min(canvas.height, Math.ceil(y + 20));
  const out = trimmed.getContext("2d")!;
  out.fillStyle = "#fff";
  out.fillRect(0, 0, W, trimmed.height);
  out.drawImage(canvas, 0, 0);
  out.fillStyle = "#000";
  out.fillRect(0, trimmed.height - 4, W, 4); // closing edge of the frame
  out.fillRect(0, 0, 4, trimmed.height);
  out.fillRect(W - 4, 0, 4, trimmed.height);
  return trimmed;
}

export async function prepareCalibrationRaster(): Promise<Uint8Array> {
  return buildRasterReceipt(await renderCalibrationCanvas());
}
