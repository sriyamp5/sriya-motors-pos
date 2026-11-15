import { query, queryOne, transaction } from '../../db/database.js';
import { AppError, notFound, badRequest } from '../../core/errors.js';
import { camelize, camelizeAll, documentNumber, likeContains, offsetOf } from '../../core/sql.js';
import { recordAudit } from '../audit/auditService.js';
import { applyStockChange } from '../stock/stockLedger.js';
import { getSettings } from '../settings/settingsService.js';
import { PAYMENT_METHODS, ROLES, STOCK_MOVEMENT_TYPES } from '../../../shared/constants.js';
import { calculateBillTotals, fromCents, toCents } from '../../../shared/money.js';

/* ------------------------------------------------------------ Helpers --- */

/** Removes cost and profit information for cashiers. */
function presentSale(sale, items, role) {
  const header = camelize(sale);
  const lines = camelizeAll(items);
  if (role !== ROLES.ADMIN) {
    delete header.totalCost;
    lines.forEach((line) => delete line.unitCost);
  } else {
    header.grossProfit = fromCents(toCents(header.totalAmount) - toCents(header.totalCost));
  }
  return { ...header, items: lines };
}

/**
 * Locks every product on the bill (in id order to avoid deadlocks between
 * two tills) and checks that enough stock is available for the combined
 * quantity of each product.
 */
async function lockAndCheckProducts(tx, items) {
  const ids = [...new Set(items.map((i) => i.productId))].sort((a, b) => a - b);
  const rows = await tx.query(
    `SELECT id, name, part_number, cost_price, selling_price, stock_qty, is_active
       FROM products WHERE id IN (?) ORDER BY id FOR UPDATE`,
    [ids],
  );
  const products = new Map(rows.map((r) => [r.id, r]));

  const required = new Map();
  for (const item of items) {
    required.set(item.productId, (required.get(item.productId) ?? 0) + item.quantity);
  }

  for (const [productId, quantity] of required) {
    const product = products.get(productId);
    if (!product) {
      throw new AppError(
        422,
        'INVALID_REFERENCE',
        'An item on this bill no longer exists. Please remove it and scan again.',
      );
    }
    if (!product.is_active) {
      throw new AppError(422, 'ITEM_INACTIVE', `"${product.name}" is no longer available for sale.`);
    }
    if (product.stock_qty < quantity) {
      throw new AppError(
        409,
        'INSUFFICIENT_STOCK',
        `Not enough stock for "${product.name}". Available: ${product.stock_qty}, on bill: ${quantity}.`,
        { productId, available: product.stock_qty },
      );
    }
  }
  return products;
}

/** Returns an existing customer for a credit sale or registers a new one. */
async function resolveCustomer(tx, { customerId, customerName, customerPhone, vehicleNo }) {
  if (customerId) {
    const customer = await tx.queryOne('SELECT id, name, phone, is_active FROM customers WHERE id = ? FOR UPDATE', [
      customerId,
    ]);
    if (!customer || !customer.is_active) throw notFound('Customer');
    return customer;
  }
  if (customerPhone) {
    const existing = await tx.queryOne('SELECT id, name, phone FROM customers WHERE phone = ? FOR UPDATE', [
      customerPhone,
    ]);
    if (existing) return existing;
  }
  const result = await tx.query('INSERT INTO customers (name, phone, vehicle_no) VALUES (?, ?, ?)', [
    customerName,
    customerPhone,
    vehicleNo,
  ]);
  return { id: result.insertId, name: customerName, phone: customerPhone };
}

/* ------------------------------------------------------------ Queries --- */

export async function getSale(id, role) {
  const sale = await queryOne(
    `SELECT s.*, u.full_name AS cashier_name, c.name AS customer_account_name
       FROM sales s
       JOIN users u ON u.id = s.cashier_id
       LEFT JOIN customers c ON c.id = s.customer_id
      WHERE s.id = ?`,
    [id],
  );
  if (!sale) throw notFound('Invoice');
  const items = await query(
    `SELECT si.*, p.item_code, p.unit, p.warranty_months
       FROM sale_items si JOIN products p ON p.id = si.product_id
      WHERE si.sale_id = ? ORDER BY si.id`,
    [id],
  );
  const returns = await query(
    `SELECT r.id, r.return_no, r.refund_method, r.refund_amount, r.reason, r.created_at, u.full_name AS created_by_name
       FROM sale_returns r JOIN users u ON u.id = r.created_by
      WHERE r.sale_id = ? ORDER BY r.id`,
    [id],
  );
  return { ...presentSale(sale, items, role), returns: camelizeAll(returns) };
}

