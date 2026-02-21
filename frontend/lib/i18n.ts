export type UILanguage = 'pl' | 'en';

export const SUPPORTED_LANGUAGES: UILanguage[] = ['pl', 'en'];

export function normalizeLanguage(value: string | null | undefined): UILanguage {
  return value === 'en' ? 'en' : 'pl';
}

export const STATUS_LABELS: Record<UILanguage, Record<string, string>> = {
  pl: {
    RECEIVED: 'PRZYJĘTE',
    DIAGNOSIS: 'DIAGNOZA',
    QUOTE_READY: 'KOSZTORYS',
    PARTS_ORDERED: 'ZAMAWIANIE CZĘŚCI',
    WAITING_FOR_APPROVAL: 'OCZEKUJE NA ZGODĘ',
    SENT_TO_CUSTOMER: 'WYSŁANE DO KLIENTA',
    NEW: 'NOWE',
    IN_PROGRESS: 'W TOKU',
    WAITING_FOR_CUSTOMER: 'OCZEKUJE NA KLIENTA',
    RESOLVED: 'ROZWIĄZANE',
    CLOSED: 'ZAMKNIĘTE',
    ARCHIVED: 'ZARCHIWIZOWANE',
  },
  en: {
    RECEIVED: 'RECEIVED',
    DIAGNOSIS: 'DIAGNOSIS',
    QUOTE_READY: 'QUOTE READY',
    PARTS_ORDERED: 'PARTS ORDERED',
    WAITING_FOR_APPROVAL: 'WAITING FOR APPROVAL',
    SENT_TO_CUSTOMER: 'SENT TO CUSTOMER',
    NEW: 'NEW',
    IN_PROGRESS: 'IN PROGRESS',
    WAITING_FOR_CUSTOMER: 'WAITING FOR CUSTOMER',
    RESOLVED: 'RESOLVED',
    CLOSED: 'CLOSED',
    ARCHIVED: 'ARCHIVED',
  },
};

export const PRIORITY_LABELS: Record<UILanguage, Record<string, string>> = {
  pl: {
    LOW: 'NISKI',
    NORMAL: 'NORMALNY',
    HIGH: 'WYSOKI',
    URGENT: 'PILNY',
  },
  en: {
    LOW: 'LOW',
    NORMAL: 'NORMAL',
    HIGH: 'HIGH',
    URGENT: 'URGENT',
  },
};

export const ROLE_LABELS: Record<UILanguage, Record<string, string>> = {
  pl: {
    ADMIN: 'Administrator',
    AGENT: 'Technik',
    REPORTER: 'Zgłaszający',
    VIEWER: 'Podgląd',
  },
  en: {
    ADMIN: 'Admin',
    AGENT: 'Technician',
    REPORTER: 'Reporter',
    VIEWER: 'Viewer',
  },
};
