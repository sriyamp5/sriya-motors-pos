import { query, queryOne, transaction } from '../../db/database.js';
import { notFound, conflict } from '../../core/errors.js';
import { camelize, camelizeAll, likeContains, offsetOf } from '../../core/sql.js';
import { recordAudit } from '../audit/auditService.js';
import { applyStockChange } from '../stock/stockLedger.js';
import { ROLES, STOCK_MOVEMENT_TYPES } from '../../../shared/constants.js';
import { markupPercent } from '../../../shared/money.js';

const PRODUCT_SELECT = `
  SELECT p.id, p.item_code, p.barcode, p.name, p.part_number, p.category_id, p.brand_id,
         p.part_type, p.unit, p.cost_price, p.selling_price, p.stock_qty, p.reorder_level,
         p.rack_location, p.warranty_months, p.description, p.is_active, p.created_at, p.updated_at,
         c.name AS category_name, b.name AS brand_name,
         (SELECT GROUP_CONCAT(DISTINCT CONCAT(mk.name, ' ', vm.name) ORDER BY mk.name, vm.name SEPARATOR ', ')
            FROM product_fitments f
            JOIN vehicle_models vm ON vm.id = f.vehicle_model_id
            JOIN vehicle_makes mk ON mk.id = vm.make_id
           WHERE f.product_id = p.id) AS fits_vehicles
    FROM products p
    JOIN categories c ON c.id = p.category_id
    LEFT JOIN brands b ON b.id = p.brand_id`;

/** Cost and margin are business-sensitive; cashiers only see selling prices. */
export function presentProduct(row, role) {
  const product = camelize(row);
  product.isLowStock = product.stockQty <= product.reorderLevel;
  if (role === ROLES.ADMIN) {
    product.markupPercent = markupPercent(product.costPrice, product.sellingPrice);
  } else {
    delete product.costPrice;
  }
  return product;
}

const STOCK_FILTERS = {
  low: 'p.stock_qty <= p.reorder_level AND p.stock_qty > 0',
  out: 'p.stock_qty <= 0',
  available: 'p.stock_qty > 0',
  reorder: 'p.stock_qty <= p.reorder_level',
};

const SORTS = {
  name: 'p.name ASC',
  newest: 'p.id DESC',
  stockAsc: 'p.stock_qty ASC, p.name ASC',
  priceAsc: 'p.selling_price ASC',
  priceDesc: 'p.selling_price DESC',
};

