'use client';

import { useEffect } from 'react';

/**
 * Home Page - Auto-redirect to setup or dashboard
 */
export default function Home() {
  useEffect(() => {
    // Check system initialization status
    const checkAndRedirect = async () => {
      try {
        const response = await fetch('/api/v1/setup/status', {
          method: 'POST',
        });
        const status = await response.json();
        
        if (status.setupMode) {
          // System needs setup
          window.location.href = '/setup';
        } else {
          // System is configured, go to dashboard
          window.location.href = '/dashboard';
        }
      } catch (error) {
        // Default to setup on error
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
          Loading Ticket System...
        </p>
      </div>
    </div>
  );
}