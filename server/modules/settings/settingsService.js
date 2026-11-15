import { query } from '../../db/database.js';
import { DEFAULT_SETTINGS } from '../../db/seed.js';

/**
 * Shop settings are stored as key/value rows. This service maps them to a
 * typed camelCase object and back.
 */

const SETTING_FIELDS = {
  shopName: { key: 'shop_name', type: 'string' },
  shopAddress: { key: 'shop_address', type: 'string' },
  shopPhone: { key: 'shop_phone', type: 'string' },
  shopEmail: { key: 'shop_email', type: 'string' },
  receiptFooter: { key: 'receipt_footer', type: 'string' },
  receiptPrinter: { key: 'receipt_printer', type: 'string' },
  silentPrint: { key: 'silent_print', type: 'boolean' },
  allowBelowCostSale: { key: 'allow_below_cost_sale', type: 'boolean' },
  backupDir: { key: 'backup_dir', type: 'string' },
  backupKeepCount: { key: 'backup_keep_count', type: 'number' },
};

/** Settings that cashiers are allowed to read (needed for printing receipts). */
const PUBLIC_FIELDS = [
  'shopName',
  'shopAddress',
  'shopPhone',
  'shopEmail',
  'receiptFooter',
  'receiptPrinter',
  'silentPrint',
];

function decode(type, raw) {
  if (type === 'boolean') return raw === 'true';
  if (type === 'number') return Number(raw);
  return raw ?? '';
}

export async function getSettings() {
  const rows = await query('SELECT setting_key, setting_value FROM settings');
  const byKey = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
  const result = {};
  for (const [field, { key, type }] of Object.entries(SETTING_FIELDS)) {
    result[field] = decode(type, byKey[key] ?? DEFAULT_SETTINGS[key]);
  }
  return result;
}

export async function getPublicSettings() {
  const all = await getSettings();
  return Object.fromEntries(PUBLIC_FIELDS.map((f) => [f, all[f]]));
}

export async function updateSettings(values) {
  const rows = Object.entries(values)
    .filter(([field]) => SETTING_FIELDS[field])
    .map(([field, value]) => [SETTING_FIELDS[field].key, value === null ? '' : String(value)]);
  if (rows.length) {
    await query(
      `INSERT INTO settings (setting_key, setting_value) VALUES ? AS incoming
       ON DUPLICATE KEY UPDATE setting_value = incoming.setting_value`,
      [rows],
    );
  }
  return getSettings();
}

/** Reads a single raw setting value (used for internal bookkeeping). */
export async function getRawSetting(key) {
  const rows = await query('SELECT setting_value FROM settings WHERE setting_key = ?', [key]);
  return rows[0]?.setting_value ?? null;
}

export async function setRawSetting(key, value) {
  await query(
    `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) AS incoming
     ON DUPLICATE KEY UPDATE setting_value = incoming.setting_value`,
    [key, value],
  );
}
