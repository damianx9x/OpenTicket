'use client';

import { useEffect, useMemo, useState } from 'react';

interface Step3Props {
  onContinue: () => void;
  onBack: () => void;
  isLoading: boolean;
  summary: {
    installationMode: 'server_client' | 'client_only';
    dataPath: string;
    remoteApiBaseUrl?: string;
    adminEmail: string;
    organizationName?: string;
  };
}

/**
 * Step 3: Initialization Progress
 * Shows summary and initializes the system
 */
export function InitStep3({ onContinue, onBack, isLoading, summary }: Step3Props) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setProgress(0);
      return;
    }

    setProgress(5);
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) {
          return prev;
        }
        return prev + Math.max(1, Math.round((95 - prev) / 8));
      });
    }, 600);

    return () => window.clearInterval(timer);
  }, [isLoading]);

  const stageText = useMemo(() => {
    if (summary.installationMode === 'client_only') {
      if (progress < 25) return 'Walidacja adresu serwera...';
      if (progress < 60) return 'Zapisywanie trybu klienta...';
      if (progress < 90) return 'Finalizacja konfiguracji aplikacji...';
      return 'Gotowe. Uruchamianie panelu logowania...';
    }

    if (progress < 20) return 'Sprawdzanie uprawnień i katalogów...';
    if (progress < 45) return 'Tworzenie struktury danych...';
    if (progress < 70) return 'Inicjalizacja bazy i migracji...';
    if (progress < 90) return 'Konfiguracja konta administratora...';
    return 'Finalizacja konfiguracji i zabezpieczeń...';
  }, [progress]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          ✓ Review & Initialize
        </h2>
        <p className="text-gray-600">
          Please review your settings before initializing the system.
        </p>
      </div>

      {/* Summary Card */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-4">
        {summary.installationMode === 'client_only' ? (
          <div>
            <p className="text-sm font-medium text-gray-600">Tryb instalacji</p>
            <p className="text-gray-900 text-sm mt-1">Sam klient (połączenie z istniejącym serwerem)</p>
            <p className="text-sm font-medium text-gray-600 mt-3">Adres serwera</p>
            <p className="text-gray-900 font-mono text-sm mt-1">{summary.remoteApiBaseUrl}</p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-gray-600">Data Location</p>
            <p className="text-gray-900 font-mono text-sm mt-1">{summary.dataPath}</p>
          </div>
        )}

        {summary.installationMode !== 'client_only' && (
          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm font-medium text-gray-600">Admin Email</p>
            <p className="text-gray-900 font-mono text-sm mt-1">{summary.adminEmail}</p>
          </div>
        )}

        {summary.installationMode !== 'client_only' && summary.organizationName && (
          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm font-medium text-gray-600">Organization</p>
            <p className="text-gray-900 text-sm mt-1">{summary.organizationName}</p>
          </div>
        )}

        <div className="border-t border-gray-200 pt-4">
          <p className="text-sm font-medium text-gray-600">What will be created:</p>
          <ul className="text-sm text-gray-700 mt-2 space-y-1">
            {summary.installationMode === 'client_only' ? (
              <>
                <li>✓ Client connection profile</li>
                <li>✓ Remote API base URL</li>
                <li>✓ Local desktop configuration file</li>
                <li>✓ Ready-to-login client mode</li>
              </>
            ) : (
              <>
                <li>✓ SQLite database (app.db)</li>
                <li>✓ Configuration file (config.json)</li>
                <li>✓ Uploads directory</li>
                <li>✓ Admin user account</li>
                <li>✓ Required database tables</li>
              </>
            )}
          </ul>
        </div>
      </div>

      {/* Progress Section */}
      {isLoading && (
        <div className="space-y-3">
          <div className="flex items-center justify-center">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="text-center text-sm font-medium text-gray-700">
              Initializing system... {Math.min(progress, 99)}%
            </p>
            <p className="text-center text-xs text-gray-500">{stageText}</p>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>💾 What happens next:</strong>
          <br />
          {summary.installationMode === 'client_only'
            ? 'Zapiszemy konfigurację klienta i połączymy aplikację z istniejącym serwerem. Ten krok trwa zwykle kilka sekund.'
            : "We'll create your SQLite database, apply necessary migrations, create your admin account, and generate security keys. This usually takes 10-60 seconds depending on the computer."}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={isLoading}
          className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Back
        </button>
        <button
          onClick={onContinue}
          disabled={isLoading}
          className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Initializing...' : 'Initialize System →'}
        </button>
      </div>
    </div>
  );
}
