import { businessDayKey, type Expense, type Language } from "@kumbakonam/shared";
import { dayLabels } from "./dayLabels";

export interface ExpenseLine {
  expenseId: string;
  name: string;
  amount: number;
}

export interface DayExpensesReport {
  /** businessDayKey — YYYY-MM-DD */
  key: string;
  dateLabel: string;
  relativeLabel: string | undefined;
  total: number;
  expenses: ExpenseLine[];
}

/** Groups expenses by business day, newest first, each day's own expenses
 *  by amount desc — same shape and rationale as itemSalesReport's grouping,
 *  just for "what was spent on" instead of "what sold" (requested
 *  2026-09-04: "download the Spending [expenses]... with details"). */
export function buildExpensesReport(expenses: Expense[], language: Language): DayExpensesReport[] {
  const byDay = new Map<string, { total: number; expenses: ExpenseLine[] }>();

  for (const expense of expenses) {
    const key = businessDayKey(expense.createdAt.toDate());
    let day = byDay.get(key);
    if (!day) {
      day = { total: 0, expenses: [] };
      byDay.set(key, day);
    }
    day.total += expense.amount;
    day.expenses.push({ expenseId: expense.expenseId, name: expense.name, amount: expense.amount });
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, day]) => ({
      key,
      ...dayLabels(key, language),
      total: day.total,
      expenses: [...day.expenses].sort((a, b) => b.amount - a.amount),
    }));
}
