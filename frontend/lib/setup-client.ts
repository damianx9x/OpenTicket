/**
 * Setup Service - Client library for system initialization
 * Communicates with POST /api/v1/setup/init endpoint
 */
import {
  buildApiUrl,
  clearApiBaseOverride,
  getApiBase,
  normalizeApiBaseUrl,
  requestData,
  ApiRequestError,
  setApiBaseOverride,
} from '@/lib/api-base';
export { buildApiUrl } from '@/lib/api-base';

export type InstallationMode = 'server_client' | 'client_only';
export type DeploymentTarget = 'local_machine' | 'remote_host';
export type HostProfile = 'linux_docker' | 'linux_native' | 'synology_docker';
export type SetupBootstrapMode =
  | 'fresh'
  | 'existing_db'
  | 'backup_archive'
  | 'encrypted_backup'
  | 'demo_dataset';

export interface SetupRequest {
  dataPath: string;
  adminEmail: string;
  adminPassword: string;
  organizationName?: string;
  deploymentTarget?: DeploymentTarget;
  hostProfile?: HostProfile;
  setupSessionToken?: string;
  bootstrapMode?: SetupBootstrapMode;
  existingDatabasePath?: string;
  existingBackupArchivePath?: string;
  demoTicketCount?: number;
  autoBackupEnabled?: boolean;
  autoBackupIntervalHours?: number;
  autoBackupPath?: string;
  backupEncryptionKey?: string;
}

export interface ClientOnlySetupRequest {
  remoteApiBaseUrl: string;
  setupSessionToken?: string;
}

export interface SetupResponse {
  success: boolean;
  message: string;
  configPath?: string;
  migrationsApplied?: number;
  adminUserId?: string;
  adminEmail?: string;
  installationMode?: InstallationMode;
  deploymentTarget?: DeploymentTarget;
  hostProfile?: HostProfile;
  remoteApiBaseUrl?: string;
  bootstrapMode?: SetupBootstrapMode;
  bootstrapSourcePath?: string;
  demoTicketCount?: number;
  backupEncryptionKeyGenerated?: string;
  backupEncryptionKeyHint?: string;
}

export interface SetupStatus {
  isSetup: boolean;
  setupMode: boolean;
  defaultDataPath?: string;
  installationMode?: InstallationMode;
  deploymentTarget?: DeploymentTarget;
  hostProfile?: HostProfile;
  setupSessionMode?: 'loopback' | 'one_time_token';
  remoteSetupOpen?: boolean;
  remoteSetupExpiresAt?: string;
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

export interface CreateSetupTokenResponse {
  success: boolean;
  token?: string;
  expiresAt?: string;
  maxAttempts?: number;
  message: string;
}

export interface ClaimSetupTokenResponse {
  success: boolean;
  setupSessionToken?: string;
  expiresAt?: string;
  message: string;
}

export interface RevokeSetupTokenResponse {
  success: boolean;
  message: string;
}

function localSetupBase(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://127.0.0.1:3000';
  }
  return getApiBase();
}

