// Every piece of text in the admin app, in Tamil. Wording follows the Kumbakonam POS owner app
// (டாஷ்போர்டு, ஆர்டர்கள், பணம் செலுத்தும் முறை). Weights, money, payment names and the date
// ranges (இன்று / நேற்று / கடந்த 7 நாட்கள்) come from @broiler/shared, which are Tamil too.

export const t = {
  appTitle: 'பிராய்லர் நிர்வாகம்',

  signInSubtitle: 'உரிமையாளர் பின் எண்ணை உள்ளிடவும்',
  lock: 'வெளியேறு',
  lockLabel: 'வெளியேறு',

  tabDashboard: 'டாஷ்போர்டு',
  tabOrders: 'ஆர்டர்கள்',

  loadError: (message: string) => `விற்பனையை ஏற்ற முடியவில்லை. ${message}`,
  noSales: 'இந்தக் காலத்தில் இதுவரை விற்பனை இல்லை.',
  noOrders: 'இந்தக் காலத்தில் இதுவரை ஆர்டர்கள் இல்லை.',

  totalSales: 'மொத்த விற்பனை',
  orders: 'ஆர்டர்கள்',
  weightSold: 'விற்ற எடை',
  piecesSold: 'விற்ற எண்ணிக்கை',
  avgOrder: 'சராசரி ஆர்டர்',
  byPayment: 'பணம் செலுத்தும் முறை',
  itemsSold: 'விற்ற பொருட்கள்',
  byCategory: 'வகைவாரி விற்பனை',
  priceChanges: 'விலை மாற்றிய விற்பனை',
  adjustedLines: (count: number) => `${count} பொருள் பட்டியல் விலையிலிருந்து மாற்றப்பட்டது`,
  adjustedEffect: (amount: string) => `மொத்த விற்பனையில் மாற்றம் ${amount}`,
  listRate: (rate: string) => `பட்டியல் ${rate}`,

  orderAria: (no: number, total: string) => `ஆர்டர் ${no}, ${total}`,
  total: (amount: string) => (amount === '' ? 'மொத்தம்' : `மொத்தம் · ${amount}`),

  cantConnect: 'இணைக்க முடியவில்லை',
  tryAgain: 'மீண்டும் முயற்சி',
  firebaseNotConfigured:
    'Firebase அமைக்கப்படவில்லை. apps/admin/.env.example கோப்பை apps/admin/.env ஆக நகலெடுத்து மதிப்புகளை நிரப்பவும்; பின்னர் `npx expo start --clear` மூலம் மீண்டும் தொடங்கவும்.',
};
