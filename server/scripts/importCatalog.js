/**
 * Imports vehicles, brands or items from a CSV file (saved from Excel as
 * "CSV UTF-8"). Import in this order: vehicles, brands, then items, because
 * items refer to the vehicles and brands by name.
 *
 * Usage (from the project folder):
 *   node --env-file=.env server/scripts/importCatalog.js vehicles vehicles.csv           check only
 *   node --env-file=.env server/scripts/importCatalog.js vehicles vehicles.csv --apply   save
 *
 * Without --apply nothing is changed: the file is only checked and a summary
 * is printed. With --apply a database backup is taken first. Rows that
 * already exist are skipped, so running the same file twice is safe.
 *
 * Columns (header names, any order; other columns are ignored):
 *   vehicles  Make, Model, Vehicle type
 *   brands    Brand, Country
 *   items     Item name, Part number, Category, Brand, Part type, Unit, Vehicles,
 *             Buying price, Selling price, Opening stock, Low stock level, Rack, Description
 *             Vehicles: "Make: Model" pairs separated by ";", e.g. "Suzuki: Alto 800; Suzuki: Alto K10"
 *
 * See docs/IMPORTING_ITEMS.md.
 */
import fs from 'node:fs';
import { initDatabase, query, queryOne, shutdownDatabase, getDbState } from '../db/database.js';
import { runMigrations } from '../db/migrator.js';
import { seedBaseData } from '../db/seed.js';
import { createBackup } from '../modules/backup/backupService.js';
import { createProduct } from '../modules/products/productService.js';
import { createProductSchema, toFieldErrors } from '../../shared/schemas/index.js';
import { PART_TYPES, UNITS, VEHICLE_TYPES } from '../../shared/constants.js';
import { parseCsv } from '../core/csv.js';

const KINDS = ['vehicles', 'brands', 'items'];
const MAX_PROBLEMS_SHOWN = 30;

/* ------------------------------------------------------------ Helpers --- */

const key = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

/** Reads a column by any of its accepted names (case-insensitive). */
function column(record, ...names) {
  for (const [name, value] of Object.entries(record)) {
    if (names.some((n) => key(n) === key(name))) return value;
  }
  return '';
}

/** "Three wheeler", "three-wheeler" and "THREE_WHEELER" all become THREE_WHEELER. */
function toCode(value, allowed, fallback) {
  const code = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (!code) return fallback;
  return Object.values(allowed).includes(code) ? code : null;
}

/** "7,995.00" or "Rs. 7995" become 7995; empty stays empty for the validator. */
const toNumber = (value) => String(value ?? '').replace(/rs\.?|,|\s/gi, '');

async function loadIndex(sql) {
  const rows = await query(sql);
  return new Map(rows.map((r) => [key(r.name), r.id]));
}

function report(title, problems) {
  if (!problems.length) return;
  console.log(`\n${title} (${problems.length}):`);
  for (const p of problems.slice(0, MAX_PROBLEMS_SHOWN)) console.log(`  line ${p.line}: ${p.message}`);
  if (problems.length > MAX_PROBLEMS_SHOWN) console.log(`  ... and ${problems.length - MAX_PROBLEMS_SHOWN} more`);
}

/* ----------------------------------------------------------- Vehicles --- */

async function importVehicles(records, apply) {
  const makes = await loadIndex('SELECT id, name FROM vehicle_makes');
  const models = new Map(
    (await query('SELECT make_id, name FROM vehicle_models')).map((r) => [`${r.make_id}|${key(r.name)}`, true]),
  );
  const problems = [];
  const plannedMakes = new Set();
  const plannedModels = new Set();
  let createdMakes = 0;
  let createdModels = 0;
  let existing = 0;

  for (const record of records) {
    const make = column(record, 'Make');
    const model = column(record, 'Model');
    const type = toCode(column(record, 'Vehicle type', 'Type'), VEHICLE_TYPES, VEHICLE_TYPES.CAR);
    if (!make || !model) {
      problems.push({ line: record._line, message: 'Make and Model are required.' });
      continue;
    }
    if (make.length > 60 || model.length > 80) {
      problems.push({ line: record._line, message: 'Make or Model name is too long.' });
      continue;
    }
    if (!type) {
      problems.push({
        line: record._line,
        message: `Unknown vehicle type. Use one of: ${Object.values(VEHICLE_TYPES).join(', ')}`,
      });
      continue;
    }

    let makeId = makes.get(key(make));
    if (!makeId && !plannedMakes.has(key(make))) {
      plannedMakes.add(key(make));
      createdMakes += 1;
      if (apply) {
        makeId = (await query('INSERT INTO vehicle_makes (name) VALUES (?)', [make])).insertId;
        makes.set(key(make), makeId);
      }
    }

    const modelKey = `${makeId ?? key(make)}|${key(model)}`;
    if (models.has(modelKey) || plannedModels.has(modelKey)) {
      existing += 1;
      continue;
    }
    plannedModels.add(modelKey);
    createdModels += 1;
    if (apply) {
      await query('INSERT INTO vehicle_models (make_id, name, vehicle_type) VALUES (?, ?, ?)', [makeId, model, type]);
      models.set(modelKey, true);
    }
  }

  return {
    summary: `${createdMakes} new make(s), ${createdModels} new model(s), ${existing} already existed`,
    problems,
  };
}

/* ------------------------------------------------------------- Brands --- */

