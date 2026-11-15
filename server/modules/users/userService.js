import bcrypt from 'bcryptjs';
import { query, queryOne, transaction } from '../../db/database.js';
import { notFound, badRequest } from '../../core/errors.js';
import { camelize, likeContains, offsetOf, paginated } from '../../core/sql.js';
import { recordAudit } from '../audit/auditService.js';
import { ROLES } from '../../../shared/constants.js';

const USER_COLUMNS = `id, full_name, username, role, is_active, must_change_password, last_login_at, created_at, updated_at`;

export async function listUsers({ search, page, pageSize, includeInactive }) {
  const where = [includeInactive ? '1 = 1' : 'is_active = 1'];
  const params = [];
  if (search) {
    where.push('(full_name LIKE ? OR username LIKE ?)');
    params.push(likeContains(search), likeContains(search));
  }
  const whereSql = where.join(' AND ');
  const { total } = await queryOne(`SELECT COUNT(*) AS total FROM users WHERE ${whereSql}`, params);
  const rows = await query(
    `SELECT ${USER_COLUMNS} FROM users WHERE ${whereSql} ORDER BY is_active DESC, full_name LIMIT ? OFFSET ?`,
    [...params, pageSize, offsetOf(page, pageSize)],
  );
  return paginated(rows, total, page, pageSize);
}

export async function getUser(id) {
  const row = await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);
  if (!row) throw notFound('User');
  return camelize(row);
}

export async function createUser(actor, { fullName, username, role, password }) {
  const hash = await bcrypt.hash(password, 10);
  // New users choose their own password on first sign-in.
  const result = await query(
    `INSERT INTO users (full_name, username, password_hash, role, must_change_password) VALUES (?, ?, ?, ?, 1)`,
    [fullName, username, hash, role],
  );
  await recordAudit({
    userId: actor.id,
    action: 'USER_CREATED',
    entityType: 'user',
    entityId: result.insertId,
    summary: `Created ${role.toLowerCase()} account "${username}"`,
  });
  return getUser(result.insertId);
}

/**
 * Prevents changes that would leave the shop without an active admin or lock
 * the current admin out of their own account.
 */
async function assertAdminSafety(tx, actor, target, { role, isActive }) {
  const losesAdmin = target.role === ROLES.ADMIN && (role !== ROLES.ADMIN || !isActive);
  if (!losesAdmin) return;

  if (target.id === actor.id) {
    throw badRequest('You cannot remove your own admin access or deactivate your own account.');
  }
  const { activeAdmins } = await tx.queryOne(
    `SELECT COUNT(*) AS activeAdmins FROM users WHERE role = 'ADMIN' AND is_active = 1 FOR UPDATE`,
  );
  if (activeAdmins <= 1) {
    throw badRequest('At least one active admin account is required.');
  }
}

export async function updateUser(actor, id, { fullName, role, isActive }) {
  await transaction(async (tx) => {
    const target = await tx.queryOne('SELECT id, username, role, is_active FROM users WHERE id = ? FOR UPDATE', [id]);
    if (!target) throw notFound('User');
    await assertAdminSafety(tx, actor, target, { role, isActive });

    const sessionInvalidated = target.role !== role || (target.is_active && !isActive);
    await tx.query(
      `UPDATE users SET full_name = ?, role = ?, is_active = ?,
              token_version = token_version + ? WHERE id = ?`,
      [fullName, role, isActive, sessionInvalidated ? 1 : 0, id],
    );

    const changes = [];
    if (target.role !== role) changes.push(`role ${target.role} → ${role}`);
    if (Boolean(target.is_active) !== isActive) changes.push(isActive ? 'activated' : 'deactivated');
    await recordAudit(
      {
        userId: actor.id,
        action: 'USER_UPDATED',
        entityType: 'user',
        entityId: id,
        summary: `Updated user "${target.username}"${changes.length ? ` (${changes.join(', ')})` : ''}`,
      },
      tx,
    );
  });
  return getUser(id);
}

export async function resetPassword(actor, id, { newPassword }) {
  const target = await queryOne('SELECT id, username FROM users WHERE id = ?', [id]);
  if (!target) throw notFound('User');

  const hash = await bcrypt.hash(newPassword, 10);
  await query(
    `UPDATE users SET password_hash = ?, must_change_password = ?, token_version = token_version + 1 WHERE id = ?`,
    [hash, target.id === actor.id ? 0 : 1, id],
  );
  await recordAudit({
    userId: actor.id,
    action: 'PASSWORD_RESET',
    entityType: 'user',
    entityId: id,
    summary: `Reset password for "${target.username}"`,
  });
}
