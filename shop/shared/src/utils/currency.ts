const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Formats a whole-rupee amount as e.g. "₹1,234" (Data Model prices are whole ₹). */
export function formatCurrency(amount: number): string {
  return INR_FORMATTER.format(amount);
}
