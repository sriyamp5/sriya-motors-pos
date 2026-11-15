import { AppError } from '../../core/errors.js';

/**
 * Single entry point for changing product stock. It must be called inside a
 * transaction: the product row is locked, the balance is updated and a
 * movement row with the resulting balance is written, so stock_qty and the
 * movement history can never disagree.
 *
 * @returns {Promise<{ balanceAfter: number, product: object }>}
 */
export async function applyStockChange(
  tx,
  {
    productId,
    quantity,
    movementType,
    userId,
    unitCost = null,
    referenceType = null,
    referenceId = null,
    referenceNo = null,
    note = null,
  },
) {
  const product = await tx.queryOne(
    'SELECT id, name, stock_qty, cost_price, selling_price, is_active FROM products WHERE id = ? FOR UPDATE',
    [productId],
  );
  if (!product) {
    throw new AppError(422, 'INVALID_REFERENCE', 'An item on this document no longer exists.');
  }

  const balanceAfter = product.stock_qty + quantity;
  if (balanceAfter < 0) {
    throw new AppError(
      409,
      'INSUFFICIENT_STOCK',
      `Not enough stock for "${product.name}". Available: ${product.stock_qty}, required: ${-quantity}.`,
      { productId, available: product.stock_qty },
    );
  }

  await tx.query('UPDATE products SET stock_qty = ? WHERE id = ?', [balanceAfter, productId]);
  await tx.query(
    `INSERT INTO stock_movements
       (product_id, movement_type, quantity, balance_after, unit_cost, reference_type, reference_id, reference_no, note, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [productId, movementType, quantity, balanceAfter, unitCost, referenceType, referenceId, referenceNo, note, userId],
  );

  return { balanceAfter, product };
}
