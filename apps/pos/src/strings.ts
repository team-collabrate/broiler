// Every piece of text in the POS app, in Tamil. Wording follows the Kumbakonam POS (worker-app)
// so both shops' apps read the same: ஆர்டர் (order), பணம் (cash), பணம் செலுத்தும் முறை
// (payment method), பில் அச்சிடு (print bill). Weights, money and payment names come from
// @broiler/shared (formatWeight, formatMoney, PAYMENT_LABELS), which are Tamil too.

export const t = {
  appTitle: 'பிராய்லர் விற்பனை',

  // Header and today's rate
  todaysRate: 'இன்றைய விலை',
  todaysRateLabel: 'இன்றைய விலையை அமைக்கவும்',
  todaysRateNeededLabel: 'இன்றைய விலையை அமைக்கவும். இன்று இன்னும் அமைக்கவில்லை',
  ratesSubtitle: (date: string) => `${date} · கிலோ அல்லது எண் விலை`,
  rateNever: 'இன்னும் அமைக்கவில்லை',
  rateNotToday: 'இன்று அமைக்கவில்லை',
  rateToday: 'இன்று அமைக்கப்பட்டது',
  back: 'பின்செல்',
  saveRates: 'விலைகளை சேமி',
  retrySave: 'மீண்டும் சேமி',
  saving: 'சேமிக்கிறது…',
  ratesError: (message: string) => `விலைகள் சேமிக்கப்படவில்லை. ${message}`,
  rateAria: (name: string, rate: string, unit: string) => `${name}, ${unit} ${rate} ரூபாய்`,

  // Catalog
  menuError: (message: string) => `மெனுவை ஏற்ற முடியவில்லை. ${message}`,
  menuEmpty: 'மெனுவில் பொருட்கள் இல்லை. உரிமையாளரிடம் பொருட்களைச் சேர்க்கச் சொல்லவும்.',
  categoryEmpty: 'இந்த வகையில் பொருட்கள் இல்லை.',
  cardAria: (name: string, rate: string) => `${name}, ${rate}`,
  categoriesLabel: 'வகைகள்',
  setRate: 'விலை அமைக்கவும்',

  // The product sheet
  methodWeight: 'எடைப்படி',
  methodAmount: 'தொகைப்படி',
  methodQty: 'எண்ணிக்கை',
  kg: 'கிலோ',
  gramsUnit: 'கிராம்',
  quantity: 'எண்ணிக்கை',
  qtyOptional: 'எண்ணிக்கை (விருப்பம்)',
  rate: 'விலை',
  rateLocked: 'விலை மாற்ற முடியாது',
  cancel: 'ரத்து',
  addToBill: 'பில்லில் சேர்',
  updateLine: 'மாற்றத்தைச் சேமி',
  decreaseQty: 'ஒன்று குறை',
  increaseQty: 'ஒன்று கூட்டு',
  amountAria: (money: string) => `${money} மதிப்பு`,
  amountDisplayAria: (rupees: string) => `${rupees} ரூபாய்`,
  keyDelete: 'அழி',
  keyClear: 'அனைத்தையும் அழி',
  keyDecimal: 'புள்ளி',

  // Price adjustment
  adjustDown: (amount: string) => `${amount} குறை`,
  adjustUp: (amount: string) => `${amount} கூட்டு`,
  adjustLimit: (amount: string) => `அதிகபட்சம் ±${amount}`,
  listRate: (rate: string) => `பட்டியல் ${rate}`,

  // Cart
  currentSale: 'தற்போதைய ஆர்டர்',
  cartEmpty: 'இன்னும் பொருட்கள் இல்லை',
  cartEmptyHint: 'சேர்க்க ஒரு பொருளைத் தட்டவும்',
  total: (amount: string) => (amount === '' ? 'மொத்தம்' : `மொத்தம் · ${amount}`),
  printBill: (money: string) => `பில் அச்சிடு ${money}`,
  payCredit: 'கடன்',
  paySplit: 'பிரித்து',
  splitChip: (gpay: string, cash: string) => `GPay ${gpay} + ரொக்கம் ${cash}`,
  creditChip: (name: string) => name,

  // Split payment (GPay + cash)
  splitTitle: 'பணம் பிரித்து செலுத்து',
  gpay: 'GPay',
  cashHalf: 'ரொக்கம்',
  splitHint: 'ஒரு தொகையை உள்ளிடவும் — மற்றொன்று தானாக நிரம்பும்.',
  splitNeeded: 'GPay மற்றும் ரொக்கம் இரண்டிலும் தொகை வேண்டும்.',
  done: 'சரி',

  // Credit (kadan)
  creditTitle: 'கடன்',
  creditSubtitle: 'இந்த பில் யாருக்கு என்பதைத் தேர்ந்தெடுக்கவும், அல்லது புதிய பெயரை எழுதவும்.',
  thisBill: 'இந்த பில்',
  owing: 'தற்போது கடன் உள்ளவர்கள்',
  newCustomer: 'புதிய வாடிக்கையாளர்',
  namePlaceholder: 'பெயர்',
  useName: 'இந்தப் பெயரைப் பயன்படுத்து',
  needName: 'முதலில் ஒரு பெயரை எழுதவும்.',
  loading: 'ஏற்றுகிறது…',
  nobodyOwes: 'தற்போது யாருக்கும் கடன் இல்லை.',
  creditNeeded: 'கடன் பில்லுக்கு வாடிக்கையாளர் பெயர் வேண்டும்.',

  // Credit book (collecting payments)
  khataMenu: 'கடன் புத்தகம்',
  khataTitle: 'கடன் புத்தகம்',
  khataSubtitle: 'யார் எவ்வளவு கடன். கடன் முடிந்ததும் பெயர் தானாக மறையும்.',
  totalOwed: 'மொத்த கடன்',
  takePayment: 'பணம் பெறு',
  payAll: 'முழுவதும்',
  amountReceived: 'பெற்ற தொகை (₹)',
  receivedBy: 'எப்படி பெற்றது',
  record: 'பதிவு',
  recorded: (name: string) => `${name}: பதிவு செய்யப்பட்டது ✓`,
  tooMuch: 'கடனை விட அதிகம்.',
  needAmount: 'பூஜ்ஜியத்திற்கு மேல் தொகையை உள்ளிடவும்.',
  close: 'மூடு',
  loadFailed: (message: string) => `ஏற்ற முடியவில்லை. ${message}`,
  recordFailed: (message: string) => `பதிவு செய்ய முடியவில்லை. ${message}`,
  admin: 'நிர்வாகம்',
  adminShort: 'நிர்',
  edit: (name: string) => `${name} திருத்து`,
  remove: (name: string) => `${name} நீக்கு`,
  saleError: (message: string) => `ஆர்டர் சேமிக்கப்படவில்லை. ${message}`,
  retry: 'மீண்டும் முயற்சி',
  dismiss: 'மூடு',
  tooManyLines: 'ஒரு ஆர்டரில் அதிகபட்சம் 20 பொருட்கள். இந்த ஆர்டருக்கு பில் போட்டுவிட்டு புதியதைத் தொடங்கவும்.',

  payWith: 'பணம் செலுத்தும் முறை',

  // Bill
  billNo: 'பில் எண்',
  billDate: 'தேதி',
  billItem: 'பொருள்',
  billWeight: 'அளவு',
  billRate: 'விலை',
  billAmount: 'தொகை',
  billTotalWeight: 'மொத்த எடை',
  billTotalPieces: 'மொத்த எண்ணிக்கை',
  billTotal: 'மொத்தம்',
  billPaid: 'பணம் செலுத்தும் முறை',
  billCash: 'ரொக்கம்',
  billGpay: 'GPay',
  billCustomer: 'வாடிக்கையாளர்',
  billThanks: 'நன்றி! மீண்டும் வருக!',
  billSaved: 'ஆர்டர் சேமிக்கப்பட்டது',
  print: 'பில் அச்சிடு',
  newBill: 'புதிய பில்',

  // Sign-in and lock
  signInTitle: 'பிராய்லர் விற்பனை',
  signInSubtitle: 'கவுண்டர் பின் எண்ணை உள்ளிடவும்',
  ownerPinTitle: 'உரிமையாளர் பின் எண்',
  ownerPinSubtitle: 'இன்றைய விலையை மாற்ற உரிமையாளர் பின் எண்ணை உள்ளிடவும்',
  lock: 'பூட்டு',
  lockLabel: 'திரையைப் பூட்டு',

  // Start-up
  cantConnect: 'இணைக்க முடியவில்லை',
  tryAgain: 'மீண்டும் முயற்சி',
  firebaseNotConfigured:
    'Firebase அமைக்கப்படவில்லை. apps/pos/.env.example கோப்பை apps/pos/.env ஆக நகலெடுத்து மதிப்புகளை நிரப்பவும்; பின்னர் `npx expo start --clear` மூலம் மீண்டும் தொடங்கவும்.',
};
