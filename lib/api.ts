import { tokenStorage } from './storage';
import { devLog, devWarn, devError } from './logger';
import i18nInstance from './i18n';
import { feedback } from './feedback/feedback';
import type {
  AddressesResponse, AuthResponse, AvailableProvidersResponse, CalloutPaymentResponse,
  CanChatResponse, Category, ChatMessagesResponse, ConnectBalance, ConnectLinkResponse,
  ConnectStatus, ContactInfoResponse, CreateSubscriptionResponse, DocConfigResponse,
  Enveloped, IbanResponse, Invoice, InvoicesResponse, MeResponse, NearbyProvidersResponse,
  NotificationPrefsResponse, NotificationsResponse, OkResponse, PaymentSetupResponse,
  ProviderAvailability, ProviderDashboardResponse, ProviderDetailResponse,
  ProviderDocumentsResponse, ProviderMeResponse, ProviderMissionsResponse,
  ProviderSummary, QuizConfig, QuizSubmitResult, QuoteAcceptResponse, QuotesForRequestResponse,
  RatingsResponse, ResetTokenValidation, SavedAddress, SendMessageResponse, SendQuotePayload,
  ServiceRequest, Subcategory, TicketEventsResponse, TicketResponse, TicketsResponse,
  UnknownPayload, UnreadCountResponse, VatResponse, WalletBalance, WalletTxsResponse,
  ValidationStatusResponse,
} from './types';

/** Langues des modèles de facture PDF côté serveur. */
const PDF_LANGS = ['fr', 'nl', 'en'];

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error('EXPO_PUBLIC_API_URL environment variable is required');
}

