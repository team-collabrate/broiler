import type { Customer } from "@kumbakonam/shared";
import type { DaySalesReport } from "./itemSalesReport";
import type { DayExpensesReport } from "./expensesReport";
import type { DayLoanReport } from "./loanReport";

// Fixed 3-letter abbreviations, not toLocaleDateString's "short" — en-IN
// (and most locales) render September as 4-letter "Sept", which broke the
// requested "02-dec-2026" format's month width for that one month only.
const MONTH_ABBR = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "02-dec-2026" from a YYYY-MM-DD key, or from `now` when there's no
 *  single day to name a file after (Loan, or a hypothetical multi-day
 *  export — requested 2026-09-04, filename format example
 *  "02-dec-2026-sales"). */
function fileDateStamp(key?: string): string {
  const date = key ? new Date(`${key}T12:00:00`) : new Date();
  const day = String(date.getDate()).padStart(2, "0");
  return `${day}-${MONTH_ABBR[date.getMonth()]}-${date.getFullYear()}`;
}

/** A single-day download (the per-day "Download" button) names the file
 *  after the day it actually covers, not the day it happened to be
 *  downloaded on — "02-dec-2026-sales.xlsx" stays correct even opened a
 *  week later. Only a multi-day export (kept for reuse; nothing currently
 *  calls sales or expenses export that way) falls back to today's date,
 *  since there's no single day to name it after. */
function dayStamp(days: Array<{ key: string }>): string {
  return fileDateStamp(days.length === 1 ? days[0].key : undefined);
}

/** One sheet per day (named by its date, e.g. "2026-09-03"), each listing
 *  every item sold that day with qty and amount, a blank row, then the
 *  day's own total — matches what the owner asked for: "what are all items
 *  has been sold and what their count and the amount", per day.
 *
 *  Item ID and Rate are in the export for audit purposes (requested
 *  2026-09-03): two rows can share a display name (a renamed/re-added menu
 *  item, or a bulk/wholesale rate billed under the same name) while being
 *  genuinely different sales — the Item ID is the actual stable identity,
 *  and "Rate (avg)" flags when even one Item ID itself sold at more than
 *  one price in the window, so a number here is never silently averaging
 *  over something that looks like — but isn't — one fixed price.
 *
 *  xlsx is a ~700KB library — dynamically imported here rather than at the
 *  top of the module, so a viewer who never presses Export never downloads
 *  it (this page is meant to be opened on a phone over whatever connection
 *  is around). */
export async function exportItemSalesXlsx(days: DaySalesReport[]): Promise<void> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  for (const day of days) {
    const rows: Array<Record<string, string | number>> = day.items.map((item) => ({
      Item: item.name,
      "Item ID": item.itemId,
      Qty: item.qty,
      "Rate (₹)": item.rateVaries ? `${item.rate.toFixed(2)} (avg)` : item.rate,
      "Amount (₹)": item.amount,
    }));
    const totalQty = day.items.reduce((sum, item) => sum + item.qty, 0);
    rows.push({ Item: "", "Item ID": "", Qty: "", "Rate (₹)": "", "Amount (₹)": "" });
    // Two separate rows, not one blended one — "Qty" means item quantity
    // everywhere else on this sheet; folding order count into that same
    // column here (as an earlier version of this export did) reads as if
    // 402 orders and 402 items sold were the same number, which they
    // usually aren't.
    rows.push({ Item: "Orders", "Item ID": "", Qty: day.orderCount, "Rate (₹)": "", "Amount (₹)": "" });
    rows.push({ Item: "TOTAL", "Item ID": "", Qty: totalQty, "Rate (₹)": "", "Amount (₹)": day.totalSales });

    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [{ wch: 32 }, { wch: 24 }, { wch: 8 }, { wch: 14 }, { wch: 14 }];
    // Sheet names can't exceed 31 chars or contain []:*?/\ — the YYYY-MM-DD
    // key is already safe and unique, so it doubles as the sheet name.
    XLSX.utils.book_append_sheet(workbook, sheet, day.key);
  }

  XLSX.writeFile(workbook, `${dayStamp(days)}-sales.xlsx`);
}

