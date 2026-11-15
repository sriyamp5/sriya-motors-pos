import { query, queryOne } from '../../db/database.js';
import { notFound } from '../../core/errors.js';
import { camelize, camelizeAll, likeContains, offsetOf, paginated } from '../../core/sql.js';
import { recordAudit } from '../audit/auditService.js';

/**
 * Builds a CRUD service for simple reference tables.
 *
 * @param {object} definition
 * @param {string} definition.table        table name (also used as alias "t")
 * @param {string} definition.label        human readable entity name
 * @param {Record<string,string>} definition.columns  camelCase field -> column
 * @param {string[]} definition.searchColumns  columns matched by the search box
 * @param {string} [definition.select]     extra select expressions
 * @param {string} [definition.joins]      extra JOIN clauses
 * @param {Record<string,string>} [definition.filters] query param -> column for equality filters
 * @param {string} [definition.orderBy]
 */
export function createMasterDataService({
  table,
  label,
  columns,
  searchColumns,
  select = '',
  joins = '',
  filters = {},
  orderBy = 't.name',
}) {
  const baseSelect = `SELECT t.*${select ? `, ${select}` : ''} FROM ${table} t ${joins}`;
  const fieldEntries = Object.entries(columns);

  function buildWhere({ search, includeInactive, ...rest }) {
    const where = [includeInactive ? '1 = 1' : 't.is_active = 1'];
    const params = [];
    if (search) {
      where.push(`(${searchColumns.map((c) => `${c} LIKE ?`).join(' OR ')})`);
      searchColumns.forEach(() => params.push(likeContains(search)));
    }
    for (const [param, column] of Object.entries(filters)) {
      if (rest[param] !== undefined && rest[param] !== null && rest[param] !== '') {
        where.push(`${column} = ?`);
        params.push(rest[param]);
      }
    }
    return { whereSql: where.join(' AND '), params };
  }

  async function list(options) {
    const { page, pageSize } = options;
    const { whereSql, params } = buildWhere(options);
    const { total } = await queryOne(`SELECT COUNT(*) AS total FROM ${table} t ${joins} WHERE ${whereSql}`, params);
    const rows = await query(`${baseSelect} WHERE ${whereSql} ORDER BY t.is_active DESC, ${orderBy} LIMIT ? OFFSET ?`, [
      ...params,
      pageSize,
      offsetOf(page, pageSize),
    ]);
    return paginated(rows, total, page, pageSize);
  }

  /** Lightweight list of active records for dropdowns. */
  async function options(filterValues = {}) {
    const { whereSql, params } = buildWhere({ ...filterValues, includeInactive: false });
    return camelizeAll(await query(`${baseSelect} WHERE ${whereSql} ORDER BY ${orderBy} LIMIT 2000`, params));
  }

  async function get(id) {
    const row = await queryOne(`${baseSelect} WHERE t.id = ?`, [id]);
    if (!row) throw notFound(label);
    return camelize(row);
  }

  async function create(actor, data) {
    const cols = fieldEntries.map(([, column]) => column);
    const values = fieldEntries.map(([field]) => data[field] ?? null);
    const result = await query(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      values,
    );
    await recordAudit({
      userId: actor.id,
      action: `${table.toUpperCase()}_CREATED`,
      entityType: table,
      entityId: result.insertId,
      summary: `Created ${label.toLowerCase()} "${data.name}"`,
    });
    return get(result.insertId);
  }

  async function update(actor, id, data) {
    await get(id);
    const assignments = fieldEntries.map(([, column]) => `${column} = ?`);
    const values = fieldEntries.map(([field]) => data[field] ?? null);
    await query(`UPDATE ${table} SET ${assignments.join(', ')} WHERE id = ?`, [...values, id]);
    await recordAudit({
      userId: actor.id,
      action: `${table.toUpperCase()}_UPDATED`,
      entityType: table,
      entityId: id,
      summary: `Updated ${label.toLowerCase()} "${data.name}"`,
    });
    return get(id);
  }

  async function setActive(actor, id, isActive) {
    const record = await get(id);
    await query(`UPDATE ${table} SET is_active = ? WHERE id = ?`, [isActive, id]);
    await recordAudit({
      userId: actor.id,
      action: `${table.toUpperCase()}_${isActive ? 'ACTIVATED' : 'DEACTIVATED'}`,
      entityType: table,
      entityId: id,
      summary: `${isActive ? 'Activated' : 'Deactivated'} ${label.toLowerCase()} "${record.name}"`,
    });
    return get(id);
  }

  /** Hard delete; the database refuses it (IN_USE) when the record is referenced. */
  async function remove(actor, id) {
    const record = await get(id);
    await query(`DELETE FROM ${table} WHERE id = ?`, [id]);
    await recordAudit({
      userId: actor.id,
      action: `${table.toUpperCase()}_DELETED`,
      entityType: table,
      entityId: id,
      summary: `Deleted ${label.toLowerCase()} "${record.name}"`,
    });
  }

  return { list, options, get, create, update, setActive, remove };
}
