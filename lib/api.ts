import { Alert } from 'react-native';
import { tokenStorage } from './storage';
import { devLog, devWarn, devError } from './logger';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error('EXPO_PUBLIC_API_URL environment variable is required');
}

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
  private pendingRequests: ((token: string | null) => void)[] = [];

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const token = await tokenStorage.getToken();
    
    if (__DEV__) {
      devLog('🔐 Token status:', token ? `Present (${token.slice(0, 10)}...)` : '❌ NULL');
    }
    
    if (!token) {
      devWarn('⚠️ API Request sent WITHOUT Token!');
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
        this.pendingRequests.push((newToken: string | null) => resolve(newToken));
      });
    }

    this.isRefreshing = true;
    let newToken: string | null = null;

    try {
      const currentToken = await tokenStorage.getToken();
      if (!currentToken) {
        devLog('❌ No token available for refresh');
        return null;
      }

      devLog('🔄 Refreshing access token...');

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
        devLog('❌ Refresh failed:', errorData.error || response.status);
        return null;
      }

      const data = await response.json();

      if (!data.token) {
        devLog('❌ No token in refresh response');
        return null;
      }

      await tokenStorage.setToken(data.token);
      newToken = data.token;
      devLog('✅ Token refreshed successfully');
      return newToken;
    } catch (error) {
      devError('❌ Token refresh error:', error);
      return null;
    } finally {
      // Flush pending BEFORE clearing flag to prevent duplicate refresh
      const pending = this.pendingRequests;
      this.pendingRequests = [];
      this.isRefreshing = false;
      pending.forEach(cb => cb(newToken));
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

    devLog(`📡 API ${config.method} ${url}`);

    try {
      const response = await fetch(url, config);
      const text = await response.text();

      // ── Détection HTML / tunnel error (ngrok 503, Cloudflare, proxy pages) ──
      const contentType = response.headers.get('content-type') || '';
      const isHTML = contentType.includes('text/html') || text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html');

      if (isHTML) {
        const isNgrokError = text.includes('ngrok') || text.includes('ERR_NGROK');
        const label = isNgrokError ? 'Tunnel ngrok indisponible' : 'Serveur indisponible';
        devError(`❌ [${response.status}] ${label} — ${config.method} ${endpoint}`);

        const error: any = new Error(
          response.status === 503
            ? `Serveur temporairement indisponible (503). ${isNgrokError ? 'Tunnel ngrok down.' : 'Réessayez dans quelques secondes.'}`
            : `${label} (${response.status})`
        );
        error.status = response.status;
        error.isHTMLResponse = true;
        error.isNgrokError = isNgrokError;
        throw error;
      }

      // ── Parse JSON ────────────────────────────────────────────────────────
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        devError(`❌ API NON-JSON RESPONSE [${response.status}] ${config.method} ${endpoint}`);
        devError(`📄 Preview: ${text.slice(0, 200)}`);
        const error: any = new Error(`Réponse invalide du serveur (${response.status})`);
        error.status = response.status;
        throw error;
      }

      // ── 401 → refresh token puis retry ───────────────────────────────────
      if (response.status === 401 && retryCount === 0) {
        devLog('🔐 Got 401, attempting token refresh...');
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          devLog('🔄 Retrying request with new token...');
          return this.request(endpoint, options, retryCount + 1);
        } else {
          devLog('❌ Token refresh failed, clearing session...');
          await tokenStorage.removeToken();
          Alert.alert('Session expirée', 'Veuillez vous reconnecter.');
        }
      }

      // ── 503 avec JSON (rare mais possible) ───────────────────────────────
      if (response.status === 503) {
        const error: any = new Error(data?.error || data?.message || 'Serveur temporairement indisponible (503)');
        error.status = 503;
        error.data = data;
        throw error;
      }

      if (!response.ok) {
        devError(`❌ API ERROR ${response.status}:`, data);
        const error: any = new Error(data.error || data.message || `HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      devLog(`✅ API SUCCESS ${config.method} ${endpoint}`);
      return data;
    } catch (error: any) {
      // Ne pas re-logger les erreurs déjà construites avec un status connu
      if (!error.status) {
        devError(`❌ API REQUEST FAILED (network?):`, error.message);
      } else {
        devError(`❌ API REQUEST FAILED [${error.status}]:`, error.message);
      }
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
    signup: async (email: string, password: string, name?: string, extra?: { role?: string; phone?: string; firstName?: string; lastName?: string }) => {
      const result = await this.post('/auth/signup', { email, password, name, ...extra });
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
    assignRole: async (role: 'CLIENT' | 'PROVIDER') => {
      const result = await this.post('/auth/assign-role', { role });
      if (result.token) {
        await tokenStorage.setToken(result.token);
      }
      return result;
    },
    apple: async (identityToken: string, fullName?: { givenName?: string; familyName?: string }, email?: string) => {
      const result = await this.post('/auth/apple', { identityToken, fullName, email });
      if (result.token) {
        await tokenStorage.setToken(result.token);
      }
      return result;
    },
    google: async (accessToken: string) => {
      const result = await this.post('/auth/google', { accessToken });
      if (result.token) {
        await tokenStorage.setToken(result.token);
      }
      return result;
    },
    changePassword: (currentPassword: string, newPassword: string) =>
      this.post('/auth/change-password', { currentPassword, newPassword }),
    forgotPassword: (email: string) =>
      this.post('/auth/forgot-password', { email }),
    resetPassword: (token: string, password: string) =>
      this.post(`/auth/reset-password/${token}`, { password }),
    validateResetToken: (token: string) =>
      this.request(`/auth/reset-password/${token}/validate`),
  };

  // ==================== USER ====================
  user = {
    me: () => this.request('/auth/me'),
    get: (id: string) => this.request(`/users/${id}`),
    list: () => this.request('/users'),
    update: (id: string, data: any) => this.put(`/users/${id}`, data),
    updateProfile: (data: { name?: string; phone?: string; city?: string }) =>
      this.patch('/me', data),
  };

  // ==================== REQUESTS (CLIENT + PROVIDER) ====================
  requests = {
    // GET /requests — retourne les demandes du client OU les missions du provider
    // Le backend détecte automatiquement le rôle via le token JWT
    list: async (params?: { page?: number; limit?: number }) => {
      return this.request<any>('/requests');
    },
    get: (id: string) => this.request(`/requests/${id}`),
    create: (data: any) => {
      if (data.lat != null && (data.lat < -90 || data.lat > 90)) throw new Error('Latitude invalide');
      if (data.lng != null && (data.lng < -180 || data.lng > 180)) throw new Error('Longitude invalide');
      return this.post('/requests', data);
    },
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
    available: (params: { lat: number; lng: number; radius?: number; categoryId?: number; minRating?: number; limit?: number }) => {
      const qs = new URLSearchParams({
        lat: params.lat.toString(),
        lng: params.lng.toString(),
        ...(params.radius !== undefined && { radius: params.radius.toString() }),
        ...(params.categoryId !== undefined && { categoryId: params.categoryId.toString() }),
        ...(params.minRating !== undefined && { minRating: params.minRating.toString() }),
        ...(params.limit !== undefined && { limit: params.limit.toString() }),
      });
      return this.request(`/providers/available?${qs}`);
    },
    missions: () => this.request('/providers/missions'),
    top: () => this.request('/providers/top'),
    ranked: () => this.request('/providers/ranked'),
    me: () => this.request('/providers/me'),
    register: (data: any) => this.post('/providers/register', data),
    updateMe: (data: any) => this.patch('/providers/me', data),
    validationStatus: () => this.request<{ providerStatus: string }>('/providers/me/validation-status'),
  };

  // ==================== PROVIDER DOCUMENTS ====================
  providerDocs = {
    list: () => this.request('/providers/documents'),

    /** Upload un document KYC via multipart/form-data */
    upload: async (formData: FormData, _retry = false): Promise<any> => {
      const token = await tokenStorage.getToken();
      const url = `${this.baseURL}/providers/documents`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'ngrok-skip-browser-warning': 'true',
          // Content-Type intentionnellement absent : fetch le gère avec le boundary multipart
        },
        body: formData,
      });

      // Token expiré → refresh et retry une fois
      if (response.status === 401 && !_retry) {
        const newToken = await this.refreshAccessToken();
        if (newToken) return this.providerDocs.upload(formData, true);
      }

      const text = await response.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error('Réponse invalide du serveur'); }
      if (!response.ok) throw Object.assign(new Error(data?.error || `HTTP ${response.status}`), { status: response.status, data });
      return data;
    },

    /** Config des documents requis pour une catégorie (slug) */
    config: (categorySlug: string) => this.request(`/providers/doc-config/${categorySlug}`),
  };

  // ==================== PROVIDER QUIZ ====================
  providerQuiz = {
    /** Questions du quiz pour une catégorie (sans les réponses) */
    getQuestions: (categorySlug: string) =>
      this.request(`/providers/quiz-config/${categorySlug}`),

    /** Soumet les réponses et retourne { passed, score, total, passMark, detail } */
    submit: (categorySlug: string, answers: number[]) =>
      this.post(`/providers/quiz/${categorySlug}`, { answers }),
  };

  // ==================== WALLET ====================
  wallet = {
    balance: () => this.request('/wallet'),
    transactions: (limit = 50) => this.request(`/wallet/txs?limit=${limit}`),
    withdraws: () => this.request('/wallet/withdraws'),
    withdraw: (amount: number, destination?: string, note?: string) =>
      this.post('/wallet/withdraw', { amount, method: 'BANK', destination, note }),
    credit: (amount: number) => this.post('/wallet/credit', { amount }),
    debit: (amount: number) => this.post('/wallet/debit', { amount }),
  };

  // ==================== NOTIFICATIONS ====================
  notifications = {
    list: () => this.request('/notifications'),
    markAsRead: (id: string) => this.patch(`/notifications/${id}/read`),
    markAllAsRead: () => this.patch('/notifications/read-all'),
  };

  // ==================== MESSAGES ====================
  messages = {
    list: () => this.request('/messages'),
    get: (id: string) => this.request(`/messages/${id}`),
    send: (recipientId: string, content: string) =>
      this.post('/messages', { recipientId, content }),
    inbox: (page = 1, limit = 20) => this.request(`/messages/inbox?page=${page}&limit=${limit}`),
    conversation: (userId: string, page = 1) => this.request(`/messages/conversation/${userId}?page=${page}&limit=50`),
    markAsRead: (id: string) => this.patch(`/messages/${id}/read`),
    markAllRead: (recipientId: string) => this.post(`/messages/read-all/${recipientId}`),
    unreadCount: () => this.request('/messages/unread'),
    contactInfo: (recipientId: string) => this.request(`/messages/contact/${recipientId}`),
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

  // ==================== INVOICES ====================
  invoices = {
    list: () => this.request('/invoices'),
    get: (id: string) => this.request(`/invoices/${id}`),
    getByRequest: (requestId: number) => this.request(`/invoices?requestId=${requestId}`),
    getPdfUrl: (id: string) => {
      const base = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/api\/?$/, '');
      return `${base}/api/invoices/${id}/pdf`;
    },
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
      devLog(`✅ Confirming payment success for request ${requestId}`);
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

  // ==================== STRIPE CONNECT ====================
  // ==================== TICKETS / SUPPORT ====================
  tickets = {
    list: () => this.request('/tickets'),
    get: (id: string) => this.request(`/tickets/${id}`),
    create: (data: { title: string; description: string; priority?: string; requestId?: number }) =>
      this.post('/tickets', data),
  };

  // ==================== QUOTES / DEVIS ====================
  quotes = {
    forRequest: (requestId: string | number) =>
      this.request(`/quotes/request/${requestId}`),
    send: (requestId: string | number, data: { laborAmount: number; partsAmount?: number; partsDetail?: string; notes?: string; photos?: string[] }) =>
      this.post(`/quotes/${requestId}`, data),
    accept: (quoteId: number) =>
      this.post(`/quotes/${quoteId}/accept`),
    refuse: (quoteId: number, reason?: string) =>
      this.post(`/quotes/${quoteId}/refuse`, { reason }),
    calloutPayment: (requestId: string | number) =>
      this.post('/quotes/callout-payment', { requestId }),
  };

  connect = {
    status: () => this.request('/connect/status'),
    onboarding: (returnUrl?: string, refreshUrl?: string) => this.post('/connect/onboarding', { returnUrl, refreshUrl }),
    dashboard: () => this.post('/connect/dashboard', {}),
  };

  storage = tokenStorage;
}

export const api = new ApiClient(API_BASE_URL);

export async function client(endpoint: string, method = 'GET', body?: any) {
  return api.request(endpoint, { method: method as any, body });
}

export { tokenStorage } from './storage';