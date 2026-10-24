# Owner (admin) app

<https://broiler-pos-admin.web.app>. Sign in with the managing PIN. Everything is in everyday Tamil. Source: `shop/owner-app`.
Deploy: `npm run deploy:owner` (from `shop`).

| Tab | What it does |
| --- | --- |
| முகப்பு (Dashboard) | Kilos and money sold today, how it was paid, week and month, money owed. A warning when today's rates are not set. |
| கணக்கு (Reports) | Today, yesterday, last 7 days, this month or any date: totals, payment split, hourly or daily chart, items sold, by category. |
| பில் (Bills) | The last 4 days, a day at a time. Open a bill to see its lines. The owner can delete any bill (it stays in the list marked நீக்கியது and leaves every total; a credit bill lowers the customer's balance). |
| கடன் (Credit) | Who owes what. Open a name for their credit bills and payments, and to take a payment. |
| விலை (Rates) | One row per item. Set the rates and press சேமி: that confirms every rate for today and the counter shows them at once. |

## How it behaves

- **Screens by device:** a phone gets one column and a bottom tab bar; a tablet gets a tab column on the left and two-column screens.
- **Reads on demand:** there are no live listeners. It reads when it opens, on **புதுப்பி** (Refresh), and when the phone is picked up after a minute. An app left open costs no reads.
- **Old days:** bills are kept in full for 4 days; older days are rolled up into daily totals automatically.
- **Counter link:** the ⚙️ on the counter (two taps) opens this site inside the counter app, in a frame. The app only lets the counter's own address frame it (`Content-Security-Policy: frame-ancestors` in `firebase.json`). Closing it signs the admin out.
- **PINs:** the PIN is the account password (`broiler-<PIN>`). Change it with `node --env-file=shop/worker-app/.env scripts/change-pin.mjs owner`.

## சம்பளம் (the labour salary book)
A tab for the daily-wage workers: the list shows each worker's balance (what the shop owes them, or the advance they owe back) and this week's days; tap a name to record a day (வேலை, லீவு, இரட்டை, வண்டி or மற்றது), what was paid and any advance, see the new balance before saving, read the day-by-day list and delete a wrong entry. "புதிய ஆள்" adds a worker (name, day wage, opening amount); a worker who has left moves to "விட்டவர்கள்" and keeps their history. See DATA_MODEL.md for the records.