export interface ApiResponse<T = unknown> {
  ok?: boolean;
  data?: T;
  error?: string;
  [key: string]: unknown;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

/** Erreur levée par l'ApiClient : le message serveur, le statut HTTP et le corps. */
export type ApiError = Error & {
  status?: number;
  data?: unknown;
  isHTMLResponse?: boolean;
  isNgrokError?: boolean;
};

/** Corps JSON d'une réponse, avant typage par l'appelant (champs d'erreur lus ici). */
type JsonBody = { error?: string; message?: string; code?: string };

/** Les routes multipart renvoient leur charge utile telle quelle. */
type UploadResponse = UnknownPayload;

function apiError(message: string, fields: Omit<ApiError, 'name' | 'message'>): ApiError {
  return Object.assign(new Error(message), fields);
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

    // Locale active du device (déduite par expo-localization au boot, modifiée
    // si l'user change de langue système). On l'envoie au backend pour que
    // les PDFs, emails et messages d'erreur sortent dans la bonne langue,
    // SANS dépendre du champ User.language stocké en DB qui peut être obsolète.
    const lang = (i18nInstance.language || 'fr').split('-')[0].toLowerCase();

    return {
      'Content-Type': 'application/json',
      'Accept-Language': lang,
      'X-Client-Lang': lang,
      ...(__DEV__ ? { 'ngrok-skip-browser-warning': 'true' } : {}),
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
          ...(__DEV__ ? { 'ngrok-skip-browser-warning': 'true' } : {}),
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

  async request<T = unknown>(endpoint: string, options: RequestOptions = {}, retryCount = 0): Promise<T> {
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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(url, { ...config, signal: controller.signal });
      clearTimeout(timeout);
      const text = await response.text();

      // ── Détection HTML / tunnel error (ngrok 503, Cloudflare, proxy pages) ──
      const contentType = response.headers.get('content-type') || '';
      const isHTML = contentType.includes('text/html') || text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html');

      if (isHTML) {
        const isNgrokError = text.includes('ngrok') || text.includes('ERR_NGROK');
        const label = isNgrokError ? 'Tunnel ngrok indisponible' : 'Serveur indisponible';
        devError(`❌ [${response.status}] ${label} — ${config.method} ${endpoint}`);

        throw apiError(
          response.status === 503
            ? `Serveur temporairement indisponible (503). ${isNgrokError ? 'Tunnel ngrok down.' : 'Réessayez dans quelques secondes.'}`
            : `${label} (${response.status})`,
          { status: response.status, isHTMLResponse: true, isNgrokError },
        );
      }

      // ── Parse JSON ────────────────────────────────────────────────────────
      let data: JsonBody;
      try {
        data = JSON.parse(text);
      } catch {
        devError(`❌ API NON-JSON RESPONSE [${response.status}] ${config.method} ${endpoint}`);
        devError(`📄 Preview: ${text.slice(0, 200)}`);
        throw apiError(`Réponse invalide du serveur (${response.status})`, { status: response.status });
      }

      // ── 401 → refresh token puis retry ───────────────────────────────────
      // Skip auto-refresh for auth routes (login/signup return 401 for invalid credentials, not expired session)
      const isAuthRoute = endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/signup');
      if (response.status === 401 && retryCount === 0 && !isAuthRoute) {
        devLog('Got 401, attempting token refresh...');
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          devLog('Retrying request with new token...');
          return this.request<T>(endpoint, options, retryCount + 1);
        } else {
          devLog('Token refresh failed, clearing session...');
          await tokenStorage.removeToken();
          feedback.error('common.session_expired');
          throw apiError('Session expirée', { status: 401 });
        }
      }

      // ── 503 avec JSON (rare mais possible) ───────────────────────────────
      if (response.status === 503) {
        throw apiError(data?.error || data?.message || 'Serveur temporairement indisponible (503)', { status: 503, data });
      }

      if (!response.ok) {
        devError(`❌ API ERROR ${response.status}:`, data);
        throw apiError(data.error || data.message || `HTTP ${response.status}`, { status: response.status, data });
      }

      devLog(`✅ API SUCCESS ${config.method} ${endpoint}`);
      // Le corps n'est pas validé : T est le contrat que l'appelant attend du serveur.
      return data as T;
    } catch (caught: unknown) {
      const error = caught as ApiError;
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
  // Verbes bruts pour les routes sans méthode dédiée. Sans T, la réponse est
  // `unknown` : passer le type attendu (`api.get<ServiceRequest>(…)`).
  get = <T = unknown>(endpoint: string): Promise<T> => this.request<T>(endpoint, { method: 'GET' });

  post = <T = unknown>(endpoint: string, body?: unknown): Promise<T> =>
    this.request<T>(endpoint, { method: 'POST', body });

  put = <T = unknown>(endpoint: string, body?: unknown): Promise<T> =>
    this.request<T>(endpoint, { method: 'PUT', body });

  patch = <T = unknown>(endpoint: string, body?: unknown): Promise<T> =>
    this.request<T>(endpoint, { method: 'PATCH', body });

  delete = <T = unknown>(endpoint: string): Promise<T> =>
    this.request<T>(endpoint, { method: 'DELETE' });

  // ==================== AUTH ====================
  auth = {
    login: async (email: string, password: string) => {
      const result = await this.post<AuthResponse>('/auth/login', { email, password });
      if (result.token) {
        await tokenStorage.setToken(result.token);
      }
      return result;
    },
    signup: async (
      email: string,
      password: string,
      name?: string,
      extra?: {
        role?: string;
        phone?: string;
        firstName?: string;
        lastName?: string;
        address?: string;
        postalCode?: string;
        city?: string;
      }
    ) => {
      const result = await this.post<AuthResponse>('/auth/signup', { email, password, name, ...extra });
      if (result.token) {
        await tokenStorage.setToken(result.token);
      }
      return result;
    },
    logout: async () => {
      // Clear the local token FIRST so the navigation guard
      // (which gates on `hasToken`) can redirect immediately. Otherwise a
      // slow / unreachable backend would block signOut and the user would
      // appear "stuck" on the screen with the logout button doing nothing
      // visible. The backend invalidation becomes a best-effort fire-and-forget.
      await tokenStorage.removeToken();
      this.post<OkResponse>('/auth/logout').catch(() => {
        // Network failure is fine — the token is already gone locally.
      });
    },
    refresh: () => this.post<AuthResponse>('/auth/refresh'),
    assignRole: async (role: 'CLIENT' | 'PROVIDER') => {
      const result = await this.post<AuthResponse>('/auth/assign-role', { role });
      if (result.token) {
        await tokenStorage.setToken(result.token);
      }
      return result;
    },
    apple: async (identityToken: string, fullName?: { givenName?: string; familyName?: string }, email?: string) => {
      const result = await this.post<AuthResponse>('/auth/apple', { identityToken, fullName, email });
      if (result.token) {
        await tokenStorage.setToken(result.token);
      }
      return result;
    },
    google: async (tokens: { idToken?: string; accessToken?: string }) => {
      const result = await this.post<AuthResponse>('/auth/google', tokens);
      if (result.token) {
        await tokenStorage.setToken(result.token);
      }
      return result;
    },
    changePassword: (currentPassword: string, newPassword: string) =>
      this.post<OkResponse>('/auth/change-password', { currentPassword, newPassword }),
    forgotPassword: (email: string) =>
      this.post<OkResponse>('/auth/forgot-password', { email }),
    resetPassword: (token: string, password: string) =>
      this.post<OkResponse>(`/auth/reset-password/${token}`, { password }),
    validateResetToken: (token: string) =>
      this.request<ResetTokenValidation>(`/auth/reset-password/${token}/validate`),
  };

  // ==================== USER ====================
  user = {
    me: () => this.request<MeResponse>('/auth/me'),
    get: (id: string) => this.request<UnknownPayload>(`/users/${id}`),
    list: () => this.request<UnknownPayload>('/users'),
    update: (id: string, data: Record<string, unknown>) => this.put<UnknownPayload>(`/users/${id}`, data),
    updateProfile: (data: { name?: string; phone?: string; city?: string }) =>
      this.patch<UnknownPayload>('/me', data),
  };

  // ==================== REQUESTS (CLIENT + PROVIDER) ====================
  requests = {
    // GET /requests — retourne les demandes du client OU les missions du provider
    // Le backend détecte automatiquement le rôle via le token JWT
    list: async (params?: { page?: number; limit?: number }) => {
      return this.request<Enveloped<ServiceRequest[]>>('/requests');
    },
    get: (id: string) => this.request<Enveloped<ServiceRequest>>(`/requests/${id}`),
    create: (data: { lat?: number | null; lng?: number | null } & Record<string, unknown>) => {
      if (data.lat != null && (data.lat < -90 || data.lat > 90)) throw new Error('Latitude invalide');
      if (data.lng != null && (data.lng < -180 || data.lng > 180)) throw new Error('Longitude invalide');
      return this.post<Enveloped<ServiceRequest>>('/requests', data);
    },
    accept: (id: string) => this.post<Enveloped<ServiceRequest>>(`/requests/${id}/accept`),
    decline: (id: string) => this.post<OkResponse>(`/requests/${id}/refuse`),
    start: (id: string) => this.post<Enveloped<ServiceRequest>>(`/requests/${id}/start`),
    complete: (id: string) => this.post<Enveloped<ServiceRequest>>(`/requests/${id}/complete`),
    cancel: (id: string) => this.post<OkResponse>(`/requests/${id}/cancel`),
  };

  // ==================== TAXONOMIES ====================
  taxonomies = {
    list: () => this.request<Enveloped<Category[]>>('/categories'),
    get: (id: string) => this.request<Enveloped<Category>>(`/categories/${id}`),
    subcategories: (categoryId: string) => this.request<Enveloped<Subcategory[]>>(`/categories/${categoryId}/subcategories`),
  };

  // ==================== DASHBOARD ====================
  dashboard = {
    client: () => this.request<UnknownPayload>('/client/dashboard'),
    provider: () => this.request<ProviderDashboardResponse>('/provider/dashboard'),
  };

  // ==================== PROVIDERS ====================
  providers = {
    list: () => this.request<Enveloped<ProviderSummary[]>>('/providers'),
    get: (id: string) => this.request<ProviderDetailResponse>(`/providers/${id}`),
    availability: (id: string) => this.request<ProviderAvailability>(`/providers/${id}/availability`),
    /** radius en km (le serveur plafonne à 50). */
    nearby: (lat: number, lng: number, radius = 5) =>
      this.request<NearbyProvidersResponse>(`/providers/nearby?lat=${lat}&lng=${lng}&radius=${radius}`),
    available: (params: { lat: number; lng: number; radius?: number; categoryId?: number; minRating?: number; limit?: number }) => {
      const qs = new URLSearchParams({
        lat: params.lat.toString(),
        lng: params.lng.toString(),
        ...(params.radius !== undefined && { radius: params.radius.toString() }),
        ...(params.categoryId !== undefined && { categoryId: params.categoryId.toString() }),
        ...(params.minRating !== undefined && { minRating: params.minRating.toString() }),
        ...(params.limit !== undefined && { limit: params.limit.toString() }),
      });
      return this.request<AvailableProvidersResponse>(`/providers/available?${qs}`);
    },
    missions: () => this.request<ProviderMissionsResponse>('/providers/missions'),
    top: () => this.request<Enveloped<ProviderSummary[]>>('/providers/top'),
    ranked: () => this.request<Enveloped<ProviderSummary[]>>('/providers/ranked'),
    me: () => this.request<ProviderMeResponse>('/providers/me'),
    register: (data: { name: string } & Record<string, unknown>) => this.post<ProviderMeResponse>('/providers/register', data),
    updateMe: (data: Record<string, unknown>) => this.patch<ProviderMeResponse>('/providers/me', data),
    validationStatus: () => this.request<ValidationStatusResponse>('/providers/me/validation-status'),
  };

  // ==================== PROVIDER DOCUMENTS ====================
  // ==================== PROVIDER (entreprise) ====================
  provider = {
    /** BCE → mod-97 puis VIES côté serveur. Erreurs : INVALID_BCE_FORMAT, VIES_INVALID, VIES_UNAVAILABLE. */
    setVat: (vatNumber: string) => this.post<VatResponse>('/provider/vat', { vatNumber }),
    /** IBAN → mod-97 côté serveur. Erreur : INVALID_IBAN. */
    setIban: (iban: string) => this.post<IbanResponse>('/provider/iban', { iban }),
  };

  providerDocs = {
    list: () => this.request<ProviderDocumentsResponse>('/providers/documents'),

    /** Upload un document KYC via multipart/form-data */
    upload: async (formData: FormData, _retry = false): Promise<UploadResponse> => {
      const token = await tokenStorage.getToken();
      const url = `${this.baseURL}/providers/documents`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(__DEV__ ? { 'ngrok-skip-browser-warning': 'true' } : {}),
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
      let data: UploadResponse & JsonBody;
      try { data = JSON.parse(text); } catch { throw new Error('Réponse invalide du serveur'); }
      if (!response.ok) throw Object.assign(new Error(data?.error || `HTTP ${response.status}`), { status: response.status, data });
      return data;
    },

    /** Config des documents requis pour une catégorie (slug) */
    config: (categorySlug: string) => this.request<DocConfigResponse>(`/providers/doc-config/${categorySlug}`),
  };

  /** Photos guidées du client (POST /requests/:id/photos, multipart). */
  requestPhotos = {
    upload: async (requestId: number | string, formData: FormData, _retry = false): Promise<UploadResponse> => {
      const token = await tokenStorage.getToken();
      const response = await fetch(`${this.baseURL}/requests/${requestId}/photos`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(__DEV__ ? { 'ngrok-skip-browser-warning': 'true' } : {}),
          // Content-Type absent : fetch pose le boundary multipart lui-même.
        },
        body: formData,
      });
      if (response.status === 401 && !_retry) {
        const newToken = await this.refreshAccessToken();
        if (newToken) return this.requestPhotos.upload(requestId, formData, true);
      }
      const text = await response.text();
      let data: UploadResponse & JsonBody;
      try { data = JSON.parse(text); } catch { throw new Error('Réponse invalide du serveur'); }
      if (!response.ok) throw Object.assign(new Error(data?.message || data?.code || `HTTP ${response.status}`), { status: response.status, data });
      return data;
    },
  };

