import type { BillInput } from "./receipt";

/** Sample bills for the receipt preview and the printer's test print. Amounts are examples only. */
const at = new Date(2026, 9, 19, 17, 42);

export const SAMPLE_BILLS: { label: string; bill: BillInput }[] = [
  {
    label: "Weight bill",
    bill: {
      orderId: "sample-1",
      billNo: "12",
      createdAt: at,
      lines: [
        { name: "பிராய்லர் கோழி - தோலுடன்", quantity: "1.25 கிலோ", rate: "₹240.00/கிலோ", amount: "₹300.00" },
        { name: "நாட்டுக்கோழி கறி", quantity: "≈ 444 கிராம்", rate: "₹450.00/கிலோ", amount: "₹200.00" },
        { name: "காடை", quantity: "2 எண்", rate: "₹55.00/எண்", amount: "₹110.00", note: "பட்டியல் ₹60.00/எண்" },
      ],
      totalWeight: "1.694 கிலோ",
      totalPieces: "2 எண்",
      total: "₹610.00",
      paymentLabel: "பணம்",
      staffName: "கவுண்டர்",
    },
  },
  {
    label: "Split (GPay + cash)",
    bill: {
      orderId: "sample-2",
      billNo: "13",
      createdAt: at,
      lines: [{ name: "மட்டன் - எலும்புடன்", quantity: "750 கிராம்", rate: "₹800.00/கிலோ", amount: "₹600.00" }],
      totalWeight: "750 கிராம்",
      total: "₹600.00",
      paymentLabel: "பிரித்து",
      paymentDetail: "ரொக்கம் ₹250.00 + GPay ₹350.00",
    },
  },
  {
    label: "Credit (kadan)",
    bill: {
      orderId: "sample-3",
      billNo: "14",
      createdAt: at,
      lines: [{ name: "பிராய்லர் கோழி - தோலில்லா", quantity: "3 கிலோ", rate: "₹260.00/கிலோ", amount: "₹780.00" }],
      totalWeight: "3 கிலோ",
      total: "₹780.00",
      paymentLabel: "கடன்",
      customerName: "ரவி கடை",
    },
  },
  {
    label: "Counter B, pieces, price changes",
    bill: {
      orderId: "sample-4",
      billNo: "B7",
      createdAt: at,
      lines: [
        { name: "கடாய்", quantity: "2 எண்", rate: "₹65.00/எண்", amount: "₹130.00", note: "பட்டியல் ₹60.00/எண்" },
        { name: "பொடி", quantity: "5 எண்", rate: "₹10.00/எண்", amount: "₹50.00" },
        { name: "நாட்டுக்கோழி கறி", quantity: "1 கிலோ", rate: "₹445.00/கிலோ", amount: "₹445.00", note: "பட்டியல் ₹450.00/கிலோ" },
      ],
      totalWeight: "1 கிலோ",
      totalPieces: "7 எண்",
      total: "₹625.00",
      paymentLabel: "UPI",
    },
  },
  {
    label: "10 lines, long names",
    bill: {
      orderId: "sample-5",
      billNo: "21",
      createdAt: at,
      lines: [
        "பிராய்லர் கோழி - தோலுடன்",
        "பிராய்லர் கோழி - தோலில்லா",
        "பிராய்லர் கோழி - உயிரோடு",
        "நாட்டுக்கோழி கறி",
        "நாட்டுக்கோழி - உயிருடன் (பெரியது)",
        "மட்டன் - எலும்புடன் (முன் கால்)",
        "மட்டன் - எலும்பில்லா",
        "கொடல், குடல், ஈரல் கலவை",
        "முட்டை - நாட்டு (கோழி முட்டை)",
        "மசாலா பொடி - சிறிய பாக்கெட்",
      ].map((name, i) => ({ name, quantity: i % 3 === 0 ? "2 எண்" : "0.750 கிலோ", rate: i % 3 === 0 ? "₹12.00/எண்" : "₹260.00/கிலோ", amount: i % 3 === 0 ? "₹24.00" : "₹195.00" })),
      totalWeight: "5.250 கிலோ",
      totalPieces: "8 எண்",
      total: "₹1,401.00",
      paymentLabel: "கடன்",
      customerName: "ரவிச்சந்திரன் ஸ்டோர்ஸ்",
    },
  },
];

// A reprint of the first sample: the paper carries the "நகல்" (copy) mark.
SAMPLE_BILLS.push({ label: "Copy (reprint)", bill: { ...SAMPLE_BILLS[0].bill, isCopy: true } });
