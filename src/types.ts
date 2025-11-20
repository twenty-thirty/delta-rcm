
export enum CodeType {
  AQL = 'AQL',
  NUMERIC = 'NUMERIC',
  OTHER = 'OTHER'
}

export interface Claim {
  id: number;
  provider: string;
  cpt: string;
  codeType: CodeType;
  units: number;
  charge: number;
  paid: number;
  patientId: string;
  patientName: string;
  payer: string;
  dos: Date | null; // Date of Service
  dateSort: number; // Timestamp for sorting
  isPaid: boolean;
}

export interface KPI {
  totalCollected: number;
  totalEncounters: number;
  totalUnits: number;
  paidUnits: number;
  denialRate: number;
  projectedOpportunity: number; // New: Realistic recovery amount
}

export interface MonthlyStat {
  month: string; // YYYY-MM
  paid: number;
  units: number;
}

export interface PayerDenialStats {
  payer: string;
  deniedUnits: number;
  deniedValue: number; // Based on charges
  projectedValue: number; // Based on expected reimbursement
}

// Expected reimbursement rate for a specific CPT and Payer
export interface ReimbursementRate {
  payer: string;
  cpt: string;
  expectedRate: number; // The Calculated 'Mode' or 'Max'
  method: 'Mode' | 'Max' | 'None';
  frequency: number; // How many times this rate was seen
}

export interface PatientStat {
  patientName: string;
  patientId: string;
  totalVisits: number;
  totalRevenue: number;
  lastVisit: Date | null;
  payer: string;
}