  // ==================== PROVIDER QUIZ ====================
  providerQuiz = {
    /** Questions du quiz pour une catégorie (sans les réponses) */
    getQuestions: (categorySlug: string) =>
      this.request<QuizConfig>(`/providers/quiz-config/${categorySlug}`),

    /** Soumet les réponses et retourne { passed, score, total, passMark, detail } */
    submit: (categorySlug: string, answers: number[]) =>
      this.post<QuizSubmitResult>(`/providers/quiz/${categorySlug}`, { answers }),
  };

  // ==================== WALLET ====================
  wallet = {
    balance: () => this.request<WalletBalance>('/wallet'),
    transactions: (limit = 50) => this.request<WalletTxsResponse>(`/wallet/txs?limit=${limit}`),
    withdraws: () => this.request<UnknownPayload>('/wallet/withdraws'),
    /** amount en centimes (le portefeuille est tenu en centimes). */
    credit: (amount: number) => this.post<WalletBalance>('/wallet/credit', { amount }),
    /** amount en centimes. */
    debit: (amount: number) => this.post<WalletBalance>('/wallet/debit', { amount }),
  };

  // ==================== ADDRESSES ====================
  addresses = {
    list: () => this.request<AddressesResponse>('/addresses'),
    create: (data: { label: string; address: string; lat: number; lng: number }) =>
      this.post<Enveloped<SavedAddress>>('/addresses', data),
    remove: (id: number) => this.delete<OkResponse>(`/addresses/${id}`),
  };

