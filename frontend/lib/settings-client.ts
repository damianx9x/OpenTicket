import { requestData } from '@/lib/api-base';

export interface SystemSettings {
  branding: {
    companyName: string;
    logoDataUrl: string;
    theme: string;
  };
  features: {
    technicianSelfSignup: boolean;
  };
  reminders: {
    enabled: boolean;
    channels: string[];
  };
  uiDefaults: {
    compactMode: boolean;
    defaultStatusFilter: string;
    defaultPriorityFilter: string;
    language: 'pl' | 'en';
  };
  integrations: {
    email: {
      mode: 'disabled' | 'smtp' | 'webhook';
      provider: string;
      from: string;
      host: string;
      port: number;
      secure: boolean;
      username: string;
      password?: string;
      webhookUrl?: string;
    };
    sms: {
      mode: 'disabled' | 'twilio' | 'webhook';
      provider: string;
      sender: string;
      accountSid?: string;
      authToken?: string;
      webhookUrl?: string;
    };
  };
  backup: {
    enabled: boolean;
    intervalHours: number;
    targetPath: string;
    keepPrevious: boolean;
  };
}

export async function getPublicSettings() {
  return requestData<Pick<SystemSettings, 'branding' | 'uiDefaults' | 'features'>>(
    '/api/v1/settings/public',
  );
}

export async function getAdminSettings() {
  return requestData<SystemSettings>('/api/v1/settings/admin');
}

export async function updateAdminSettings(patch: Partial<SystemSettings>) {
  return requestData<SystemSettings>('/api/v1/settings/admin', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export async function sendTestEmail(payload: {
  to: string;
  subject?: string;
  message?: string;
}) {
  return requestData('/api/v1/notifications/test/email', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function sendTestSms(payload: { to: string; message?: string }) {
  return requestData('/api/v1/notifications/test/sms', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
