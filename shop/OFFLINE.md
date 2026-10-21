# Selling with no internet

The shop's internet drops often, so a sale must never wait for it. This page says what happens at the counter, what
does and does not work offline, how it is built, and how it was tested.

## What staff will see

| Situation | What the screen does |
| --- | --- |
| Internet drops | The rail says **⚠ ஆஃப்லைன்** (after about 4 seconds) and a note at the top says selling can carry on. |
| A bill is made offline | It prints at once with its bill number and is saved on the tablet. The rail shows a gold **number + காத்திருப்பு** pill: how many bills are waiting to upload. |
| Internet returns | Waiting bills upload by themselves, in order, once each. The pill goes away. Nothing to press. |
| Bills have waited a day or more | The pill turns red and the note asks for the internet to be connected soon. |
| The server refuses a bill | A red card at the top names the bill, its amount and what was sold, and says to write it down and tell the owner. It stays until someone taps **பார்த்தேன்**. |
| The screen locks (30 idle minutes, or **திரையைப் பூட்டு**) | The sales screen is hidden but the half-made bill is kept. The PIN opens it again, with or without internet. |

## What works offline, what does not

| Works with no internet | Needs the internet |
| --- | --- |
| Cash, UPI and split bills (number made on the tablet, printed at once) | **Credit (கடன்) bills** and **credit payments** |
| The product grid, rates and photos (kept on the tablet) | Setting today's rates (the owner's PIN is checked by the server) |
| Printing over Bluetooth | The first PIN sign-in on a tablet, and a sign-in after signing out |
| Unlocking the locked screen | Menu changes made by the owner |

A credit bill asks for the internet and says so: *"கடன் பில்லுக்கு இணைய இணைப்பு தேவை"*. Write it on paper and ring it up
when the line is back.

## How it is built

1. **Bill numbers are made on the tablet** (`core/billNo.ts`, `shop/billCounter.ts`). Each tablet has a counter letter (`A`
   for the first; the owner can change it in the Admin menu). Numbers run 1, 2, 3… for each day and counter and are kept in
   the tablet's storage, so they survive a restart. A bill prints as `12` on counter A and `B12` on counter B, so two tablets
   can never print the same label. A sale that is dropped before it is saved gives its number back, so a failed attempt
   leaves no gap.
2. **A sale is written to the tablet first** (`shop/orders.ts`). The order and the day's counter note go to Firestore in one
   batch. Firestore keeps the batch on the tablet and sends it when it can. The sale does not wait for the answer.
3. **The outbox** (`core/outbox.ts`, `shop/outbox.ts`) is the list of sales the server has not confirmed. Each one is watched
   until Firestore says it was accepted (it leaves the list) or refused (it stays, marked, until seen). The list is kept in
   storage, so bills waiting when the app is closed are picked up again on the next launch.
4. **Two times on every bill.** `soldAt` is when the tablet made the sale; `createdAt` is when the server received it. For a
   sale made offline they differ, and reports use `soldAt`. The rules accept `soldAt` only if it is not in the future and
   not more than 3 days old, so a wrong tablet clock cannot move a sale far from the truth. **A sale that waits more than
   3 days is refused**, so the internet must be reconnected within that time.
5. **The tablet stays signed in.** The screen lock only hides the sales screen (`shop/screenLock.ts`). Signing out would stop
   waiting bills from uploading, and signing back in needs the internet. The PIN is checked against the server when it can be
   reached, and otherwise against a salted hash kept from the last time the same PIN was accepted (`core/pinLock.ts`). Five
   wrong PINs in a row block the next try for 30 seconds.
6. **Photos and the app** are cached by the service worker (the installed web app) or live inside the app (the Android APK).

## Credit offline: the spike, and why credit stays online

A credit bill also changes the customer's balance, and the rules (`firestore.rules`) only accept a balance change that comes
in the same transaction as the order that explains it. Two ways to make that work offline were considered:

- **A transaction** reads the customer's balance first, so it needs the server. It cannot run offline.
- **A queued batch with `increment()`** can be queued offline, and the server would apply the increment to its own balance,
  so a stale balance on the tablet would not matter. But the batch is accepted or refused as a whole, and there are cases the
  tablet cannot see in advance: for example the same customer typed with different capital letters from what the server has
  (the rule does not allow the name to change), or the owner correcting that customer in between. A refused batch loses the
  order and the balance change together, and the customer has already left with the goods. That is money owed to the shop
  that would silently not be recorded.

So **credit and credit payments require a connection**. Cash, UPI and split never touch a balance, so they are always safe
offline. The rules emulator now exists (`npm run test:rules`, see TESTING.md), so the queued-batch idea could be tried and
proved case by case if the shop's internet turns out to make this too limiting; it has not been, because a refused credit write
would quietly lose money owed to the shop.

## Limits to know about

- **A reinstalled tablet that is offline** forgets its bill count and would restart at 1, so labels from earlier that day can
  repeat. Orders are never overwritten (each has its own id), so no sale is lost, only the human-readable number repeats.
  When the internet is on at start-up the count catches up from the server's note (`counters/<day>_<letter>`).
- **A bill the server refuses leaves a gap** in the bill numbers on purpose; the red card names it. The usual causes are a
  sale waiting more than 3 days, a deactivated account, or a line that breaks the rules.
- **While the owner is signed in to set rates**, bills the counter left waiting stay waiting (the tablet keeps each account's
  unsent bills apart). They upload when the counter signs back in. If the counter cannot sign back in (no internet at that
  moment) the tablet signs out so the owner's session is never left open at the counter; the PIN screen then needs the internet.
- **The idle lock is a screen lock, not the security boundary.** The server's rules decide what each account may do. A 4-digit
  PIN is only 10,000 possibilities, so anyone who can read the tablet's storage could find it, but they could already use the
  signed-in tablet.
- Offline behaviour of the **real tablet and the installed Android app** is still to be tested on the device (Phase 5 and 10).

## How it was tested (Phase 3)

- `npm test` in `shop/`: bill numbering (restarts each day, per counter letter, survives restart, give-back, catch-up), the outbox
  (what counts as waiting, accepted, refused, damaged storage), the PIN check and guess limiter.
- In the browser, against the live `broiler-pos` project, with Firestore's connection cut and restored by
  `window.__broiler.offline()` / `.online()` (development builds only):
  - 10 mixed cash/UPI sales offline: bill numbers 2 to 11 in a row, all waiting; reconnecting uploaded all 10 in about a second, once each,
    with no duplicate or missing number, and each kept its real sale time.
  - 3 sales offline, then the page reloaded: they were picked up again and uploaded once.
  - A refused bill (a re-sent order id): the red card named it with the reason; **பார்த்தேன்** cleared it.
  - A bill queued as the owner, then sign out and back in as the owner: uploaded once. While a different account was signed in
    the bill was not wrongly reported as refused.
  - Lock, wrong PIN, right PIN (online and with the sign-in server blocked), the 30-second block after five wrong PINs, and a
    reload after 31 idle minutes (comes back locked, still signed in).
- `scripts/check-access.mjs` has new checks for the order fields and the 3-day rule, to run against the project after the rules
  are deployed (Phase 6). The rules compile (`firebase deploy --only firestore:rules --dry-run`) but are not yet deployed.
- `scripts/check-bills.mjs` lists a day's orders as the owner and reports duplicate or missing bill numbers per counter, for
  reconciling a trial day.