function buildLocalSetupUrl(pathname: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${localSetupBase()}${normalizedPath}`;
}

function resolveSetupEndpoint(pathname: string, apiBaseUrl?: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const targetBase = (apiBaseUrl || '').trim();
  if (!targetBase) {
    return buildLocalSetupUrl(normalizedPath);
  }
  const normalized = normalizeApiBaseUrl(targetBase);
  return `${normalized}${normalizedPath}`;
}

function mergeSetupHeaders(init: RequestInit | undefined, setupSessionToken?: string): RequestInit {
  if (!setupSessionToken || setupSessionToken.trim().length === 0) {
    return init || {};
  }
  const headers = new Headers(init?.headers ?? undefined);
  headers.set('x-setup-session-token', setupSessionToken.trim());
  return {
    ...(init || {}),
    headers,
  };
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!error) {
    return false;
  }
  if (error instanceof ApiRequestError) {
    return false;
  }
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'NetworkError' || error.name === 'AbortError';
  }
  if (error instanceof Error) {
    return /(failed to fetch|networkerror|load failed|err_connection|err_name_not_resolved|econnrefused|socket hang up)/i.test(
      error.message,
    );
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toLoopbackVariant(baseUrl: string, hostname: '127.0.0.1' | 'localhost'): string | null {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      return null;
    }
    parsed.hostname = hostname;
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function resolveSetupFallbackEndpoints(pathname: string, apiBaseUrl?: string): string[] {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const candidates: string[] = [];
  const add = (url: string | null | undefined) => {
    if (!url) {
      return;
    }
    const trimmed = url.trim();
    if (!trimmed || candidates.includes(trimmed)) {
      return;
    }
    candidates.push(trimmed);
  };

  const primary = resolveSetupEndpoint(normalizedPath, apiBaseUrl);
  add(primary);

  if (apiBaseUrl) {
    const normalizedBase = normalizeApiBaseUrl(apiBaseUrl);
    add(`${normalizedBase}${normalizedPath}`);
    add(
      (() => {
        const variant = toLoopbackVariant(normalizedBase, '127.0.0.1');
        return variant ? `${variant}${normalizedPath}` : null;
      })(),
    );
    add(
      (() => {
        const variant = toLoopbackVariant(normalizedBase, 'localhost');
        return variant ? `${variant}${normalizedPath}` : null;
      })(),
    );
    return candidates;
  }

  if (typeof window !== 'undefined') {
    const rawOrigin = window.location.origin;
    if (/^https?:\/\//i.test(rawOrigin)) {
      try {
        const parsed = new URL(rawOrigin);
        const port = parsed.port
          ? `:${parsed.port}`
          : parsed.protocol === 'https:'
            ? ':443'
            : ':80';
        add(`http://127.0.0.1${port}${normalizedPath}`);
        add(`http://localhost${port}${normalizedPath}`);
      } catch {
        // ignore origin parse errors
      }
    }
  }

  for (const fallbackPort of ['3200', '3000', '3001', '3002']) {
    add(`http://127.0.0.1:${fallbackPort}${normalizedPath}`);
    add(`http://localhost:${fallbackPort}${normalizedPath}`);
  }

  return candidates;
}

async function validateDataPathViaDesktopBridge(
  dataPath: string,
  options?: { apiBaseUrl?: string; setupSessionToken?: string },
): Promise<DataPathValidation | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const bridge = (window as any).electron || (window as any).electronAPI;
  if (!bridge?.setupValidatePath) {
    return null;
  }

  try {
    const result = await bridge.setupValidatePath({
      dataPath,
      apiBaseUrl: options?.apiBaseUrl,
      setupSessionToken: options?.setupSessionToken,
    });
    if (result && typeof result === 'object' && 'ok' in result) {
      return result as DataPathValidation;
    }
  } catch {
    // fallback failed; caller will throw original networking error
  }

  return null;
}

/**
 * Check if system is already initialized
 */
export async function checkSetupStatus(apiBaseUrl?: string): Promise<SetupStatus> {
  try {
    return await requestData<SetupStatus>(resolveSetupEndpoint('/api/v1/setup/status', apiBaseUrl), {
      method: 'POST',
    });
  } catch (error) {
    console.error('Failed to check setup status:', error);
    // Assume setup mode on error
    return {
      isSetup: false,
      setupMode: true,
      installationMode: 'server_client',
      deploymentTarget: 'local_machine',
      setupSessionMode: 'loopback',
      remoteSetupOpen: false,
    };
  }
}

/**
 * Initialize the system
 */
