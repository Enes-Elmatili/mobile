/**
 * userService.ts — Profil utilisateur & documents KYC prestataire
 *
 * Toutes les erreurs sont des ApiError { message, status, data }.
 * Les appelants (écrans/hooks) gèrent l'UX (showSocketToast, navigation…).
 */

import apiClient from './apiClient';
import { tokenStorage } from '../storage';
import type { User, Provider, ProviderDocument } from './types';

export const userService = {

  // ── Profil ──────────────────────────────────────────────────────────────────

  /** GET /auth/me — profil complet avec rôles */
  getMe: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/auth/me');
    return data;
  },

  /**
   * PATCH /users/:id — mise à jour du profil de base
   * Appeler refreshMe() côté AuthContext après succès.
   */
  updateProfile: async (
    userId: string,
    payload: Partial<Pick<User, 'name' | 'phone' | 'city'>>,
  ): Promise<User> => {
    const { data } = await apiClient.patch<User>(`/users/${userId}`, payload);
    return data;
  },

  // ── Provider profile ─────────────────────────────────────────────────────────

  /**
   * PATCH /providers/me — mise à jour du profil prestataire
   * Appeler refreshMe() côté AuthContext après succès.
   */
  updateProviderProfile: async (
    payload: Partial<Pick<Provider, 'name' | 'description' | 'phone' | 'city' | 'lat' | 'lng'>>,
  ): Promise<Provider> => {
    const { data } = await apiClient.patch<Provider>('/providers/me', payload);
    return data;
  },

  // ── Documents KYC ───────────────────────────────────────────────────────────

  /** GET /providers/documents — liste des docs KYC du prestataire connecté */
  getProviderDocuments: async (): Promise<ProviderDocument[]> => {
    const { data } = await apiClient.get<{ documents: ProviderDocument[] }>('/providers/documents');
    // Le backend peut renvoyer { documents: [...] } ou directement un tableau
    return Array.isArray(data) ? data : (data as any)?.documents ?? [];
  },

  /**
   * POST /providers/documents — upload multipart d'un document KYC
   *
   * On utilise fetch natif car Axios ne gère pas fiablement le multipart
   * avec les URI locales de React Native (expo-image-picker).
   */
  uploadProviderDocument: async (
    docKey: string,
    fileUri: string,
    mimeType: string,
    fileName: string,
    categoryId?: number,
  ): Promise<ProviderDocument> => {
    const token = await tokenStorage.getToken();

    const formData = new FormData();
    // @ts-ignore — React Native FormData accepte { uri, name, type }
    formData.append('file', { uri: fileUri, name: fileName, type: mimeType });
    formData.append('docKey', docKey);
    if (categoryId != null) formData.append('categoryId', String(categoryId));

    const response = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL}/providers/documents`,
      {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(__DEV__ ? { 'ngrok-skip-browser-warning': 'true' } : {}),
          // Content-Type absent : fetch génère le boundary multipart automatiquement
        },
        body: formData,
      },
    );

    const json = await response.json().catch(() => {
      throw new Error('Réponse invalide du serveur');
    });

    if (!response.ok) {
      const err: any = new Error(json?.error || `HTTP ${response.status}`);
      err.status = response.status;
      err.data = json;
      throw err;
    }

    return json.document as ProviderDocument;
  },
};