export async function listProducts(filters, role) {
  const { search, page, pageSize, includeInactive, categoryId, brandId, vehicleModelId, makeId, stock, sort } = filters;
  const where = [includeInactive ? '1 = 1' : 'p.is_active = 1'];
  const params = [];

  if (search) {
    const term = likeContains(search);
    where.push(`(p.name LIKE ? OR p.part_number LIKE ? OR p.barcode LIKE ? OR p.item_code LIKE ?
                 OR b.name LIKE ? OR p.rack_location LIKE ?
                 OR EXISTS (SELECT 1 FROM product_fitments f
                              JOIN vehicle_models vm ON vm.id = f.vehicle_model_id
                              JOIN vehicle_makes mk ON mk.id = vm.make_id
                             WHERE f.product_id = p.id AND CONCAT(mk.name, ' ', vm.name) LIKE ?))`);
    params.push(term, term, term, term, term, term, term);
  }
  if (categoryId) {
    where.push('p.category_id = ?');
    params.push(categoryId);
  }
  if (brandId) {
    where.push('p.brand_id = ?');
    params.push(brandId);
  }
  if (vehicleModelId) {
    where.push('EXISTS (SELECT 1 FROM product_fitments f WHERE f.product_id = p.id AND f.vehicle_model_id = ?)');
    params.push(vehicleModelId);
  } else if (makeId) {
    where.push(`EXISTS (SELECT 1 FROM product_fitments f JOIN vehicle_models vm ON vm.id = f.vehicle_model_id
                         WHERE f.product_id = p.id AND vm.make_id = ?)`);
    params.push(makeId);
  }
  if (stock && STOCK_FILTERS[stock]) where.push(STOCK_FILTERS[stock]);

  const whereSql = where.join(' AND ');
  const { total } = await queryOne(
    `SELECT COUNT(*) AS total FROM products p LEFT JOIN brands b ON b.id = p.brand_id WHERE ${whereSql}`,
    params,
  );
  const rows = await query(
    `${PRODUCT_SELECT} WHERE ${whereSql} ORDER BY ${SORTS[sort] ?? SORTS.name} LIMIT ? OFFSET ?`,
    [...params, pageSize, offsetOf(page, pageSize)],
  );

  return {
    items: rows.map((r) => presentProduct(r, role)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Finds an active product by a scanned code. The barcode is checked first,
 * then the internal item code and the part number, so a cashier can also type
 * those when a barcode label is damaged.
 */
export async function findByCode(code, role) {
  const rows = await query(
    `${PRODUCT_SELECT}
      WHERE p.is_active = 1 AND (p.barcode = ? OR p.item_code = ? OR p.part_number = ?)
      ORDER BY (p.barcode = ?) DESC, (p.item_code = ?) DESC
      LIMIT 2`,
    [code, code, code, code, code],
  );
  if (rows.length === 0) return { product: null, matches: 0 };
  return { product: presentProduct(rows[0], role), matches: rows.length };
}

async function loadFitments(productId) {
  return camelizeAll(
    await query(
      `SELECT f.id, f.vehicle_model_id, f.year_from, f.year_to, vm.name AS model_name, vm.make_id, mk.name AS make_name
         FROM product_fitments f
         JOIN vehicle_models vm ON vm.id = f.vehicle_model_id
         JOIN vehicle_makes mk ON mk.id = vm.make_id
        WHERE f.product_id = ?
        ORDER BY mk.name, vm.name`,
      [productId],
    ),
  );
}

export async function getProduct(id, role) {
  const row = await queryOne(`${PRODUCT_SELECT} WHERE p.id = ?`, [id]);
  if (!row) throw notFound('Item');
  const product = presentProduct(row, role);
  product.fitments = await loadFitments(id);
  return product;
}

async function replaceFitments(tx, productId, fitments) {
  await tx.query('DELETE FROM product_fitments WHERE product_id = ?', [productId]);
  if (fitments.length === 0) return;
  await tx.query('INSERT INTO product_fitments (product_id, vehicle_model_id, year_from, year_to) VALUES ?', [
    fitments.map((f) => [productId, f.vehicleModelId, f.yearFrom, f.yearTo]),
  ]);
}

const editableColumns = (data) => [
  data.name,
  data.partNumber,
  data.barcode,
  data.categoryId,
  data.brandId,
  data.partType,
  data.unit,
  data.costPrice,
  data.sellingPrice,
  data.reorderLevel,
  data.rackLocation,
  data.warrantyMonths,
  data.description,
];

export async function createProduct(actor, data) {
  const productId = await transaction(async (tx) => {
    const result = await tx.query(
      `INSERT INTO products
         (name, part_number, barcode, category_id, brand_id, part_type, unit, cost_price, selling_price,
          reorder_level, rack_location, warranty_months, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...editableColumns(data), actor.id],
    );
    const id = result.insertId;
    await tx.query('UPDATE products SET item_code = ? WHERE id = ?', [`SM${String(id).padStart(5, '0')}`, id]);
    await replaceFitments(tx, id, data.fitments);

    if (data.openingStock > 0) {
      await applyStockChange(tx, {
        productId: id,
        quantity: data.openingStock,
        movementType: STOCK_MOVEMENT_TYPES.OPENING,
        unitCost: data.costPrice,
        userId: actor.id,
        note: 'Opening stock',
      });
    }

    await recordAudit(
      {
        userId: actor.id,
        action: 'PRODUCT_CREATED',
        entityType: 'product',
        entityId: id,
        summary: `Added item "${data.name}"`,
        details: { costPrice: data.costPrice, sellingPrice: data.sellingPrice, openingStock: data.openingStock },
      },
      tx,
    );
    return id;
  });
  return getProduct(productId, actor.role);
}

export async function updateProduct(actor, id, data) {
  await transaction(async (tx) => {
    const current = await tx.queryOne(
      'SELECT id, name, cost_price, selling_price FROM products WHERE id = ? FOR UPDATE',
      [id],
    );
    if (!current) throw notFound('Item');

    await tx.query(
      `UPDATE products
          SET name = ?, part_number = ?, barcode = ?, category_id = ?, brand_id = ?, part_type = ?, unit = ?,
              cost_price = ?, selling_price = ?, reorder_level = ?, rack_location = ?, warranty_months = ?,
              description = ?, is_active = ?
        WHERE id = ?`,
      [...editableColumns(data), data.isActive, id],
    );
    await replaceFitments(tx, id, data.fitments);

    const priceChanged = current.cost_price !== data.costPrice || current.selling_price !== data.sellingPrice;
    await recordAudit(
      {
        userId: actor.id,
        action: priceChanged ? 'PRODUCT_PRICE_CHANGED' : 'PRODUCT_UPDATED',
        entityType: 'product',
        entityId: id,
        summary: priceChanged
          ? `Changed price of "${data.name}": cost ${current.cost_price} → ${data.costPrice}, selling ${current.selling_price} → ${data.sellingPrice}`
          : `Updated item "${data.name}"`,
        details: priceChanged
          ? {
              before: { cost: current.cost_price, selling: current.selling_price },
              after: { cost: data.costPrice, selling: data.sellingPrice },
            }
          : null,
      },
      tx,
    );
  });
  return getProduct(id, actor.role);
}

export async function setProductActive(actor, id, isActive) {
  const product = await getProduct(id, actor.role);
  await query('UPDATE products SET is_active = ? WHERE id = ?', [isActive, id]);
  await recordAudit({
    userId: actor.id,
    action: isActive ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED',
    entityType: 'product',
    entityId: id,
    summary: `${isActive ? 'Activated' : 'Deactivated'} item "${product.name}"`,
  });
  return getProduct(id, actor.role);
}

/** Items with sales or purchase history are kept for reporting; they can only be deactivated. */
export async function deleteProduct(actor, id) {
  await transaction(async (tx) => {
    const product = await tx.queryOne('SELECT id, name FROM products WHERE id = ? FOR UPDATE', [id]);
    if (!product) throw notFound('Item');
    const usage = await tx.queryOne(
      `SELECT (SELECT COUNT(*) FROM sale_items WHERE product_id = ?) +
              (SELECT COUNT(*) FROM purchase_items WHERE product_id = ?) +
              (SELECT COUNT(*) FROM stock_movements WHERE product_id = ? AND movement_type <> 'OPENING') AS uses`,
      [id, id, id],
    );
    if (usage.uses > 0) {
      throw conflict('This item has sales or stock history and cannot be deleted. Deactivate it instead.');
    }
    await tx.query('DELETE FROM stock_movements WHERE product_id = ?', [id]);
    await tx.query('DELETE FROM products WHERE id = ?', [id]);
    await recordAudit(
      {
        userId: actor.id,
        action: 'PRODUCT_DELETED',
        entityType: 'product',
        entityId: id,
        summary: `Deleted item "${product.name}"`,
      },
      tx,
    );
  });
}

export async function listMovements(productId, { page, pageSize }) {
  const { total } = await queryOne('SELECT COUNT(*) AS total FROM stock_movements WHERE product_id = ?', [productId]);
  const rows = await query(
    `SELECT m.id, m.movement_type, m.quantity, m.balance_after, m.unit_cost, m.reference_type,
            m.reference_id, m.reference_no, m.note, m.created_at, u.full_name AS user_name
       FROM stock_movements m JOIN users u ON u.id = m.user_id
      WHERE m.product_id = ?
      ORDER BY m.id DESC
      LIMIT ? OFFSET ?`,
    [productId, pageSize, offsetOf(page, pageSize)],
  );
  return { items: camelizeAll(rows), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function adjustStock(actor, { productId, quantityChange, reason, note }) {
  return transaction(async (tx) => {
    const { balanceAfter, product } = await applyStockChange(tx, {
      productId,
      quantity: quantityChange,
      movementType: STOCK_MOVEMENT_TYPES.ADJUSTMENT,
      userId: actor.id,
      referenceType: 'ADJUSTMENT',
      note: note ? `${reason}: ${note}` : reason,
    });
    await recordAudit(
      {
        userId: actor.id,
        action: 'STOCK_ADJUSTED',
        entityType: 'product',
        entityId: productId,
        summary: `Stock of "${product.name}" adjusted by ${quantityChange > 0 ? '+' : ''}${quantityChange} (${reason}). New balance ${balanceAfter}`,
      },
      tx,
    );
    return { productId, balanceAfter };
  });
}

/** Recent adjustments across all products (stock adjustment screen). */
export async function listAdjustments({ page, pageSize }) {
  const { total } = await queryOne(`SELECT COUNT(*) AS total FROM stock_movements WHERE movement_type = 'ADJUSTMENT'`);
  const rows = await query(
    `SELECT m.id, m.product_id, p.name AS product_name, p.item_code, m.quantity, m.balance_after, m.note,
            m.created_at, u.full_name AS user_name
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       JOIN users u ON u.id = m.user_id
      WHERE m.movement_type = 'ADJUSTMENT'
      ORDER BY m.id DESC
      LIMIT ? OFFSET ?`,
    [pageSize, offsetOf(page, pageSize)],
  );
  return { items: camelizeAll(rows), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
