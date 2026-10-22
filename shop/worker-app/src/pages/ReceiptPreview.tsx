import { useEffect, useRef, useState } from "react";
import { renderCalibrationCanvas } from "../printing/calibration";
import { renderReceiptCanvas, RECEIPT_WIDTH } from "../printing/receiptCanvas";
import { SAMPLE_BILLS } from "../printing/sampleBills";

/**
 * Open the app at /?receipt to see the bill exactly as the printer will receive it (the same canvas),
 * for sample bills of every kind (weight, split, credit, pieces and price changes, ten long lines, a reprint) and the
 * calibration sheet used to set up a new printer. Handy for checking the layout without a
 * printer, and for tuning shopDetails.ts.
 */
export function ReceiptPreview() {
  const [index, setIndex] = useState(0);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const drawing = index < SAMPLE_BILLS.length ? renderReceiptCanvas(SAMPLE_BILLS[index].bill) : renderCalibrationCanvas();
    drawing.then((canvas) => {
      if (!alive || !host.current) return;
      host.current.replaceChildren(canvas);
      canvas.style.width = `${RECEIPT_WIDTH}px`;
      canvas.style.boxShadow = "0 2px 12px rgba(0,0,0,0.25)";
    });
    return () => {
      alive = false;
    };
  }, [index]);

  return (
    <div style={{ padding: 16, background: "#ddd", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {SAMPLE_BILLS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setIndex(i)}
            style={{ padding: "8px 14px", fontWeight: i === index ? 700 : 400 }}
          >
            {s.label}
          </button>
        ))}
        <button type="button" onClick={() => setIndex(SAMPLE_BILLS.length)} style={{ padding: "8px 14px", fontWeight: index === SAMPLE_BILLS.length ? 700 : 400 }}>
          Calibration sheet
        </button>
        <span style={{ alignSelf: "center", color: "#555" }}>{RECEIPT_WIDTH} dots wide (80 mm paper)</span>
      </div>
      <div ref={host} />
    </div>
  );
}