export async function initializeSystem(
  request: SetupRequest,
  options?: { apiBaseUrl?: string; setupSessionToken?: string },
): Promise<SetupResponse> {
  try {
    const setupSessionToken = options?.setupSessionToken || request.setupSessionToken;
    const requestWithToken =
      setupSessionToken && setupSessionToken.trim().length > 0
        ? { ...request, setupSessionToken: setupSessionToken.trim() }
        : request;

    return await requestData<SetupResponse>(
      resolveSetupEndpoint('/api/v1/setup/init', options?.apiBaseUrl),
      mergeSetupHeaders(
        {
          method: 'POST',
          body: JSON.stringify(requestWithToken),
        },
        setupSessionToken,
      ),
    );
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
  options?: { apiBaseUrl?: string; setupSessionToken?: string },
): Promise<SetupResponse> {
  try {
    const setupSessionToken = options?.setupSessionToken || request.setupSessionToken;
    const requestWithToken =
      setupSessionToken && setupSessionToken.trim().length > 0
        ? { ...request, setupSessionToken: setupSessionToken.trim() }
        : request;

    return await requestData<SetupResponse>(
      resolveSetupEndpoint('/api/v1/setup/client-only', options?.apiBaseUrl),
      mergeSetupHeaders(
        {
          method: 'POST',
          body: JSON.stringify(requestWithToken),
        },
        setupSessionToken,
      ),
    );
  } catch (error) {
    console.error('Client-only setup failed:', error);
    return {
      success: false,
      message: `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function createRemoteSetupToken(
  options?: {
    apiBaseUrl?: string;
    ttlMinutes?: number;
    maxAttempts?: number;
    setupSessionToken?: string;
  },
): Promise<CreateSetupTokenResponse> {
  return requestData<CreateSetupTokenResponse>(
    resolveSetupEndpoint('/api/v1/setup/token/create', options?.apiBaseUrl),
    mergeSetupHeaders(
      {
        method: 'POST',
        body: JSON.stringify({
          ttlMinutes: options?.ttlMinutes,
          maxAttempts: options?.maxAttempts,
          setupSessionToken: options?.setupSessionToken,
        }),
      },
      options?.setupSessionToken,
    ),
  );
}

export async function claimRemoteSetupToken(
  token: string,
  options?: { apiBaseUrl?: string },
): Promise<ClaimSetupTokenResponse> {
  return requestData<ClaimSetupTokenResponse>(
    resolveSetupEndpoint('/api/v1/setup/token/claim', options?.apiBaseUrl),
    {
      method: 'POST',
      body: JSON.stringify({ token }),
    },
  );
}

export async function revokeRemoteSetupToken(options?: {
  apiBaseUrl?: string;
  setupSessionToken?: string;
}): Promise<RevokeSetupTokenResponse> {
  return requestData<RevokeSetupTokenResponse>(
    resolveSetupEndpoint('/api/v1/setup/token/revoke', options?.apiBaseUrl),
    mergeSetupHeaders(
      {
        method: 'POST',
        body: JSON.stringify({
          setupSessionToken: options?.setupSessionToken,
        }),
      },
      options?.setupSessionToken,
    ),
  );
}

/**
 * Validate selected data path before setup initialization.
 */
export async function validateDataPath(
  dataPath: string,
  options?: { apiBaseUrl?: string; setupSessionToken?: string },
): Promise<DataPathValidation> {
  const payload = JSON.stringify({
    dataPath,
    setupSessionToken: options?.setupSessionToken,
  });

  const requestInit = mergeSetupHeaders(
    {
      method: 'POST',
      body: payload,
    },
    options?.setupSessionToken,
  );

  const endpoints = resolveSetupFallbackEndpoints('/api/v1/setup/validate-path', options?.apiBaseUrl);
  let lastError: unknown = null;

  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index];
    try {
      return await requestData<DataPathValidation>(endpoint, requestInit);
    } catch (error) {
      if (!isRetryableNetworkError(error)) {
        throw error;
      }
      lastError = error;
      if (index < endpoints.length - 1) {
        await delay(160);
      }
    }
  }

  const bridgeResult = await validateDataPathViaDesktopBridge(dataPath, options);
  if (bridgeResult) {
    return bridgeResult;
  }

  throw (
    lastError ||
    new Error('Nie udało się połączyć z silnikiem lokalnym podczas walidacji ścieżki.')
  );
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
