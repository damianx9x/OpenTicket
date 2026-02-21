'use client';

import { useEffect, useState } from 'react';
import SetupWizard from '@/app/components/SetupWizard';
import { applyRuntimeApiBaseFromSetupStatus, checkSetupStatus } from '@/lib/setup-client';
import type { SetupResponse } from '@/lib/setup-client';
import { requestData } from '@/lib/api-base';

/**
 * Setup Page
 * Entry point for system initialization
 * Automatically redirects to dashboard if system is already configured
 */
export default function SetupPage() {
  const [setupStatus, setSetupStatus] = useState<{
    isSetup: boolean;
    defaultDataPath: string;
    installationMode: 'server_client' | 'client_only';
    remoteApiBaseUrl?: string;
    loading: boolean;
    error: string | null;
    resetting: boolean;
  }>({
    isSetup: false,
    defaultDataPath: '',
    installationMode: 'server_client',
    remoteApiBaseUrl: undefined,
    loading: true,
    error: null,
    resetting: false,
  });

  useEffect(() => {
    // Check if system is already initialized
    const checkStatus = async () => {
      try {
        const status = await checkSetupStatus();
        applyRuntimeApiBaseFromSetupStatus(status);
        setSetupStatus((prev) => ({
          ...prev,
          isSetup: status.isSetup,
          defaultDataPath: status.defaultDataPath ?? '',
          installationMode: status.installationMode ?? 'server_client',
          remoteApiBaseUrl: status.remoteApiBaseUrl,
          loading: false,
          error: null,
        }));
      } catch (error) {
        console.error('Failed to check setup status:', error);
        setSetupStatus((prev) => ({
          ...prev,
          isSetup: false,
          defaultDataPath: '',
          installationMode: 'server_client',
          remoteApiBaseUrl: undefined,
          loading: false,
          error: 'Nie udało się sprawdzić statusu konfiguracji.',
        }));
      }
    };

    checkStatus();
  }, []);

  const handleSetupComplete = (result: SetupResponse) => {
    if (!result.success) {
      return;
    }
  };

  const handleDevReset = async () => {
    setSetupStatus((prev) => ({ ...prev, resetting: true, error: null }));
    try {
      const result = await requestData<{ success: boolean; message: string }>('/api/v1/setup/dev-reset', {
        method: 'POST',
      });

      if (!result.success) {
        setSetupStatus((prev) => ({
          ...prev,
          resetting: false,
          error: result.message || 'Reset nie powiódł się.',
        }));
        return;
      }

      window.location.href = '/setup?fresh=1';
    } catch (error) {
      setSetupStatus((prev) => ({
        ...prev,
        resetting: false,
        error: `Reset nie powiódł się: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      }));
    }
  };

  if (setupStatus.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
          </div>
          <p className="mt-4 text-gray-600">Loading setup...</p>
        </div>
      </div>
    );
  }

  if (setupStatus.isSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-xl border border-blue-100 bg-white p-8 shadow-lg">
          <h1 className="text-xl font-semibold text-gray-900">System jest już skonfigurowany</h1>
          <p className="mt-3 text-sm text-gray-700">
            Setup został już wykonany wcześniej, dlatego kreator jest zablokowany.
          </p>
          <p className="mt-2 text-sm text-gray-700">
            Tryb instalacji:{' '}
            <strong>{setupStatus.installationMode === 'client_only' ? 'sam klient' : 'serwer + klient'}</strong>
            {setupStatus.installationMode === 'client_only' && setupStatus.remoteApiBaseUrl
              ? ` (${setupStatus.remoteApiBaseUrl})`
              : ''}
            .
          </p>
          <p className="mt-2 text-sm text-gray-700">
            Jeśli testujesz lokalnie i chcesz przejść setup od początku, użyj resetu DEV.
          </p>

          {setupStatus.error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {setupStatus.error}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              onClick={() => {
                window.location.href = '/login';
              }}
            >
              Przejdź do logowania
            </button>
            <button
              type="button"
              className="rounded border border-amber-300 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-60"
              onClick={() => void handleDevReset()}
              disabled={setupStatus.resetting}
            >
              {setupStatus.resetting ? 'Resetowanie...' : 'Reset konfiguracji (DEV) i uruchom setup'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <SetupWizard onComplete={handleSetupComplete} initialDataPath={setupStatus.defaultDataPath} />;
}