  // ==================== NOTIFICATIONS ====================
  notifications = {
    list: () => this.request<NotificationsResponse>('/notifications'),
    markAsRead: (id: string) => this.patch<OkResponse>(`/notifications/${id}/read`),
    markAllAsRead: () => this.patch<OkResponse>('/notifications/read-all'),
    prefs: () => this.request<NotificationPrefsResponse>('/notifications/prefs'),
    updatePrefs: (patch: Record<string, unknown>) => this.patch<NotificationPrefsResponse>('/notifications/prefs', patch),
  };

  // ==================== MESSAGES ====================
  messages = {
    list: () => this.request<ChatMessagesResponse>('/messages'),
    get: (id: string) => this.request<SendMessageResponse>(`/messages/${id}`),
    send: (recipientId: string, content: string) =>
      this.post<SendMessageResponse>('/messages', { recipientId, content }),
    inbox: (page = 1, limit = 20) => this.request<ChatMessagesResponse>(`/messages/inbox?page=${page}&limit=${limit}`),
    conversation: (userId: string, page = 1) => this.request<ChatMessagesResponse>(`/messages/conversation/${userId}?page=${page}&limit=50`),
    markAsRead: (id: string) => this.patch<OkResponse>(`/messages/${id}/read`),
    markAllRead: (recipientId: string) => this.post<OkResponse>(`/messages/read-all/${recipientId}`),
    unreadCount: () => this.request<UnreadCountResponse>('/messages/unread'),
    contactInfo: (recipientId: string) => this.request<ContactInfoResponse>(`/messages/contact/${recipientId}`),
    canChat: (recipientId: string) => this.request<CanChatResponse>(`/messages/can-chat/${recipientId}`),
  };