/** Same shape and rationale as exportItemSalesXlsx, for "what was spent on"
 *  instead of "what sold" (requested 2026-09-04: "download the Spending
 *  [expenses]... with details" — the itemized list, not just the day's
 *  total figure the on-screen quick-access card already showed). */
export async function exportExpensesXlsx(days: DayExpensesReport[]): Promise<void> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  for (const day of days) {
    const rows: Array<Record<string, string | number>> = day.expenses.map((expense) => ({
      Description: expense.name,
      "Amount (₹)": expense.amount,
    }));
    rows.push({ Description: "", "Amount (₹)": "" });
    rows.push({ Description: "TOTAL", "Amount (₹)": day.total });

    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [{ wch: 32 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, sheet, day.key);
  }

  XLSX.writeFile(workbook, `${dayStamp(days)}-expenses.xlsx`);
}

/** Day-grouped loan (Khata) activity — requested 2026-09-05 ("the loan
 *  should be separated day wise"), replacing the earlier single "who owes
 *  right now" snapshot export. Each day's sheet lists what came back
 *  ("Received" — payments) and what was lent ("Given" — new credit
 *  sales), each its own labeled block so the two never run together, then
 *  a Net row (Given − Received: how much the loan book grew or shrank
 *  that day). Received-then-Given order matches the on-screen cards
 *  (LoanSection.tsx) — swapped from Given-first on request 2026-09-05. */
export async function exportLoanXlsx(days: DayLoanReport[]): Promise<void> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  for (const day of days) {
    const rows: Array<Record<string, string | number>> = [];
    rows.push({ Type: "RECEIVED", Customer: "", "Amount (₹)": "" });
    for (const line of day.received) rows.push({ Type: "", Customer: line.customerName, "Amount (₹)": line.amount });
    rows.push({ Type: "", Customer: "Received total", "Amount (₹)": day.receivedTotal });
    rows.push({ Type: "", Customer: "", "Amount (₹)": "" });
    rows.push({ Type: "GIVEN", Customer: "", "Amount (₹)": "" });
    for (const line of day.given) rows.push({ Type: "", Customer: line.customerName, "Amount (₹)": line.amount });
    rows.push({ Type: "", Customer: "Given total", "Amount (₹)": day.givenTotal });
    rows.push({ Type: "", Customer: "", "Amount (₹)": "" });
    rows.push({ Type: "NET", Customer: "Given − Received", "Amount (₹)": day.netTotal });

    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [{ wch: 10 }, { wch: 28 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, sheet, day.key);
  }

  XLSX.writeFile(workbook, `${dayStamp(days)}-loan.xlsx`);
}

/** Every customer currently owing money, one row each (requested
 *  2026-09-05: "customer wise we need to know - each customer should give
 *  how much") — a running total as of right now, separate from the
 *  day-wise Given/Received activity log above: this answers "who owes
 *  what overall", that answers "what happened on which day". */
export async function exportLoanCustomersXlsx(customers: Customer[]): Promise<void> {
  const XLSX = await import("xlsx");
  const totalOutstanding = customers.reduce((sum, c) => sum + c.balance, 0);

  const rows: Array<Record<string, string | number>> = customers.map((c) => ({
    Customer: c.name,
    "Balance (₹)": c.balance,
  }));
  rows.push({ Customer: "", "Balance (₹)": "" });
  rows.push({ Customer: "TOTAL OUTSTANDING", "Balance (₹)": totalOutstanding });

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [{ wch: 28 }, { wch: 14 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Loan");
  XLSX.writeFile(workbook, `${fileDateStamp()}-loan-balances.xlsx`);
}