export async function findSaleByInvoice(invoiceNo, role) {
  const row = await queryOne('SELECT id FROM sales WHERE invoice_no = ?', [invoiceNo.trim().toUpperCase()]);
  if (!row) throw notFound('Invoice');
  return getSale(row.id, role);
}

export async function listSales(filters, user) {
  const { search, page, pageSize, from, to, paymentMethod, cashierId, overriddenOnly, status } = filters;
  const where = ['1 = 1'];
  const params = [];

  if (search) {
    const term = likeContains(search);
    where.push('(s.invoice_no LIKE ? OR s.customer_name LIKE ? OR s.customer_phone LIKE ? OR s.vehicle_no LIKE ?)');
    params.push(term, term, term, term);
  }
  if (from) {
    where.push('s.created_at >= ?');
    params.push(`${from} 00:00:00`);
  }
  if (to) {
    where.push('s.created_at <= ?');
    params.push(`${to} 23:59:59`);
  }
  if (paymentMethod) {
    where.push('s.payment_method = ?');
    params.push(paymentMethod);
  }
  if (status) {
    where.push('s.status = ?');
    params.push(status);
  }
  if (cashierId) {
    where.push('s.cashier_id = ?');
    params.push(cashierId);
  }
  if (overriddenOnly) where.push('s.has_price_override = 1');

  const whereSql = where.join(' AND ');
  const summary = await queryOne(
    `SELECT COUNT(*) AS total, COALESCE(SUM(s.total_amount), 0) AS total_amount, COALESCE(SUM(s.total_cost), 0) AS total_cost
       FROM sales s WHERE ${whereSql}`,
    params,
  );
  const rows = await query(
    `SELECT s.id, s.invoice_no, s.customer_name, s.customer_phone, s.vehicle_no, s.total_amount, s.total_cost,
            s.payment_method, s.status, s.has_price_override, s.created_at, u.full_name AS cashier_name,
            (SELECT COALESCE(SUM(quantity), 0) FROM sale_items si WHERE si.sale_id = s.id) AS item_count
       FROM sales s JOIN users u ON u.id = s.cashier_id
      WHERE ${whereSql}
      ORDER BY s.id DESC
      LIMIT ? OFFSET ?`,
    [...params, pageSize, offsetOf(page, pageSize)],
  );

  const isAdmin = user.role === ROLES.ADMIN;
  const items = camelizeAll(rows).map((row) => {
    if (!isAdmin) delete row.totalCost;
    return row;
  });

  return {
    items,
    total: summary.total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(summary.total / pageSize)),
    summary: {
      count: summary.total,
      totalAmount: summary.total_amount,
      ...(isAdmin
        ? {
            totalCost: summary.total_cost,
            grossProfit: fromCents(toCents(summary.total_amount) - toCents(summary.total_cost)),
          }
        : {}),
    },
  };
}

/* ----------------------------------------------------------- Checkout --- */

