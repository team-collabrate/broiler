import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@kumbakonam/shared";
import type { BillInput } from "../printing/receipt";
import { renderReceiptCanvas } from "../printing/receiptCanvas";
import "./BillView.css";

const STRINGS = {
  notice: { en: "Printer unavailable — here's the bill to share.", ta: "பிரிண்டர் இல்லை — பகிர பில் இதோ." },
  rendering: { en: "Preparing bill…", ta: "பில் தயாராகிறது…" },
  retryPrint: { en: "Retry Print", ta: "மீண்டும் அச்சிடு" },
  closeNext: { en: "Close · Next Order", ta: "மூடு · அடுத்த ஆர்டர்" },
};

export interface BillViewProps {
  bill: BillInput;
  canRetryPrint: boolean;
  onRetryPrint: () => void;
  onClose: () => void;
}

/**
 * On-screen bill fallback — User Flow §1 ("printer not found → show on-screen
 * bill fallback"), worker can screenshot/share it.
 *
 * Renders the exact same canvas that gets sent to the printer, so the paper
 * copy and the screen copy cannot drift apart.
 */
export function BillView({ bill, canRetryPrint, onRetryPrint, onClose }: BillViewProps) {
  const { language } = useLanguage();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const holderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    renderReceiptCanvas(bill)
      .then((canvas) => {
        if (!cancelled) setImageUrl(canvas.toDataURL("image/png"));
      })
      .catch((err) => console.error("Receipt rendering failed", err));
    return () => {
      cancelled = true;
    };
  }, [bill]);

  // Escape or Enter both move on to the next order — there's nothing to "cancel" here.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="bill-view__backdrop" role="dialog" aria-modal="true" aria-label="Bill">
      <div className="bill-view">
        <p className="bill-view__notice">{STRINGS.notice[language]}</p>

        <div className="bill-view__paper" ref={holderRef}>
          {imageUrl ? (
            <img className="bill-view__image" src={imageUrl} alt="" />
          ) : (
            <p className="bill-view__rendering">{STRINGS.rendering[language]}</p>
          )}
        </div>

        <div className="bill-view__actions">
          {canRetryPrint && (
            <button type="button" className="bill-view__retry" onClick={onRetryPrint}>
              {STRINGS.retryPrint[language]}
            </button>
          )}
          <button type="button" className="bill-view__close" onClick={onClose}>
            {STRINGS.closeNext[language]}
          </button>
        </div>
      </div>
    </div>
  );
}
