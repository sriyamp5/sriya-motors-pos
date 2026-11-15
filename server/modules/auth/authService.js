import bcrypt from 'bcryptjs';
import { query, queryOne } from '../../db/database.js';
import { signToken } from '../../middleware/auth.js';
import { AppError, unauthorized, badRequest } from '../../core/errors.js';
import { recordAudit } from '../audit/auditService.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

/** In-memory failed login counter. Resets when the application restarts. */
const failedAttempts = new Map();

function assertNotLocked(username) {
  const entry = failedAttempts.get(username);
  if (entry?.lockedUntil && entry.lockedUntil > Date.now()) {
    const minutes = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
    throw new AppError(
      429,
      'ACCOUNT_LOCKED',
      `Too many failed attempts. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`,
    );
  }
}

function registerFailure(username) {
  const entry = failedAttempts.get(username) ?? { count: 0, lockedUntil: null };
  entry.count += 1;
  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
    entry.count = 0;
  }
  failedAttempts.set(username, entry);
}

export const toSessionUser = (user) => ({
  id: user.id,
  fullName: user.full_name,
  username: user.username,
  role: user.role,
  mustChangePassword: Boolean(user.must_change_password),
});

export async function login({ username, password }) {
  assertNotLocked(username);

  const user = await queryOne(
    `SELECT id, full_name, username, password_hash, role, is_active, must_change_password, token_version
       FROM users WHERE username = ?`,
    [username],
  );

  const passwordOk = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!user || !passwordOk) {
    registerFailure(username);
    throw unauthorized('Incorrect username or password.');
  }
  if (!user.is_active) {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled. Please contact the admin.');
  }

  failedAttempts.delete(username);
  await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  await recordAudit({
    userId: user.id,
    action: 'LOGIN',
    entityType: 'user',
    entityId: user.id,
    summary: `${user.username} signed in`,
  });

  return { token: signToken(user), user: toSessionUser(user) };
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await queryOne('SELECT id, username, password_hash FROM users WHERE id = ?', [userId]);
  if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
    throw badRequest('The current password is incorrect.', {
      fields: { currentPassword: 'The current password is incorrect' },
    });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  // Bumping token_version signs out other sessions that used the old password.
  await query(
    `UPDATE users SET password_hash = ?, must_change_password = 0, token_version = token_version + 1 WHERE id = ?`,
    [hash, userId],
  );
  await recordAudit({
    userId,
    action: 'PASSWORD_CHANGED',
    entityType: 'user',
    entityId: userId,
    summary: `${user.username} changed their password`,
  });

  const updated = await queryOne(
    'SELECT id, full_name, username, role, must_change_password, token_version FROM users WHERE id = ?',
    [userId],
  );
  return { token: signToken(updated), user: toSessionUser(updated) };
}
