import { MAX_ORDER_LINES } from "@kumbakonam/shared/core";

// Every piece of text on the counter screen, in plain English. Product names stay Tamil (they come from the menu)
// and the printed bill is fully Tamil: its own words live in printing/ (billText.ts, receiptCanvas.ts), not here.
// Weights, money and payment names come from the core module, always asked for in English on the screen (fmt.ts).

export const t = {

  // Sign-in, owner PIN, lock
  signInTitle: "HONEY BROILERS",
  signInSubtitle: "Enter your PIN",
  back: "Back",
  connecting: "Connecting…",

  // Admin button and menu
  admin: "Admin",

  saving: "Saving…",

  // Catalog
  menuError: (message: string) => `Cannot load the menu. ${message}`,
  menuEmpty: "No items yet. Ask the owner to add items.",
  categoryEmpty: "No items here.",
  categoriesLabel: "Categories",
  setRate: "Set rate",
  loading: "Loading…",

  // The product sheet
  byWeight: "By weight",
  byAmount: "By amount ₹",
  otherWeight: "Other weight",
  otherAmount: "Other amount ₹",
  otherCount: "Other count",
  onePiece: "piece",
  manyPieces: "pieces",
  kindsLabel: "Kinds",
  scrollDown: "More below: scroll down",
  cutLabel: "Cut",
  howLabel: "How the customer asks",
  adminNeedsInternet: "Admin needs internet. Try again when it is back.",
  othersHint: "Tap to add. Press and hold to change the count.",
  updateAppNow: "Update app now",
  roundOff: "Round off",
  roundTo: "Round to ₹10",
  on: "ON",
  off: "OFF",
  backToBilling: "Back to billing",
  loadingAdmin: "Opening Admin…",
  tapAgain: "Tap again for Admin",
  keepPacks: "தனித்தனியாக வை (2 × 250 கி)",
  methodWeight: "Weight",
  methodAmount: "Amount",
  methodQty: "Count",
  kg: "kg",
  gramsUnit: "g",
  quantity: "Count",
  qtyOptional: "Count (optional)",
  rate: "Rate",
  rateLocked: "Rate is fixed",
  cancel: "Cancel",
  addToBill: "Add to bill",
  updateLine: "Save",
  decreaseQty: "Less",
  increaseQty: "More",
  keyClear: "Clear",
  keyDelete: "Delete",
  adjustDown: (amount: string) => `${amount} less`,
  adjustUp: (amount: string) => `${amount} more`,
  adjustLimit: (amount: string) => `Max ±${amount}`,
  listRate: (rate: string) => `Usual rate ${rate}`,

  // Cart
  currentSale: "Bill",
  cartEmpty: "No items yet",
  cartEmptyHint: "Tap an item to add it",
  total: (amount: string) => (amount === "" ? "Total" : `Total · ${amount}`),
  printBill: (money: string) => `Print bill ${money}`,
  edit: (name: string) => `Edit ${name}`,
  remove: (name: string) => `Remove ${name}`,
  saleError: (message: string) => `Bill not saved. ${message}`,
  tooManyLines: `Only ${MAX_ORDER_LINES} items on one bill. Print this one, then start a new bill.`,
  dismiss: "Close",
  payWith: "Pay by",

  // Split payment (GPay + cash)
  splitChip: (gpay: string, cash: string) => `பணம் ${cash} + UPI ${gpay}`,
  splitTitle: "Split payment",
  gpay: "UPI",
  cashHalf: "பணம்",
  splitHint: "Type one amount. The other is filled in.",
  splitNeeded: "Enter both the GPay and cash amounts.",
  done: "Done",
  billTotal: "Bill total",

  // Credit (kadan)
  creditTitle: "Credit",
  creditSubtitle: "Choose a customer or type a new name.",
  thisBill: "This bill",
  owing: "Customers who owe money",
  newCustomer: "New customer",
  namePlaceholder: "Name",
  useName: "Use this name",
  needName: "Type a name first.",
  nobodyOwes: "Nobody owes money right now.",
  noMatch: "No one with this name. Add them as a new customer below.",
  creditNeeded: "Enter the customer's name.",
  creditNeedsInternet: "Credit needs internet. Try again when it is back.",
  loadFailed: (message: string) => `Cannot load. ${message}`,


  // The printer
  printerOk: "Printer",
  printerNone: "No printer",
  printerProblem: "Printer problem",
  printerTitle: "Printer setup",
  printerStatus: {
    unsupported: "Bluetooth is not available here. Use the Android app to print.",
    checking: "Checking the printer…",
    unpaired: "No printer connected. Switch the printer on and keep it close.",
    connecting: "Connecting…",
    picking: "Choose your printer below.",
  },
  printerWebNote: "Only Bluetooth LE printers work in a browser. Use the Android app in the shop.",
  printerEmptyScan: "No devices found. Switch the printer on. First time: pair it in the tablet's Bluetooth settings.",
  connectPrinter: "Connect printer",
  printerConnected: "Printer connected",
  printerReady: "Ready to print",
  chooseYourPrinter: "Choose your printer",
  changePrinter: "Change printer",
  searchAgain: "Search again",
  printerStep1: "Switch the printer on and keep it close.",
  printerStep2: "First time: pair it in tablet Settings > Bluetooth.",
  printerStep3: "Tap Connect printer and choose it from the list.",
  testBill: "Print test bill",
  testPrinted: "Printed ✓",
  printProblem: {
    "no-printer": "No printer connected. Go to Admin > Printer setup.",
    "bluetooth-off": "Bluetooth is off. Turn it on and try again.",
    permission: "Allow Bluetooth for this app in Settings > Apps > Honey Broiler > Permissions.",
    unreachable: "The printer is not responding. Check it is on, close by, and has paper.",
  },

  // A bill on the screen (printer trouble, or an earlier bill being printed again)
  billTitle: (label: string) => `Bill ${label}`,
  billNotPrinted: "The bill is saved but not printed.",
  billCopyNote: "It will print with a copy mark (நகல்).",
  billRendering: "Getting the bill ready…",
  printAgain: "Print again",
  printingBill: (label: string) => `Printing bill ${label}…`,
  notPrinted: (label: string) => `Bill ${label} is saved but did not print`,
  fixBill: "Fix",
  fixTitle: (label: string) => `Fix bill ${label}?`,
  fixWarning: "This bill is deleted and its items come back on the screen. Change them and print a new bill. Needs internet.",
  fixConfirm: "Delete and fix",
  fixNeedsEmpty: "To fix an older bill, first finish or clear the bill on the screen.",
  printing: "Printing…",
  closeNext: "Close · next bill",

  // Recent bills
  recentMenu: "Recent bills",
  recentTitle: "Recent bills",
  recentSubtitle: "The last bills printed on this tablet. A reprint has a copy mark. The last 3 bills can be deleted for 24 hours.",
  deleteBill: "Delete",
  billDeleted: "Deleted",
  billWaiting: "Waiting to upload",
  deleteTitle: (label: string) => `Delete bill ${label}?`,
  deleteWarning: "It will not count in any total. For a credit bill the customer's balance goes back. This cannot be undone.",
  deleteConfirm: "Delete bill",
  keepBill: "Keep bill",
  deleting: "Deleting…",
  deleteNeedsInternet: "Deleting a bill needs internet.",
  deleteFailed: (message: string) => `Bill not deleted. ${message}`,
  recentEmpty: "No bills yet.",

  // After a sale
  save: "Save",
  saved: (label: string) => `Bill ${label} saved ✓ (not printed)`,
  printed: (label: string) => `Bill ${label} printed ✓`,

  // Screen lock
  lockedTitle: "Screen locked",
  lockedSubtitle: "Enter your PIN to continue",

  // Connection and uploading
  online: "Online",
  offline: "Offline",
  waitingShort: "Waiting",
  waitingBills: (count: number) => `${count} ${count === 1 ? "bill" : "bills"} will upload when internet is back`,
  staleWarning: "Bills have not been sent for hours. Connect to the internet.",
  refusedTitle: (label: string) => `Bill ${label} was rejected`,
  refusedDetail: (amount: string, summary: string, reason: string) =>
    `${amount} · ${summary}. ${reason.replace(/[.\s]+$/, "")}. Write it down and tell the owner.`,
  refusedSeen: "Got it",

};
