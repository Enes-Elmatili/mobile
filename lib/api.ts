import Constants from 'expo-constants';
import { tokenStorage } from './storage';

const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'http://192.168.129.179:3000/api';

console.log('🌐 API_BASE_URL:', API_BASE_URL);

export interface ApiResponse<T = any> {
  ok?: boolean;
  data?: T;
  error?: string;
  [key: string]: any;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  private baseURL: string;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<string | null> | null = null;
  private pendingRequests: (() => void)[] = [];

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const token = await tokenStorage.getToken();
    
    if (__DEV__) {
      console.log('🔐 Token status:', token ? `Present (${token.slice(0, 10)}...)` : '❌ NULL');
    }
    
    if (!token) {
      console.warn('⚠️ API Request sent WITHOUT Token!');
    }

    return {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  // 🆕 TOKEN REFRESH with request queueing
  private async refreshAccessToken(): Promise<string | null> {
    if (this.isRefreshing) {
      return new Promise((resolve) => {
        this.pendingRequests.push(() => resolve(tokenStorage.getCachedToken()));
      });
    }

    this.isRefreshing = true;
    
    try {
      const currentToken = await tokenStorage.getToken();
      if (!currentToken) {
        console.log('❌ No token available for refresh');
        return null;
      }

      console.log('🔄 Refreshing access token...');
      
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log('❌ Refresh failed:', errorData.error || response.status);
        return null;
      }

      const data = await response.json();
      
      if (!data.token) {
        console.log('❌ No token in refresh response');
        return null;
      }
      
      await tokenStorage.setToken(data.token);
      console.log('✅ Token refreshed successfully');
      return data.token;
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      return null;
    } finally {
      this.isRefreshing = false;
      this.pendingRequests.forEach(cb => cb());
      this.pendingRequests = [];
    }
  }

  async request<T = any>(endpoint: string, options: RequestOptions = {}, retryCount = 0): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
    const headers = await this.getHeaders();

    const config: RequestInit = {
      method: options.method || 'GET',
      headers: { ...headers, ...options.headers },
    };

    if (options.body) {
      config.body = JSON.stringify(options.body);
    }

    console.log(`📡 API ${config.method} ${url}`);

    try {
      const response = await fetch(url, config);
      const text = await response.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error(`❌ API NON-JSON RESPONSE at ${url}`);
        console.error(`📄 Content preview: ${text.slice(0, 500)}`);
        
        const error: any = new Error(`API returned invalid JSON (Status: ${response.status})`);
        error.status = response.status;
        throw error;
      }

      // 🔧 FIX: Handle 401 with retry logic
      if (response.status === 401 && retryCount === 0) {
        console.log('🔐 Got 401, attempting token refresh...');
        
        const newToken = await this.refreshAccessToken();
        
        if (newToken) {
          console.log('🔄 Retrying request with new token...');
          return this.request(endpoint, options, retryCount + 1);
        } else {
          console.log('❌ Token refresh failed, clearing session...');
          await tokenStorage.removeToken();
        }
      }

      if (!response.ok) {
        console.error(`❌ API ERROR ${response.status}:`, data);
        const error: any = new Error(data.error || data.message || `HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      console.log(`✅ API SUCCESS ${config.method} ${endpoint}`);
      return data;
    } catch (error: any) {
      console.error(`❌ API REQUEST FAILED:`, error.message);
      throw error;
    }
  }

  // 🆕 PUBLIC HTTP METHODS
  get = <T = any>(endpoint: string): Promise<T> => this.request(endpoint, { method: 'GET' });
  
  post = <T = any>(endpoint: string, body?: any): Promise<T> => 
    this.request(endpoint, { method: 'POST', body });
  
  put = <T = any>(endpoint: string, body?: any): Promise<T> => 
    this.request(endpoint, { method: 'PUT', body });
  
  patch = <T = any>(endpoint: string, body?: any): Promise<T> => 
    this.request(endpoint, { method: 'PATCH', body });
  
  delete = <T = any>(endpoint: string): Promise<T> => 
    this.request(endpoint, { method: 'DELETE' });

  // ==================== AUTH ====================
  auth = {
    login: async (email: string, password: string) => {
      const result = await this.post('/auth/login', { email, password });
      if (result.token) {
        await tokenStorage.setToken(result.token);
      }
      return result;
    },
    signup: async (email: string, password: string, name?: string) => {
      const result = await this.post('/auth/signup', { email, password, name });
      if (result.token) {
        await tokenStorage.setToken(result.token);
      }
      return result;
    },
    logout: async () => {
      try {
        await this.post('/auth/logout');
      } finally {
        await tokenStorage.removeToken();
      }
    },
    refresh: () => this.post('/auth/refresh'),
  };

  // ==================== USER ====================
  user = {
    me: () => this.request('/auth/me'),
    get: (id: string) => this.request(`/users/${id}`),
    list: () => this.request('/users'),
    update: (id: string, data: any) => this.put(`/users/${id}`, data),
  };

  // ==================== REQUESTS (CLIENT) ====================
  requests = {
    list: async (params?: { page?: number; limit?: number }) => {
      const dashboard = await this.request<any>('/client/dashboard');
      return {
        data: dashboard.requests || [],
        total: dashboard.requests?.length || 0,
      };
    },
    get: (id: string) => this.request(`/requests/${id}`),
    create: (data: any) => this.post('/requests', data),
    accept: (id: string) => this.post(`/requests/${id}/accept`),
    decline: (id: string) => this.post(`/requests/${id}/refuse`),
    start: (id: string) => this.post(`/requests/${id}/start`),
    complete: (id: string) => this.post(`/requests/${id}/complete`),
    cancel: (id: string) => this.post(`/requests/${id}/cancel`),
  };

  // ==================== TAXONOMIES ====================
  taxonomies = {
    list: () => this.request('/categories'),
    get: (id: string) => this.request(`/categories/${id}`),
    subcategories: (categoryId: string) => this.request(`/categories/${categoryId}/subcategories`),
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

  // ==================== PAYMENTS ====================
  payments = {
    list: () => this.request('/payments'),
    get: (id: string) => this.request(`/payments/${id}`),
    intent: async (requestId: string) => {
      const token = await tokenStorage.getToken();
      if (!token) throw new Error("⛔️ Erreur Session: Veuillez vous reconnecter avant de payer.");
      return this.post('/payments/intent', { requestId });
    },
    // ✅ FIXED: Added missing success method
    success: async (requestId: string) => {
      console.log(`✅ Confirming payment success for request ${requestId}`);
      return this.post('/payments/success', { requestId });
    },
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

  storage = tokenStorage;
}

export const api = new ApiClient(API_BASE_URL);

export async function client(endpoint: string, method = 'GET', body?: any) {
  return api.request(endpoint, { method: method as any, body });
}

export { tokenStorage } from './storage';