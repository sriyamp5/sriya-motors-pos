/**
 * Money helpers.
 *
 * All arithmetic is done in integer cents to avoid floating point drift
 * (for example 0.1 + 0.2). Values are converted back to rupees only for
 * storage (DECIMAL(12,2)) and display.
 */

export const toCents = (amount) => Math.round((Number(amount) || 0) * 100);

export const fromCents = (cents) => Math.round(cents) / 100;

/** Rounds a rupee amount to two decimals. */
export const roundMoney = (amount) => fromCents(toCents(amount));

/**
 * Calculates the totals of a bill from its lines.
 * Each line: { quantity, unitPrice, discount, unitCost? }.
 * Returns rupee values rounded to two decimals.
 */
export function calculateBillTotals(lines, billDiscount = 0) {
  let grossCents = 0;
  let lineDiscountCents = 0;
  let costCents = 0;

  for (const line of lines) {
    const qty = Number(line.quantity) || 0;
    grossCents += toCents(line.unitPrice) * qty;
    lineDiscountCents += toCents(line.discount);
    costCents += toCents(line.unitCost) * qty;
  }

  const netBeforeBillDiscount = grossCents - lineDiscountCents;
  const billDiscountCents = toCents(billDiscount);
  const totalCents = netBeforeBillDiscount - billDiscountCents;

  return {
    subtotal: fromCents(grossCents),
    itemDiscountTotal: fromCents(lineDiscountCents),
    billDiscount: fromCents(billDiscountCents),
    total: fromCents(totalCents),
    totalCost: fromCents(costCents),
    netBeforeBillDiscount: fromCents(netBeforeBillDiscount),
  };
}

/** Line total after the line discount. */
export const lineNetTotal = (quantity, unitPrice, discount = 0) =>
  fromCents(toCents(unitPrice) * (Number(quantity) || 0) - toCents(discount));

/** Markup of a selling price over its cost, as a percentage. */
export function markupPercent(costPrice, sellingPrice) {
  const cost = Number(costPrice) || 0;
  if (cost <= 0) return null;
  return Math.round(((Number(sellingPrice) - cost) / cost) * 10000) / 100;
}

/** Selling price obtained by applying a markup percentage to a cost. */
export const priceFromMarkup = (costPrice, percent) =>
  roundMoney((Number(costPrice) || 0) * (1 + (Number(percent) || 0) / 100));

const formatter = new Intl.NumberFormat('en-LK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats a value as Sri Lankan rupees, e.g. "Rs. 1,500.00". */
export const formatMoney = (amount, withSymbol = true) =>
  `${withSymbol ? 'Rs. ' : ''}${formatter.format(Number(amount) || 0)}`;
