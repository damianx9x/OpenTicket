/**
 * Configuration types for hybrid Desktop/Web operation
 */

export type DatabaseMode = 'sqlite' | 'postgresql';
export type StorageMode = 'local' | 's3';

export interface AppConfig {
  // Database
  databaseMode: DatabaseMode;
  databaseUrl: string;
  
  // Storage
  storageMode: StorageMode;
  
  // For local storage (Desktop)
  dataPath?: string; // ~/Library/Application Support/TicketSystem
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
  
  createdAt: Date;
}

export interface SetupRequest {
  dataPath: string;
  adminEmail: string;
  adminPassword: string;
  organizationName?: string;
}

export interface SetupResponse {
  success: boolean;
  message: string;
  configPath?: string;
  migrationsApplied?: number;
  adminUserId?: string;
}
