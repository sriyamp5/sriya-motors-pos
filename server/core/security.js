import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { AppError } from './errors.js';

/**
 * Protection used when the system is published on the internet (web mode).
 * The desktop application only listens on 127.0.0.1 and does not need it.
 */

/** Hashes of the inline scripts in index.html, so the CSP can allow exactly those and nothing else. */
function inlineScriptHashes(staticDir) {
  try {
    const html = fs.readFileSync(path.join(staticDir, 'index.html'), 'utf8');
    return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(
      ([, body]) => `'sha256-${crypto.createHash('sha256').update(body).digest('base64')}'`,
    );
  } catch {
    return [];
  }
}

/**
 * Standard browser security headers. HTTPS itself (and HSTS) is handled by
 * the reverse proxy in front of the application.
 */
export function securityHeaders({ staticDir } = {}) {
  const scriptSources = ["'self'", ...(staticDir ? inlineScriptHashes(staticDir) : [])].join(' ');
  const csp = [
    "default-src 'self'",
    `script-src ${scriptSources}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self' about:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  return (_req, res, next) => {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
  };
}

/**
 * Limits how often one IP address may try to sign in. Works together with the
 * per-account lock in the auth service: that stops guessing one password,
 * this stops one address trying many accounts.
 *
 * @param {object} [options]
 * @param {number} [options.max]      attempts allowed per window
 * @param {number} [options.windowMs] window length
 */
export function loginRateLimit({ max = 20, windowMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of attempts) if (entry.resetAt <= now) attempts.delete(ip);
  }, windowMs);
  cleanup.unref?.();

  return (req, _res, next) => {
    const now = Date.now();
    const ip = req.ip ?? 'unknown';
    let entry = attempts.get(ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      attempts.set(ip, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      const minutes = Math.ceil((entry.resetAt - now) / 60000);
      throw new AppError(
        429,
        'TOO_MANY_ATTEMPTS',
        `Too many sign-in attempts. Please try again in ${minutes} minute(s).`,
      );
    }
    next();
  };
}
