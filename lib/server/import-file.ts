const MAX_IMPORT_COLUMNS = 100;

function parseCsvText(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }
    if (character === '"' && !value) quoted = true;
    else if (character === ',') {
      row.push(value);
      value = '';
    } else if (character === '\n') {
      row.push(value.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      value = '';
    } else value += character;
  }
  if (quoted) throw new Error('The CSV contains an unterminated quoted value.');
  if (value || row.length) {
    row.push(value.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

function cellText(value: unknown) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const candidate = value as {
      formula?: string;
      sharedFormula?: string;
      result?: unknown;
      text?: string;
      hyperlink?: string;
    };
    if (candidate.formula || candidate.sharedFormula)
      return `=${candidate.formula ?? candidate.sharedFormula}`;
    return cellText(
      candidate.text ?? candidate.result ?? candidate.hyperlink ?? '',
    );
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
    return String(value);
  return '';
}

function rectangularRows(rows: string[][]) {
  const nonempty = rows.filter((row) => row.some((value) => value.trim()));
  if (nonempty.length < 2)
    throw new Error(
      'The import file must contain a header and at least one data row.',
    );
  const headers = nonempty[0].map((value) => value.trim());
  if (headers.length > MAX_IMPORT_COLUMNS)
    throw new Error(
      `Import files may contain at most ${MAX_IMPORT_COLUMNS} columns.`,
    );
  if (headers.some((header) => !header))
    throw new Error('Every import column must have a header.');
  if (headers.some((header) => /^[=+@-]/.test(header)))
    throw new Error(
      'Import column headers cannot begin with spreadsheet formula characters.',
    );
  const normalized = headers.map((header) => header.toLowerCase());
  if (new Set(normalized).size !== normalized.length)
    throw new Error('Import column headers must be unique.');
  const records = nonempty
    .slice(1)
    .map((values) =>
      Object.fromEntries(
        headers.map((header, index) => [header, (values[index] ?? '').trim()]),
      ),
    );
  return { headers, records };
}

export async function parseImportFile(file: File, fileType: 'csv' | 'xlsx') {
  if (fileType === 'csv') {
    const text = new TextDecoder()
      .decode(await file.arrayBuffer())
      .replace(/^\uFEFF/, '');
    return rectangularRows(parseCsvText(text));
  }
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(await file.arrayBuffer()) as never);
  if (workbook.worksheets.length !== 1)
    throw new Error('XLSX imports must contain exactly one worksheet.');
  const worksheet = workbook.worksheets[0];
  const rows: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (worksheetRow) => {
    const values: string[] = [];
    for (let column = 1; column <= worksheet.columnCount; column += 1)
      values.push(cellText(worksheetRow.getCell(column).value));
    rows.push(values);
  });
  return rectangularRows(rows);
}

export async function importFileHash(file: File) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    await file.arrayBuffer(),
  );
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}
