# Bluetooth bill printing (80 mm thermal printer)

How printing works, what the staff see when something goes wrong, how to set the tablet up, and what is still to be
checked on the real printer.

## How it works

1. The sale is saved, then the bill is **drawn as a picture** (`worker-app/src/printing/receiptCanvas.ts`), 576 dots wide
   for 80 mm paper. Thermal printers cannot print Tamil as text, so the whole bill, Tamil included, goes out as an image
   (`escposRaster.ts` turns it into printer commands).
2. The picture is sent to the printer over Bluetooth:
   - **Android app (the installed APK):** classic Bluetooth serial (SPP) through the Capacitor plugin
     `@fmesasc/capacitor-bluetooth-serial`. This is the reliable path, tuned on real printers by the Kumbakonam project.
   - **Browser or installed web app:** Web Bluetooth, which only works with printers that use Bluetooth LE. Many cheap thermal
     printers are classic-only and will not show up there. So for the shop, **use the Android app for printing**.
3. A failed print is never a lost sale: the sale is saved first, and the bill stays on the screen with the reason and a
   **மீண்டும் அச்சிடு** (print again) button.

## What the staff will see

| Situation | What happens |
| --- | --- |
| Printer chosen and working | The bill prints; a green "பில் … அச்சிடப்பட்டது ✓" note. The rail shows **● பிரிண்டர்**. |
| No printer chosen on this tablet | The bill is saved and shown on the screen: "பிரிண்டர் இணைக்கப்படவில்லை…" with a **பிரிண்டர் அமைப்பு** button. The rail shows a gold **⚠ பிரிண்டர் இல்லை** (tap it to set up). |
| Printer switched off, out of range or out of paper | The bill is shown with "பிரிண்டர் பதிலளிக்கவில்லை. ஆன் செய்யப்பட்டுள்ளதா, அருகில் உள்ளதா, பேப்பர் உள்ளதா எனப் பார்க்கவும்". The rail turns red (**⚠ பிரிண்டர் சிக்கல்**). Fix it and press **மீண்டும் அச்சிடு**. No re-pairing needed. |
| Bluetooth switched off on the tablet | "புளூடூத் ஆஃப் செய்யப்பட்டுள்ளது…": turn it on in the tablet's settings, then print again. |
| The app has no Bluetooth permission | "…அமைப்புகள் > ஆப்ஸ் > Broiler POS > அனுமதிகளில் இயக்கவும்". |
| Someone wants a copy of an earlier bill | Admin ▸ **கடைசி பில்கள்** lists the last bills printed on this tablet; open one and print. It prints with a large **நகல்** (copy) mark so it cannot pass for a second original. |

The printer is **remembered**: it stays chosen after a restart, and it does not matter if the printer is still switched off when
the app opens. The Bluetooth connection is made (and made again if it has dropped) when a bill is printed: if the first try
fails the app drops the old connection, reconnects once and sends the bill again before giving up.

**Out of paper cannot be detected** by most cheap printers over Bluetooth, so it shows as "not responding". The on-screen bill and
**மீண்டும் அச்சிடு** cover it.

## What you can check without a printer

Open the app at `/?receipt` (for example `http://localhost:3000/?receipt`). It draws the sample bills (weight, split, credit,
pieces and price changes, ten lines with long names, a reprint) and the **calibration sheet**, using exactly the picture the
printer receives. Use it to check the layout.

To try the screens with no Bluetooth at all, in a development build type this in the browser console:
`__broiler.fakePrinter = "ok"` (or `"unreachable"`, `"bluetooth-off"`, `"permission"`). It does not exist in a production build.

## Set up the shop's details

Edit `worker-app/src/printing/shopDetails.ts`:

| Setting | Meaning |
| --- | --- |
| `SHOP_DETAILS.name` | **Placeholder** (`பிராய்லர் கோழிக்கடை`). Put the real shop name. A long name shrinks to fit. |
| `SHOP_DETAILS.subtitle` | Address or area, one line (optional) |
| `SHOP_DETAILS.phone` | Phone number (optional) |
| `SHOP_DETAILS.thanks` / `footer` | Closing lines |
| `PAPER_WIDTH_DOTS` | `576` for 80 mm paper. `384` for 58 mm. Set it from the printer's manual if the calibration sheet shows the head is narrower. |
| `RECEIPT_LOGO_URL` | The black-and-white rooster, `worker-app/public/receipt-logo.png` (108 x 130, 1-bit) |

