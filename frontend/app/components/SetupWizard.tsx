'use client';

import { useEffect, useState } from 'react';
import { InitStep1 } from './steps/Step1-Location';
import { InitStep2 } from './steps/Step2-Admin';
import { InitStep3 } from './steps/Step3-Progress';
import { InitStep4 } from './steps/Step4-QRCode';
import { SetupRequest, SetupResponse } from '@/lib/setup-client';

export interface SetupWizardState {
  currentStep: 1 | 2 | 3 | 4;
  dataPath: string;
  adminEmail: string;
  adminPassword: string;
  organizationName: string;
  setupResult: SetupResponse | null;
  isLoading: boolean;
  error: string | null;
}

interface SetupWizardProps {
  onComplete?: (result: SetupResponse) => void;
}

/**
 * Multi-step Setup Wizard
 * Step 1: Choose storage location
 * Step 2: Admin credentials
 * Step 3: Initialization progress
 * Step 4: QR code for iOS pairing
 */
export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [state, setState] = useState<SetupWizardState>({
    currentStep: 1,
    dataPath: '',
    adminEmail: '',
    adminPassword: '',
    organizationName: '',
    setupResult: null,
    isLoading: false,
    error: null,
  });

  const handleStep1Continue = (dataPath: string) => {
    setState((prev) => ({
      ...prev,
      dataPath,
      currentStep: 2,
      error: null,
    }));
  };

  const handleStep2Continue = (adminEmail: string, adminPassword: string, organizationName: string) => {
    setState((prev) => ({
      ...prev,
      adminEmail,
      adminPassword,
      organizationName,
      currentStep: 3,
      error: null,
    }));
  };

  const handleStep3Initialize = async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const { initializeSystem } = await import('@/lib/setup-client');

      const request: SetupRequest = {
        dataPath: state.dataPath,
        adminEmail: state.adminEmail,
        adminPassword: state.adminPassword,
        organizationName: state.organizationName || undefined,
      };

      const result = await initializeSystem(request);

      if (result.success) {
        setState((prev) => ({
          ...prev,
          setupResult: result,
          currentStep: 4,
          isLoading: false,
        }));
        onComplete?.(result);
      } else {
        setState((prev) => ({
          ...prev,
          error: result.message,
          isLoading: false,
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isLoading: false,
      }));
    }
  };

  const handleGoBack = () => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(1, prev.currentStep - 1) as 1 | 2 | 3 | 4,
      error: null,
    }));
  };

  const resetWizard = () => {
    setState({
      currentStep: 1,
      dataPath: '',
      adminEmail: '',
      adminPassword: '',
      organizationName: '',
      setupResult: null,
      isLoading: false,
      error: null,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`flex-1 h-2 mx-1 rounded-full transition-colors ${
                  step <= state.currentStep ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-600 text-center">
            Step {state.currentStep} of 4
          </p>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          {state.error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">⚠️ Error</p>
              <p className="text-red-700 text-sm mt-1">{state.error}</p>
            </div>
          )}

          {state.currentStep === 1 && (
            <InitStep1
              onContinue={handleStep1Continue}
              defaultValue={state.dataPath}
            />
          )}

          {state.currentStep === 2 && (
            <InitStep2
              onContinue={handleStep2Continue}
              onBack={handleGoBack}
              defaultEmail={state.adminEmail}
              defaultPassword={state.adminPassword}
              defaultOrg={state.organizationName}
            />
          )}

          {state.currentStep === 3 && (
            <InitStep3
              onContinue={handleStep3Initialize}
              onBack={handleGoBack}
              isLoading={state.isLoading}
              summary={{
                dataPath: state.dataPath,
                adminEmail: state.adminEmail,
                organizationName: state.organizationName,
              }}
            />
          )}

          {state.currentStep === 4 && state.setupResult && (
            <InitStep4
              result={state.setupResult}
              onNewSetup={resetWizard}
            />
          )}
        </div>

        {/* Footer Info */}
        {state.currentStep < 4 && (
          <p className="text-center text-sm text-gray-600 mt-6">
            🔒 Your data will be stored locally and encrypted
          </p>
        )}
      </div>
    </div>
  );
}
