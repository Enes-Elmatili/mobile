import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.129.179:3000/api';

// Types

export interface ApiResponse<T = any> {
  ok?: boolean;
  data?: T;
  error?: string;
  [key: string]: any;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const token = await AsyncStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
    const headers = await this.getHeaders();
    const config: RequestInit = {
      method: options.method || 'GET',
      headers: { ...headers, ...options.headers },
    };

    if (options.body) {
      config.body = JSON.stringify(options.body);
    }

    console.log(`📡 API ${config.method} ${endpoint}`);
    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        console.error(`❌ API ERROR ${response.status}:`, data);
        throw new Error(data.error || data.message || `HTTP ${response.status}`);
      }

      console.log(`✅ API SUCCESS ${config.method} ${endpoint}`);
      return data;
    } catch (error: any) {
      console.error(`❌ API REQUEST FAILED:`, error.message);
      throw error;
    }
  }

  private post<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request(endpoint, { method: 'POST', body });
  }

  private put<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request(endpoint, { method: 'PUT', body });
  }

  private delete<T = any>(endpoint: string): Promise<T> {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // ==================== AUTH ====================
  auth = {
    login: (email: string, password: string) =>
      this.post('/auth/login', { email, password }),
    signup: (email: string, password: string, name?: string) =>
      this.post('/auth/signup', { email, password, name }),
    logout: () => this.post('/auth/logout'),
    refresh: () => this.post('/auth/refresh'),
  };

  // ==================== USER ====================
  user = {
    me: () => this.request('/me'),
    get: (id: string) => this.request(`/users/${id}`),
    list: () => this.request('/users'),
    update: (id: string, data: any) => this.put(`/users/${id}`, data),
  };

  // ==================== REQUESTS (CLIENT) ====================
  requests = {
    // Liste via dashboard (route qui fonctionne)
    list: async (params?: { page?: number; limit?: number }) => {
      const dashboard = await this.request('/client/dashboard');
      return {
        data: dashboard.requests || [],
        total: dashboard.requests?.length || 0,
      };
    },

    // ✅ Détails d'une request (corrigé)
    get: (id: string) => this.request(`/requests/${id}`),

    // Créer une request
    create: (data: any) => this.post('/requests', data),

    // Actions sur les requests
    accept: (id: string) => this.post(`/requests/${id}/accept`),
    decline: (id: string) => this.post(`/requests/${id}/refuse`),
    start: (id: string) => this.post(`/requests/${id}/start`),
    complete: (id: string) => this.post(`/requests/${id}/complete`),
    cancel: (id: string) => this.post(`/requests/${id}/cancel`),
  };

  // ==================== DASHBOARD ====================
  dashboard = {
    client: () => this.request('/client/dashboard'),
    provider: () => this.request('/provider/dashboard'),
  };

  // ==================== PROVIDERS ====================
  providers = {
    list: () => this.request('/providers'),
    get: (id: string) => this.request(`/providers/${id}`),
    nearby: (lat: number, lng: number, radius = 5000) =>
      this.request(`/providers/nearby?lat=${lat}&lng=${lng}&radius=${radius}`),
    missions: () => this.request('/providers/missions'),
    top: () => this.request('/providers/top'),
    ranked: () => this.request('/providers/ranked'),
  };

  // ==================== WALLET ====================
  wallet = {
    balance: () => this.request('/wallet'),
    transactions: (limit = 50) => this.request(`/wallet/txs?limit=${limit}`),
    credit: (amount: number) => this.post('/wallet/credit', { amount }),
    debit: (amount: number) => this.post('/wallet/debit', { amount }),
  };

  // ==================== NOTIFICATIONS ====================
  notifications = {
    list: () => this.request('/notifications'),
    markAsRead: (id: string) => this.put(`/notifications/${id}/read`),
    markAllAsRead: () => this.put('/notifications/read-all'),
  };

  // ==================== MESSAGES ====================
  messages = {
    list: () => this.request('/messages'),
    get: (id: string) => this.request(`/messages/${id}`),
    send: (recipientId: string, content: string) =>
      this.post('/messages', { recipientId, content }),
  };

  // ==================== RATINGS ====================
  ratings = {
    create: (data: { requestId: string; rating: number; comment?: string }) =>
      this.post('/ratings', data),
    list: (providerId?: string) => {
      const query = providerId ? `?providerId=${providerId}` : '';
      return this.request(`/ratings${query}`);
    },
  };

  // ==================== TICKETS ====================
  tickets = {
    list: () => this.request('/tickets'),
    get: (id: string) => this.request(`/tickets/${id}`),
    create: (data: any) => this.post('/tickets', data),
  };

  // ==================== DOCUMENTS ====================
  documents = {
    list: () => this.request('/documents'),
    getTicket: (id: string) => this.request(`/documents/tickets/${id}`),
    getContract: (id: string) => this.request(`/documents/contracts/${id}`),
    getInvoice: (id: string) => this.request(`/documents/invoices/${id}`),
  };

  // ==================== BUSINESS ====================
  contracts = {
    list: () => this.request('/contracts'),
    get: (id: string) => this.request(`/contracts/${id}`),
    create: (data: any) => this.post('/contracts', data),
  };

  payments = {
    list: () => this.request('/payments'),
    get: (id: string) => this.request(`/payments/${id}`),
    create: (data: any) => this.post('/payments', data),
  };

  // ==================== STATS ====================
  stats = {
    global: () => this.request('/stats'),
    exportCSV: () => this.request('/stats/requests.csv'),
    exportPDF: () => this.request('/export/requests.pdf'),
  };

  // ==================== SUBSCRIPTION ====================
  subscription = {
    get: () => this.request('/subscription'),
    create: (plan: string) => this.post('/subscription', { plan }),
    cancel: () => this.delete('/subscription'),
  };
}

// Instance singleton
export const api = new ApiClient(API_BASE_URL);

// Legacy client pour compatibilité (AuthContext, login.tsx)
export async function client(endpoint: string, method = 'GET', body?: any) {
  return api.request(endpoint, { method: method as any, body });
}

export type { RequestOptions };
