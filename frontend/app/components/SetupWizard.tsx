'use client';

import { useEffect, useState } from 'react';
import { InitStep1 } from './steps/Step1-Location';
import { InitStep2 } from './steps/Step2-Admin';
import { InitStep3 } from './steps/Step3-Progress';
import { InitStep4 } from './steps/Step4-QRCode';
import {
  applyRuntimeApiBaseFromSetupStatus,
  initializeClientOnlyMode,
  InstallationMode,
  SetupBootstrapMode,
  SetupRequest,
  SetupResponse,
} from '@/lib/setup-client';

export interface SetupWizardState {
  currentStep: 1 | 2 | 3 | 4;
  installationMode: InstallationMode;
  dataPath: string;
  remoteApiBaseUrl: string;
  bootstrapMode: SetupBootstrapMode;
  existingDatabasePath: string;
  existingBackupArchivePath: string;
  demoTicketCount: number;
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: number;
  autoBackupPath: string;
  adminEmail: string;
  adminPassword: string;
  organizationName: string;
  setupResult: SetupResponse | null;
  isLoading: boolean;
  error: string | null;
}

interface SetupWizardProps {
  onComplete?: (result: SetupResponse) => void;
  initialDataPath?: string;
}

/**
 * Multi-step Setup Wizard
 * Step 1: Choose storage location
 * Step 2: Admin credentials
 * Step 3: Initialization progress
 * Step 4: QR code for iOS pairing
 */
