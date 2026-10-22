import { MAX_ORDER_LINES } from "@kumbakonam/shared/core";

// Every piece of text on the counter screen, in plain English. Product names stay Tamil (they come from the menu)
// and the printed bill is fully Tamil: its own words live in printing/ (billText.ts, receiptCanvas.ts), not here.
// Weights, money and payment names come from the core module, always asked for in English on the screen (fmt.ts).

export const t = {
  appTitle: "Broiler POS",

  // Sign-in, owner PIN, lock
  signInTitle: "Honey Broilers",
  signInSubtitle: "Enter your PIN",
  signIn: "Sign in",
  ownerPinTitle: "Owner PIN",
  ownerPinSubtitle: "Enter the owner PIN to change rates",
  pinDelete: "Delete",
  back: "Back",
  connecting: "Connecting…",
  lockLabel: "Lock screen",

  // Admin button and menu
  admin: "Admin",
  adminMenuTitle: "Admin",
  printerSetup: "Printer setup",

  // Today's rate
  todaysRate: "Today's rate",
  ratesSubtitle: (date: string) => `${date} · per kg or per piece`,
  rateNever: "Not set yet",
  rateNotToday: "Not set today",
  rateToday: "Set today",
  saveRates: "Save rates",
  retrySave: "Save again",
  saving: "Saving…",
  ratesError: (message: string) => `Rates not saved. ${message}`,
  rateNeededNote: "Today's rate is not set",

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
  cutLabel: "Cut",
  howLabel: "How the customer asks",
  keepPacks: "Keep packs separate",
  keepPacksHint: "250 g twice stays 2 × 250 g. Untick to add them up (500 g).",
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
  amountLabel: "Amount (₹)",
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
  payCredit: "Credit",
  paySplit: "Split",

  // Split payment (GPay + cash)
  splitChip: (gpay: string, cash: string) => `GPay ${gpay} + Cash ${cash}`,
  splitTitle: "Split payment",
  gpay: "GPay",
  cashHalf: "Cash",
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

  // Credit book (taking money against a balance)
  khataMenu: "Credit book",
  khataTitle: "Credit book",
  khataSubtitle: "Who owes how much.",
  khataOffline: "No internet. You can look, but saving a payment needs internet.",
  totalOwed: "Total owed",
  payAll: "Pay all",
  amountReceived: "Amount received (₹)",
  receivedBy: "Paid by",
  record: "Save",
  recorded: (name: string, left: string) => (left === "" ? `${name}: all paid ✓` : `${name}: saved ✓ ${left} left`),
  tooMuch: "More than the amount owed.",
  needAmount: "Enter an amount above zero.",
  recordFailed: (message: string) => `Cannot save. ${message}`,

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
  printerRemembered: (name: string) => `Printer on this tablet: ${name}`,
  printerPairHint: "First time: pair the printer in tablet Settings > Bluetooth (PIN is usually 0000 or 1234).",
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
  connectOtherPrinter: "Connect a different printer",
  testBill: "Print test bill",
  testPrinted: "Printed ✓",
  printProblem: {
    "no-printer": "No printer connected. Go to Admin > Printer setup.",
    "bluetooth-off": "Bluetooth is off. Turn it on and try again.",
    permission: "Allow Bluetooth for this app in Settings > Apps > Broiler POS > Permissions.",
    unreachable: "The printer is not responding. Check it is on, close by, and has paper.",
  },

  // A bill on the screen (printer trouble, or an earlier bill being printed again)
  billTitle: (label: string) => `Bill ${label}`,
  billNotPrinted: "The bill is saved but not printed.",
  billCopyNote: "It will print with a copy mark (நகல்).",
  billRendering: "Getting the bill ready…",
  printAgain: "Print again",
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
  printed: (label: string) => `Bill ${label} printed ✓`,
  printedOffline: (label: string) => `Bill ${label} printed ✓ Will upload when internet is back`,
  savedNotPrinted: (label: string) => `Bill ${label} saved. No printer.`,

  // Screen lock
  lockedTitle: "Screen locked",
  lockedSubtitle: "Enter your PIN to continue",
  unlock: "Unlock",

  // Connection and uploading
  online: "Online",
  offline: "Offline",
  waitingShort: "Waiting",
  waitingBills: (count: number) => `${count} ${count === 1 ? "bill" : "bills"} will upload when internet is back`,
  offlineNote: "No internet. You can keep billing. Bills are saved here and sent when internet is back.",
  staleWarning: "Bills have not been sent for hours. Connect to the internet.",
  refusedTitle: (label: string) => `Bill ${label} was rejected`,
  refusedDetail: (amount: string, summary: string, reason: string) =>
    `${amount} · ${summary}. ${reason.replace(/[.\s]+$/, "")}. Write it down and tell the owner.`,
  refusedSeen: "Got it",

  // Counter letter

  // Start-up
  cantConnect: "Cannot connect",
  tryAgain: "Try again",
  firebaseNotConfigured: "Firebase is not set up. Fill in shop/worker-app/.env and start again.",
};
