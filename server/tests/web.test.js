/**
 * Checks the protections that apply when the system is hosted online
 * (SRIYA_MODE=web). Uses its own throw-away database "<DB_NAME>_webtest".
 * Run with: npm test
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mysql from 'mysql2/promise';

const TEST_DB = `${process.env.DB_NAME || 'sriya_pos'}_webtest`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sriya-pos-webtest-'));
const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sriya-pos-webtest-ui-'));
fs.writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><script>window.x=1</script><div id="root"></div>');

process.env.DB_NAME = TEST_DB;
process.env.SRIYA_MODE = 'web';
process.env.SRIYA_DATA_DIR = dataDir;
process.env.JWT_SECRET = 'web-test-secret-that-is-long-enough-0123456789';
process.env.LOG_LEVEL = 'warn';

const { startServer } = await import('../index.js');

let server;
let baseUrl;

const call = (method, url, body) =>
  fetch(`${baseUrl}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

before(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await connection.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
  await connection.end();

  server = await startServer({ port: 4691, staticDir });
  baseUrl = `http://127.0.0.1:${server.port}`;
  for (let i = 0; i < 60; i += 1) {
    const status = await (await call('GET', '/api/system/status')).json();
    if (status.database.status === 'ready') return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Database did not become ready');
});

after(async () => {
  await server?.close();
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await connection.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
  await connection.end();
});

test('status reports web mode without revealing database details', async () => {
  const status = await (await call('GET', '/api/system/status')).json();
  assert.equal(status.mode, 'web');
  assert.equal(status.database.needsSetup, false);
  assert.equal(status.database.host, undefined);
  assert.equal(status.database.user, undefined);
});

test('database settings cannot be changed from the browser', async () => {
  const response = await call('POST', '/api/system/database', {
    host: 'evil.example.com',
    port: 3306,
    user: 'x',
    password: 'x',
    database: 'x',
  });
  assert.equal(response.status, 403);
});

test('security headers are sent and the inline theme script is allowed by hash', async () => {
  const response = await call('GET', '/');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cache-control'), 'no-cache');
  const csp = response.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self' 'sha256-[A-Za-z0-9+/=]+'/);
  assert.match(csp, /frame-ancestors 'none'/);
});

test('backups cannot be restored from an arbitrary server path', async () => {
  const login = await (await call('POST', '/api/auth/login', { username: 'admin', password: 'admin123' })).json();
  const changed = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` },
    body: JSON.stringify({ currentPassword: 'admin123', newPassword: 'secret99', confirmPassword: 'secret99' }),
  }).then((r) => r.json());

  const response = await fetch(`${baseUrl}/api/backups/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${changed.token}` },
    body: JSON.stringify({ filePath: '/etc/passwd.sql.gz', confirm: 'RESTORE' }),
  });
  assert.equal(response.status, 400);
});

test('repeated failed sign-ins from one address are slowed down', async () => {
  let last;
  for (let i = 0; i < 25; i += 1) {
    last = await call('POST', '/api/auth/login', { username: `nobody${i}`, password: 'wrong-password' });
  }
  assert.equal(last.status, 429);
  const body = await last.json();
  assert.equal(body.error.code, 'TOO_MANY_ATTEMPTS');
});
