/**
 * Setup Service - Client library for system initialization
 * Communicates with POST /api/v1/setup/init endpoint
 */

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

export interface SetupStatus {
  isSetup: boolean;
  setupMode: boolean;
}

// Get the API base URL (auto-detect in browser)
function getApiBase(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }
  
  // Use current origin if available
  return window.location.origin;
}

/**
 * Check if system is already initialized
 */
export async function checkSetupStatus(): Promise<SetupStatus> {
  try {
    const response = await fetch(`${getApiBase()}/api/v1/setup/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to check setup status:', error);
    // Assume setup mode on error
    return { isSetup: false, setupMode: true };
  }
}

/**
 * Initialize the system
 */
export async function initializeSystem(request: SetupRequest): Promise<SetupResponse> {
  try {
    const response = await fetch(`${getApiBase()}/api/v1/setup/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Setup initialization failed:', error);
    return {
      success: false,
      message: `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
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
