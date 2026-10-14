import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { billLine, billTotals, formatBillDate, type BillData } from '../bill';
import { SHOP_LINES, SHOP_NAME } from '../config';
import { t } from '../strings';

export const canPrint = true;

export function printBill(): void {
  window.print();
}

const HOST_ID = 'bill-print-root';
const STYLE_ID = 'bill-print-style';

// The printable bill is a plain HTML copy kept in <body>, hidden on screen and the only thing
// shown when printing. Printing the on-screen React Native view directly gets clipped by the
// scroll containers around it. 72mm wide suits an 80mm receipt printer and also prints on A4.
const PRINT_CSS = `
#${HOST_ID} { display: none; }
@media print {
  #root { display: none !important; }
  #${HOST_ID} { display: block; }
  @page { size: 80mm auto; margin: 4mm; }
  body { background: #fff !important; }
}`;

const cell = { padding: '1px 0', verticalAlign: 'top' } as const;

export function BillPrint({ bill }: { bill: BillData | null }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = PRINT_CSS;
      document.head.appendChild(style);
    }
    let el = document.getElementById(HOST_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = HOST_ID;
      document.body.appendChild(el);
    }
    setHost(el);
  }, []);

  if (!host || !bill) return null;
  const totals = billTotals(bill);
  const rule = <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />;

  return createPortal(
    <div style={{ width: '72mm', fontFamily: 'sans-serif', fontSize: '13px', lineHeight: 1.5, color: '#000' }}>
      <div style={{ textAlign: 'center', fontSize: '17px', fontWeight: 700 }}>{SHOP_NAME}</div>
      {SHOP_LINES.map((line) => (
        <div key={line} style={{ textAlign: 'center' }}>
          {line}
        </div>
      ))}
      {rule}
      <div>
        {t.billNo}: <b>{bill.orderNo}</b>
      </div>
      <div>
        {t.billDate}: {formatBillDate(bill.createdAt)}
      </div>
      {rule}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            <th style={cell}>{t.billItem}</th>
            <th style={{ ...cell, textAlign: 'right' }}>{t.billAmount}</th>
          </tr>
        </thead>
        <tbody>
          {bill.lines.map((line) => {
            const l = billLine(line);
            return (
              <tr key={line.key}>
                <td style={cell}>
                  <div>{l.name}</div>
                  <div style={{ fontSize: '11px' }}>
                    {l.quantity} × {l.rate}
                    {l.listRate ? `  (${l.listRate})` : ''}
                  </div>
                </td>
                <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>{l.amount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rule}
      {totals.weight && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{t.billTotalWeight}</span>
          <span>{totals.weight}</span>
        </div>
      )}
      {totals.pieces && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{t.billTotalPieces}</span>
          <span>{totals.pieces}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 700 }}>
        <span>{t.billTotal}</span>
        <span>{totals.total}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{t.billPaid}</span>
        <span>{totals.payment}</span>
      </div>
      {rule}
      <div style={{ textAlign: 'center', fontWeight: 700 }}>{t.billThanks}</div>
    </div>,
    host,
  );
}
