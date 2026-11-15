import { query, queryOne } from '../../db/database.js';
import { logger } from '../../core/logger.js';
import { likeContains, offsetOf, paginated } from '../../core/sql.js';

/**
 * Records significant actions (user management, price changes, refunds,
 * stock corrections) so the owner can review who did what and when.
 */
export async function recordAudit(
  { userId, action, entityType = null, entityId = null, summary, details = null },
  executor = { query },
) {
  try {
    await executor.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, summary, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId ?? null, action, entityType, entityId, summary, details ? JSON.stringify(details) : null],
    );
  } catch (error) {
    // Inside a transaction the caller must know; outside, auditing must not break the action.
    if (executor.query !== query) throw error;
    logger.error('Failed to write audit log', error);
  }
}

export async function listAuditLogs({ search, page, pageSize, from, to }) {
  const where = ['1 = 1'];
  const params = [];
  if (search) {
    where.push('(a.summary LIKE ? OR a.action LIKE ? OR u.username LIKE ?)');
    const term = likeContains(search);
    params.push(term, term, term);
  }
  if (from) {
    where.push('a.created_at >= ?');
    params.push(`${from} 00:00:00`);
  }
  if (to) {
    where.push('a.created_at <= ?');
    params.push(`${to} 23:59:59`);
  }
  const whereSql = where.join(' AND ');

  const { total } = await queryOne(
    `SELECT COUNT(*) AS total FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id WHERE ${whereSql}`,
    params,
  );
  const rows = await query(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.summary, a.details, a.created_at,
            u.full_name AS user_name, u.username
       FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
      WHERE ${whereSql}
      ORDER BY a.id DESC
      LIMIT ? OFFSET ?`,
    [...params, pageSize, offsetOf(page, pageSize)],
  );
  return paginated(rows, total, page, pageSize);
}
