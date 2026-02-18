'use client';

import { useEffect, useState } from 'react';

/**
 * Dashboard Page
 * Main application page after setup
 * Will be populated with ticket management UI in future phases
 */
export default function DashboardPage() {
  const [resetLoading, setResetLoading] = useState(false);
  const isElectron = typeof window !== 'undefined' && 'electron' in window;

  useEffect(() => {
    // Check if system is initialized
    const checkInit = async () => {
      try {
        const response = await fetch('/api/v1/setup/status', {
          method: 'POST',
        });
        const status = await response.json();
        
        if (status.setupMode) {
          // Redirect to setup if not configured
          window.location.href = '/setup';
        }
      } catch (error) {
        console.error('Failed to check initialization:', error);
      }
    };

    checkInit();
  }, []);

  const handleResetSetup = async () => {
    if (!isElectron) {
      alert('Reset function only available in desktop app');
      return;
    }

    if (!confirm('Are you sure you want to reset the setup? You will need to reconfigure on restart.')) {
      return;
    }

    setResetLoading(true);
    try {
      const result = await (window as any).electron.resetSetup();
      if (result.success) {
        alert(result.message);
        // Reload page
        setTimeout(() => window.location.reload(), 1000);
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          Ticket System Dashboard
        </h1>
        
        <div className="bg-white rounded-lg shadow p-8 space-y-6">
          <div className="border-l-4 border-blue-600 pl-4">
            <h2 className="text-xl font-semibold text-gray-800">✅ System Ready</h2>
            <p className="text-gray-600 mt-1">
              Your ticket system has been successfully initialized and is ready to use.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="font-medium text-blue-900">🎫 Tickets</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">0</p>
              <p className="text-sm text-blue-700 mt-1">Total tickets</p>
            </div>
            
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-medium text-green-900">💬 Comments</p>
              <p className="text-3xl font-bold text-green-600 mt-2">0</p>
              <p className="text-sm text-green-700 mt-1">Recent comments</p>
            </div>
            
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="font-medium text-purple-900">📱 Mobile Apps</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">0</p>
              <p className="text-sm text-purple-700 mt-1">Connected devices</p>
            </div>
          </div>

          <div className="border-t pt-6 mt-6">
            <h3 className="font-semibold text-gray-800 mb-3">📋 Quick Start:</h3>
            <ul className="space-y-2 text-gray-600">
              <li>✓ View API documentation at <a href="/api/docs" className="text-blue-600 hover:underline">/api/docs</a></li>
              <li>✓ Create your first ticket from the tickets section (coming soon)</li>
              <li>✓ Invite team members to collaborate</li>
              <li>✓ Scan the QR code to connect your iPhone</li>
            </ul>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-900 text-sm">
              <strong>🔄 PHASE 2 Status:</strong> Full dashboard UI with tickets management is coming next. Currently in development.
            </p>
          </div>

          {isElectron && (
            <div className="border-t pt-6 mt-6">
              <h3 className="font-semibold text-gray-800 mb-3">🔧 Maintenance:</h3>
              <button
                onClick={handleResetSetup}
                disabled={resetLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-medium transition"
              >
                {resetLoading ? 'Resetting...' : 'Reset Setup'}
              </button>
              <p className="text-sm text-gray-600 mt-2">
                Reset the setup process to reconfigure the data storage location and admin account.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