async function importBrands(records, apply) {
  const brands = await loadIndex('SELECT id, name FROM brands');
  const problems = [];
  let created = 0;
  let existing = 0;

  for (const record of records) {
    const name = column(record, 'Brand', 'Name');
    const country = column(record, 'Country') || null;
    if (!name || name.length > 100) {
      problems.push({ line: record._line, message: 'Brand name is required (up to 100 characters).' });
      continue;
    }
    if (brands.has(key(name))) {
      existing += 1;
      continue;
    }
    brands.set(key(name), true);
    created += 1;
    if (apply) await query('INSERT INTO brands (name, country) VALUES (?, ?)', [name, country]);
  }
  return { summary: `${created} new brand(s), ${existing} already existed`, problems };
}

/* -------------------------------------------------------------- Items --- */

async function importItems(records, apply) {
  const categories = await loadIndex('SELECT id, name FROM categories');
  const brands = await loadIndex('SELECT id, name FROM brands');
  const models = new Map(
    (
      await query(
        `SELECT m.id, mk.name AS make, m.name AS model
           FROM vehicle_models m JOIN vehicle_makes mk ON mk.id = m.make_id`,
      )
    ).map((r) => [`${key(r.make)}:${key(r.model)}`, r.id]),
  );
  // An item is the same when both its name and part number match.
  const existingItems = new Set(
    (await query('SELECT name, part_number FROM products')).map((r) => `${key(r.name)}|${key(r.part_number)}`),
  );
  const admin = await queryOne(`SELECT id FROM users WHERE role = 'ADMIN' AND is_active = 1 ORDER BY id LIMIT 1`);
  if (!admin) throw new Error('No active admin user found.');

  const problems = [];
  const ready = [];
  let existing = 0;

  for (const record of records) {
    const line = record._line;
    const name = column(record, 'Item name', 'Name');
    const partNumber = column(record, 'Part number', 'Part no');
    const itemKey = `${key(name)}|${key(partNumber)}`;
    if (existingItems.has(itemKey)) {
      existing += 1;
      continue;
    }

    const categoryName = column(record, 'Category');
    const categoryId = categories.get(key(categoryName));
    if (!categoryId) {
      problems.push({ line, message: `Category "${categoryName}" does not exist. Create it first or use "Other".` });
      continue;
    }

    const brandName = column(record, 'Brand');
    const brandId = brandName ? brands.get(key(brandName)) : '';
    if (brandName && !brandId) {
      problems.push({ line, message: `Brand "${brandName}" does not exist. Import brands first.` });
      continue;
    }

    const fitments = [];
    const missingVehicles = [];
    for (const pair of column(record, 'Vehicles').split(';')) {
      if (!pair.trim()) continue;
      const [make, ...rest] = pair.split(':');
      const id = models.get(`${key(make)}:${key(rest.join(':'))}`);
      if (id) {
        if (!fitments.some((f) => f.vehicleModelId === id))
          fitments.push({ vehicleModelId: id, yearFrom: '', yearTo: '' });
      } else missingVehicles.push(pair.trim());
    }
    if (missingVehicles.length) {
      problems.push({ line, message: `Vehicle(s) not found: ${missingVehicles.join(', ')}. Import vehicles first.` });
      continue;
    }

    const partType = toCode(column(record, 'Part type'), PART_TYPES, PART_TYPES.AFTERMARKET);
    const unit = toCode(column(record, 'Unit'), UNITS, UNITS.PCS);
    const parsed = createProductSchema.safeParse({
      name,
      partNumber,
      barcode: '',
      categoryId,
      brandId,
      partType: partType ?? 'invalid',
      unit: unit ?? 'invalid',
      costPrice: toNumber(column(record, 'Buying price', 'Cost price')) || '0',
      sellingPrice: toNumber(column(record, 'Selling price')),
      openingStock: toNumber(column(record, 'Opening stock', 'Quantity')) || '0',
      reorderLevel: toNumber(column(record, 'Low stock level', 'Reorder level')) || '0',
      rackLocation: column(record, 'Rack', 'Rack location'),
      warrantyMonths: '',
      description: column(record, 'Description'),
      fitments,
    });
    if (!parsed.success) {
      const message = Object.entries(toFieldErrors(parsed.error))
        .map(([field, text]) => `${field}: ${text}`)
        .join('; ');
      problems.push({ line, message: `"${name}": ${message}` });
      continue;
    }
    existingItems.add(itemKey);
    ready.push(parsed.data);
  }

  if (apply) {
    // Created one by one in file order, so item codes follow the order of the file.
    for (const data of ready) await createProduct({ id: admin.id }, data);
  }
  return { summary: `${ready.length} new item(s), ${existing} already existed`, problems };
}

/* --------------------------------------------------------------- Main --- */

async function main() {
  const [kind, file, ...flags] = process.argv.slice(2);
  const apply = flags.includes('--apply');
  if (!KINDS.includes(kind) || !file) {
    console.log(
      'Usage: node --env-file=.env server/scripts/importCatalog.js <vehicles|brands|items> <file.csv> [--apply]',
    );
    process.exitCode = 1;
    return;
  }
  if (!fs.existsSync(file)) throw new Error(`File not found: ${file}`);

  const { records } = parseCsv(fs.readFileSync(file, 'utf8'));
  console.log(`${records.length} row(s) read from ${file}`);

  await initDatabase(async () => {
    await runMigrations();
    await seedBaseData();
  });
  const state = getDbState();
  if (state.status !== 'ready') throw new Error(`Database not available: ${state.message}`);

  if (apply) {
    const backup = await createBackup('pre-import');
    console.log(`Backup taken first: ${backup.fileName}`);
  }

  const run = { vehicles: importVehicles, brands: importBrands, items: importItems }[kind];
  const { summary, problems } = await run(records, apply);

  report('Rows with problems (not imported)', problems);
  console.log(`\n${apply ? 'Imported' : 'Check only, nothing saved'}: ${summary}.`);
  if (!apply) console.log('Run again with --apply to save.');
}

main()
  .catch((error) => {
    console.error(`Import failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(shutdownDatabase);
