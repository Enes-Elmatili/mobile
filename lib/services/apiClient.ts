/**
 * apiClient.ts — Instance Axios pré-configurée
 *
 * - baseURL = EXPO_PUBLIC_API_URL (throw si absent)
 * - Injecte le Bearer token à chaque requête via tokenStorage
 * - Intercepteur réponse : normalise les erreurs → ApiError { status, data, message }
 * - 401 → supprime le token (AuthContext détectera l'absence et redirigera)
 */

import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import { tokenStorage } from '../storage';
import { devLog, devWarn } from '../logger';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error('EXPO_PUBLIC_API_URL environment variable is required');
}

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    ...(__DEV__ ? { 'ngrok-skip-browser-warning': 'true' } : {}),
  },
});

// ── Request interceptor : injection du token ──────────────────────────────────

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    devLog('🔐 Bearer token injecté :', token.slice(0, 10) + '…');
  } else {
    devWarn('⚠️  Requête sans token :', config.url);
  }
  return config;
});

// ── Response interceptor : normalisation des erreurs ─────────────────────────

apiClient.interceptors.response.use(
  (response) => {
    devLog(`✅ ${response.config.method?.toUpperCase()} ${response.config.url}`);
    return response;
  },
  async (error: AxiosError<any>) => {
    const status  = error.response?.status;
    const payload = error.response?.data;

    const message =
      payload?.error   ||
      payload?.message ||
      error.message    ||
      'Une erreur inattendue est survenue';

    devWarn(`❌ API [${status ?? 'network'}] ${error.config?.url} :`, message);

    // 401 : effacer le token → AuthContext forcera le re-login
    if (status === 401) {
      await tokenStorage.removeToken();
    }

    const apiError: any = new Error(message);
    apiError.status = status;
    apiError.data   = payload;
    throw apiError;
  },
);

export default apiClient;
