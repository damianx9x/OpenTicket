/**
 * API Client - Frontend Services Layer
 * Communicates with backend API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333/api/v1';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, any>;
}

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

// Generic fetch wrapper with error handling
async function apiCall<T>(endpoint: string, options: FetchOptions = {}): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    return { success: true, ...data };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Network error: ${errorMsg}` };
  }
}

// ============= TICKETS API =============

export const ticketsAPI = {
  // Pobierz listę ticketów z filtrami
  async getAll(filters?: { status?: string; priority?: string; search?: string; assignedTo?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.assignedTo) params.append('assignedTo', filters.assignedTo);

    return apiCall<any[]>(`/tickets?${params.toString()}`);
  },

  // Pobierz szczegóły ticketu
  async getById(id: string) {
    return apiCall<any>(`/tickets/${id}`);
  },

  // Utwórz nowy ticket
  async create(ticket: {
    title: string;
    description: string;
    priority?: string;
    deviceType?: string;
    deviceSN?: string;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
  }) {
    return apiCall<any>('/tickets', {
      method: 'POST',
      body: JSON.stringify(ticket),
    });
  },

  // Edytuj ticket
  async update(id: string, updates: Record<string, any>) {
    return apiCall<any>(`/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  // Dodaj komentarz
  async addComment(id: string, comment: { author: string; text: string; isInternal?: boolean }) {
    return apiCall<any>(`/tickets/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify(comment),
    });
  },

  // Dodaj koszt
  async addCostItem(id: string, costItem: { description: string; quantity: number; unitPrice: number; vat?: number }) {
    return apiCall<any>(`/tickets/${id}/cost-items`, {
      method: 'POST',
      body: JSON.stringify(costItem),
    });
  },

  // Generuj QR code
  async generateQR(id: string) {
    return apiCall<any>(`/tickets/${id}/generate-qr`, {
      method: 'POST',
    });
  },
};

// ============= USERS API =============

export const usersAPI = {
  async getAll() {
    return apiCall<any[]>('/users');
  },

  async create(user: { name: string; email: string; role?: string }) {
    return apiCall<any>('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  },
};

// ============= VAT RATES API =============

export const vatRatesAPI = {
  async getAll() {
    return apiCall<any[]>('/vat-rates');
  },

  async create(rate: { rate: number; label: string; description?: string }) {
    return apiCall<any>('/vat-rates', {
      method: 'POST',
      body: JSON.stringify(rate),
    });
  },
};

// ============= ATTACHMENTS API =============

export const attachmentsAPI = {
  async getPresignedUrl(ticketId: string, fileName: string, fileType: string) {
    return apiCall<any>('/attachments/presigned-url', {
      method: 'POST',
      body: JSON.stringify({ ticketId, fileName, fileType }),
    });
  },
};

// ============= DIAGNOSTICS =============

export const diagnosticsAPI = {
  async getHealth() {
    return apiCall<any>('/health');
  },

  async getDiagnostics() {
    return apiCall<any>('/diagnostics');
  },
};