To change the logo: make a high-contrast black-on-white image 108 pixels wide (thermal paper prints no greys) and replace
`receipt-logo.png`. If you change its size, update `LOGO_SIZE` in the same file.

## Build the Android app

From `shop/`:

```bash
npm run android:apk
```

It builds the web app, copies it into the Android project and runs Gradle, then prints where the APK is
(`worker-app/android/app/build/outputs/apk/debug/app-debug.apk`). It finds Java and the Android SDK by itself (see the top of
`scripts/build-android.mjs`); the first run downloads Gradle and the Android libraries, which takes several minutes. The app
connects to the Firebase project named in `worker-app/.env` **at the moment it is built**.

Install it on the tablet (USB debugging on, tablet plugged in): `adb install -r path/to/app-debug.apk`, or copy the file to the tablet
and open it (allow "install unknown apps" for the file manager when asked). The app is called **Broiler POS**, its id is
`com.broiler.pos`, and the launcher icon and splash screen are the rooster.

This APK is signed with Android's standard debug key, which is fine for a tablet the shop owns and installs itself. A
key of your own (Android Studio: Build > Generate Signed Bundle / APK) is only needed to publish on the Play Store, and
whoever makes it must keep the key file safe: without it the app cannot be updated in place.

## Set up the tablet (Redmi Pad 2) once

1. **Plug it in at the counter.** The app keeps the screen on while it is open (a sleeping tablet drops the printer's Bluetooth
   link), which uses battery.
2. **Stop Android closing the app in the background:** Settings > Apps > Broiler POS > Battery > *No restrictions* (wording varies
   on Xiaomi's system: also *Autostart* on). Sales waiting to upload are safe on the tablet even if the app is closed, but the
   upload only happens while it runs.
3. **Pin the app** so a customer cannot leave it: Settings > Security > *Screen pinning* on, then pin Broiler POS from the Recents screen.
4. **Permissions:** when the app first asks for Bluetooth (and Location, which Android needs to find Bluetooth devices), allow.

## Pair the printer on the tablet

1. Switch the printer on and pair it in the tablet's own **Settings > Bluetooth** first (the PIN is usually `0000` or `1234`).
2. In the app tap the printer button on the left rail (**⚠ பிரிண்டர் இல்லை**) or Admin ▸ **பிரிண்டர் அமைப்பு**, tap
   **புளூடூத் பிரிண்டரை இணை**, allow the permission, and tap the printer in the list.
3. Tap **சோதனை பில் அச்சிடு** (prints a sample bill) and **அளவு சோதனை அச்சிடு** (prints the calibration sheet).

## The day the printer arrives: check list

Print the **calibration sheet** (`அளவு சோதனை`) and look at the paper:

| Look for | If it is wrong |
| --- | --- |
| The frame touches both edges and every corner is there, and the ruler numbers run to 500 | The head is narrower than 576 dots: set `PAPER_WIDTH_DOTS` from the printer's manual in `shopDetails.ts`. |
| The solid black block is evenly black, and the fine lines and the dotted pattern are crisp, not pale or streaky | Darkness or paper: try the printer's own density setting (hold its feed button while powering on to print its settings), or fresh thermal paper. The app deliberately sends no density command (see `escposRaster.ts`). |
| The Tamil lines are clear at all three sizes, and the rooster is crisp | If thin strokes break up, the printer's darkness is too low; if they blob, too high. |

Then the **fifty-bill test** (the Phase 5 finish line): ring up and print 50 bills in a row, with the printer switched off and on
again part-way, and once with Bluetooth switched off and on. Every bill should print or be reprintable from the screen; none
should be missing from Admin ▸ **கடைசி பில்கள்**. Also check the print speed: turn on **அச்சு வேகத் தகவலைக் காட்டு** in the
printer screen to see the time and speed of each print.

## Known limits

- A retry after a dead link sends the bill once more; in rare cases (the link dropped half-way through) a partly printed bill may
  come out before the full one.
- **Not yet tested on real hardware:** the printer itself, the Bluetooth permission prompts on the tablet's Android version, and
  the installed app. Everything above the Bluetooth layer was tested in a browser and with unit tests (`npm test`).