export default function SetupWizard({ onComplete, initialDataPath = '' }: SetupWizardProps) {
  const [state, setState] = useState<SetupWizardState>({
    currentStep: 1,
    installationMode: 'server_client',
    dataPath: initialDataPath,
    remoteApiBaseUrl: '',
    bootstrapMode: 'fresh',
    existingDatabasePath: '',
    existingBackupArchivePath: '',
    demoTicketCount: 200,
    autoBackupEnabled: true,
    autoBackupIntervalHours: 24,
    autoBackupPath: '',
    adminEmail: '',
    adminPassword: '',
    organizationName: '',
    setupResult: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!initialDataPath) {
      return;
    }

    setState((prev) => {
      if (prev.dataPath) {
        return prev;
      }
      return {
        ...prev,
        dataPath: initialDataPath,
      };
    });
  }, [initialDataPath]);

  const handleStep1Continue = (payload: {
    installationMode: InstallationMode;
    dataPath: string;
    remoteApiBaseUrl?: string;
    bootstrapMode?: SetupBootstrapMode;
    existingDatabasePath?: string;
    existingBackupArchivePath?: string;
    demoTicketCount?: number;
    autoBackupEnabled?: boolean;
    autoBackupIntervalHours?: number;
    autoBackupPath?: string;
  }) => {
    setState((prev) => ({
      ...prev,
      installationMode: payload.installationMode,
      dataPath: payload.dataPath,
      remoteApiBaseUrl: payload.remoteApiBaseUrl || '',
      bootstrapMode: payload.bootstrapMode || 'fresh',
      existingDatabasePath: payload.existingDatabasePath || '',
      existingBackupArchivePath: payload.existingBackupArchivePath || '',
      demoTicketCount:
        payload.bootstrapMode === 'demo_dataset'
          ? Math.max(20, Math.min(1000, Math.floor(payload.demoTicketCount || 200)))
          : 200,
      autoBackupEnabled:
        payload.installationMode === 'client_only'
          ? false
          : payload.autoBackupEnabled ?? prev.autoBackupEnabled,
      autoBackupIntervalHours:
        payload.installationMode === 'client_only'
          ? prev.autoBackupIntervalHours
          : Math.max(1, Math.min(168, Math.floor(payload.autoBackupIntervalHours || prev.autoBackupIntervalHours || 24))),
      autoBackupPath: payload.installationMode === 'client_only' ? '' : payload.autoBackupPath || prev.autoBackupPath || '',
      currentStep: payload.installationMode === 'client_only' ? 3 : 2,
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
      let result: SetupResponse;
      if (state.installationMode === 'client_only') {
        result = await initializeClientOnlyMode({
          remoteApiBaseUrl: state.remoteApiBaseUrl,
        });
      } else {
        const request: SetupRequest = {
          dataPath: state.dataPath,
          adminEmail: state.adminEmail,
          adminPassword: state.adminPassword,
          organizationName: state.organizationName || undefined,
          bootstrapMode: state.bootstrapMode,
          existingDatabasePath: state.existingDatabasePath || undefined,
          existingBackupArchivePath: state.existingBackupArchivePath || undefined,
          demoTicketCount: state.bootstrapMode === 'demo_dataset' ? state.demoTicketCount : undefined,
          autoBackupEnabled: state.autoBackupEnabled,
          autoBackupIntervalHours: state.autoBackupIntervalHours,
          autoBackupPath: state.autoBackupPath || undefined,
        };
        result = await initializeSystem(request);
      }

      if (result.success) {
        applyRuntimeApiBaseFromSetupStatus({
          isSetup: true,
          setupMode: false,
          installationMode: result.installationMode || state.installationMode,
          remoteApiBaseUrl: result.remoteApiBaseUrl || state.remoteApiBaseUrl,
        });
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

  const handleContinueToDashboard = async () => {
    if (state.installationMode === 'client_only') {
      window.location.href = '/login';
      return;
    }

    // Best UX: auto-login with just-created admin and open dashboard directly.
    // Fallback to login screen if automatic session creation fails.
    try {
      const { login } = await import('@/lib/auth-client');
      await login(state.adminEmail, state.adminPassword);
      window.location.href = '/dashboard';
      return;
    } catch (error) {
      console.warn('Auto login after setup failed:', error);
    }

    const email = encodeURIComponent(state.adminEmail || '');
    window.location.href = `/login${email ? `?email=${email}` : ''}`;
  };

  const handleGoBack = () => {
    setState((prev) => ({
      ...prev,
      currentStep:
        prev.installationMode === 'client_only' && prev.currentStep === 3
          ? 1
          : (Math.max(1, prev.currentStep - 1) as 1 | 2 | 3 | 4),
      error: null,
    }));
  };

  const resetWizard = () => {
    setState({
      currentStep: 1,
      installationMode: 'server_client',
      dataPath: '',
      remoteApiBaseUrl: '',
      bootstrapMode: 'fresh',
      existingDatabasePath: '',
      existingBackupArchivePath: '',
      demoTicketCount: 200,
      autoBackupEnabled: true,
      autoBackupIntervalHours: 24,
      autoBackupPath: '',
      adminEmail: '',
      adminPassword: '',
      organizationName: '',
      setupResult: null,
      isLoading: false,
      error: null,
    });
  };

  const progressSteps = state.installationMode === 'client_only' ? [1, 3, 4] : [1, 2, 3, 4];
  const visualStepIndex = progressSteps.findIndex((step) => step === state.currentStep);
  const visualCurrentStep = visualStepIndex >= 0 ? visualStepIndex + 1 : 1;
  const visualTotalSteps = progressSteps.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {progressSteps.map((step) => (
              <div
                key={step}
                className={`flex-1 h-2 mx-1 rounded-full transition-colors ${
                  step <= state.currentStep ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-600 text-center">
            Step {visualCurrentStep} of {visualTotalSteps}
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
                installationMode: state.installationMode,
                dataPath: state.dataPath,
                remoteApiBaseUrl: state.remoteApiBaseUrl,
                bootstrapMode: state.bootstrapMode,
                existingDatabasePath: state.existingDatabasePath,
                existingBackupArchivePath: state.existingBackupArchivePath,
                demoTicketCount: state.demoTicketCount,
                autoBackupEnabled: state.autoBackupEnabled,
                autoBackupIntervalHours: state.autoBackupIntervalHours,
                autoBackupPath: state.autoBackupPath,
                adminEmail: state.adminEmail,
                organizationName: state.organizationName,
              }}
            />
          )}

          {state.currentStep === 4 && state.setupResult && (
            <InitStep4
              result={state.setupResult}
              installationMode={state.installationMode}
              remoteApiBaseUrl={state.remoteApiBaseUrl}
              onNewSetup={resetWizard}
              onContinueToDashboard={() => void handleContinueToDashboard()}
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
