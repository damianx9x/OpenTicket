/**
 * Setup Service - Client library for system initialization
 * Communicates with POST /api/v1/setup/init endpoint
 */
import {
  buildApiUrl,
  clearApiBaseOverride,
  normalizeApiBaseUrl,
  requestData,
  setApiBaseOverride,
} from '@/lib/api-base';
export { buildApiUrl } from '@/lib/api-base';

export type InstallationMode = 'server_client' | 'client_only';

export interface SetupRequest {
  dataPath: string;
  adminEmail: string;
  adminPassword: string;
  organizationName?: string;
  bootstrapMode?: 'fresh' | 'existing_db' | 'backup_archive';
  existingDatabasePath?: string;
  existingBackupArchivePath?: string;
}

export interface ClientOnlySetupRequest {
  remoteApiBaseUrl: string;
}

export interface SetupResponse {
  success: boolean;
  message: string;
  configPath?: string;
  migrationsApplied?: number;
  adminUserId?: string;
  adminEmail?: string;
  installationMode?: InstallationMode;
  remoteApiBaseUrl?: string;
  bootstrapMode?: 'fresh' | 'existing_db' | 'backup_archive';
  bootstrapSourcePath?: string;
}

export interface SetupStatus {
  isSetup: boolean;
  setupMode: boolean;
  defaultDataPath?: string;
  installationMode?: InstallationMode;
  remoteApiBaseUrl?: string;
}

export interface DataPathValidation {
  ok: boolean;
  requestedPath: string;
  resolvedPath: string;
  createdDirectory: boolean;
  writable: boolean;
  warning?: string;
  error?: string;
}

export interface DiscoveredSetupServer {
  apiBaseUrl: string;
  host: string;
  port: number;
  latencyMs: number;
  setupMode?: boolean;
  installationMode?: InstallationMode;
  app?: string;
  version?: string;
}

export interface DiscoverServersResponse {
  success: boolean;
  scannedTargets: number;
  durationMs: number;
  servers: DiscoveredSetupServer[];
  message?: string;
}

export interface ValidateRemoteResponse {
  ok: boolean;
  apiBaseUrl: string;
  latencyMs?: number;
  error?: string;
  system?: {
    app?: string;
    version?: string;
    setupMode?: boolean;
    installationMode?: InstallationMode;
  };
}

export interface DiscoverLocalDataResponse {
  success: boolean;
  existingDatabases: string[];
  backupArchives: string[];
  searchedPaths: string[];
}

function localSetupBase(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://127.0.0.1:3000';
  }
  return window.location.origin;
}

function buildLocalSetupUrl(pathname: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${localSetupBase()}${normalizedPath}`;
}

/**
 * Check if system is already initialized
 */
export async function checkSetupStatus(): Promise<SetupStatus> {
  try {
    return await requestData<SetupStatus>(buildLocalSetupUrl('/api/v1/setup/status'), {
      method: 'POST',
    });
  } catch (error) {
    console.error('Failed to check setup status:', error);
    // Assume setup mode on error
    return { isSetup: false, setupMode: true, installationMode: 'server_client' };
  }
}

/**
 * Initialize the system
 */
export async function initializeSystem(request: SetupRequest): Promise<SetupResponse> {
  try {
    return await requestData<SetupResponse>(buildLocalSetupUrl('/api/v1/setup/init'), {
      method: 'POST',
      body: JSON.stringify(request),
    });
  } catch (error) {
    console.error('Setup initialization failed:', error);
    return {
      success: false,
      message: `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function initializeClientOnlyMode(
  request: ClientOnlySetupRequest,
): Promise<SetupResponse> {
  try {
    return await requestData<SetupResponse>(buildLocalSetupUrl('/api/v1/setup/client-only'), {
      method: 'POST',
      body: JSON.stringify(request),
    });
  } catch (error) {
    console.error('Client-only setup failed:', error);
    return {
      success: false,
      message: `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Validate selected data path before setup initialization.
 */
export async function validateDataPath(dataPath: string): Promise<DataPathValidation> {
  return requestData<DataPathValidation>(buildLocalSetupUrl('/api/v1/setup/validate-path'), {
    method: 'POST',
    body: JSON.stringify({ dataPath }),
  });
}

export async function discoverSetupServers(options?: {
  deepScan?: boolean;
  includeLocalhost?: boolean;
  timeoutMs?: number;
  maxResults?: number;
}): Promise<DiscoverServersResponse> {
  return requestData<DiscoverServersResponse>(buildLocalSetupUrl('/api/v1/setup/discover-servers'), {
    method: 'POST',
    body: JSON.stringify(options || {}),
  });
}

export async function validateRemoteApiBase(remoteApiBaseUrl: string): Promise<ValidateRemoteResponse> {
  return requestData<ValidateRemoteResponse>(buildLocalSetupUrl('/api/v1/setup/validate-remote'), {
    method: 'POST',
    body: JSON.stringify({ remoteApiBaseUrl }),
  });
}

export async function discoverLocalDataSources(): Promise<DiscoverLocalDataResponse> {
  return requestData<DiscoverLocalDataResponse>(buildLocalSetupUrl('/api/v1/setup/discover-local-data'), {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function applyRuntimeApiBaseFromSetupStatus(status: SetupStatus): void {
  if (status.installationMode === 'client_only' && status.remoteApiBaseUrl) {
    try {
      const normalized = normalizeApiBaseUrl(status.remoteApiBaseUrl);
      if (normalized) {
        setApiBaseOverride(normalized);
        return;
      }
    } catch {
      // ignore and clear below
    }
  }

  clearApiBaseOverride();
}

/**
 * Get local IP address for QR code
 * This will be called from Electron's preload script
 */
export function getLocalIpForQR(): string {
  // In browser, we use window.location.hostname
  if (typeof window !== 'undefined') {
    return window.location.hostname || 'localhost';
  }
  return 'localhost';
}
