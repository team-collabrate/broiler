# Verification report: Honey Broilers POS project documentation

Audit date: 22 October 2026. Source revision: commit `8ef4588` on `main` (35 commits). Document: `HoneyBroiler_POS_Project_Documentation.pdf`, 19 pages, built from `HoneyBroiler_POS_Project_Documentation.md`.

No application source, dependency, database, or deployment was changed. The only files added are in `docs/project-documentation/`.

## 1. Repository areas inspected

| Area | What was read |
| --- | --- |
| Manifests and lockfiles | `shop/package.json`, `shop/package-lock.json` (resolved versions of React, Vite, TypeScript, Firebase, Capacitor, plugins, Workbox), root `package.json` and lockfile, workspace `package.json` files |
| Shared library | all of `shop/shared/src/core` (sale maths, bill numbers, outbox, PIN lock, roles, summaries, date ranges, print recovery, categories, rates, recent bills, errors, types) and `shop/shared/src/shop` (orders, bill counter, outbox, void, customers, menu, owner reads, session, screen lock, connection, settings, storage), `shop/shared/src/firebase`, `shop/shared/src/ui/theme.css` |
| Counter app | `CounterScreen.tsx`, `App.tsx`, `main.tsx`, the picker, cart, sheets, top bar, sound, printing pipeline (`receiptCanvas.ts`, `escposRaster.ts`, `classicBluetoothPrinter.ts`, `shopDetails.ts`), `hooks/usePrinter.ts`, `vite.config.ts`, `capacitor.config.ts` |
| Android project | `MainActivity.java`, `PairedPrintersPlugin.java`, `variables.gradle`, `build.gradle`, Gradle wrapper, merged manifest (permissions, backup flag) |
| Admin site | every screen, `data.ts`, `fmt.ts`, `ui.tsx`, `SignIn.tsx`, `app.css`, `vite.config.ts` |
| Backend configuration | `firestore.rules`, `firebase.json` (hosting, headers, emulators, auth providers), `.firebaserc` |
| Tooling and tests | `scripts/` (emulators, rules tests, seed, backup, PIN change), `shop/scripts/build-android.mjs`, `.github/workflows/ci.yml`, all `*.test.ts` files, `.gitignore` |
| Existing guides | `docs/GO_LIVE.md`, `OFFLINE.md`, `PRINTING.md`, `TESTING.md`, `DATA_MODEL.md`, `GAPS.md`, `OWNER_APP.md` (used as leads, then checked against code) |

## 2. Checks performed

**Commands actually run during the audit (results as observed):**

| Command | Result |
| --- | --- |
| `cd shop && npm test` | 139 tests, 139 passed, 0 failed |
| `cd shop && npm run typecheck` | no errors |
| `cd shop && npm run build` | counter and admin builds succeeded |
| `npm run test:rules` (root, local Firestore emulator) | 62 tests, 62 passed, 0 failed |
| `curl` of `https://broiler-pos.web.app`, `https://broiler-pos-admin.web.app`, `https://github.com/team-collabrate/broiler` | HTTP 200 each |
| `git rev-parse`, `git rev-list --count HEAD`, `git status` | `8ef4588`, 35 commits, working tree clean apart from the new documentation folder |

**Automated cross-check of the document against the repository** (`audit` script, run on the final Markdown):

- **File paths.** Every path named in a code span was resolved against the repository (also against the abbreviations used in tables, for example `counter/PinScreen.tsx`). All paths exist except those that are deliberately not paths: npm package names, Firestore document ids (`settings/pricing`), the format `dd-mm/number`, bare file names that exist under a longer path (`ci.yml`, `build.gradle`, `theme.css`, `MainActivity.java`), and `packages/shared/src/roles.ts`, which is cited on purpose as a **stale reference** inside `firestore.rules` (finding L1).
- **Identifiers.** Every function, constant and hook named in a code span (71) exists in the source.
- **Constants and rules.** 40 quoted values were matched against the code, among them: 5 lines per bill, quantity 999, weight 999,999 g, price step ₹5 and default limit ₹20, PIN length 4 to 6, 5 free tries and 30 s block, PBKDF2 100,000 iterations, 30-minute idle lock, 4 kept days, 20 recent bills, 3-day sale age, 24-hour stale warning, 4-second online grace, ink threshold 160, 128-row bands, 5-row feed threshold, 384-dot paper, 0.82 scale, preset weights, amounts and counts, SDK levels, Gradle and plugin versions, application id, region, hosting sites, rules limits (1 paisa tolerance, 24-hour single read, 3-day removal). **0 mismatches.**
- **Library versions.** Compared with `shop/package-lock.json` and the root lockfile.
- **Counts.** Test counts per file, lines of source (recounted excluding tests and `.d.ts`), commit count.
- **Section references and terms.** Every "Section N" reference points at an existing section; the terms "Counter app", "Admin site" and "Shared library" are used consistently.
- **Secrets.** The Markdown and the PDF text were searched for the live and test PIN values and for API-key patterns: none present.

