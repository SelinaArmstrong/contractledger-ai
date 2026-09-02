function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export async function assertContractFileSignature(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.txt')) {
    if (file.type && file.type !== 'text/plain') {
      throw new Error('The selected text file has an unsupported media type.');
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.includes(0))
      throw new Error('The selected text file contains binary data.');
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new Error('Contract text files must use UTF-8 encoding.');
    }
    return 'text' as const;
  }

  if (!name.endsWith('.pdf'))
    throw new Error('Choose a PDF or UTF-8 TXT contract file.');
  if (file.type && file.type !== 'application/pdf')
    throw new Error('The selected PDF has an unsupported media type.');

  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (!startsWith(header, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    throw new Error('The selected contract is not a valid PDF file.');
  }
  return 'pdf' as const;
}

export async function assertSupplierFileSignature(file: File) {
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const valid =
    (file.type === 'application/pdf' &&
      startsWith(header, [0x25, 0x50, 0x44, 0x46, 0x2d])) ||
    (file.type === 'image/png' &&
      startsWith(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (file.type === 'image/jpeg' && startsWith(header, [0xff, 0xd8, 0xff]));

  if (!valid) {
    throw new Error(
      'The file content does not match its declared PDF or image type.',
    );
  }
}

export async function assertImportFileSignature(file: File) {
  const name = file.name.toLowerCase();
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (name.endsWith('.xlsx')) {
    if (!startsWith(header, [0x50, 0x4b, 0x03, 0x04])) {
      throw new Error('The selected workbook is not a valid XLSX file.');
    }
    return 'xlsx' as const;
  }
  if (!name.endsWith('.csv')) {
    throw new Error('Choose a CSV or XLSX import file.');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.includes(0))
    throw new Error('The selected CSV contains binary data.');
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('CSV imports must use UTF-8 encoding.');
  }
  return 'csv' as const;
}
