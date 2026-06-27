import type { FindingCategory, FindingSeverity } from "@/generated/prisma/enums";

export type ScannerContext = {
  scanId: string;
  url: string;
  maxPages: number;
  includeSubpages: boolean;
};

export type ScannerFinding = {
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  impact?: string;
  recommendation?: string;
  evidence?: Record<string, unknown>;
  source: string;
  sortOrder?: number;
};

export type ScannerAdapter = {
  name: string;
  run(context: ScannerContext): Promise<ScannerFinding[]>;
};
