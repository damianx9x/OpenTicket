/**
 * Configuration types for hybrid Desktop/Web operation
 */

export type DatabaseMode = 'sqlite' | 'postgresql';
export type StorageMode = 'local' | 's3';
export type InstallationMode = 'server_client' | 'client_only';
export type SetupBootstrapMode = 'fresh' | 'existing_db' | 'backup_archive' | 'demo_dataset';

export interface AppConfig {
  // Database
  databaseMode: DatabaseMode;
  databaseUrl: string;
  
  // Storage
  storageMode: StorageMode;
  
  // For local storage (Desktop)
  dataPath?: string; // ~/Library/Application Support/OpenTicket
  uploadsPath?: string; // dataPath/uploads
  
  // For S3/MinIO (Web)
  s3Endpoint?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  s3Bucket?: string;
  
  // Server
  port: number;
  jwtSecret: string;
  
  // Admin setup
  adminEmail?: string;
  adminPassword?: string;
  
  // Setup mode flag
  setupMode: boolean;
  setupModeKey?: string; // Random key to validate setup requests
  installationMode?: InstallationMode;
  remoteApiBaseUrl?: string;
  
  createdAt: Date;
}

export interface SetupRequest {
  dataPath?: string;
  adminEmail: string;
  adminPassword: string;
  organizationName?: string;
  bootstrapMode?: SetupBootstrapMode;
  existingDatabasePath?: string;
  existingBackupArchivePath?: string;
  demoTicketCount?: number;
}

export interface DiscoverLocalDataResponse {
  success: boolean;
  existingDatabases: string[];
  backupArchives: string[];
  searchedPaths: string[];
}

export interface ClientOnlySetupRequest {
  remoteApiBaseUrl: string;
}

export interface DiscoverServersRequest {
  deepScan?: boolean;
  includeLocalhost?: boolean;
  timeoutMs?: number;
  maxResults?: number;
}

export interface DiscoveredServerInfo {
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
  servers: DiscoveredServerInfo[];
  message?: string;
}

export interface ValidateRemoteServerResponse {
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

export interface SetupResponse {
  success: boolean;
  message: string;
  configPath?: string;
  migrationsApplied?: number;
  adminUserId?: string;
  adminEmail?: string;
  installationMode?: InstallationMode;
  remoteApiBaseUrl?: string;
  bootstrapMode?: SetupBootstrapMode;
  bootstrapSourcePath?: string;
  demoTicketCount?: number;
}
