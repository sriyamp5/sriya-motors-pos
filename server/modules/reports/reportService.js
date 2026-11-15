import { query, queryOne } from '../../db/database.js';
import { conflict } from '../../core/errors.js';
import { camelize, camelizeAll } from '../../core/sql.js';
import { recordAudit } from '../audit/auditService.js';
import { ROLES } from '../../../shared/constants.js';
import { fromCents, toCents } from '../../../shared/money.js';

/**
 * Read-only reporting queries.
 *
 * Profit definitions used throughout:
 *   gross profit = sale total - cost of goods sold
 *   net profit   = gross profit - (refunds - cost of restocked returns)
 */

const dayRange = (from, to) => [`${from} 00:00:00`, `${to} 23:59:59`];

const subtract = (a, b) => fromCents(toCents(a) - toCents(b));

/* ---------------------------------------------------------- Dashboard --- */

export async function getDashboard(user) {
  const isAdmin = user.role === ROLES.ADMIN;
  const cashierFilter = isAdmin ? '' : ' AND s.cashier_id = ?';
  const cashierParams = isAdmin ? [] : [user.id];

  const today = await queryOne(
    `SELECT COUNT(*) AS sales_count,
            COALESCE(SUM(s.total_amount), 0) AS revenue,
            COALESCE(SUM(s.total_cost), 0) AS cost,
            COALESCE(SUM((SELECT SUM(quantity) FROM sale_items si WHERE si.sale_id = s.id)), 0) AS items_sold
       FROM sales s
      WHERE s.created_at >= CURDATE()${cashierFilter}`,
    cashierParams,
  );
  const todayReturns = await queryOne(
    `SELECT COUNT(*) AS return_count, COALESCE(SUM(refund_amount), 0) AS refunds, COALESCE(SUM(cost_reversed), 0) AS cost_reversed
       FROM sale_returns WHERE created_at >= CURDATE()`,
  );
  const stock = await queryOne(
    `SELECT SUM(stock_qty <= reorder_level AND stock_qty > 0) AS low_count,
            SUM(stock_qty <= 0) AS out_count,
            COUNT(*) AS item_count
       FROM products WHERE is_active = 1`,
  );
  const lowStock = await query(
    `SELECT id, item_code, name, part_number, stock_qty, reorder_level, rack_location
       FROM products WHERE is_active = 1 AND stock_qty <= reorder_level
      ORDER BY stock_qty ASC, name LIMIT 8`,
  );
  const recentSales = await query(
    `SELECT s.id, s.invoice_no, s.customer_name, s.total_amount, s.payment_method, s.status, s.created_at,
            u.full_name AS cashier_name
       FROM sales s JOIN users u ON u.id = s.cashier_id
      WHERE 1 = 1${cashierFilter}
      ORDER BY s.id DESC LIMIT 8`,
    cashierParams,
  );

  const result = {
    today: {
      salesCount: today.sales_count,
      revenue: today.revenue,
      itemsSold: Number(today.items_sold),
      returnCount: todayReturns.return_count,
      refunds: todayReturns.refunds,
    },
    stock: {
      lowCount: Number(stock.low_count ?? 0),
      outCount: Number(stock.out_count ?? 0),
      itemCount: stock.item_count,
    },
    lowStock: camelizeAll(lowStock),
    recentSales: camelizeAll(recentSales),
  };

  if (!isAdmin) return result;

  const grossProfit = subtract(today.revenue, today.cost);
  result.today.grossProfit = grossProfit;
  result.today.netProfit = subtract(grossProfit, subtract(todayReturns.refunds, todayReturns.cost_reversed));

  const trend = await query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS sales_count, SUM(total_amount) AS revenue, SUM(total_cost) AS cost
       FROM sales
      WHERE created_at >= CURDATE() - INTERVAL 13 DAY
      GROUP BY DATE(created_at)
      ORDER BY day`,
  );
  result.trend = fillDays(14, trend).map((d) => ({ ...d, profit: subtract(d.revenue, d.cost) }));

  const credit = await queryOne(
    'SELECT COALESCE(SUM(credit_balance), 0) AS outstanding, SUM(credit_balance > 0) AS debtors FROM customers',
  );
  result.credit = { outstanding: credit.outstanding, debtors: Number(credit.debtors ?? 0) };

  const valuation = await queryOne(
    `SELECT COALESCE(SUM(GREATEST(stock_qty, 0) * cost_price), 0) AS cost_value,
            COALESCE(SUM(GREATEST(stock_qty, 0) * selling_price), 0) AS retail_value
       FROM products WHERE is_active = 1`,
  );
  result.stock.costValue = valuation.cost_value;
  result.stock.retailValue = valuation.retail_value;

  const overrides = await queryOne(
    `SELECT COUNT(*) AS count,
            COALESCE(SUM((si.unit_price - si.list_price) * si.quantity), 0) AS impact
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE si.price_overridden = 1 AND s.created_at >= CURDATE()`,
  );
  result.today.priceOverrides = overrides.count;
  result.today.priceOverrideImpact = overrides.impact;

  const topProducts = await query(
    `SELECT si.product_id, si.product_name, SUM(si.quantity) AS quantity, SUM(si.line_total) AS revenue
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE s.created_at >= CURDATE() - INTERVAL 6 DAY
      GROUP BY si.product_id, si.product_name
      ORDER BY quantity DESC LIMIT 5`,
  );
  result.topProducts = camelizeAll(topProducts).map((p) => ({ ...p, quantity: Number(p.quantity) }));

  return result;
}

/** Ensures a continuous series of days, filling gaps with zeros. */
function fillDays(count, rows) {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const days = [];
  const date = new Date();
  date.setDate(date.getDate() - (count - 1));
  for (let i = 0; i < count; i += 1) {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const row = byDay.get(key);
    days.push({
      day: key,
      salesCount: row?.sales_count ?? 0,
      revenue: row?.revenue ?? 0,
      cost: row?.cost ?? 0,
    });
    date.setDate(date.getDate() + 1);
  }
  return days;
}

/* -------------------------------------------------------------- Sales --- */

export async function getSalesSummary({ from, to }) {
  const range = dayRange(from, to);
  const daily = await query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS sales_count,
            SUM(total_amount) AS revenue, SUM(total_cost) AS cost,
            SUM(item_discount_total + bill_discount) AS discounts,
            SUM(CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END) AS cash,
            SUM(CASE WHEN payment_method = 'CARD' THEN total_amount ELSE 0 END) AS card,
            SUM(CASE WHEN payment_method = 'CREDIT' THEN total_amount ELSE 0 END) AS credit
       FROM sales WHERE created_at BETWEEN ? AND ?
      GROUP BY DATE(created_at) ORDER BY day`,
    range,
  );
  const returns = await query(
    `SELECT DATE(created_at) AS day, SUM(refund_amount) AS refunds, SUM(cost_reversed) AS cost_reversed
       FROM sale_returns WHERE created_at BETWEEN ? AND ?
      GROUP BY DATE(created_at)`,
    range,
  );
  const returnsByDay = new Map(returns.map((r) => [r.day, r]));

  const days = new Set([...daily.map((d) => d.day), ...returns.map((r) => r.day)]);
  const dailyByDay = new Map(daily.map((d) => [d.day, d]));

  const rows = [...days].sort().map((day) => {
    const d = dailyByDay.get(day) ?? { sales_count: 0, revenue: 0, cost: 0, discounts: 0, cash: 0, card: 0, credit: 0 };
    const r = returnsByDay.get(day) ?? { refunds: 0, cost_reversed: 0 };
    const grossProfit = subtract(d.revenue, d.cost);
    return {
      day,
      salesCount: d.sales_count,
      revenue: d.revenue,
      cost: d.cost,
      discounts: d.discounts,
      cash: d.cash,
      card: d.card,
      credit: d.credit,
      refunds: r.refunds,
      netRevenue: subtract(d.revenue, r.refunds),
      grossProfit,
      netProfit: subtract(grossProfit, subtract(r.refunds, r.cost_reversed)),
    };
  });

  const sum = (key) => fromCents(rows.reduce((acc, r) => acc + toCents(r[key]), 0));
  return {
    rows,
    totals: {
      salesCount: rows.reduce((acc, r) => acc + r.salesCount, 0),
      revenue: sum('revenue'),
      cost: sum('cost'),
      discounts: sum('discounts'),
      cash: sum('cash'),
      card: sum('card'),
      credit: sum('credit'),
      refunds: sum('refunds'),
      netRevenue: sum('netRevenue'),
      grossProfit: sum('grossProfit'),
      netProfit: sum('netProfit'),
    },
  };
}

