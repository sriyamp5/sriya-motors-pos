/**
 * End-to-end API test of the main shop workflow against a throw-away
 * database ("<DB_NAME>_test"). Run with: npm test
 *
 * Requires a reachable MySQL server configured through .env.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mysql from 'mysql2/promise';

const TEST_DB = `${process.env.DB_NAME || 'sriya_pos'}_test`;
process.env.DB_NAME = TEST_DB;
process.env.SRIYA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sriya-pos-test-'));
process.env.LOG_LEVEL = 'warn';

const { startServer } = await import('../index.js');

let server;
let baseUrl;
let adminToken;
let cashierToken;

async function api(method, url, { token, body } = {}) {
  const response = await fetch(`${baseUrl}/api${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

async function waitForDatabase() {
  for (let i = 0; i < 60; i += 1) {
    const { data } = await api('GET', '/system/status');
    if (data.database.status === 'ready') return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Database did not become ready');
}

before(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await connection.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
  await connection.end();

  server = await startServer({ port: 4690 });
  baseUrl = `http://127.0.0.1:${server.port}`;
  await waitForDatabase();
});

after(async () => {
  await server?.close();
});

const today = () => new Date().toLocaleDateString('en-CA');

test('admin must change the seeded password before using the system', async () => {
  const login = await api('POST', '/auth/login', { body: { username: 'admin', password: 'admin123' } });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.mustChangePassword, true);

  const blocked = await api('GET', '/products', { token: login.data.token });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.data.error.code, 'PASSWORD_CHANGE_REQUIRED');

  const mismatch = await api('POST', '/auth/change-password', {
    token: login.data.token,
    body: { currentPassword: 'admin123', newPassword: 'secret99', confirmPassword: 'other' },
  });
  assert.equal(mismatch.status, 422);
  assert.ok(mismatch.data.error.details.fields.confirmPassword);

  const changed = await api('POST', '/auth/change-password', {
    token: login.data.token,
    body: { currentPassword: 'admin123', newPassword: 'secret99', confirmPassword: 'secret99' },
  });
  assert.equal(changed.status, 200);
  adminToken = changed.data.token;

  const oldToken = await api('GET', '/products', { token: login.data.token });
  assert.equal(oldToken.status, 401, 'old session is invalidated after password change');
});

test('admin creates a cashier who signs in and sets a password', async () => {
  const created = await api('POST', '/users', {
    token: adminToken,
    body: {
      fullName: 'Nimal Perera',
      username: 'nimal',
      role: 'CASHIER',
      password: 'temp123',
      confirmPassword: 'temp123',
    },
  });
  assert.equal(created.status, 201);

  const duplicate = await api('POST', '/users', {
    token: adminToken,
    body: { fullName: 'Another', username: 'nimal', role: 'CASHIER', password: 'temp123', confirmPassword: 'temp123' },
  });
  assert.equal(duplicate.status, 409);

  const login = await api('POST', '/auth/login', { body: { username: 'nimal', password: 'temp123' } });
  const changed = await api('POST', '/auth/change-password', {
    token: login.data.token,
    body: { currentPassword: 'temp123', newPassword: 'nimal456', confirmPassword: 'nimal456' },
  });
  cashierToken = changed.data.token;

  const forbidden = await api('GET', '/users', { token: cashierToken });
  assert.equal(forbidden.status, 403);
});

test('the last admin cannot be demoted', async () => {
  const self = await api('PUT', '/users/1', {
    token: adminToken,
    body: { fullName: 'System Administrator', role: 'CASHIER', isActive: true },
  });
  assert.equal(self.status, 400);
});

let productId;
let supplierId;

test('product creation validates input and hides cost from cashiers', async () => {
  const invalid = await api('POST', '/products', { token: adminToken, body: { name: '' } });
  assert.equal(invalid.status, 422);
  assert.ok(invalid.data.error.details.fields.name);

  const make = await api('GET', '/vehicle-makes/options', { token: adminToken });
  const toyota = make.data.find((m) => m.name === 'Toyota');
  const model = await api('POST', '/vehicle-models', {
    token: adminToken,
    body: { makeId: toyota.id, name: 'Axio', vehicleType: 'CAR' },
  });
  assert.equal(model.status, 201);

  const categories = await api('GET', '/categories/options', { token: adminToken });
  const filters = categories.data.find((c) => c.name === 'Filters');

  const created = await api('POST', '/products', {
    token: adminToken,
    body: {
      name: 'Oil Filter',
      partNumber: '90915-YZZE1',
      barcode: '4987654321012',
      categoryId: filters.id,
      brandId: '',
      partType: 'GENUINE',
      unit: 'PCS',
      costPrice: '1000',
      sellingPrice: '1500',
      openingStock: '10',
      reorderLevel: '3',
      rackLocation: 'A-01',
      warrantyMonths: '',
      description: '',
      fitments: [{ vehicleModelId: model.data.id, yearFrom: 2012, yearTo: 2020 }],
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  productId = created.data.id;
  assert.equal(created.data.stockQty, 10);
  assert.equal(created.data.markupPercent, 50);
  assert.match(created.data.itemCode, /^SM\d{5}$/);

  const asCashier = await api('GET', `/products/${productId}`, { token: cashierToken });
  assert.equal(asCashier.data.costPrice, undefined);

  const lookup = await api('GET', '/products/lookup/4987654321012', { token: cashierToken });
  assert.equal(lookup.data.product.id, productId);

  const byVehicle = await api('GET', '/products?search=axio', { token: cashierToken });
  assert.equal(byVehicle.data.total, 1);

  const cashierCreate = await api('POST', '/products', { token: cashierToken, body: {} });
  assert.equal(cashierCreate.status, 403);
});

test('goods received increase stock and update prices', async () => {
  const supplier = await api('POST', '/suppliers', {
    token: adminToken,
    body: { name: 'Lanka Auto Distributors', phone: '0112345678' },
  });
  assert.equal(supplier.status, 201, JSON.stringify(supplier.data));
  supplierId = supplier.data.id;

  const grn = await api('POST', '/purchases', {
    token: adminToken,
    body: {
      supplierId,
      purchaseDate: today(),
      items: [{ productId, quantity: 5, unitCost: 1100, sellingPrice: 1650 }],
    },
  });
  assert.equal(grn.status, 201, JSON.stringify(grn.data));
  assert.equal(grn.data.totalAmount, 5500);

  const product = await api('GET', `/products/${productId}`, { token: adminToken });
  assert.equal(product.data.stockQty, 15);
  assert.equal(product.data.costPrice, 1100);
  assert.equal(product.data.sellingPrice, 1650);
});

let saleId;

test('cashier sells with a changed price; it is recorded for the admin', async () => {
  const belowCost = await api('POST', '/sales', {
    token: cashierToken,
    body: { items: [{ productId, quantity: 1, unitPrice: 900 }], paymentMethod: 'CASH', amountTendered: 900 },
  });
  assert.equal(belowCost.status, 422);
  assert.equal(belowCost.data.error.code, 'PRICE_BELOW_MINIMUM');

  const tooMuch = await api('POST', '/sales', {
    token: cashierToken,
    body: { items: [{ productId, quantity: 999, unitPrice: 1700 }], paymentMethod: 'CASH' },
  });
  assert.equal(tooMuch.status, 409);

  const shortCash = await api('POST', '/sales', {
    token: cashierToken,
    body: { items: [{ productId, quantity: 2, unitPrice: 1700 }], paymentMethod: 'CASH', amountTendered: 100 },
  });
  assert.equal(shortCash.status, 400);

  const sale = await api('POST', '/sales', {
    token: cashierToken,
    body: {
      items: [{ productId, quantity: 2, unitPrice: 1700, discount: 0 }],
      billDiscount: 100,
      paymentMethod: 'CASH',
      amountTendered: 5000,
    },
  });
  assert.equal(sale.status, 201, JSON.stringify(sale.data));
  saleId = sale.data.id;
  assert.equal(sale.data.totalAmount, 3300);
  assert.equal(sale.data.changeAmount, 1700);
  assert.equal(sale.data.items[0].listPrice, 1650);
  assert.equal(sale.data.items[0].unitPrice, 1700);
  assert.equal(sale.data.items[0].priceOverridden, true);
  assert.equal(sale.data.totalCost, undefined, 'cashier does not see cost');

  const asAdmin = await api('GET', `/sales/${saleId}`, { token: adminToken });
  assert.equal(asAdmin.data.totalCost, 2200);
  assert.equal(asAdmin.data.grossProfit, 1100);

  const overrides = await api('GET', `/reports/price-overrides?from=${today()}&to=${today()}`, { token: adminToken });
  assert.equal(overrides.data.totals.count, 1);
  assert.equal(overrides.data.totals.net, 100);

  const cashierReport = await api('GET', `/reports/sales-summary?from=${today()}&to=${today()}`, {
    token: cashierToken,
  });
  assert.equal(cashierReport.status, 403);

  const product = await api('GET', `/products/${productId}`, { token: adminToken });
  assert.equal(product.data.stockQty, 13);
});

test('returns refund the paid share and restock', async () => {
  const sale = await api('GET', `/sales/${saleId}`, { token: cashierToken });
  const line = sale.data.items[0];

  const tooMany = await api('POST', '/returns', {
    token: cashierToken,
    body: {
      saleId,
      refundMethod: 'CASH',
      reason: 'Wrong part',
      items: [{ saleItemId: line.id, quantity: 3, restock: true }],
    },
  });
  assert.equal(tooMany.status, 422);

  const ret = await api('POST', '/returns', {
    token: cashierToken,
    body: {
      saleId,
      refundMethod: 'CASH',
      reason: 'Wrong part',
      items: [{ saleItemId: line.id, quantity: 1, restock: true }],
    },
  });
  assert.equal(ret.status, 201, JSON.stringify(ret.data));
  // Line 3400 less a 100 bill discount = 3300 for two units.
  assert.equal(ret.data.refundAmount, 1650);

  const after = await api('GET', `/sales/${saleId}`, { token: adminToken });
  assert.equal(after.data.status, 'PARTIALLY_RETURNED');

  const product = await api('GET', `/products/${productId}`, { token: adminToken });
  assert.equal(product.data.stockQty, 14);

  const summary = await api('GET', `/reports/sales-summary?from=${today()}&to=${today()}`, { token: adminToken });
  assert.equal(summary.data.totals.refunds, 1650);
  // Gross 1100, less (refund 1650 - cost back 1100) = 550.
  assert.equal(summary.data.totals.netProfit, 550);
});

test('credit sale creates a customer balance that can be settled', async () => {
  const missingCustomer = await api('POST', '/sales', {
    token: cashierToken,
    body: { items: [{ productId, quantity: 1, unitPrice: 1650 }], paymentMethod: 'CREDIT' },
  });
  assert.equal(missingCustomer.status, 422);

  const sale = await api('POST', '/sales', {
    token: cashierToken,
    body: {
      items: [{ productId, quantity: 1, unitPrice: 1650 }],
      paymentMethod: 'CREDIT',
      customerName: 'Kamal Garage',
      customerPhone: '0771234567',
    },
  });
  assert.equal(sale.status, 201, JSON.stringify(sale.data));

  const debtors = await api('GET', '/customers/debtors', { token: adminToken });
  assert.equal(debtors.data[0].creditBalance, 1650);

  const over = await api('POST', `/customers/${sale.data.customerId}/payments`, {
    token: cashierToken,
    body: { amount: 5000, method: 'CASH' },
  });
  assert.equal(over.status, 400);

  const paid = await api('POST', `/customers/${sale.data.customerId}/payments`, {
    token: cashierToken,
    body: { amount: 650, method: 'CASH' },
  });
  assert.equal(paid.status, 201);
  assert.equal(paid.data.balance, 1000);
});

test('day closing computes expected cash', async () => {
  const summary = await api('GET', `/cash-closings/summary?date=${today()}`, { token: adminToken });
  // Cash sale 3300 + collection 650 - cash refund 1650.
  assert.equal(summary.data.expectedCashExcludingFloat, 2300);

  const closed = await api('POST', '/cash-closings', {
    token: adminToken,
    body: { businessDate: today(), openingFloat: 5000, countedCash: 7250 },
  });
  assert.equal(closed.status, 201);
  assert.equal(closed.data.closing.difference, -50);

  const again = await api('POST', '/cash-closings', {
    token: adminToken,
    body: { businessDate: today(), openingFloat: 5000, countedCash: 7250 },
  });
  assert.equal(again.status, 409);
});

test('repeating a checkout with the same reference does not create a second sale', async () => {
  const body = {
    items: [{ productId, quantity: 1, unitPrice: 1650 }],
    paymentMethod: 'CASH',
    clientRef: 'till-retry-0001',
  };
  const first = await api('POST', '/sales', { token: cashierToken, body });
  assert.equal(first.status, 201, JSON.stringify(first.data));
  const stockAfterFirst = (await api('GET', `/products/${productId}`, { token: adminToken })).data.stockQty;

  // The same request again, as after a lost reply, and two copies at the same moment.
  const results = await Promise.all([
    api('POST', '/sales', { token: cashierToken, body }),
    api('POST', '/sales', { token: cashierToken, body }),
  ]);
  for (const again of results) {
    assert.equal(again.status, 201, JSON.stringify(again.data));
    assert.equal(again.data.invoiceNo, first.data.invoiceNo);
  }
  const stockNow = (await api('GET', `/products/${productId}`, { token: adminToken })).data.stockQty;
  assert.equal(stockNow, stockAfterFirst, 'stock is reduced only once');

  const badRef = await api('POST', '/sales', { token: cashierToken, body: { ...body, clientRef: 'x' } });
  assert.equal(badRef.status, 422);
});

test('items with history cannot be deleted, only deactivated', async () => {
  const del = await api('DELETE', `/products/${productId}`, { token: adminToken });
  assert.equal(del.status, 409);
  const deactivated = await api('PATCH', `/products/${productId}/active`, {
    token: adminToken,
    body: { isActive: false },
  });
  assert.equal(deactivated.data.isActive, false);
  const lookup = await api('GET', '/products/lookup/4987654321012', { token: cashierToken });
  assert.equal(lookup.data.product, null);
});

test('backup and restore round-trip', async () => {
  const backup = await api('POST', '/backups', { token: adminToken });
  assert.equal(backup.status, 201, JSON.stringify(backup.data));

  await api('PATCH', `/products/${productId}/active`, { token: adminToken, body: { isActive: true } });

  const noConfirm = await api('POST', '/backups/restore', {
    token: adminToken,
    body: { fileName: backup.data.fileName },
  });
  assert.equal(noConfirm.status, 422);

  const restored = await api('POST', '/backups/restore', {
    token: adminToken,
    body: { fileName: backup.data.fileName, confirm: 'RESTORE' },
  });
  assert.equal(restored.status, 200, JSON.stringify(restored.data));
  await waitForDatabase();

  const product = await api('GET', `/products/${productId}`, { token: adminToken });
  assert.equal(product.data.isActive, false, 'state from the backup is back');
  const audit = await api('GET', '/audit-logs?search=PRICE_OVERRIDE', { token: adminToken });
  assert.ok(audit.data.total >= 1);

  const download = await fetch(`${baseUrl}/api/backups/${backup.data.fileName}/download`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(download.status, 200);
  assert.ok((await download.arrayBuffer()).byteLength > 100);
  const cashierDownload = await api('GET', `/backups/${backup.data.fileName}/download`, { token: cashierToken });
  assert.equal(cashierDownload.status, 403);
  const escape = await api('GET', `/backups/..%2F..%2Fconfig.json/download`, { token: adminToken });
  assert.equal(escape.status, 404);
});
