import { query, queryOne, transaction } from '../../db/database.js';
import { notFound, badRequest } from '../../core/errors.js';
import { camelize, camelizeAll, documentNumber, likeContains, offsetOf, paginated } from '../../core/sql.js';
import { recordAudit } from '../audit/auditService.js';
import { applyStockChange } from '../stock/stockLedger.js';
import { STOCK_MOVEMENT_TYPES } from '../../../shared/constants.js';
import { fromCents, toCents } from '../../../shared/money.js';

/**
 * Goods received notes (GRN).
 *
 * Receiving goods increases stock and sets the item's buying price to the
 * latest supplier price ("last cost" method). Optionally a new selling price
 * can be set at the same time, which is how the shop applies its markup.
 */

export async function listPurchases({ search, page, pageSize, from, to, supplierId }) {
  const where = ['1 = 1'];
  const params = [];
  if (search) {
    where.push('(p.grn_no LIKE ? OR p.supplier_invoice_no LIKE ? OR s.name LIKE ?)');
    const term = likeContains(search);
    params.push(term, term, term);
  }
  if (supplierId) {
    where.push('p.supplier_id = ?');
    params.push(supplierId);
  }
  if (from) {
    where.push('p.purchase_date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('p.purchase_date <= ?');
    params.push(to);
  }
  const whereSql = where.join(' AND ');

  const { total } = await queryOne(
    `SELECT COUNT(*) AS total FROM purchases p JOIN suppliers s ON s.id = p.supplier_id WHERE ${whereSql}`,
    params,
  );
  const rows = await query(
    `SELECT p.id, p.grn_no, p.supplier_invoice_no, p.purchase_date, p.total_amount, p.notes, p.created_at,
            s.name AS supplier_name, u.full_name AS created_by_name,
            (SELECT COUNT(*) FROM purchase_items i WHERE i.purchase_id = p.id) AS item_count
       FROM purchases p
       JOIN suppliers s ON s.id = p.supplier_id
       JOIN users u ON u.id = p.created_by
      WHERE ${whereSql}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?`,
    [...params, pageSize, offsetOf(page, pageSize)],
  );
  return paginated(rows, total, page, pageSize);
}

export async function getPurchase(id) {
  const header = await queryOne(
    `SELECT p.*, s.name AS supplier_name, s.phone AS supplier_phone, u.full_name AS created_by_name
       FROM purchases p
       JOIN suppliers s ON s.id = p.supplier_id
       JOIN users u ON u.id = p.created_by
      WHERE p.id = ?`,
    [id],
  );
  if (!header) throw notFound('Goods received note');
  const items = await query(
    `SELECT i.*, pr.name AS product_name, pr.item_code, pr.part_number
       FROM purchase_items i JOIN products pr ON pr.id = i.product_id
      WHERE i.purchase_id = ?
      ORDER BY i.id`,
    [id],
  );
  return { ...camelize(header), items: camelizeAll(items) };
}

export async function createPurchase(actor, data) {
  const productIds = data.items.map((i) => i.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw badRequest('The same item is listed more than once. Please combine the quantities into one line.');
  }

  const purchaseId = await transaction(async (tx) => {
    const supplier = await tx.queryOne('SELECT id, name FROM suppliers WHERE id = ?', [data.supplierId]);
    if (!supplier) throw notFound('Supplier');

    const totalCents = data.items.reduce((sum, i) => sum + toCents(i.unitCost) * i.quantity, 0);
    const header = await tx.query(
      `INSERT INTO purchases (supplier_id, supplier_invoice_no, purchase_date, total_amount, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.supplierId, data.supplierInvoiceNo, data.purchaseDate, fromCents(totalCents), data.notes, actor.id],
    );
    const id = header.insertId;
    const grnNo = documentNumber('GRN', id);
    await tx.query('UPDATE purchases SET grn_no = ? WHERE id = ?', [grnNo, id]);

    for (const item of data.items) {
      const { product } = await applyStockChange(tx, {
        productId: item.productId,
        quantity: item.quantity,
        movementType: STOCK_MOVEMENT_TYPES.PURCHASE,
        unitCost: item.unitCost,
        userId: actor.id,
        referenceType: 'PURCHASE',
        referenceId: id,
        referenceNo: grnNo,
        note: `From ${supplier.name}`,
      });

      await tx.query(
        `INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, line_total, previous_cost, new_selling_price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          item.productId,
          item.quantity,
          item.unitCost,
          fromCents(toCents(item.unitCost) * item.quantity),
          product.cost_price,
          item.sellingPrice,
        ],
      );

      await tx.query(
        'UPDATE products SET cost_price = ?, selling_price = COALESCE(?, selling_price), is_active = 1 WHERE id = ?',
        [item.unitCost, item.sellingPrice, item.productId],
      );
    }

    await recordAudit(
      {
        userId: actor.id,
        action: 'GOODS_RECEIVED',
        entityType: 'purchase',
        entityId: id,
        summary: `Received ${data.items.length} item(s) from ${supplier.name} (${grnNo})`,
        details: { total: fromCents(totalCents), supplierInvoiceNo: data.supplierInvoiceNo },
      },
      tx,
    );
    return id;
  });

  return getPurchase(purchaseId);
}
