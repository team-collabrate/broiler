# Bluetooth bill printing (80 mm thermal printer)

How printing works, how to set it up on the tablet, and what is still to be checked on real hardware.

## How it works

1. The sale is saved, then the bill is **drawn as a picture** (`worker-app/src/printing/receiptCanvas.ts`),
   576 dots wide for 80 mm paper. Thermal printers cannot print Tamil as text, so the whole bill, Tamil
   included, goes out as an image (`escposRaster.ts` turns it into printer commands).
2. The picture is sent to the printer over Bluetooth:
   - **Android app (the installed APK):** classic Bluetooth serial (SPP), through the Capacitor plugin
     `@fmesasc/capacitor-bluetooth-serial`. This is the reliable path, tuned on real printers by the
     Kumbakonam project.
   - **Browser or installed PWA:** Web Bluetooth, which only works with printers that use Bluetooth LE.
     Many cheap thermal printers are classic-only and will not show up there.
   So for the shop, **use the Android app for printing**.
3. If the printer is missing, off or refuses, the bill is shown on screen with a **Print again** button,
   without charging the sale a second time.

## What you can check without a printer

Open the app at `/?receipt` (for example `http://localhost:3000/?receipt`). It draws three sample bills
(weight, split GPay + cash, credit) using exactly the same picture the printer receives. Use it to tune the
layout.

## Set up the shop's details

Edit `worker-app/src/printing/shopDetails.ts`:

| Setting | Meaning |
| --- | --- |
| `SHOP_DETAILS.name` | **Placeholder** (`பிராய்லர் கோழிக்கடை`). Put the real shop name. A long name shrinks to fit. |
| `SHOP_DETAILS.subtitle` | Address or area, one line (optional) |
| `SHOP_DETAILS.phone` | Phone number (optional) |
| `SHOP_DETAILS.thanks` / `footer` | Closing lines |
| `PAPER_WIDTH_DOTS` | `576` for 80 mm paper (the shop's printer). `384` for 58 mm. |
| `RECEIPT_LOGO_URL` | The black-and-white rooster, `worker-app/public/receipt-logo.png` (108 x 130, 1-bit) |

To change the logo: make a high-contrast black-on-white image 108 pixels wide (thermal paper prints no greys)
and replace `receipt-logo.png`. If you change its size, update `LOGO_SIZE` in the same file.

## Build the Android app

You need Android Studio (it brings the JDK and the Android SDK) on the computer that builds the app.

```bash
cd shop
npm install
npm run android:sync     # builds the web app and copies it into the Android project
npm run android:open     # opens it in Android Studio; press Run with the tablet plugged in
```

The app is called **Broiler POS** and its id is `com.broiler.pos`. The launcher icon and splash screen are
the rooster. For a release you can hand out, use Android Studio's Build > Generate Signed Bundle / APK.

## Pair the printer on the tablet

1. Switch the printer on and pair it in the tablet's own **Settings > Bluetooth** first (the PIN is usually
   `0000` or `1234`).
2. In the app open the printer setup (printer icon in the side rail), tap **Connect**, allow the
   Bluetooth permission, and pick the printer from the list.
3. Tap **Print a test bill**. It prints the weight sample bill.

## Still to check on the real printer (not possible from here)

- The paper width really is 80 mm / 576 dots on that model. If the bill is cut off on the right, the head is
  narrower: set `PAPER_WIDTH_DOTS` to the value in the printer's manual (often 576 or 512).
- Print density and speed. If the print is faint or slow, the printer's own settings or the chunk size in
  `classicBluetoothPrinter.ts` may need a small change.
- The Tamil text is clear at the printed size, and the rooster is crisp.
- Android permission prompts on the tablet's Android version.
