// Every piece of text on the counter screen, in Tamil. Wording follows the Kumbakonam POS where it already had a
// word (ஆர்டர், பணம், பணம் செலுத்தும் முறை, பில் அச்சிடு) so the shop's staff read the same words in both.
// Weights, money and payment names come from the core module (formatWeight, formatMoney, PAYMENT_LABELS).

export const t = {
  appTitle: "பிராய்லர் விற்பனை",

  // Sign-in, owner PIN, lock
  signInTitle: "பிராய்லர் விற்பனை",
  signInSubtitle: "உங்கள் பின் எண்ணை உள்ளிடவும்",
  signIn: "உள்நுழை",
  ownerPinTitle: "உரிமையாளர் பின் எண்",
  ownerPinSubtitle: "இன்றைய விலையை மாற்ற உரிமையாளர் பின் எண்ணை உள்ளிடவும்",
  pinDelete: "அழி",
  back: "பின்செல்",
  connecting: "இணைக்கிறது…",
  lockLabel: "திரையைப் பூட்டு",

  // Admin button and menu
  admin: "நிர்வாகம்",
  adminShort: "நிர்",
  adminMenuTitle: "நிர்வாகம்",
  printerSetup: "பிரிண்டர் அமைப்பு",

  // Today's rate
  todaysRate: "இன்றைய விலை",
  ratesSubtitle: (date: string) => `${date} · கிலோ அல்லது எண் விலை`,
  rateNever: "இன்னும் அமைக்கவில்லை",
  rateNotToday: "இன்று அமைக்கவில்லை",
  rateToday: "இன்று அமைக்கப்பட்டது",
  saveRates: "விலைகளை சேமி",
  retrySave: "மீண்டும் சேமி",
  saving: "சேமிக்கிறது…",
  ratesError: (message: string) => `விலைகள் சேமிக்கப்படவில்லை. ${message}`,
  rateNeededNote: "இன்றைய விலை இன்னும் அமைக்கப்படவில்லை",

  // Catalog
  menuError: (message: string) => `மெனுவை ஏற்ற முடியவில்லை. ${message}`,
  menuEmpty: "மெனுவில் பொருட்கள் இல்லை. உரிமையாளரிடம் பொருட்களைச் சேர்க்கச் சொல்லவும்.",
  categoryEmpty: "இந்த வகையில் பொருட்கள் இல்லை.",
  categoriesLabel: "வகைகள்",
  setRate: "விலை அமைக்கவும்",
  loading: "ஏற்றுகிறது…",

  // The product sheet
  methodWeight: "எடைப்படி",
  methodAmount: "தொகைப்படி",
  methodQty: "எண்ணிக்கை",
  kg: "கிலோ",
  gramsUnit: "கிராம்",
  quantity: "எண்ணிக்கை",
  qtyOptional: "எண்ணிக்கை (விருப்பம்)",
  rate: "விலை",
  rateLocked: "விலை மாற்ற முடியாது",
  cancel: "ரத்து",
  addToBill: "பில்லில் சேர்",
  updateLine: "மாற்றத்தைச் சேமி",
  decreaseQty: "ஒன்று குறை",
  increaseQty: "ஒன்று கூட்டு",
  amountLabel: "தொகை (₹)",
  keyClear: "அனைத்தையும் அழி",
  keyDelete: "அழி",
  adjustDown: (amount: string) => `${amount} குறை`,
  adjustUp: (amount: string) => `${amount} கூட்டு`,
  adjustLimit: (amount: string) => `அதிகபட்சம் ±${amount}`,
  listRate: (rate: string) => `பட்டியல் ${rate}`,

  // Cart
  currentSale: "தற்போதைய ஆர்டர்",
  cartEmpty: "இன்னும் பொருட்கள் இல்லை",
  cartEmptyHint: "சேர்க்க ஒரு பொருளைத் தட்டவும்",
  total: (amount: string) => (amount === "" ? "மொத்தம்" : `மொத்தம் · ${amount}`),
  printBill: (money: string) => `பில் அச்சிடு ${money}`,
  edit: (name: string) => `${name} திருத்து`,
  remove: (name: string) => `${name} நீக்கு`,
  saleError: (message: string) => `ஆர்டர் சேமிக்கப்படவில்லை. ${message}`,
  tooManyLines: "ஒரு ஆர்டரில் அதிகபட்சம் 20 பொருட்கள். இந்த ஆர்டருக்கு பில் போட்டுவிட்டு புதியதைத் தொடங்கவும்.",
  dismiss: "மூடு",
  payWith: "பணம் செலுத்தும் முறை",
  payCredit: "கடன்",
  paySplit: "பிரித்து",
  comingSoon: "விரைவில்",

  // After a sale
  printed: (no: number) => `பில் ${no} அச்சிடப்பட்டது ✓`,
  savedNotPrinted: (no: number) => `பில் ${no} சேமிக்கப்பட்டது. பிரிண்டர் இல்லை.`,

  // Start-up
  cantConnect: "இணைக்க முடியவில்லை",
  tryAgain: "மீண்டும் முயற்சி",
  firebaseNotConfigured: "Firebase அமைக்கப்படவில்லை. shop/worker-app/.env ஐ நிரப்பி மீண்டும் தொடங்கவும்.",
};