export async function getProductProfit({ from, to }) {
  const rows = await query(
    `SELECT si.product_id, p.item_code, si.product_name, si.part_number,
            SUM(si.quantity - si.returned_qty) AS quantity,
            SUM(si.line_total * (si.quantity - si.returned_qty) / si.quantity) AS revenue,
            SUM(si.unit_cost * (si.quantity - si.returned_qty)) AS cost
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN products p ON p.id = si.product_id
      WHERE s.created_at BETWEEN ? AND ?
      GROUP BY si.product_id, p.item_code, si.product_name, si.part_number
      HAVING quantity > 0
      ORDER BY (revenue - cost) DESC
      LIMIT 500`,
    dayRange(from, to),
  );
  return camelizeAll(rows).map((r) => {
    const revenue = fromCents(toCents(r.revenue));
    const profit = subtract(revenue, r.cost);
    return {
      ...r,
      quantity: Number(r.quantity),
      revenue,
      profit,
      marginPercent: revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0,
    };
  });
}

export async function getPriceOverrides({ from, to }) {
  const rows = await query(
    `SELECT si.id, s.id AS sale_id, s.invoice_no, s.created_at, u.full_name AS cashier_name,
            si.product_name, si.part_number, si.quantity, si.unit_cost, si.list_price, si.unit_price,
            (si.unit_price - si.list_price) AS difference,
            (si.unit_price - si.list_price) * si.quantity AS impact
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN users u ON u.id = s.cashier_id
      WHERE si.price_overridden = 1 AND s.created_at BETWEEN ? AND ?
      ORDER BY s.id DESC
      LIMIT 1000`,
    dayRange(from, to),
  );
  const items = camelizeAll(rows);
  const totals = items.reduce(
    (acc, r) => {
      if (r.impact >= 0) acc.increase += toCents(r.impact);
      else acc.decrease += toCents(r.impact);
      return acc;
    },
    { increase: 0, decrease: 0 },
  );
  return {
    items,
    totals: {
      count: items.length,
      increase: fromCents(totals.increase),
      decrease: fromCents(totals.decrease),
      net: fromCents(totals.increase + totals.decrease),
    },
  };
}

