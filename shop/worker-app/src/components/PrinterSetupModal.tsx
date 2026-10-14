import { useEffect, useState } from "react";
import { useLanguage, type Language } from "@kumbakonam/shared";
import type { PrinterStatus } from "../hooks/usePrinter";
import type { ClassicPrinterConnection } from "../printing/classicBluetoothPrinter";
import { getBluetoothDiagnostics, type BluetoothDiagnostics } from "../printing/webBluetoothPrinter";
import "./PrinterSetupModal.css";

export interface PrinterSetupModalProps {
  status: PrinterStatus;
  error: string | null;
  deviceName: string | null;
  /** "native" (classic Bluetooth SPP, installed app) vs "web" (BLE/GATT, plain browser tab) — see usePrinter.ts. */
  platform: "native" | "web";
  /** Native only — populated once status is "picking". */
  printerDevices: ClassicPrinterConnection[];
  onConnect: () => void;
  /** Native only — called with an address from printerDevices. */
  onSelectPrinter: (address: string) => void;
  onClose: () => void;
}

const STATUS_TEXT: Record<PrinterStatus, Record<Language, string>> = {
  unsupported: {
    en: "This browser can't use Bluetooth. Use Chrome on Android to print.",
    ta: "இந்த உலாவி புளூடூத்தைப் பயன்படுத்த முடியாது. அச்சிட Android இல் Chrome ஐப் பயன்படுத்தவும்.",
  },
  checking: {
    en: "Checking for a previously connected printer…",
    ta: "முன்பு இணைக்கப்பட்ட பிரிண்டரைச் சரிபார்க்கிறது…",
  },
  unpaired: {
    en: "No printer connected yet. Switch the printer on and keep it nearby.",
    ta: "இன்னும் பிரிண்டர் இணைக்கப்படவில்லை. பிரிண்டரை ஆன் செய்து அருகில் வைக்கவும்.",
  },
  connecting: {
    en: "Pick your printer from the Bluetooth list…",
    ta: "புளூடூத் பட்டியலிலிருந்து உங்கள் பிரிண்டரைத் தேர்ந்தெடுக்கவும்…",
  },
  // Native only — the web path never leaves "connecting" mid-flow, since
  // the browser's own picker is a single blocking call.
  picking: {
    en: "Pick your printer from the list below.",
    ta: "கீழே உள்ள பட்டியலிலிருந்து உங்கள் பிரிண்டரைத் தேர்ந்தெடுக்கவும்.",
  },
  ready: { en: "Printer connected.", ta: "பிரிண்டர் இணைக்கப்பட்டது." },
  error: {
    en: "Printer isn't responding. Check it's on and in range.",
    ta: "பிரிண்டர் பதிலளிக்கவில்லை. அது இயங்குகிறதா, அருகில் உள்ளதா எனப் பார்க்கவும்.",
  },
};

const STRINGS = {
  title: { en: "Printer Setup", ta: "பிரிண்டர் அமைப்பு" },
  connected: { en: "Connected", ta: "இணைக்கப்பட்டது" },
  connectAnother: { en: "Connect a different printer", ta: "வேறு பிரிண்டரை இணை" },
  connect: { en: "Connect Bluetooth Printer", ta: "புளூடூத் பிரிண்டரை இணை" },
  done: { en: "Done", ta: "முடிந்தது" },
  troubleshootTitle: { en: "Printer not in the list?", ta: "பட்டியலில் பிரிண்டர் இல்லையா?" },
  checking: { en: "Checking…", ta: "சரிபார்க்கிறது…" },
  okBrowser: { en: "Browser supports Bluetooth", ta: "உலாவி புளூடூத்தை ஆதரிக்கிறது" },
  badBrowser: { en: "Use Chrome on Android", ta: "Android இல் Chrome ஐப் பயன்படுத்தவும்" },
  okAdapter: { en: "Bluetooth is on", ta: "புளூடூத் இயங்குகிறது" },
  badAdapter: { en: "Turn Bluetooth on", ta: "புளூடூத்தை ஆன் செய்யவும்" },
  okSecure: { en: "Secure connection", ta: "பாதுகாப்பான இணைப்பு" },
  badSecure: { en: "Must be opened over https", ta: "https வழியாகத் திறக்க வேண்டும்" },
  okAndroid: { en: "Android device", ta: "Android சாதனம்" },
  badAndroid: { en: "Not Android — open this on the tablet", ta: "Android அல்ல — டேப்லெட்டில் திறக்கவும்" },
  classicNote: {
    en: "If all of the above are fine and the printer still isn't listed, it likely pairs as a classic Bluetooth printer. Browsers can only reach Bluetooth LE printers, so use the on-screen bill instead.",
    ta: "மேலே உள்ள அனைத்தும் சரியாக இருந்தும் பிரிண்டர் பட்டியலில் இல்லை என்றால், அது classic Bluetooth பிரிண்டராக இருக்கலாம். உலாவிகள் Bluetooth LE பிரிண்டர்களை மட்டுமே அணுக முடியும், எனவே திரையில் உள்ள பில்லைப் பயன்படுத்தவும்.",
  },
  emptyScan: {
    en: "No nearby devices found. Make sure the printer is on, and pair it in Android's own Bluetooth settings first if this is the first time.",
    ta: "அருகில் சாதனங்கள் எதுவும் இல்லை. பிரிண்டர் ஆன் செய்யப்பட்டுள்ளதா என்பதைச் சரிபார்க்கவும்; இது முதல் முறை எனில் Android இன் புளூடூத் அமைப்புகளில் முதலில் இணைக்கவும்.",
  },
};

