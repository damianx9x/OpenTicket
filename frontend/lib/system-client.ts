import { requestData } from '@/lib/api-base';

export interface SystemInfo {
  app: string;
  version: string;
  node: string;
  environment: string;
  setupMode: boolean;
  installationMode?: 'server_client' | 'client_only';
  remoteApiBaseUrl?: string | null;
  databaseMode: string;
  storageMode: string;
  port: number;
}

export interface DiagnosticsCheckResult {
  ok: boolean;
  reason?: string;
  skipped?: boolean;
}

export interface DiagnosticsChecks {
  database?: DiagnosticsCheckResult;
  redis?: DiagnosticsCheckResult;
  objectStorage?: DiagnosticsCheckResult;
  stats?: Record<string, unknown>;
  timestamp?: string;
}

export interface DiagnosticsReport {
  checks: DiagnosticsChecks;
  runtime?: Record<string, unknown>;
  config?: Record<string, unknown>;
  generatedAt?: string;
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return requestData<SystemInfo>('/api/v1/system/info');
}

export async function getDiagnosticsReport(): Promise<DiagnosticsReport> {
  return requestData<DiagnosticsReport>('/api/v1/diagnostics/report');
}

export interface DemoLoadResult {
  success: boolean;
  resetApplied: boolean;
  requestedCount: number;
  createdTickets: number;
  createdComments: number;
  createdCosts: number;
  createdStatusHistory: number;
  createdUsers: number;
  totalTickets: number;
}

export async function loadDemoDataset(payload?: { count?: number; reset?: boolean }): Promise<DemoLoadResult> {
  return requestData<DemoLoadResult>('/api/v1/demo/load', {
    method: 'POST',
    body: JSON.stringify({
      count: payload?.count ?? 200,
      reset: payload?.reset ?? true,
    }),
  });
}