export async function getCashierPerformance({ from, to }) {
  const rows = await query(
    `SELECT u.id, u.full_name, u.username, COUNT(s.id) AS sales_count,
            COALESCE(SUM(s.total_amount), 0) AS revenue,
            COALESCE(SUM(s.total_amount - s.total_cost), 0) AS gross_profit,
            COALESCE(SUM(s.has_price_override), 0) AS override_bills
       FROM users u
       JOIN sales s ON s.cashier_id = u.id AND s.created_at BETWEEN ? AND ?
      GROUP BY u.id, u.full_name, u.username
      ORDER BY revenue DESC`,
    dayRange(from, to),
  );
  return camelizeAll(rows).map((r) => ({ ...r, overrideBills: Number(r.overrideBills) }));
}

export async function getStockValuation() {
  const rows = await query(
    `SELECT c.id, c.name AS category_name, COUNT(p.id) AS item_count,
            COALESCE(SUM(GREATEST(p.stock_qty, 0)), 0) AS quantity,
            COALESCE(SUM(GREATEST(p.stock_qty, 0) * p.cost_price), 0) AS cost_value,
            COALESCE(SUM(GREATEST(p.stock_qty, 0) * p.selling_price), 0) AS retail_value
       FROM categories c
       JOIN products p ON p.category_id = c.id AND p.is_active = 1
      GROUP BY c.id, c.name
      ORDER BY cost_value DESC`,
  );
  const items = camelizeAll(rows).map((r) => ({
    ...r,
    quantity: Number(r.quantity),
    potentialProfit: subtract(r.retailValue, r.costValue),
  }));
  const sum = (key) => fromCents(items.reduce((acc, r) => acc + toCents(r[key]), 0));
  return {
    items,
    totals: {
      quantity: items.reduce((acc, r) => acc + r.quantity, 0),
      costValue: sum('costValue'),
      retailValue: sum('retailValue'),
      potentialProfit: sum('potentialProfit'),
    },
  };
}

