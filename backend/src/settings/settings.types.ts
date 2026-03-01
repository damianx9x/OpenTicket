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

export interface CostCatalogItem {
  id: string;
  name: string;
  unitNet: number;
  vatCode: string;
  defaultQty: number;
  category?: string;
  unit?: string;
  active: boolean;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  branding: {
    companyName: 'OpenTicket',
    logoDataUrl: '',
    theme: 'helpdesk-blue',
  },
  features: {
    technicianSelfSignup: false,
  },
  reminders: {
    enabled: true,
    channels: ['IN_APP'],
  },
  uiDefaults: {
    compactMode: false,
    defaultStatusFilter: '',
    defaultPriorityFilter: '',
    language: 'pl',
  },
  integrations: {
    email: {
      mode: 'disabled',
      provider: 'smtp',
      from: '',
      host: '',
      port: 587,
      secure: false,
      username: '',
    },
    sms: {
      mode: 'disabled',
      provider: 'webhook',
      sender: '',
    },
  },
  backup: {
    enabled: true,
    intervalHours: 24,
    targetPath: '',
    keepPrevious: true,
  },
};
