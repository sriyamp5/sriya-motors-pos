/** Unit tests for the CSV reader used by the catalogue import. Run with: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../core/csv.js';

const BOM = String.fromCharCode(0xfeff);

test('reads an Excel "CSV UTF-8" file with quotes, commas and a BOM', () => {
  const text =
    BOM +
    'Item name,Part number,Selling price\r\n"LOWER ARM ASSY (MARUTI 800,ALTO)",45200M79F11,"4,295.00"\r\n"WIPER 14""",777,500\r\n\r\n';
  const { columns, records } = parseCsv(text);
  assert.deepEqual(columns, ['Item name', 'Part number', 'Selling price']);
  assert.equal(records.length, 2);
  assert.equal(records[0]['Item name'], 'LOWER ARM ASSY (MARUTI 800,ALTO)');
  assert.equal(records[0]['Selling price'], '4,295.00');
  assert.equal(records[1]['Item name'], 'WIPER 14"');
  assert.equal(records[1]._line, 3);
});

test('accepts semicolon-separated files', () => {
  const { records } = parseCsv('Make;Model;Vehicle type\nSuzuki;Alto 800;CAR\n');
  assert.deepEqual(
    { ...records[0], _line: undefined },
    {
      Make: 'Suzuki',
      Model: 'Alto 800',
      'Vehicle type': 'CAR',
      _line: undefined,
    },
  );
});
