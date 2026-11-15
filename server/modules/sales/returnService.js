import { query, queryOne, transaction } from '../../db/database.js';
import { AppError, notFound, badRequest } from '../../core/errors.js';
import { camelize, camelizeAll, documentNumber, likeContains, offsetOf, paginated } from '../../core/sql.js';
import { recordAudit } from '../audit/auditService.js';
import { applyStockChange } from '../stock/stockLedger.js';
import { PAYMENT_METHODS, REFUND_METHODS, SALE_STATUSES, STOCK_MOVEMENT_TYPES } from '../../../shared/constants.js';
import { fromCents, toCents } from '../../../shared/money.js';

/**
 * Customer returns against an invoice.
 *
 * The refund for each unit is its share of the line total after the bill
 * discount, so a customer can never be refunded more than they paid.
 * Restocked items go back into stock; damaged items are recorded without
 * a stock change.
 */

function unitRefundCents(saleItem, sale) {
  const lineNetCents = toCents(saleItem.line_total);
  const billBaseCents = toCents(sale.subtotal) - toCents(sale.item_discount_total);
  const billShareCents = billBaseCents > 0 ? (toCents(sale.bill_discount) * lineNetCents) / billBaseCents : 0;
  return (lineNetCents - billShareCents) / saleItem.quantity;
}

export async function createReturn(actor, data) {
  const returnId = await transaction(async (tx) => {
    const sale = await tx.queryOne('SELECT * FROM sales WHERE id = ? FOR UPDATE', [data.saleId]);
    if (!sale) throw notFound('Invoice');

    const saleItems = await tx.query('SELECT * FROM sale_items WHERE sale_id = ? FOR UPDATE', [sale.id]);
    const itemsById = new Map(saleItems.map((i) => [i.id, i]));

    const requestedIds = data.items.map((i) => i.saleItemId);
    if (new Set(requestedIds).size !== requestedIds.length) {
      throw badRequest('An invoice line is listed more than once.');
    }

    const lines = data.items.map((request) => {
      const saleItem = itemsById.get(request.saleItemId);
      if (!saleItem) throw badRequest('A selected line does not belong to this invoice.');
      const returnable = saleItem.quantity - saleItem.returned_qty;
      if (request.quantity > returnable) {
        throw new AppError(
          422,
          'RETURN_QTY_EXCEEDED',
          `Only ${returnable} of "${saleItem.product_name}" can be returned from this invoice.`,
        );
      }
      const lineRefundCents = Math.round(unitRefundCents(saleItem, sale) * request.quantity);
      return { saleItem, quantity: request.quantity, restock: request.restock, lineRefundCents };
    });

    const refundCents = lines.reduce((sum, l) => sum + l.lineRefundCents, 0);
    const previous = await tx.queryOne(
      'SELECT COALESCE(SUM(refund_amount), 0) AS refunded FROM sale_returns WHERE sale_id = ?',
      [sale.id],
    );
    if (refundCents + toCents(previous.refunded) > toCents(sale.total_amount)) {
      throw badRequest('The refund would be more than the invoice total.');
    }

    if (data.refundMethod === REFUND_METHODS.CREDIT) {
      if (sale.payment_method !== PAYMENT_METHODS.CREDIT || !sale.customer_id) {
        throw badRequest('Credit refunds are only possible for credit sales.');
      }
      const customer = await tx.queryOne('SELECT credit_balance FROM customers WHERE id = ? FOR UPDATE', [
        sale.customer_id,
      ]);
      if (toCents(customer.credit_balance) < refundCents) {
        throw badRequest('The customer balance is less than the refund. Please refund in cash instead.');
      }
      await tx.query('UPDATE customers SET credit_balance = credit_balance - ? WHERE id = ?', [
        fromCents(refundCents),
        sale.customer_id,
      ]);
    }

    const costReversedCents = lines
      .filter((l) => l.restock)
      .reduce((sum, l) => sum + toCents(l.saleItem.unit_cost) * l.quantity, 0);

    const header = await tx.query(
      `INSERT INTO sale_returns (sale_id, refund_method, refund_amount, cost_reversed, reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sale.id, data.refundMethod, fromCents(refundCents), fromCents(costReversedCents), data.reason, actor.id],
    );
    const id = header.insertId;
    const returnNo = documentNumber('RET', id);
    await tx.query('UPDATE sale_returns SET return_no = ? WHERE id = ?', [returnNo, id]);

    for (const line of lines) {
      const { saleItem, quantity, restock, lineRefundCents } = line;
      await tx.query(
        `INSERT INTO sale_return_items (return_id, sale_item_id, product_id, quantity, unit_refund, line_total, unit_cost, restocked)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          saleItem.id,
          saleItem.product_id,
          quantity,
          fromCents(Math.round(lineRefundCents / quantity)),
          fromCents(lineRefundCents),
          saleItem.unit_cost,
          restock,
        ],
      );
      await tx.query('UPDATE sale_items SET returned_qty = returned_qty + ? WHERE id = ?', [quantity, saleItem.id]);
      if (restock) {
        await applyStockChange(tx, {
          productId: saleItem.product_id,
          quantity,
          movementType: STOCK_MOVEMENT_TYPES.RETURN,
          unitCost: saleItem.unit_cost,
          userId: actor.id,
          referenceType: 'RETURN',
          referenceId: id,
          referenceNo: returnNo,
          note: `Return of ${sale.invoice_no}`,
        });
      }
    }

    const remaining = await tx.queryOne(
      'SELECT SUM(quantity - returned_qty) AS qty FROM sale_items WHERE sale_id = ?',
      [sale.id],
    );
    const status = Number(remaining.qty) === 0 ? SALE_STATUSES.RETURNED : SALE_STATUSES.PARTIALLY_RETURNED;
    await tx.query('UPDATE sales SET status = ? WHERE id = ?', [status, sale.id]);

    await recordAudit(
      {
        userId: actor.id,
        action: 'SALE_RETURN',
        entityType: 'sale',
        entityId: sale.id,
        summary: `${returnNo}: refunded Rs. ${fromCents(refundCents).toFixed(2)} on ${sale.invoice_no} (${data.refundMethod})`,
        details: {
          reason: data.reason,
          items: lines.map((l) => ({ item: l.saleItem.product_name, qty: l.quantity, restocked: l.restock })),
        },
      },
      tx,
    );
    return id;
  });

  return getReturn(returnId);
}

