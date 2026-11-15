import jwt from 'jsonwebtoken';
import { getConfig } from '../config/appConfig.js';
import { queryOne } from '../db/database.js';
import { unauthorized, forbidden, AppError } from '../core/errors.js';

const TOKEN_TTL = '14h';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, tv: user.token_version }, getConfig().jwtSecret, {
    expiresIn: TOKEN_TTL,
  });
}

/**
 * Verifies the bearer token and loads the current user record, so that a
 * deactivated user, a role change or a password reset takes effect on the
 * very next request.
 */
export async function authenticate(req, _res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, getConfig().jwtSecret);
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.');
  }

  const user = await queryOne(
    `SELECT id, full_name, username, role, is_active, must_change_password, token_version
       FROM users WHERE id = ?`,
    [payload.sub],
  );
  if (!user || !user.is_active || user.token_version !== payload.tv) {
    throw unauthorized('Your session is no longer valid. Please sign in again.');
  }

  req.user = {
    id: user.id,
    fullName: user.full_name,
    username: user.username,
    role: user.role,
    mustChangePassword: Boolean(user.must_change_password),
  };
  next();
}

/** Blocks everything except changing the password until a forced change is done. */
export function requirePasswordChanged(req, _res, next) {
  if (req.user?.mustChangePassword) {
    throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Please change your password to continue.');
  }
  next();
}

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user?.role)) throw forbidden();
    next();
  };
