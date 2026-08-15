export type ScannerStatus =
  | 'safe'
  | 'suspicious'
  | 'dangerous'
  | 'unknown';

export interface ScannerResult {
  provider: string;
  status: ScannerStatus;
  score?: number;
  categories?: string[];
  message?: string;
  raw?: unknown;
}