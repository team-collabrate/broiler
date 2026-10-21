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
];
