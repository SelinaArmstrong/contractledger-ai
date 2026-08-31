function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export async function assertContractFileSignature(file: File) {
  if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
    return;
  }

  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (!startsWith(header, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    throw new Error('The selected contract is not a valid PDF file.');
  }
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
    throw new Error('The file content does not match its declared PDF or image type.');
  }
}
