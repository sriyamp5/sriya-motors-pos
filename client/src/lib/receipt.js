import { formatMoney } from '@shared/money.js';
import { PAYMENT_METHOD_LABELS } from '@shared/constants.js';
import { formatDateTime } from './format.js';

/**
 * Builds a self-contained HTML receipt sized for 80 mm thermal paper.
 * The same markup is used for silent printing in the desktop app and for
 * the browser print dialog.
 */

const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const money = (v) => formatMoney(v, false);

export function buildReceiptHtml(sale, settings, { reprint = false } = {}) {
  const lines = sale.items
    .map((item) => {
      const discount = Number(item.discount) > 0 ? `<div class="sub">Discount -${money(item.discount)}</div>` : '';
      const warranty = item.warrantyMonths ? `<div class="sub">Warranty: ${item.warrantyMonths} month(s)</div>` : '';
      const part = item.partNumber ? `<div class="sub">${escapeHtml(item.partNumber)}</div>` : '';
      return `
        <tr><td colspan="3" class="name">${escapeHtml(item.productName)}</td></tr>
        <tr class="detail">
          <td>${item.quantity} x ${money(item.unitPrice)}</td>
          <td></td>
          <td class="r">${money(item.lineTotal)}</td>
        </tr>
        <tr><td colspan="3">${part}${discount}${warranty}</td></tr>`;
    })
    .join('');

  const payment =
    sale.paymentMethod === 'CASH'
      ? `<tr><td>Cash</td><td class="r">${money(sale.amountTendered)}</td></tr>
         <tr><td>Change</td><td class="r">${money(sale.changeAmount)}</td></tr>`
      : `<tr><td>Paid by</td><td class="r">${PAYMENT_METHOD_LABELS[sale.paymentMethod]}${sale.cardReference ? ` (${escapeHtml(sale.cardReference)})` : ''}</td></tr>`;

  const customer = sale.customerName
    ? `<div>Customer: ${escapeHtml(sale.customerName)}${sale.customerPhone ? ` · ${escapeHtml(sale.customerPhone)}` : ''}</div>`
    : '';
  const vehicle = sale.vehicleNo ? `<div>Vehicle: ${escapeHtml(sale.vehicleNo)}</div>` : '';
  const credit = sale.paymentMethod === 'CREDIT' ? '<div class="center strong">CREDIT SALE — AMOUNT DUE</div>' : '';

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(sale.invoiceNo)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: 72mm; margin: 0 auto; padding: 3mm 0 6mm; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11.5px; color: #000; }
  .center { text-align: center; }
  .r { text-align: right; white-space: nowrap; }
  .strong { font-weight: 700; }
  h1 { font-size: 17px; margin: 0; letter-spacing: 0.5px; }
  .muted { font-size: 10.5px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .name { font-weight: 600; padding-top: 4px; }
  .sub { font-size: 10px; color: #222; }
  .total td { font-size: 15px; font-weight: 800; padding-top: 4px; }
  .footer { margin-top: 8px; font-size: 10.5px; text-align: center; }
</style></head>
<body>
  <div class="center">
    <h1>${escapeHtml(settings.shopName || 'Sriya Motors (Pvt) Ltd')}</h1>
    ${settings.shopAddress ? `<div class="muted">${escapeHtml(settings.shopAddress)}</div>` : ''}
    ${settings.shopPhone ? `<div class="muted">Tel: ${escapeHtml(settings.shopPhone)}</div>` : ''}
  </div>
  <hr>
  <table>
    <tr><td>Invoice</td><td class="r strong">${escapeHtml(sale.invoiceNo)}</td></tr>
    <tr><td>Date</td><td class="r">${escapeHtml(formatDateTime(sale.createdAt))}</td></tr>
    <tr><td>Cashier</td><td class="r">${escapeHtml(sale.cashierName ?? '')}</td></tr>
  </table>
  ${customer || vehicle ? `<div class="muted" style="margin-top:4px">${customer}${vehicle}</div>` : ''}
  ${reprint ? '<div class="center strong" style="margin-top:4px">*** REPRINT ***</div>' : ''}
  <hr>
  <table>${lines}</table>
  <hr>
  <table>
    <tr><td>Subtotal</td><td class="r">${money(sale.subtotal)}</td></tr>
    ${Number(sale.itemDiscountTotal) > 0 ? `<tr><td>Item discounts</td><td class="r">-${money(sale.itemDiscountTotal)}</td></tr>` : ''}
    ${Number(sale.billDiscount) > 0 ? `<tr><td>Bill discount</td><td class="r">-${money(sale.billDiscount)}</td></tr>` : ''}
    <tr class="total"><td>TOTAL (Rs.)</td><td class="r">${money(sale.totalAmount)}</td></tr>
    ${payment}
  </table>
  ${credit}
  <hr>
  <div class="center muted">Items: ${sale.items.reduce((s, i) => s + i.quantity, 0)}</div>
  <div class="footer">${escapeHtml(settings.receiptFooter || 'Thank you, come again!')}</div>
</body></html>`;
}