  // ==================== RATINGS ====================
  ratings = {
    create: (data: { requestId: string; rating: number; comment?: string }) =>
      this.post<OkResponse>('/ratings', data),
    list: (providerId?: string) => {
      const query = providerId ? `?providerId=${providerId}` : '';
      return this.request<RatingsResponse>(`/ratings${query}`);
    },
  };

  // ==================== DOCUMENTS ====================
  documents = {
    list: () => this.request<UnknownPayload>('/documents'),
    getTicket: (id: string) => this.request<UnknownPayload>(`/documents/tickets/${id}`),
    getContract: (id: string) => this.request<UnknownPayload>(`/documents/contracts/${id}`),
    getInvoice: (id: string) => this.request<UnknownPayload>(`/documents/invoices/${id}`),
  };

  // ==================== INVOICES ====================
  invoices = {
    list: () => this.request<InvoicesResponse>('/invoices'),
    get: (id: string) => this.request<Enveloped<Invoice>>(`/invoices/${id}`),
    getByRequest: (requestId: number) => this.request<InvoicesResponse>(`/invoices?requestId=${requestId}`),
    getPdfUrl: (id: string) => {
      const base = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/api\/?$/, '');
      // Passe la langue active en query param : FileSystem.downloadAsync n'utilise
      // pas les défauts ApiClient (c'est un download direct), donc on inline.
      const lang = (i18nInstance.language || 'fr').split('-')[0].toLowerCase();
      // Le PDF est rendu par le serveur, qui n'a de modèles qu'en fr/nl/en :
      // une facture polonaise sort en anglais plutôt qu'en erreur.
      const pdfLang = PDF_LANGS.includes(lang) ? lang : 'en';
      return `${base}/api/invoices/${id}/pdf?lang=${encodeURIComponent(pdfLang)}`;
    },
  };

  // ==================== BUSINESS ====================
  contracts = {
    list: () => this.request<UnknownPayload>('/contracts'),
    get: (id: string) => this.request<UnknownPayload>(`/contracts/${id}`),
    create: (data: Record<string, unknown>) => this.post<UnknownPayload>('/contracts', data),
  };

  // ==================== PAYMENTS ====================
  payments = {
    list: () => this.request<UnknownPayload>('/payments'),
    get: (id: string) => this.request<UnknownPayload>(`/payments/${id}`),
    // DIRECT_CHARGE flow: backend creates a PaymentIntent with automatic_payment_methods
    // so Stripe exposes Card, Klarna, Bancontact, Apple Pay… based on amount/region.
    // Client is charged immediately; backend transfers 80% to the provider at
    // acceptance and refunds via cron if no provider accepts within the TTL.
    // Response shape: { paymentIntentClientSecret, setupIntentClientSecret (alias,
    // deprecated), ephemeralKey, customer, amount, currency, flow }.
    // promoCode optionnel : remise validée 100% serveur (mode fixed → FIXED_DISCOUNT).
    // Le backend renvoie en plus `promo: { code, discountCents, nominalCents }` et un
    // PaymentIntent au montant déjà remisé. /setup ne consomme PAS le code (rejouable) :
    // il n'est brûlé qu'au paiement réussi (/payments/success).
    setup: async (requestId: string, promoCode?: string) => {
      const token = await tokenStorage.getToken();
      if (!token) throw new Error("Erreur de session : veuillez vous reconnecter avant de payer.");
      return this.post<PaymentSetupResponse>('/payments/setup', { requestId, ...(promoCode ? { promoCode } : {}) });
    },
    // Legacy — kept for rollback during transition. Will be removed once setup is confirmed stable.
    intent: async (requestId: string) => {
      const token = await tokenStorage.getToken();
      if (!token) throw new Error("Erreur de session : veuillez vous reconnecter avant de payer.");
      return this.post<PaymentSetupResponse>('/payments/intent', { requestId });
    },
    success: async (requestId: string) => {
      devLog(`✅ Confirming payment success for request ${requestId}`);
      return this.post<OkResponse>('/payments/success', { requestId });
    },
    create: (data: Record<string, unknown>) => this.post<UnknownPayload>('/payments', data),
  };

  // ==================== STATS ====================
  stats = {
    global: () => this.request<UnknownPayload>('/stats'),
    exportCSV: () => this.request<UnknownPayload>('/stats/requests.csv'),
    exportPDF: () => this.request<UnknownPayload>('/export/requests.pdf'),
  };

  // ==================== SUBSCRIPTION ====================
  subscription = {
    get: () => this.request<UnknownPayload>('/subscription'),
    create: (plan: string) => this.post<UnknownPayload>('/subscription', { plan }),
    cancel: () => this.delete<OkResponse>('/subscription'),
    // Abonnement presta NATIF (PaymentSheet) : le backend crée une Subscription
    // `default_incomplete` et renvoie { subscriptionId, paymentIntentClientSecret,
    // ephemeralKey, customerId } → pilote le PaymentSheet Stripe (carte/Apple/Google
    // Pay, montant réel). Prix + identité dérivés serveur depuis le PALIER (clé stable).
    createSubscription: (tier: string) =>
      this.post<CreateSubscriptionResponse>('/subscription/create-subscription', { tier }),
    // Variante Checkout (redirection navigateur) — conservée mais non utilisée par
    // l'app (on privilégie l'expérience native ci-dessus).
    createCheckoutSession: (tier: string, returnUrl: string) =>
      this.post<ConnectLinkResponse>('/subscription/create-checkout-session', { tier, returnUrl }),
  };

  // ==================== STRIPE CONNECT ====================
  // ==================== TICKETS / SUPPORT ====================
  tickets = {
    list: () => this.request<TicketsResponse>('/tickets'),
    get: (id: string) => this.request<TicketResponse>(`/tickets/${id}`),
    create: (data: { title: string; description: string; priority?: string; requestId?: number }) =>
      this.post<TicketResponse>('/tickets', data),
    events: (id: string) => this.request<TicketEventsResponse>(`/tickets/${id}/events`),
    addMessage: (id: string, content: string) =>
      this.post<OkResponse>(`/tickets/${id}/messages`, { content }),
    update: (id: string, data: { status?: string; priority?: string }) =>
      this.patch<TicketResponse>(`/tickets/${id}`, data),
  };

  // ==================== QUOTES / DEVIS ====================
  quotes = {
    forRequest: (requestId: string | number) =>
      this.request<QuotesForRequestResponse>(`/quotes/request/${requestId}`),
    /** Montants en centimes. */
    send: (requestId: string | number, data: SendQuotePayload) =>
      this.post<OkResponse>(`/quotes/${requestId}`, data),
    accept: (quoteId: number) =>
      this.post<QuoteAcceptResponse>(`/quotes/${quoteId}/accept`),
    confirmPayment: (quoteId: number, paymentIntentId?: string) =>
      this.post<OkResponse>(`/quotes/${quoteId}/confirm-payment`, paymentIntentId ? { paymentIntentId } : undefined),
    refuse: (quoteId: number, reason?: string) =>
      this.post<OkResponse>(`/quotes/${quoteId}/refuse`, { reason }),
    // promoCode optionnel : CALLOUT_COVERED → FIXED offre le déplacement. Le backend
    // renvoie alors { covered: true, clientSecret: null, amount: 0 } (aucun paiement).
    calloutPayment: (requestId: string | number, promoCode?: string) =>
      this.post<CalloutPaymentResponse>('/quotes/callout-payment', { requestId, ...(promoCode ? { promoCode } : {}) }),
  };

  connect = {
    status: () => this.request<ConnectStatus>('/connect/status'),
    balance: () => this.request<ConnectBalance>('/connect/balance'),
    onboarding: (returnUrl?: string, refreshUrl?: string) => this.post<ConnectLinkResponse>('/connect/onboarding', { returnUrl, refreshUrl }),
    dashboard: () => this.post<ConnectLinkResponse>('/connect/dashboard', {}),
  };

  storage = tokenStorage;
}

export const api = new ApiClient(API_BASE_URL);

export async function client<T = unknown>(endpoint: string, method = 'GET', body?: unknown) {
  return api.request<T>(endpoint, { method: method as RequestOptions['method'], body });
}

export { tokenStorage } from './storage';