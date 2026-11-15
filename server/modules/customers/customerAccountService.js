import { query, queryOne, transaction } from '../../db/database.js';
import { notFound, badRequest } from '../../core/errors.js';
import { camelize, camelizeAll } from '../../core/sql.js';
import { recordAudit } from '../audit/auditService.js';
import { fromCents, toCents } from '../../../shared/money.js';

/**
 * Credit account operations: statement of credit sales, refunds and
 * payments, and recording payments that reduce the outstanding balance.
 */

export async function getStatement(customerId) {
  const customer = await queryOne('SELECT * FROM customers WHERE id = ?', [customerId]);
  if (!customer) throw notFound('Customer');

  const entries = await query(
    `SELECT * FROM (
        SELECT 'SALE' AS entry_type, s.id AS reference_id, s.invoice_no AS reference_no,
               s.total_amount AS debit, 0 AS credit, s.created_at
          FROM sales s WHERE s.customer_id = ? AND s.payment_method = 'CREDIT'
        UNION ALL
        SELECT 'PAYMENT', p.id, p.reference, 0, p.amount, p.created_at
          FROM customer_payments p WHERE p.customer_id = ?
        UNION ALL
        SELECT 'REFUND', r.id, r.return_no, 0, r.refund_amount, r.created_at
          FROM sale_returns r JOIN sales s ON s.id = r.sale_id
         WHERE s.customer_id = ? AND r.refund_method = 'CREDIT'
      ) entries
      ORDER BY created_at DESC
      LIMIT 300`,
    [customerId, customerId, customerId],
  );
  return { customer: camelize(customer), entries: camelizeAll(entries) };
}

export async function receivePayment(actor, customerId, { amount, method, reference, note }) {
  return transaction(async (tx) => {
    const customer = await tx.queryOne('SELECT id, name, credit_balance FROM customers WHERE id = ? FOR UPDATE', [
      customerId,
    ]);
    if (!customer) throw notFound('Customer');
    if (toCents(amount) > toCents(customer.credit_balance)) {
      throw badRequest(`The amount is more than the outstanding balance (Rs. ${customer.credit_balance.toFixed(2)}).`, {
        fields: { amount: 'More than the outstanding balance' },
      });
    }

    const result = await tx.query(
      `INSERT INTO customer_payments (customer_id, amount, method, reference, note, received_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [customerId, amount, method, reference, note, actor.id],
    );
    await tx.query('UPDATE customers SET credit_balance = credit_balance - ? WHERE id = ?', [amount, customerId]);
    await recordAudit(
      {
        userId: actor.id,
        action: 'CREDIT_PAYMENT',
        entityType: 'customer',
        entityId: customerId,
        summary: `Received Rs. ${amount.toFixed(2)} (${method}) from ${customer.name}`,
      },
      tx,
    );
    return {
      id: result.insertId,
      balance: fromCents(toCents(customer.credit_balance) - toCents(amount)),
    };
  });
}

export async function listDebtors() {
  return camelizeAll(
    await query(
      `SELECT id, name, phone, vehicle_no, credit_balance FROM customers
        WHERE credit_balance > 0 ORDER BY credit_balance DESC LIMIT 500`,
    ),
  );
}