**PDF inspection.** The final PDF was rendered page by page and inspected: cover, contents, every diagram, tables, text-heavy pages and the last page. Properties checked: A4 on all 19 pages, 34 bookmarks, 26 working links (19 internal in the contents page, 7 external), no missing or replacement glyphs, Tamil text renders correctly, no clipped tables or diagrams.

## 3. Corrections made as a result of the audit

| # | Correction | Why |
| --- | --- | --- |
| 1 | Cross-references to sections fixed (tests are Section 15, findings Section 17) | They pointed one section too high after sections were merged |
| 2 | "Source size" recomputed: about 13,000 lines of source excluding tests | The first figure included test lines |
| 3 | Rule for the counter's order read: it may read a single order **by id** if created in the last 24 hours, not only "its own" | Rules text (`allow get`) does not restrict to own bills |
| 4 | "Written by" for `customerPayments` and `counters` corrected | Rules allow both staff accounts; the admin site is the current writer of payments |
| 5 | Lockout scope corrected: the 5-try lockout covers the **admin sign-in and the counter's unlock screen**; the counter's first sign-in has no client-side limit (finding H2 reworded) | `afterWrongPin` is called only in `owner-app/src/SignIn.tsx` and `screenLock.ts` |
| 6 | Development ports corrected: counter 3000, admin 3003 | `vite.config.ts` of each app |
| 7 | Admin web manifest `orientation: portrait` noted (counter: `any`) | `vite.config.ts` |
| 8 | Terminology unified ("admin site", not "owner app" or "admin app") | Consistency |
| 9 | `day_device` written as `<day>_<device>` | Matches `counterDocId` |
| 10 | "Status of use" softened: whether real sales have been recorded since the data clean-up was not checked | The live database was not read for this audit |
| 11 | Finding L2 reworded: the unused helpers are not used by the apps or other shared files, and are exercised by `sale.test.ts` | A search showed uses only inside `sale.ts` and in the tests |
| 12 | JDK statement narrowed to what the build script does | The script prefers `.tools/jdk21` and otherwise any JDK it finds |
| 13 | Diagrams redrawn for legibility (layers, components, data flow, deployment) and the counter schematic drawn by hand | The first versions were too small or confusing to read |

## 4. What remains unverified

| Item | Reason |
| --- | --- |
| Printer model (BonKaso BKT05) and how the printer behaves on paper | Named in `docs/PRINTING.md`; no hardware in this audit |
| The exact command used to deploy `firestore.rules` | No npm script exists; only the documentation says it was deployed |
| GitHub Actions run history | `ci.yml` was read; the runs were not inspected |
| Contents of the live database and whether real sales exist | The live database was not read in this audit |
| Behaviour of the installed Android app on a tablet (full screen, sound, Bluetooth, offline start) | Verified only by reading the code and the merged manifest |
| `npm run check:access` | It writes test records to the live project, so it was not run |
| Real-trading behaviour (crowds, long offline periods, many bills) | No trading data; only unit and rules tests and manual checks in the emulator |
| How closely the schematic of the counter screen (Figure 1) matches a tablet screenshot | Drawn from the source files; not a screenshot |

## 5. How to rebuild the PDF

The PDF tools are not project dependencies. In any scratch folder outside the repository run `npm install mermaid@11 puppeteer-core@24 marked@15 pdfjs-dist@4`, then, from the repository root:

```text
DOC_TOOLS=<that folder> node docs/project-documentation/build.mjs
```

Microsoft Edge or Google Chrome must be installed (`CHROME_PATH` overrides the location). The script prints the page count and checks that every section was located for the contents page.