function Check({ ok, okText, badText }: { ok: boolean; okText: string; badText: string }) {
  return (
    <li className={ok ? "is-ok" : "is-bad"}>
      <span aria-hidden="true">{ok ? "✓" : "✕"}</span>
      {ok ? okText : badText}
    </li>
  );
}

/** Engineering Plan Phase 3 — one-time "connect printer" setup screen. */
export function PrinterSetupModal({
  status,
  error,
  deviceName,
  platform,
  printerDevices,
  onConnect,
  onSelectPrinter,
  onClose,
}: PrinterSetupModalProps) {
  const { language } = useLanguage();
  const [diagnostics, setDiagnostics] = useState<BluetoothDiagnostics | null>(null);

  // Web only — this checklist (browser support, secure context, Android)
  // is about *why the browser's Bluetooth picker* might not show a device;
  // none of it applies once classic SPP is reachable natively, and an
  // empty scan there is just "nothing nearby", not one of these causes.
  useEffect(() => {
    if (platform !== "web") return;
    let cancelled = false;
    getBluetoothDiagnostics().then((d) => {
      if (!cancelled) setDiagnostics(d);
    });
    return () => {
      cancelled = true;
    };
  }, [platform]);

  // Escape only — Enter is left alone so it can't accidentally trigger the
  // Bluetooth device picker (that's a real, deliberate action, not a default).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="printer-modal__backdrop" role="dialog" aria-modal="true" aria-label={STRINGS.title[language]}>
      <div className="printer-modal">
        <h2 className="printer-modal__title">{STRINGS.title[language]}</h2>

        <p className="printer-modal__status">
          {status === "ready" && deviceName ? `${STRINGS.connected[language]}: ${deviceName}` : STATUS_TEXT[status][language]}
        </p>

        {error && <p className="printer-modal__error">{error}</p>}

        {/* Native picker — a plain list, not the OS's own picker (classic
            SPP has no browser-style device-choosing UI to reuse the way
            requestDevice() gave the web path one for free). */}
        {platform === "native" && status === "picking" && (
          <ul className="printer-modal__devices">
            {printerDevices.length === 0 ? (
              <p className="printer-modal__help-note">{STRINGS.emptyScan[language]}</p>
            ) : (
              printerDevices.map((device) => (
                <li key={device.address}>
                  <button type="button" className="printer-modal__device" onClick={() => onSelectPrinter(device.address)}>
                    {device.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}

        <button
          type="button"
          className="printer-modal__connect"
          onClick={onConnect}
          disabled={status === "unsupported" || status === "connecting"}
        >
          {status === "ready" ? STRINGS.connectAnother[language] : STRINGS.connect[language]}
        </button>

        {/* Only worth surfacing while the printer still isn't working, and
            only on the web path — see this effect's own comment above. */}
        {platform === "web" && status !== "ready" && (
          <details className="printer-modal__help">
            <summary>{STRINGS.troubleshootTitle[language]}</summary>
            {diagnostics === null ? (
              <p className="printer-modal__help-note">{STRINGS.checking[language]}</p>
            ) : (
              <>
                <ul className="printer-modal__checks">
                  <Check
                    ok={diagnostics.supported && !diagnostics.likelyUnsupportedBrowser}
                    okText={STRINGS.okBrowser[language]}
                    badText={STRINGS.badBrowser[language]}
                  />
                  {/* getAvailability() is absent on some builds — an unknown
                      adapter state is not evidence of a problem, so hide it. */}
                  {diagnostics.adapterAvailable !== null && (
                    <Check
                      ok={diagnostics.adapterAvailable}
                      okText={STRINGS.okAdapter[language]}
                      badText={STRINGS.badAdapter[language]}
                    />
                  )}
                  <Check
                    ok={diagnostics.secureContext}
                    okText={STRINGS.okSecure[language]}
                    badText={STRINGS.badSecure[language]}
                  />
                  <Check
                    ok={diagnostics.android}
                    okText={STRINGS.okAndroid[language]}
                    badText={STRINGS.badAndroid[language]}
                  />
                </ul>
                <p className="printer-modal__help-note">{STRINGS.classicNote[language]}</p>
              </>
            )}
          </details>
        )}

        <button type="button" className="printer-modal__close" onClick={onClose}>
          {STRINGS.done[language]}
        </button>
      </div>
    </div>
  );
}
