// Words that only ever appear on the printed bill, which is Tamil. The counter screen is English (see
// counter/strings.ts); weights, units and payment names on the bill come from the core module's Tamil defaults
// (formatWeight, formatRate, PAYMENT_LABELS).

export const billText = {
  /** The note under a line sold at a rate other than the list rate. */
  listRate: (rate: string) => `பட்டியல் ${rate}`,
  /** The payment line of a split bill. */
  splitDetail: (cash: string, upi: string) => `ரொக்கம் ${cash} + GPay ${upi}`,
};