export async function getReturn(id) {
  const header = await queryOne(
    `SELECT r.*, s.invoice_no, s.customer_name, s.customer_phone, u.full_name AS created_by_name
       FROM sale_returns r
       JOIN sales s ON s.id = r.sale_id
       JOIN users u ON u.id = r.created_by
      WHERE r.id = ?`,
    [id],
  );
  if (!header) throw notFound('Return');
  const items = await query(
    `SELECT ri.*, si.product_name, si.part_number
       FROM sale_return_items ri JOIN sale_items si ON si.id = ri.sale_item_id
      WHERE ri.return_id = ? ORDER BY ri.id`,
    [id],
  );
  return { ...camelize(header), items: camelizeAll(items) };
}

export async function listReturns({ search, page, pageSize, from, to }) {
  const where = ['1 = 1'];
  const params = [];
  if (search) {
    const term = likeContains(search);
    where.push('(r.return_no LIKE ? OR s.invoice_no LIKE ? OR s.customer_name LIKE ?)');
    params.push(term, term, term);
  }
  if (from) {
    where.push('r.created_at >= ?');
    params.push(`${from} 00:00:00`);
  }
  if (to) {
    where.push('r.created_at <= ?');
    params.push(`${to} 23:59:59`);
  }
  const whereSql = where.join(' AND ');
  const { total } = await queryOne(
    `SELECT COUNT(*) AS total FROM sale_returns r JOIN sales s ON s.id = r.sale_id WHERE ${whereSql}`,
    params,
  );
  const rows = await query(
    `SELECT r.id, r.return_no, r.refund_method, r.refund_amount, r.reason, r.created_at,
            s.id AS sale_id, s.invoice_no, s.customer_name, u.full_name AS created_by_name
       FROM sale_returns r
       JOIN sales s ON s.id = r.sale_id
       JOIN users u ON u.id = r.created_by
      WHERE ${whereSql}
      ORDER BY r.id DESC
      LIMIT ? OFFSET ?`,
    [...params, pageSize, offsetOf(page, pageSize)],
  );
  return paginated(rows, total, page, pageSize);
}
