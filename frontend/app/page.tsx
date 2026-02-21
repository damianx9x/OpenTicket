'use client';

import { useEffect } from 'react';
import { applyRuntimeApiBaseFromSetupStatus, checkSetupStatus } from '@/lib/setup-client';
import { getStoredToken } from '@/lib/auth-client';

/**
 * Home Page - Auto-redirect to setup or dashboard
 */
export default function Home() {
  useEffect(() => {
    // Check system initialization status
    const checkAndRedirect = async () => {
      try {
        const status = await checkSetupStatus();
        applyRuntimeApiBaseFromSetupStatus(status);
        
        if (status.setupMode) {
          window.location.href = '/setup';
        } else {
          const token = getStoredToken();
          window.location.href = token ? '/dashboard' : '/login';
        }
      } catch (error) {
        console.error('Failed to check status:', error);
        window.location.href = '/setup';
      }
    };

    checkAndRedirect();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="inline-block">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
        </div>
        <p className="mt-4 text-lg font-medium text-gray-700">
          Loading OpenTicket...
        </p>
      </div>
    </div>
  );
}