/* ------------------------------------------------------- Cash closing --- */

export async function getDaySummary(date) {
  const range = dayRange(date, date);
  const sales = await queryOne(
    `SELECT COUNT(*) AS sales_count,
            COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total_amount END), 0) AS cash_sales,
            COALESCE(SUM(CASE WHEN payment_method = 'CARD' THEN total_amount END), 0) AS card_sales,
            COALESCE(SUM(CASE WHEN payment_method = 'CREDIT' THEN total_amount END), 0) AS credit_sales,
            COALESCE(SUM(total_amount), 0) AS total_sales
       FROM sales WHERE created_at BETWEEN ? AND ?`,
    range,
  );
  const refunds = await queryOne(
    `SELECT COALESCE(SUM(CASE WHEN refund_method = 'CASH' THEN refund_amount END), 0) AS cash_refunds,
            COALESCE(SUM(CASE WHEN refund_method = 'CARD' THEN refund_amount END), 0) AS card_refunds
       FROM sale_returns WHERE created_at BETWEEN ? AND ?`,
    range,
  );
  const collections = await queryOne(
    `SELECT COALESCE(SUM(CASE WHEN method = 'CASH' THEN amount END), 0) AS cash_collections,
            COALESCE(SUM(CASE WHEN method = 'CARD' THEN amount END), 0) AS card_collections
       FROM customer_payments WHERE created_at BETWEEN ? AND ?`,
    range,
  );
  const closing = await queryOne(
    `SELECT c.*, u.full_name AS closed_by_name FROM cash_closings c JOIN users u ON u.id = c.closed_by
      WHERE c.business_date = ?`,
    [date],
  );

  return {
    date,
    salesCount: sales.sales_count,
    totalSales: sales.total_sales,
    cashSales: sales.cash_sales,
    cardSales: sales.card_sales,
    creditSales: sales.credit_sales,
    cashRefunds: refunds.cash_refunds,
    cardRefunds: refunds.card_refunds,
    cashCollections: collections.cash_collections,
    cardCollections: collections.card_collections,
    expectedCashExcludingFloat: fromCents(
      toCents(sales.cash_sales) + toCents(collections.cash_collections) - toCents(refunds.cash_refunds),
    ),
    closing: camelize(closing),
  };
}

export async function closeDay(actor, { businessDate, openingFloat, countedCash, notes }) {
  const summary = await getDaySummary(businessDate);
  if (summary.closing) throw conflict('This day has already been closed.');

  const expected = fromCents(toCents(openingFloat) + toCents(summary.expectedCashExcludingFloat));
  const difference = fromCents(toCents(countedCash) - toCents(expected));

  await query(
    `INSERT INTO cash_closings
       (business_date, opening_float, cash_sales, cash_collections, cash_refunds, expected_cash, counted_cash,
        difference, card_sales, credit_sales, notes, closed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      businessDate,
      openingFloat,
      summary.cashSales,
      summary.cashCollections,
      summary.cashRefunds,
      expected,
      countedCash,
      difference,
      summary.cardSales,
      summary.creditSales,
      notes,
      actor.id,
    ],
  );
  await recordAudit({
    userId: actor.id,
    action: 'DAY_CLOSED',
    entityType: 'cash_closing',
    summary: `Closed ${businessDate}: expected Rs. ${expected.toFixed(2)}, counted Rs. ${countedCash.toFixed(2)}, difference Rs. ${difference.toFixed(2)}`,
  });
  return getDaySummary(businessDate);
}

export async function listClosings() {
  return camelizeAll(
    await query(
      `SELECT c.*, u.full_name AS closed_by_name FROM cash_closings c JOIN users u ON u.id = c.closed_by
        ORDER BY c.business_date DESC LIMIT 60`,
    ),
  );
}
