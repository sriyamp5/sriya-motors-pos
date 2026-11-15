import bcrypt from 'bcryptjs';
import { query, queryOne } from './database.js';
import { logger } from '../core/logger.js';
import { ROLES } from '../../shared/constants.js';

/**
 * Base data required for the system to be usable on the first day.
 * Every step is idempotent so it is safe to run on each start-up.
 */

export const DEFAULT_ADMIN = Object.freeze({
  username: 'admin',
  password: 'admin123',
  fullName: 'System Administrator',
});

export const DEFAULT_SETTINGS = Object.freeze({
  shop_name: 'Sriya Motors (Pvt) Ltd',
  shop_address: '',
  shop_phone: '',
  shop_email: '',
  receipt_footer: 'Thank you for your business! Goods once sold are exchangeable within 7 days with the bill.',
  receipt_printer: '',
  silent_print: 'false',
  allow_below_cost_sale: 'false',
  backup_dir: '',
  backup_keep_count: '30',
});

const DEFAULT_CATEGORIES = [
  ['Engine Parts', 'Pistons, gaskets, timing belts, mounts'],
  ['Filters', 'Oil, air, fuel and cabin filters'],
  ['Brake System', 'Pads, shoes, discs, cylinders'],
  ['Suspension & Steering', 'Shock absorbers, bushes, ball joints, rack ends'],
  ['Electrical', 'Plugs, bulbs, sensors, starters, alternators'],
  ['Cooling System', 'Radiators, water pumps, thermostats, hoses'],
  ['Clutch & Transmission', 'Clutch plates, covers, bearings, CV joints'],
  ['Lubricants & Fluids', 'Engine oil, gear oil, brake fluid, coolant'],
  ['Body Parts', 'Mirrors, lamps, bumpers, wipers'],
  ['Bearings & Seals', 'Wheel bearings, oil seals, O-rings'],
  ['Belts & Hoses', 'Fan belts, V-belts, hoses'],
  ['Tyres & Tubes', 'Tyres, tubes, valves'],
  ['Accessories', 'General accessories'],
];

const DEFAULT_MAKES = [
  'Toyota',
  'Nissan',
  'Honda',
  'Suzuki',
  'Mitsubishi',
  'Mazda',
  'Isuzu',
  'Daihatsu',
  'Hyundai',
  'Kia',
  'Mahindra',
  'Tata',
  'Perodua',
  'Micro',
  'Bajaj',
  'TVS',
  'Hero',
  'Yamaha',
];

async function seedAdmin() {
  const row = await queryOne('SELECT COUNT(*) AS total FROM users');
  if (row.total > 0) return;

  const hash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
  await query(
    `INSERT INTO users (full_name, username, password_hash, role, must_change_password)
     VALUES (?, ?, ?, ?, 1)`,
    [DEFAULT_ADMIN.fullName, DEFAULT_ADMIN.username, hash, ROLES.ADMIN],
  );
  logger.info(`Default admin account created (username "${DEFAULT_ADMIN.username}")`);
}

async function seedSettings() {
  const rows = Object.entries(DEFAULT_SETTINGS);
  await query('INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ?', [rows]);
}

async function seedReferenceData() {
  const categories = await queryOne('SELECT COUNT(*) AS total FROM categories');
  if (categories.total === 0) {
    await query('INSERT INTO categories (name, description) VALUES ?', [DEFAULT_CATEGORIES]);
  }
  const makes = await queryOne('SELECT COUNT(*) AS total FROM vehicle_makes');
  if (makes.total === 0) {
    await query('INSERT INTO vehicle_makes (name) VALUES ?', [DEFAULT_MAKES.map((m) => [m])]);
  }
}

export async function seedBaseData() {
  await seedAdmin();
  await seedSettings();
  await seedReferenceData();
}
