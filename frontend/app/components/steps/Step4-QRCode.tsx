'use client';

import { useState, useEffect } from 'react';
import QRCodeDisplay from '../QRCodeDisplay';
import { SetupResponse } from '@/lib/setup-client';

interface Step4Props {
  result: SetupResponse;
  onNewSetup: () => void;
}

/**
 * Step 4: QR Code Display & Completion
 * Shows QR code for iOS app to scan and connect
 */
export function InitStep4({ result, onNewSetup }: Step4Props) {
  const [copyFeedback, setCopyFeedback] = useState('');
  const [localIp, setLocalIp] = useState<string>('localhost');

  useEffect(() => {
    const getLocalIp = async () => {
      try {
        // Try to get local IP from Electron
        if (typeof window !== 'undefined' && (window as any).electron?.getLocalIp) {
          const ip = await (window as any).electron.getLocalIp();
          setLocalIp(ip);
        } else {
          // Fallback to browser hostname
          setLocalIp(window.location.hostname || 'localhost');
        }
      } catch (error) {
        console.error('Failed to get local IP:', error);
        setLocalIp(window.location.hostname || 'localhost');
      }
    };

    getLocalIp();
  }, []);

  const qrData = {
    apiBase: `http://${localIp}:3000`,
    token: 'temporary-pairing-token', // This would be generated on the backend
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
          ✅ System Initialized Successfully!
        </h2>
        <p className="text-gray-600">
          Your ticket system is ready to use. Scan the QR code with your iPhone to connect.
        </p>
      </div>

      {/* QR Code Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 flex justify-center">
        <QRCodeDisplay data={qrData} />
      </div>

      {/* Setup Summary */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-3">
        <h3 className="font-semibold text-green-900">✓ Setup Complete</h3>
        <div className="text-sm text-green-800 space-y-1">
          <p>✓ Database created: {result.configPath}/app.db</p>
          <p>✓ Configuration saved</p>
          <p>✓ Admin account created: {result.adminUserId}</p>
          <p>✓ {result.migrationsApplied || 0} migrations applied</p>
        </div>
      </div>

      {/* Connection Info */}
      <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="font-medium text-blue-900">📱 Connect Your iPhone:</p>
        <ol className="text-sm text-blue-800 space-y-2">
          <li>1. Open the Ticket System app on your iPhone</li>
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

      {/* Next Steps */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-800">📋 Next Steps:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="font-medium text-gray-800">💻 Web Dashboard</p>
            <p className="text-gray-600 mt-1">
              <a
                href={qrData.apiBase}
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
              Email: <code className="text-xs bg-white px-1 rounded">
                {result.adminUserId}
              </code>
            </p>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="font-medium text-gray-800">💾 Data Location</p>
            <p className="text-gray-600 text-xs mt-1 break-all">
              {result.configPath}
            </p>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="font-medium text-gray-800">📚 Documentation</p>
            <p className="text-gray-600 mt-1">
              <a
                href="/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                API Docs (Swagger) →
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={onNewSetup}
        className="w-full px-6 py-3 border-2 border-green-600 text-green-600 font-medium rounded-lg hover:bg-green-50 transition-colors"
      >
        ✓ Continue to Dashboard
      </button>

      {/* Footer */}
      <p className="text-center text-xs text-gray-500">
        Your system is running locally at <code>{qrData.apiBase}</code>
      </p>
    </div>
  );
}
