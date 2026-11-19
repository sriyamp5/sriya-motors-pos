/**
 * Minimal CSV reader for files saved from Excel.
 *
 * Handles a UTF-8 byte order mark, quoted values (with "" for a quote and
 * line breaks inside quotes), Windows and Unix line endings, and both comma
 * and semicolon separators (Excel uses ";" in some regional settings).
 */

/** Byte order mark that Excel writes at the start of "CSV UTF-8" files. */
const BOM = String.fromCharCode(0xfeff);

function detectDelimiter(headerLine) {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  return semicolons > commas ? ';' : ',';
}

/** Splits CSV text into rows of string cells. */
export function parseCsvRows(text) {
  const source = text.startsWith(BOM) ? text.slice(1) : text;
  const delimiter = detectDelimiter(source.split(/\r?\n/, 1)[0] ?? '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // Ignore completely empty lines (Excel often adds them at the end).
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/**
 * Parses CSV text with a header line into objects keyed by the header names.
 * Each object also gets "_line", the line number in the file, for messages.
 */
export function parseCsv(text) {
  const [header, ...rows] = parseCsvRows(text);
  if (!header) return { columns: [], records: [] };
  const columns = header.map((h) => h.trim());
  const records = rows.map((cells, index) => {
    const record = { _line: index + 2 };
    columns.forEach((column, i) => {
      record[column] = (cells[i] ?? '').trim();
    });
    return record;
  });
  return { columns, records };
}
