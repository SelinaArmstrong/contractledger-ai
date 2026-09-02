import type { Workspace } from '@/lib/contract-ledger-types';

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function dollars(cents: unknown) {
  return typeof cents === 'number' ? cents / 100 : 0;
}

export async function exportCurrentRegisters(
  workspace: Workspace,
  scope: 'all' | 'suppliers' = 'all',
) {
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
    { header: 'Current Version', key: 'currentVersion', width: 16 },
    { header: 'Amendment Count', key: 'amendmentCount', width: 18 },
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
    { header: 'Next Obligation Date', key: 'nextObligationDate', width: 20 },
    { header: 'Open Obligations', key: 'openObligations', width: 18 },
    { header: 'Payment Terms', key: 'paymentTerms', width: 18 },
    { header: 'Governing Law', key: 'governingLaw', width: 20 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Last Updated', key: 'lastUpdated', width: 24 },
  ];
  workspace.contracts.forEach((contract) =>
    contractSheet.addRow({
      number: contract.contract_number,
      title: contract.title,
      currentVersion: contract.current_version ?? 1,
      amendmentCount: contract.amendment_count ?? 0,
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
      nextObligationDate: contract.next_obligation_date,
      openObligations: contract.open_obligation_count,
      paymentTerms: contract.payment_terms,
      governingLaw: contract.governing_law,
      status: contract.status,
      lastUpdated: contract.last_updated,
    }),
  );

  const supplierSheet = workbook.addWorksheet('Supplier Register', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  supplierSheet.columns = [
    { header: 'Supplier ID', key: 'id', width: 22 },
    { header: 'Vendor Number', key: 'vendorNumber', width: 18 },
    { header: 'Legal Name', key: 'name', width: 36 },
    { header: 'DBA Name', key: 'dba', width: 28 },
    { header: 'Category', key: 'category', width: 26 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Primary Contact', key: 'contact', width: 24 },
    { header: 'Email', key: 'email', width: 32 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Website', key: 'website', width: 32 },
    { header: 'Address', key: 'address', width: 42 },
    { header: 'Tax Classification', key: 'taxClassification', width: 22 },
    { header: 'Risk Tier', key: 'riskTier', width: 14 },
    { header: 'Relationship Stage', key: 'relationshipStage', width: 20 },
    { header: 'Documentation Status', key: 'qualificationStatus', width: 22 },
    {
      header: 'Documentation Review Date',
      key: 'qualificationReviewDate',
      width: 24,
    },
    { header: 'Active Contracts', key: 'contractCount', width: 18 },
    { header: 'Total Current Contract Value', key: 'totalValue', width: 28 },
    { header: 'Linked Contracts', key: 'linkedContracts', width: 54 },
    { header: 'Linked Contract Intakes', key: 'linkedIntakes', width: 54 },
    { header: 'W-9 Status', key: 'w9', width: 16 },
    { header: 'Insurance Status', key: 'insurance', width: 18 },
    { header: 'Insurance Expiration', key: 'insuranceExpiration', width: 22 },
    { header: 'Supplier Files', key: 'qualificationFiles', width: 20 },
    {
      header: 'Expired Supplier Files',
      key: 'expiredQualificationFiles',
      width: 24,
    },
    {
      header: 'Next Compliance Expiration',
      key: 'nextDocumentExpiration',
      width: 24,
    },
    { header: 'Last Updated', key: 'updated', width: 24 },
  ];
  workspace.suppliers.forEach((supplier) =>
    supplierSheet.addRow({
      id: supplier.id,
      vendorNumber: supplier.vendor_number,
      name: supplier.legal_name,
      dba: supplier.dba_name,
      category: supplier.category,
      status: supplier.status,
      contact: supplier.primary_contact,
      email: supplier.email,
      phone: supplier.phone,
      website: supplier.website,
      address: [
        supplier.address_line1,
        supplier.address_line2,
        supplier.city,
        supplier.state,
        supplier.postal_code,
        supplier.country,
      ]
        .filter(Boolean)
        .join(', '),
      taxClassification: supplier.tax_classification,
      riskTier: supplier.risk_tier,
      relationshipStage: supplier.relationship_stage,
      qualificationStatus: supplier.qualification_status,
      qualificationReviewDate: supplier.qualification_review_date,
      contractCount: supplier.active_contract_count,
      totalValue: dollars(supplier.total_contract_value_cents),
      linkedContracts:
        typeof supplier.linked_contracts === 'string'
          ? supplier.linked_contracts.replaceAll('||', '\n')
          : '',
      linkedIntakes:
        typeof supplier.linked_intakes === 'string'
          ? supplier.linked_intakes.replaceAll('||', '\n')
          : '',
      w9: supplier.w9_status,
      insurance: supplier.insurance_status,
      insuranceExpiration: supplier.insurance_expiration,
      qualificationFiles: supplier.qualification_document_count,
      expiredQualificationFiles: supplier.expired_qualification_document_count,
      nextDocumentExpiration: supplier.next_compliance_expiration,
      updated: supplier.updated_at,
    }),
  );

  const supplierDocumentSheet = workbook.addWorksheet('Supplier Documents', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  supplierDocumentSheet.columns = [
    { header: 'Supplier', key: 'supplier', width: 36 },
    { header: 'Vendor Number', key: 'vendorNumber', width: 18 },
    { header: 'File Type', key: 'fileType', width: 30 },
    { header: 'File Name', key: 'fileName', width: 46 },
    { header: 'Issuer', key: 'issuer', width: 34 },
    { header: 'Document Number', key: 'documentNumber', width: 24 },
    { header: 'Effective Date', key: 'effectiveDate', width: 18 },
    { header: 'Expiration Date', key: 'expirationDate', width: 18 },
    { header: 'Documentation Status', key: 'reviewStatus', width: 22 },
    { header: 'AI Processing Status', key: 'aiStatus', width: 20 },
    { header: 'Coverage / Qualification Summary', key: 'summary', width: 54 },
    { header: 'Uploaded At', key: 'uploadedAt', width: 24 },
  ];
  workspace.supplierDocuments.forEach((document) =>
    supplierDocumentSheet.addRow({
      supplier: document.supplier_name,
      vendorNumber: document.vendor_number,
      fileType: document.file_type,
      fileName: document.file_name,
      issuer: document.issuer,
      documentNumber: document.document_number,
      effectiveDate: document.effective_date,
      expirationDate: document.expiration_date,
      reviewStatus: document.review_status,
      aiStatus: document.ai_status,
      summary: document.coverage_summary,
      uploadedAt: document.uploaded_at,
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

  const obligationSheet = workbook.addWorksheet('Obligations & Evidence', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  obligationSheet.columns = [
    { header: 'Obligation', key: 'title', width: 42 },
    { header: 'Contract Number', key: 'contractNumber', width: 20 },
    { header: 'Supplier', key: 'supplier', width: 34 },
    { header: 'Type', key: 'type', width: 26 },
    { header: 'Priority', key: 'priority', width: 14 },
    { header: 'Workflow Status', key: 'status', width: 20 },
    { header: 'Calculated Status', key: 'effectiveStatus', width: 20 },
    { header: 'Due Date', key: 'dueDate', width: 16 },
    { header: 'Internal Review Date', key: 'reviewDate', width: 22 },
    { header: 'Owner', key: 'owner', width: 24 },
    { header: 'Backup Owner', key: 'backupOwner', width: 24 },
    { header: 'Renewal Decision', key: 'decision', width: 22 },
    { header: 'Source File', key: 'sourceFile', width: 44 },
    { header: 'Source Page', key: 'sourcePage', width: 14 },
    { header: 'Source Clause', key: 'sourceClause', width: 64 },
    { header: 'Evidence File', key: 'evidenceFile', width: 44 },
    { header: 'Evidence Reference', key: 'evidenceReference', width: 38 },
    { header: 'Completed By', key: 'completedBy', width: 24 },
    { header: 'Completed At', key: 'completedAt', width: 24 },
    { header: 'Completion Note', key: 'completionNote', width: 64 },
    { header: 'Escalation Level', key: 'escalationLevel', width: 18 },
    { header: 'Last Escalated At', key: 'escalatedAt', width: 24 },
  ];
  workspace.keyDates.forEach((item) =>
    obligationSheet.addRow({
      title: item.title,
      contractNumber: item.contract_number,
      supplier: item.supplier_name,
      type: item.type,
      priority: item.priority,
      status: item.status,
      effectiveStatus: item.effective_status,
      dueDate: item.due_date,
      reviewDate: item.internal_review_date,
      owner: item.owner,
      backupOwner: item.backup_owner,
      decision: item.decision,
      sourceFile: item.source_file_name,
      sourcePage: item.source_page,
      sourceClause: item.source_clause,
      evidenceFile: item.evidence_file_name,
      evidenceReference: item.evidence_reference,
      completedBy: item.completed_by,
      completedAt: item.completed_at,
      completionNote: item.completion_note,
      escalationLevel: item.escalation_level,
      escalatedAt: item.escalated_at,
    }),
  );

  const approvalSheet = workbook.addWorksheet('Approval Queue', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  approvalSheet.columns = [
    { header: 'Intake Number', key: 'intakeNumber', width: 20 },
    { header: 'Intake Title', key: 'intakeTitle', width: 38 },
    { header: 'Supplier', key: 'supplier', width: 34 },
    { header: 'Rule Key', key: 'ruleKey', width: 30 },
    { header: 'Rule Version', key: 'ruleVersion', width: 16 },
    { header: 'Required Control', key: 'ruleName', width: 42 },
    { header: 'Reason', key: 'reason', width: 64 },
    { header: 'Mandatory', key: 'mandatory', width: 14 },
    { header: 'Decision Owner', key: 'ownerRole', width: 28 },
    { header: 'Assigned Reviewer', key: 'reviewer', width: 24 },
    { header: 'Request Status', key: 'requestStatus', width: 20 },
    { header: 'Step Status', key: 'stepStatus', width: 20 },
    { header: 'Generated At', key: 'generatedAt', width: 24 },
    { header: 'Due Date', key: 'dueAt', width: 18 },
    { header: 'Age (Days)', key: 'ageDays', width: 14 },
    { header: 'Overdue', key: 'overdue', width: 14 },
    { header: 'Escalation Level', key: 'escalationLevel', width: 18 },
    { header: 'Source File', key: 'sourceFile', width: 46 },
    { header: 'Source Page', key: 'sourcePage', width: 14 },
    { header: 'Source Quote', key: 'sourceQuote', width: 64 },
    { header: 'Completed At', key: 'completedAt', width: 24 },
  ];
  workspace.approvalQueue.forEach((item) =>
    approvalSheet.addRow({
      intakeNumber: item.intake_number,
      intakeTitle: item.intake_title,
      supplier: item.proposed_supplier_name,
      ruleKey: item.rule_key,
      ruleVersion: item.rule_version,
      ruleName: item.rule_name,
      reason: item.reason,
      mandatory: item.mandatory ? 'Yes' : 'No',
      ownerRole: item.owner_role,
      reviewer: item.assigned_reviewer,
      requestStatus: item.request_status,
      stepStatus: item.step_status,
      generatedAt: item.generated_at,
      dueAt: item.due_at,
      ageDays: item.age_days,
      overdue: item.overdue ? 'Yes' : 'No',
      escalationLevel: item.escalation_level,
      sourceFile: item.source_file_name,
      sourcePage: item.source_page,
      sourceQuote: item.source_quote,
      completedAt: item.completed_at,
    }),
  );

  [
    contractSheet,
    supplierSheet,
    supplierDocumentSheet,
    exceptionSheet,
    obligationSheet,
    approvalSheet,
  ].forEach((sheet) => {
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
  supplierSheet.getColumn('totalValue').numFmt = '$#,##0.00';

  if (scope === 'suppliers') {
    workbook.removeWorksheet(contractSheet.id);
    workbook.removeWorksheet(exceptionSheet.id);
    workbook.removeWorksheet(obligationSheet.id);
    workbook.removeWorksheet(approvalSheet.id);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download =
    scope === 'suppliers'
      ? `ContractLedger_Supplier_Register_${dateStamp()}.xlsx`
      : `ContractLedger_Registers_${dateStamp()}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