export async function createSale(actor, data) {
  const settings = await getSettings();
  const enforceCostFloor = actor.role !== ROLES.ADMIN && !settings.allowBelowCostSale;

  const saleId = await transaction(async (tx) => {
    const products = await lockAndCheckProducts(tx, data.items);

    // Build lines from authoritative product data; only price, quantity and discount come from the till.
    const lines = data.items.map((item) => {
      const product = products.get(item.productId);
      const grossCents = toCents(item.unitPrice) * item.quantity;
      if (toCents(item.discount) > grossCents) {
        throw badRequest(`Discount for "${product.name}" is more than the line amount.`);
      }
      const netCents = grossCents - toCents(item.discount);
      if (enforceCostFloor && netCents < toCents(product.cost_price) * item.quantity) {
        throw new AppError(
          422,
          'PRICE_BELOW_MINIMUM',
          `The price for "${product.name}" is below the minimum allowed. Please ask an admin.`,
          { productId: product.id },
        );
      }
      return {
        product,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        unitCost: product.cost_price,
        listPrice: product.selling_price,
        lineTotal: fromCents(netCents),
        priceOverridden: toCents(item.unitPrice) !== toCents(product.selling_price),
      };
    });

    const totals = calculateBillTotals(lines, data.billDiscount);
    if (totals.billDiscount > totals.netBeforeBillDiscount) {
      throw badRequest('The bill discount is more than the bill amount.');
    }
    if (enforceCostFloor && toCents(totals.total) < toCents(totals.totalCost)) {
      throw new AppError(422, 'PRICE_BELOW_MINIMUM', 'The bill discount is too large. Please ask an admin.');
    }

    let amountTendered = 0;
    let changeAmount = 0;
    let customer = null;

    switch (data.paymentMethod) {
      case PAYMENT_METHODS.CASH:
        amountTendered = data.amountTendered || totals.total;
        if (toCents(amountTendered) < toCents(totals.total)) {
          throw badRequest('The cash received is less than the bill total.', {
            fields: { amountTendered: 'Cash received is less than the total' },
          });
        }
        changeAmount = fromCents(toCents(amountTendered) - toCents(totals.total));
        break;
      case PAYMENT_METHODS.CARD:
        amountTendered = totals.total;
        break;
      case PAYMENT_METHODS.CREDIT:
        customer = await resolveCustomer(tx, data);
        break;
      default:
        throw badRequest('Unsupported payment method.');
    }

    if (!customer && data.customerId) {
      customer = await tx.queryOne('SELECT id, name, phone FROM customers WHERE id = ?', [data.customerId]);
    }

    const hasOverride = lines.some((l) => l.priceOverridden);
    const header = await tx.query(
      `INSERT INTO sales
         (customer_id, customer_name, customer_phone, vehicle_no, subtotal, item_discount_total, bill_discount,
          total_amount, total_cost, payment_method, amount_tendered, change_amount, card_reference,
          has_price_override, notes, cashier_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer?.id ?? null,
        customer?.name ?? data.customerName,
        customer?.phone ?? data.customerPhone,
        data.vehicleNo,
        totals.subtotal,
        totals.itemDiscountTotal,
        totals.billDiscount,
        totals.total,
        totals.totalCost,
        data.paymentMethod,
        amountTendered,
        changeAmount,
        data.paymentMethod === PAYMENT_METHODS.CARD ? data.cardReference : null,
        hasOverride,
        data.notes,
        actor.id,
      ],
    );
    const id = header.insertId;
    const invoiceNo = documentNumber('INV', id);
    await tx.query('UPDATE sales SET invoice_no = ? WHERE id = ?', [invoiceNo, id]);

    await tx.query(
      `INSERT INTO sale_items
         (sale_id, product_id, product_name, part_number, quantity, unit_cost, list_price, unit_price, discount, line_total, price_overridden)
       VALUES ?`,
      [
        lines.map((l) => [
          id,
          l.product.id,
          l.product.name,
          l.product.part_number,
          l.quantity,
          l.unitCost,
          l.listPrice,
          l.unitPrice,
          l.discount,
          l.lineTotal,
          l.priceOverridden,
        ]),
      ],
    );

    for (const line of lines) {
      await applyStockChange(tx, {
        productId: line.product.id,
        quantity: -line.quantity,
        movementType: STOCK_MOVEMENT_TYPES.SALE,
        unitCost: line.unitCost,
        userId: actor.id,
        referenceType: 'SALE',
        referenceId: id,
        referenceNo: invoiceNo,
      });
    }

    if (data.paymentMethod === PAYMENT_METHODS.CREDIT) {
      await tx.query('UPDATE customers SET credit_balance = credit_balance + ? WHERE id = ?', [
        totals.total,
        customer.id,
      ]);
    }

    if (hasOverride) {
      const overridden = lines.filter((l) => l.priceOverridden);
      await recordAudit(
        {
          userId: actor.id,
          action: 'PRICE_OVERRIDE',
          entityType: 'sale',
          entityId: id,
          summary: `${invoiceNo}: price changed on ${overridden.length} item(s) by ${actor.username}`,
          details: overridden.map((l) => ({
            item: l.product.name,
            systemPrice: l.listPrice,
            chargedPrice: l.unitPrice,
          })),
        },
        tx,
      );
    }
    return id;
  });

  return getSale(saleId, actor.role);
}
