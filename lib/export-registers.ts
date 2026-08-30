import type { Workspace } from '@/lib/contract-ledger-types';

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function dollars(cents: unknown) {
  return typeof cents === 'number' ? cents / 100 : 0;
}

export async function exportCurrentRegisters(workspace: Workspace) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ContractLedger AI';
  workbook.created = new Date();

  const contractSheet = workbook.addWorksheet('Contract Register', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  contractSheet.columns = [
    { header: 'Contract Number', key: 'number', width: 20 },
    { header: 'Contract Title', key: 'title', width: 38 },
    { header: 'Supplier', key: 'supplier', width: 34 },
    { header: 'Contract Type', key: 'type', width: 30 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Contract Owner', key: 'owner', width: 24 },
    { header: 'Original Value', key: 'originalValue', width: 18 },
    { header: 'Amendment Value', key: 'amendmentValue', width: 18 },
    { header: 'Current Value', key: 'currentValue', width: 18 },
    { header: 'Effective Date', key: 'effectiveDate', width: 16 },
    { header: 'Expiration Date', key: 'expirationDate', width: 16 },
    { header: 'Renewal Type', key: 'renewalType', width: 16 },
    { header: 'Notice Deadline', key: 'noticeDeadline', width: 18 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Last Updated', key: 'lastUpdated', width: 24 },
  ];
  workspace.contracts.forEach((contract) =>
    contractSheet.addRow({
      number: contract.contract_number,
      title: contract.title,
      supplier: contract.supplier_name,
      type: contract.contract_type,
      department: contract.department,
      owner: contract.owner,
      originalValue: dollars(contract.original_value_cents),
      amendmentValue: dollars(contract.amendment_value_cents),
      currentValue: dollars(contract.current_value_cents),
      effectiveDate: contract.effective_date,
      expirationDate: contract.expiration_date,
      renewalType: contract.renewal_type,
      noticeDeadline: contract.notice_deadline,
      status: contract.status,
      lastUpdated: contract.last_updated,
    }),
  );

  const supplierSheet = workbook.addWorksheet('Supplier Register', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  supplierSheet.columns = [
    { header: 'Supplier ID', key: 'id', width: 22 },
    { header: 'Legal Name', key: 'name', width: 36 },
    { header: 'Category', key: 'category', width: 26 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Primary Contact', key: 'contact', width: 24 },
    { header: 'Email', key: 'email', width: 32 },
    { header: 'Active Contracts', key: 'contractCount', width: 18 },
    { header: 'Total Current Contract Value', key: 'totalValue', width: 28 },
    { header: 'W-9 Status', key: 'w9', width: 16 },
    { header: 'Insurance Status', key: 'insurance', width: 18 },
    { header: 'Insurance Expiration', key: 'insuranceExpiration', width: 22 },
    { header: 'Last Updated', key: 'updated', width: 24 },
  ];
  workspace.suppliers.forEach((supplier) =>
    supplierSheet.addRow({
      id: supplier.id,
      name: supplier.legal_name,
      category: supplier.category,
      status: supplier.status,
      contact: supplier.primary_contact,
      email: supplier.email,
      contractCount: supplier.active_contract_count,
      totalValue: dollars(supplier.total_contract_value_cents),
      w9: supplier.w9_status,
      insurance: supplier.insurance_status,
      insuranceExpiration: supplier.insurance_expiration,
      updated: supplier.updated_at,
    }),
  );

  const exceptionSheet = workbook.addWorksheet('Data Quality Exceptions', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  exceptionSheet.columns = [
    { header: 'Record Type', key: 'recordType', width: 18 },
    { header: 'Record', key: 'record', width: 38 },
    { header: 'Exception', key: 'exception', width: 46 },
    { header: 'Priority', key: 'priority', width: 14 },
    { header: 'Next Date', key: 'date', width: 18 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Owner', key: 'owner', width: 24 },
    { header: 'Renewal Decision', key: 'decision', width: 22 },
    { header: 'Completed At', key: 'completedAt', width: 24 },
    { header: 'Notes', key: 'notes', width: 40 },
  ];
  workspace.suppliers.forEach((supplier) => {
    if (supplier.w9_status === 'missing') {
      exceptionSheet.addRow({
        recordType: 'Supplier',
        record: supplier.legal_name,
        exception: 'W-9 is missing',
        priority: 'Medium',
        date: '',
      });
    }
    if (
      supplier.insurance_status === 'missing' ||
      supplier.insurance_status === 'expired'
    ) {
      exceptionSheet.addRow({
        recordType: 'Supplier',
        record: supplier.legal_name,
        exception: 'Insurance documentation requires review',
        priority: 'High',
        date: supplier.insurance_expiration ?? '',
      });
    }
  });
  workspace.keyDates.forEach((item) =>
    exceptionSheet.addRow({
      recordType: item.contract_number ? 'Contract' : 'Supplier',
      record: item.contract_number ?? item.supplier_name,
      exception: item.title,
      priority: item.type === 'non_renewal_notice' ? 'High' : 'Medium',
      date: item.due_date,
      status: item.status,
      owner: item.owner,
      decision: item.decision,
      completedAt: item.completed_at,
      notes: item.notes,
    }),
  );

  [contractSheet, supplierSheet, exceptionSheet].forEach((sheet) => {
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF16384C' },
    };
    header.alignment = { vertical: 'middle' };
    header.height = 24;
    sheet.autoFilter = {
      from: 'A1',
      to: `${sheet.getColumn(sheet.columnCount).letter}${sheet.rowCount}`,
    };
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F6F8' },
        };
      }
      row.eachCell((cell) => {
        cell.border = {
          bottom: { style: 'hair', color: { argb: 'FFD7E1E6' } },
        };
      });
    });
  });

  ['G', 'H', 'I'].forEach((column) => {
    contractSheet.getColumn(column).numFmt = '$#,##0.00';
  });
  supplierSheet.getColumn('H').numFmt = '$#,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ContractLedger_Registers_${dateStamp()}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
