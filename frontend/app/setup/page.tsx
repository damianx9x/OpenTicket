'use client';

import { useEffect, useState } from 'react';
import SetupWizard from '@/app/components/SetupWizard';
import { checkSetupStatus } from '@/lib/setup-client';
import type { SetupResponse } from '@/lib/setup-client';

/**
 * Setup Page
 * Entry point for system initialization
 * Automatically redirects to dashboard if system is already configured
 */
export default function SetupPage() {
  const [setupStatus, setSetupStatus] = useState<{
    isSetup: boolean;
    loading: boolean;
  }>({ isSetup: false, loading: true });

  useEffect(() => {
    // Check if system is already initialized
    const checkStatus = async () => {
      try {
        const status = await checkSetupStatus();
        if (status.isSetup) {
          // System already configured, redirect to dashboard
          window.location.href = '/dashboard';
        } else {
          setSetupStatus({ isSetup: false, loading: false });
        }
      } catch (error) {
        console.error('Failed to check setup status:', error);
        setSetupStatus({ isSetup: false, loading: false });
      }
    };

    checkStatus();
  }, []);

  const handleSetupComplete = (result: SetupResponse) => {
    if (result.success) {
      // Redirect to dashboard after successful setup
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 3000);
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

  return <SetupWizard onComplete={handleSetupComplete} />;
}
