// Daily automation (requested 2026-09-03) — builds the same item-by-item
// sales report as reports-app (reports-app/src/utils/itemSalesReport.ts,
// exportXlsx.ts), for a single business day, and emails it to the auditor
// as .xlsx. Run by .github/workflows/daily-report-email.yml on a schedule;
// nothing about this touches the Firebase project's billing plan — it's a
// plain Admin SDK read plus an outgoing Gmail SMTP email, both free.
//
// Requires (as env vars — GitHub Actions secrets when run on schedule,
// or your own shell when testing locally):
//   FIREBASE_SERVICE_ACCOUNT  — full service account JSON, as one string
//                                (Project Settings > Service accounts >
//                                Generate new private key). Admin SDK
//                                access bypasses firestore.rules entirely,
//                                same as every other scripts/*.mjs here —
//                                never commit this value.
//   GMAIL_USER                — the sending Gmail address
//   GMAIL_APP_PASSWORD        — that account's 16-character app password
//                                (Google Account > Security > 2-Step
//                                Verification > App passwords). Not the
//                                account's real login password.
//   AUDITOR_EMAIL              — recipient address (comma-separated for more than one)
//
// Optional:
//   REPORT_DATE — YYYY-MM-DD, to (re)send a specific past business day
//                 instead of "today" (e.g. backfilling a day the schedule
//                 failed on — added 2026-09-04 after the very first
//                 scheduled run failed on RESOURCE_EXHAUSTED and the
//                 auditor got nothing for that day at all). Only works
//                 while that day's orders are still live — see
//                 archiveAndPruneOldData's keepDays in OwnerHome.tsx for
//                 how many days back that is.
//
// Usage: node scripts/send-daily-report-email.mjs
//        REPORT_DATE=2026-09-03 node scripts/send-daily-report-email.mjs

import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as XLSX from "xlsx";
import nodemailer from "nodemailer";

const REQUIRED_ENV = ["FIREBASE_SERVICE_ACCOUNT", "GMAIL_USER", "GMAIL_APP_PASSWORD", "AUDITOR_EMAIL"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

// Same 3am cutover as shared/src/utils/businessDay.ts — duplicated rather
// than imported because this script runs under plain Node ESM against
// .mjs, while that file is TypeScript inside the `shared` workspace
// package; small enough (and stable enough — it's a fixed business rule,
// not something that changes with the app's own code) that keeping a
// second copy here is simpler than wiring up a TS loader for one function.
const BUSINESS_DAY_START_HOUR = 3;
function businessDayStart(date) {
  const d = new Date(date);
  if (d.getHours() < BUSINESS_DAY_START_HOUR) d.setDate(d.getDate() - 1);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), BUSINESS_DAY_START_HOUR, 0, 0, 0);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function buildDayReport() {
  // REPORT_DATE backfills a specific past business day; otherwise "today"
  // — matching every other caller of businessDayStart in this project.
  const target = process.env.REPORT_DATE ? new Date(`${process.env.REPORT_DATE}T12:00:00`) : new Date();
  const start = businessDayStart(target);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  // Sent at 11:59 PM by design (requested 2026-09-03) — the business day
  // itself doesn't end until 3am, so anything billed between send time and
  // 3am is deliberately NOT in this report; it shows up in the next day's
  // instead. See the workflow file's own comment for the same note. The
  // upper bound only matters for a REPORT_DATE backfill — "today" has
  // nothing past `end` yet regardless.
  const snap = await db
    .collection("orders")
    .where("createdAt", ">=", Timestamp.fromDate(start))
    .where("createdAt", "<", Timestamp.fromDate(end))
    .get();

  const items = new Map();
  let totalSales = 0;
  let orderCount = 0;

  snap.forEach((doc) => {
    const order = doc.data();
    if (order.status === "voided") return;
    totalSales += order.total ?? 0;
    orderCount += 1;
    for (const item of order.items ?? []) {
      const amount = item.price * item.qty;
      const existing = items.get(item.itemId);
      if (existing) {
        existing.qty += item.qty;
        existing.amount += amount;
        existing.pricesSeen.add(item.price);
      } else {
        items.set(item.itemId, {
          itemId: item.itemId,
          // English name always, for the auditor — the report doesn't
          // have a language toggle the way reports-app's on-screen table
          // does.
          name: item.name,
          qty: item.qty,
          amount,
          pricesSeen: new Set([item.price]),
        });
      }
    }
  });

  const lines = [...items.values()]
    .map(({ pricesSeen, ...line }) => ({
      ...line,
      rate: line.qty > 0 ? line.amount / line.qty : 0,
      rateVaries: pricesSeen.size > 1,
    }))
    .sort((a, b) => b.amount - a.amount);

  return { start, totalSales, orderCount, items: lines };
}

