/**
 * Small helpers shared by services for building queries and shaping results.
 */

const snakeToCamel = (key) => key.replace(/_([a-z0-9])/g, (_m, c) => c.toUpperCase());

/** Boolean flags stored as TINYINT(1) are converted to true/false. */
const BOOLEAN_COLUMNS = new Set([
  'is_active',
  'must_change_password',
  'price_overridden',
  'has_price_override',
  'restocked',
]);

export function camelize(row) {
  if (!row) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[snakeToCamel(key)] = BOOLEAN_COLUMNS.has(key) ? Boolean(value) : value;
  }
  return out;
}

export const camelizeAll = (rows) => rows.map(camelize);

/** Escapes LIKE wildcards in user input and wraps it for a "contains" search. */
export const likeContains = (text) => `%${String(text).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Standard paginated response shape. */
export function paginated(rows, total, page, pageSize) {
  return {
    items: camelizeAll(rows),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export const offsetOf = (page, pageSize) => (page - 1) * pageSize;

/** Formats a sequential document number such as INV-000123. */
export const documentNumber = (prefix, id) => `${prefix}-${String(id).padStart(6, '0')}`;
