'use client';

import { useEffect, useState } from 'react';
import QRCodeDisplay from '../QRCodeDisplay';
import { SetupResponse } from '@/lib/setup-client';

interface Step4Props {
  result: SetupResponse;
  installationMode: 'server_client' | 'client_only';
  remoteApiBaseUrl?: string;
  onNewSetup: () => void;
  onContinueToDashboard: () => void;
}

/**
 * Step 4: QR Code Display & Completion
 * Shows QR code for iOS app to scan and connect
 */
export function InitStep4({
  result,
  installationMode,
  remoteApiBaseUrl,
  onNewSetup,
  onContinueToDashboard,
}: Step4Props) {
  const [copyFeedback, setCopyFeedback] = useState('');
  const [localIp, setLocalIp] = useState<string>('localhost');
  const apiPort =
    typeof window !== 'undefined'
      ? window.location.port || '3000'
      : '3000';
  const explicitApiBase = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    const getLocalIp = async () => {
      try {
        const bridge =
          typeof window !== 'undefined'
            ? (window as any).electron || (window as any).electronAPI
            : null;

        if (bridge?.getLocalIp) {
          const ip = await bridge.getLocalIp();
          setLocalIp(ip);
        } else {
          setLocalIp(window.location.hostname || 'localhost');
        }
      } catch (error) {
        console.error('Failed to get local IP:', error);
        setLocalIp(window.location.hostname || 'localhost');
      }
    };

    getLocalIp();
  }, []);

  const resolvedApiBase = explicitApiBase
    ? explicitApiBase.replace('127.0.0.1', localIp).replace('localhost', localIp)
    : installationMode === 'client_only' && remoteApiBaseUrl
      ? remoteApiBaseUrl
      : `http://${localIp}:${apiPort}`;

  const qrData = {
    apiBase: resolvedApiBase,
    token: 'temporary-pairing-token',
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(''), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-green-600 mb-2">
          ✅ {installationMode === 'client_only' ? 'Klient skonfigurowany!' : 'System Initialized Successfully!'}
        </h2>
        <p className="text-gray-600">
          {installationMode === 'client_only'
            ? 'Aplikacja desktop jest gotowa i połączona z istniejącym serwerem.'
            : 'Your ticket system is ready to use. Scan the QR code with your iPhone to connect.'}
        </p>
      </div>

      {installationMode !== 'client_only' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 flex justify-center">
          <QRCodeDisplay data={qrData} />
        </div>
      )}

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-3">
        <h3 className="font-semibold text-green-900">✓ Setup Complete</h3>
        <div className="text-sm text-green-800 space-y-1">
          {installationMode === 'client_only' ? (
            <>
              <p>✓ Client profile saved</p>
              <p>✓ Remote server: {remoteApiBaseUrl || result.remoteApiBaseUrl}</p>
              <p>✓ Configuration saved</p>
            </>
          ) : (
            <>
              <p>✓ Database created: {result.configPath}/app.db</p>
              <p>✓ Configuration saved</p>
              <p>✓ Admin account created: {result.adminEmail}</p>
              <p>✓ {result.migrationsApplied || 0} migrations applied</p>
            </>
          )}
        </div>
      </div>

      {installationMode !== 'client_only' ? (
        <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="font-medium text-blue-900">📱 Connect Your iPhone:</p>
          <ol className="text-sm text-blue-800 space-y-2">
            <li>1. Open the OpenTicket app on your iPhone</li>
            <li>2. Tap "Scan Server"</li>
            <li>3. Point camera at QR code above</li>
            <li>4. App will auto-connect to your local system</li>
          </ol>

          <div className="border-t border-blue-200 pt-3 mt-3">
            <p className="text-xs font-medium text-blue-900 mb-2">Manual Connection (if QR doesn't work):</p>
            <div className="flex gap-2">
              <code className="flex-1 text-xs bg-white border border-blue-200 rounded px-2 py-1 font-mono">
                {qrData.apiBase}
              </code>
              <button
                onClick={() => copyToClipboard(qrData.apiBase, 'API Base')}
                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
              >
                {copyFeedback === 'API Base' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="font-medium text-blue-900">Połączenie klienta</p>
          <p className="text-sm text-blue-800">
            Klient będzie korzystał z serwera:
            <code className="ml-1 rounded bg-white px-1 py-0.5 font-mono text-xs">
              {remoteApiBaseUrl || result.remoteApiBaseUrl}
            </code>
          </p>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="font-semibold text-gray-800">📋 Next Steps:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="font-medium text-gray-800">💻 Web Dashboard</p>
            <p className="text-gray-600 mt-1">
              <a
                href={`${qrData.apiBase}/dashboard`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Open in browser →
              </a>
            </p>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="font-medium text-gray-800">🔐 Login Details</p>
            <p className="text-gray-600 mt-1">
              {installationMode === 'client_only' ? (
                'Użyj konta z istniejącego serwera.'
              ) : (
                <>
                  Email:{' '}
                  <code className="text-xs bg-white px-1 rounded">{result.adminEmail || 'admin@example.com'}</code>
                </>
              )}
            </p>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="font-medium text-gray-800">💾 Data Location</p>
            <p className="text-gray-600 text-xs mt-1 break-all">{result.configPath}</p>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="font-medium text-gray-800">📚 Documentation</p>
            <p className="text-gray-600 mt-1">
              <a href="/api/docs" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                API Docs (Swagger) →
              </a>
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          onClick={onContinueToDashboard}
          className="w-full px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          Przejdź do dashboardu
        </button>
        <button
          onClick={onNewSetup}
          className="w-full px-6 py-3 border-2 border-green-600 text-green-600 font-medium rounded-lg hover:bg-green-50 transition-colors"
        >
          Uruchom setup od nowa
        </button>
      </div>

      <p className="text-center text-xs text-gray-500">
        {installationMode === 'client_only'
          ? `Client connected to ${remoteApiBaseUrl || result.remoteApiBaseUrl || qrData.apiBase}`
          : `Your system is running locally at ${qrData.apiBase}`}
      </p>
    </div>
  );
}
