import { MAX_ORDER_LINES } from "@kumbakonam/shared/core";

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
  tooManyLines: `ஒரு ஆர்டரில் அதிகபட்சம் ${MAX_ORDER_LINES} பொருட்கள். இந்த ஆர்டருக்கு பில் போட்டுவிட்டு புதியதைத் தொடங்கவும்.`,
  dismiss: "மூடு",
  payWith: "பணம் செலுத்தும் முறை",
  payCredit: "கடன்",
  paySplit: "பிரித்து",

  // Split payment (GPay + cash)
  splitChip: (gpay: string, cash: string) => `GPay ${gpay} + ரொக்கம் ${cash}`,
  splitTitle: "பணம் பிரித்து செலுத்து",
  gpay: "GPay",
  cashHalf: "ரொக்கம்",
  splitHint: "ஒரு தொகையை உள்ளிடவும் — மற்றொன்று தானாக நிரம்பும்.",
  splitNeeded: "GPay மற்றும் ரொக்கம் இரண்டிலும் தொகை வேண்டும்.",
  done: "சரி",
  billTotal: "பில் தொகை",

  // Credit (kadan)
  creditTitle: "கடன்",
  creditSubtitle: "இந்த பில் யாருக்கு என்பதைத் தேர்ந்தெடுக்கவும், அல்லது புதிய பெயரை எழுதவும்.",
  thisBill: "இந்த பில்",
  owing: "தற்போது கடன் உள்ளவர்கள்",
  newCustomer: "புதிய வாடிக்கையாளர்",
  namePlaceholder: "பெயர்",
  useName: "இந்தப் பெயரைப் பயன்படுத்து",
  needName: "முதலில் ஒரு பெயரை எழுதவும்.",
  nobodyOwes: "தற்போது யாருக்கும் கடன் இல்லை.",
  noMatch: "இந்தப் பெயரில் யாரும் இல்லை. கீழே புதிய வாடிக்கையாளராகச் சேர்க்கலாம்.",
  creditNeeded: "கடன் பில்லுக்கு வாடிக்கையாளர் பெயர் வேண்டும்.",
  creditNeedsInternet: "கடன் பில்லுக்கு இணைய இணைப்பு தேவை. இணைப்பு வந்ததும் மீண்டும் முயற்சிக்கவும்.",
  loadFailed: (message: string) => `ஏற்ற முடியவில்லை. ${message}`,

  // Credit book (taking money against a balance)
  khataMenu: "கடன் புத்தகம்",
  khataTitle: "கடன் புத்தகம்",
  khataSubtitle: "யார் எவ்வளவு கடன். கடன் முடிந்ததும் பெயர் தானாக மறையும்.",
  khataOffline: "இணையம் இல்லை. கடன் புத்தகத்தைப் பார்க்கலாம்; பணத்தைப் பதிவு செய்ய இணையம் வேண்டும்.",
  totalOwed: "மொத்த கடன்",
  payAll: "முழுவதும்",
  amountReceived: "பெற்ற தொகை (₹)",
  receivedBy: "எப்படி பெற்றது",
  record: "பதிவு",
  recorded: (name: string, left: string) => (left === "" ? `${name}: கடன் முழுவதும் செலுத்தப்பட்டது ✓` : `${name}: பதிவு செய்யப்பட்டது ✓ மீதம் ${left}`),
  tooMuch: "கடனை விட அதிகம்.",
  needAmount: "பூஜ்ஜியத்திற்கு மேல் தொகையை உள்ளிடவும்.",
  recordFailed: (message: string) => `பதிவு செய்ய முடியவில்லை. ${message}`,

  // The printer
  printerOk: "● பிரிண்டர்",
  printerNone: "⚠ பிரிண்டர் இல்லை",
  printerProblem: "⚠ பிரிண்டர் சிக்கல்",
  printerTitle: "பிரிண்டர் அமைப்பு",
  printerStatus: {
    unsupported: "இந்த உலாவி புளூடூத்தைப் பயன்படுத்த முடியாது. அச்சிட Android ஆப்பைப் பயன்படுத்தவும்.",
    checking: "பிரிண்டரைச் சரிபார்க்கிறது…",
    unpaired: "இன்னும் பிரிண்டர் இணைக்கப்படவில்லை. பிரிண்டரை ஆன் செய்து அருகில் வைக்கவும்.",
    connecting: "இணைக்கிறது…",
    picking: "கீழே உள்ள பட்டியலிலிருந்து உங்கள் பிரிண்டரைத் தேர்ந்தெடுக்கவும்.",
  },
  printerRemembered: (name: string) => `இந்த டேப்லெட்டின் பிரிண்டர்: ${name}`,
  printerPairHint: "முதல் முறை எனில், டேப்லெட்டின் அமைப்புகள் > புளூடூத்தில் பிரிண்டரை முதலில் இணைக்கவும் (பின் பொதுவாக 0000 அல்லது 1234).",
  printerWebNote: "உலாவியில் புளூடூத் LE பிரிண்டர்கள் மட்டுமே இணையும். கடையில் Android ஆப்பைப் பயன்படுத்தவும்.",
  printerEmptyScan: "அருகில் சாதனங்கள் எதுவும் இல்லை. பிரிண்டர் ஆன் செய்யப்பட்டுள்ளதா எனப் பார்க்கவும்; முதல் முறை எனில் டேப்லெட்டின் புளூடூத் அமைப்புகளில் முதலில் இணைக்கவும்.",
  connectPrinter: "புளூடூத் பிரிண்டரை இணை",
  connectOtherPrinter: "வேறு பிரிண்டரை இணை",
  testBill: "சோதனை பில் அச்சிடு",
  calibrationBill: "அளவு சோதனை அச்சிடு",
  testPrinted: "அச்சிடப்பட்டது ✓",
  showPrintSpeed: "அச்சு வேகத் தகவலைக் காட்டு",
  printProblem: {
    "no-printer": "பிரிண்டர் இணைக்கப்படவில்லை. நிர்வாகம் > பிரிண்டர் அமைப்பில் இணைக்கவும்.",
    "bluetooth-off": "புளூடூத் ஆஃப் செய்யப்பட்டுள்ளது. டேப்லெட்டின் அமைப்புகளில் அதை ஆன் செய்து மீண்டும் முயற்சிக்கவும்.",
    permission: "இந்த ஆப்ஸுக்கு புளூடூத் அனுமதி தேவை. அமைப்புகள் > ஆப்ஸ் > Broiler POS > அனுமதிகளில் இயக்கவும்.",
    unreachable: "பிரிண்டர் பதிலளிக்கவில்லை. பிரிண்டர் ஆன் செய்யப்பட்டுள்ளதா, அருகில் உள்ளதா, பேப்பர் உள்ளதா எனப் பார்க்கவும்.",
  },

  // A bill on the screen (printer trouble, or an earlier bill being printed again)
  billTitle: (label: string) => `பில் ${label}`,
  billNotPrinted: "பில் சேமிக்கப்பட்டது, ஆனால் அச்சிடப்படவில்லை.",
  billCopyNote: "இந்தப் பில் \"நகல்\" என்று குறிக்கப்பட்டு அச்சாகும்.",
  billRendering: "பில் தயாராகிறது…",
  printAgain: "மீண்டும் அச்சிடு",
  printing: "அச்சிடுகிறது…",
  closeNext: "மூடு · அடுத்த ஆர்டர்",

  // Recent bills
  recentMenu: "கடைசி பில்கள்",
  recentTitle: "கடைசி பில்கள்",
  recentSubtitle: "இந்த டேப்லெட்டில் கடைசியாக அச்சிட்ட பில்கள். மீண்டும் அச்சிட்டால் \"நகல்\" என்று குறிக்கப்படும்.",
  recentEmpty: "இன்னும் பில்கள் இல்லை.",

  // After a sale
  printed: (label: string) => `பில் ${label} அச்சிடப்பட்டது ✓`,
  printedOffline: (label: string) => `பில் ${label} அச்சிடப்பட்டது ✓ இணையம் வந்ததும் அனுப்பப்படும்`,
  savedNotPrinted: (label: string) => `பில் ${label} சேமிக்கப்பட்டது. பிரிண்டர் இல்லை.`,

  // Screen lock
  lockedTitle: "திரை பூட்டப்பட்டுள்ளது",
  lockedSubtitle: "தொடர பின் எண்ணை உள்ளிடவும்",
  unlock: "திற",

  // Connection and uploading
  online: "● ஆன்லைன்",
  offline: "⚠ ஆஃப்லைன்",
  waitingShort: "காத்திருப்பு",
  waitingBills: (count: number) => `${count} பில் இணையம் வந்ததும் அனுப்பப்படும்`,
  offlineNote: "இணையம் இல்லை. விற்பனையைத் தொடரலாம்: பில்கள் இந்த டேப்லெட்டில் சேமிக்கப்பட்டு இணையம் வந்ததும் தானாக அனுப்பப்படும்.",
  staleWarning: "பல மணி நேரமாக பில்கள் அனுப்பப்படவில்லை. இணையத்தை விரைவில் இணைக்கவும்.",
  refusedTitle: (label: string) => `பில் ${label} சர்வரில் ஏற்கப்படவில்லை`,
  refusedDetail: (amount: string, summary: string, reason: string) =>
    `${amount} · ${summary}. ${reason.replace(/[.\s]+$/, "")}. இந்தப் பில்லை எழுதி வைத்து உரிமையாளரிடம் தெரிவிக்கவும்.`,
  refusedSeen: "பார்த்தேன்",

  // Counter letter
  counterLetter: (letter: string) => `கவுண்டர் ${letter}`,
  counterLetterHint: "இரண்டாவது டேப்லெட்டுக்கு வேறு எழுத்து வைக்கவும்",

  // Start-up
  cantConnect: "இணைக்க முடியவில்லை",
  tryAgain: "மீண்டும் முயற்சி",
  firebaseNotConfigured: "Firebase அமைக்கப்படவில்லை. shop/worker-app/.env ஐ நிரப்பி மீண்டும் தொடங்கவும்.",
};