function buildXlsx(report) {
  const rows = report.items.map((item) => ({
    Item: item.name,
    "Item ID": item.itemId,
    Qty: item.qty,
    "Rate (₹)": item.rateVaries ? `${item.rate.toFixed(2)} (avg)` : item.rate,
    "Amount (₹)": item.amount,
  }));
  const totalQty = report.items.reduce((sum, item) => sum + item.qty, 0);
  rows.push({ Item: "", "Item ID": "", Qty: "", "Rate (₹)": "", "Amount (₹)": "" });
  rows.push({ Item: "Orders", "Item ID": "", Qty: report.orderCount, "Rate (₹)": "", "Amount (₹)": "" });
  rows.push({ Item: "TOTAL", "Item ID": "", Qty: totalQty, "Rate (₹)": "", "Amount (₹)": report.totalSales });

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [{ wch: 32 }, { wch: 24 }, { wch: 8 }, { wch: 14 }, { wch: 14 }];
  const workbook = XLSX.utils.book_new();
  const dateKey = report.start.toISOString().slice(0, 10);
  XLSX.utils.book_append_sheet(workbook, sheet, dateKey);
  return { buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }), dateKey };
}

async function sendEmail(report, xlsxBuffer, dateKey) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });

  const recipients = process.env.AUDITOR_EMAIL.split(",").map((s) => s.trim());
  const dateLabel = report.start.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: recipients,
    subject: `Kumbakonam Cafe — Sales Report ${dateLabel}`,
    text:
      `Sales report for ${dateLabel}.\n\n` +
      `Orders: ${report.orderCount}\n` +
      `Total sales: ₹${report.totalSales.toFixed(2)}\n\n` +
      `Item-by-item breakdown attached as .xlsx (includes Item ID and Rate ` +
      `for audit purposes — see the sheet for detail).\n\n` +
      `Note: this covers the business day up to when this mail was sent (11:59 PM); ` +
      `the business day itself runs until 3am, so anything billed after send time ` +
      `appears in the next day's report instead.`,
    attachments: [
      {
        filename: `kumbakonam-sales-${dateKey}.xlsx`,
        content: xlsxBuffer,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
  });
}

/** Best-effort "something went wrong" notice — so a failed run means the
 *  auditor hears about it, not silence (added 2026-09-04: the very first
 *  scheduled run failed on RESOURCE_EXHAUSTED and nobody knew until asked
 *  directly the next day). Deliberately doesn't touch Firestore — if that's
 *  what failed, this still has a real chance of getting through since Gmail
 *  SMTP is a wholly separate quota. Swallows its own failure; the workflow
 *  step already exits non-zero either way, which is what actually surfaces
 *  in the Actions tab. */
async function sendFailureNotice(error) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.AUDITOR_EMAIL.split(",").map((s) => s.trim()),
      subject: "Kumbakonam Cafe — Sales report FAILED to generate",
      text:
        `Today's automated sales report could not be generated or sent.\n\n` +
        `Error: ${error?.message ?? String(error)}\n\n` +
        `No action needed from you — this is informational so a missing report ` +
        `doesn't go unnoticed. It can be resent manually once the underlying ` +
        `issue clears (e.g. via REPORT_DATE, see scripts/send-daily-report-email.mjs).`,
    });
  } catch (notifyErr) {
    console.error("Failure notice itself also failed to send:", notifyErr);
  }
}

try {
  const report = await buildDayReport();
  const { buffer, dateKey } = buildXlsx(report);
  await sendEmail(report, buffer, dateKey);
  console.log(`Sent ${dateKey} report (${report.orderCount} orders, ₹${report.totalSales.toFixed(2)}) to ${process.env.AUDITOR_EMAIL}`);
} catch (err) {
  console.error("Report generation/send failed:", err);
  await sendFailureNotice(err);
  process.exit(1);
}
