import type { SupplierRiskProfile } from '@/lib/supplier-risk';

export type RegisterScope = 'contracts' | 'suppliers';
export type RegisterRow = Record<string, string | number | null>;
export type RegisterPage = {
  rows: RegisterRow[];
  matchCount: number;
  totalCount: number;
  page: number;
  riskProfiles: Record<string, SupplierRiskProfile>;
};

export type RegisterOptions = Record<string, string[]>;

export type RegisterDetail = {
  contract: RegisterRow | null;
  supplier: RegisterRow | null;
  supplierRiskProfile: SupplierRiskProfile | null;
};

export const MANAGEMENT_INSIGHTS_REGISTER_LIMIT = 500;
