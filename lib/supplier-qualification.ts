export const SUPPLIER_DOCUMENT_TYPES = [
  'w9',
  'insurance_certificate',
  'business_license',
  'business_registration',
  'good_standing',
  'professional_license',
  'diversity_certification',
  'safety_qualification',
  'cybersecurity_assessment',
  'sanctions_debarment_check',
  'quality_certification',
  'other_qualification',
] as const;

export type SupplierDocumentType = (typeof SUPPLIER_DOCUMENT_TYPES)[number];

export const SUPPLIER_DOCUMENT_LABELS: Record<SupplierDocumentType, string> = {
  w9: 'W-9',
  insurance_certificate: 'Insurance certificate',
  business_license: 'Business license',
  business_registration: 'Business registration',
  good_standing: 'Certificate / record of good standing',
  professional_license: 'Professional or occupational license',
  diversity_certification: 'Diversity / small-business certification',
  safety_qualification: 'Safety qualification',
  cybersecurity_assessment: 'Cybersecurity assessment',
  sanctions_debarment_check: 'Sanctions / debarment check',
  quality_certification: 'Quality certification',
  other_qualification: 'Other qualification document',
};

export const ALLOWED_SUPPLIER_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const;

export const MAX_SUPPLIER_DOCUMENT_BYTES = 8 * 1024 * 1024;

export type SupplierDocumentationStatus =
  | 'complete'
  | 'incomplete'
  | 'needs_follow_up'
  | 'expired'
  | 'under_review';

export function supplierDocumentationStatus({
  w9Status,
  insuranceStatus,
  documentStatuses,
}: {
  w9Status: string;
  insuranceStatus: string;
  documentStatuses: string[];
}): SupplierDocumentationStatus {
  if (insuranceStatus === 'expired' || documentStatuses.includes('expired'))
    return 'expired';
  if (documentStatuses.includes('needs_follow_up')) return 'needs_follow_up';
  if (w9Status === 'missing' || insuranceStatus === 'missing')
    return 'incomplete';
  if (documentStatuses.includes('under_review')) return 'under_review';
  return 'complete';
}

export function normalizeSupplierName(name: string) {
  return name
    .toLowerCase()
    .replace(
      /\b(incorporated|corporation|company|limited|inc|corp|co|llc|l\.l\.c)\b/g,
      '',
    )
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function safeSupplierFileName(name: string) {
  return (
    name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120) || 'supplier-document'
  );
}
