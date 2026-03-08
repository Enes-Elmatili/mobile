/**
 * missionService.ts — Gestion des demandes / missions
 *
 * Le backend distingue CLIENT / PROVIDER automatiquement via le JWT :
 *   - GET /requests          → client : ses demandes | provider : ses missions assignées
 *   - GET /providers/missions → missions actives du provider (ACCEPTED / ONGOING)
 *
 * Toutes les erreurs sont des ApiError { message, status, data }.
 */

import apiClient from './apiClient';
import type { Request, Provider } from './types';

// ── Payload creation ──────────────────────────────────────────────────────────

export interface CreateRequestPayload {
  serviceType: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  categoryId: number;
  subcategoryId?: number;
  urgent?: boolean;
  preferredTimeStart?: string;
  price?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const missionService = {

  // ── Client actions ──────────────────────────────────────────────────────────

  /** POST /requests — créer une nouvelle demande (CLIENT) */
  createRequest: async (payload: CreateRequestPayload): Promise<Request> => {
    const { data } = await apiClient.post<Request>('/requests', payload);
    return data;
  },

  /**
   * GET /requests — liste des demandes du client OU missions du prestataire
   * Le backend détecte le rôle via le JWT.
   */
  getMyRequests: async (): Promise<Request[]> => {
    const { data } = await apiClient.get<any>('/requests');
    return Array.isArray(data) ? data : data?.requests ?? [];
  },

  /** GET /requests/:id */
  getRequest: async (id: number | string): Promise<Request> => {
    const { data } = await apiClient.get<Request>(`/requests/${id}`);
    return data;
  },

  /** POST /requests/:id/cancel — annuler (client ou provider) */
  cancelRequest: async (id: number | string): Promise<Request> => {
    const { data } = await apiClient.post<Request>(`/requests/${id}/cancel`);
    return data;
  },

  // ── Provider actions ────────────────────────────────────────────────────────

  /** POST /requests/:id/accept — provider accepte une mission */
  acceptRequest: async (id: number | string): Promise<Request> => {
    const { data } = await apiClient.post<Request>(`/requests/${id}/accept`);
    return data;
  },

  /** POST /requests/:id/refuse — provider refuse une mission */
  declineRequest: async (id: number | string): Promise<Request> => {
    const { data } = await apiClient.post<Request>(`/requests/${id}/refuse`);
    return data;
  },

  /** POST /requests/:id/start — provider démarre la mission (ACCEPTED → ONGOING) */
  startRequest: async (id: number | string): Promise<Request> => {
    const { data } = await apiClient.post<Request>(`/requests/${id}/start`);
    return data;
  },

  /** POST /requests/:id/complete — provider termine la mission (ONGOING → DONE) */
  completeRequest: async (id: number | string): Promise<Request> => {
    const { data } = await apiClient.post<Request>(`/requests/${id}/complete`);
    return data;
  },

  /** GET /providers/missions — missions actives du prestataire connecté */
  getMyMissions: async (): Promise<Request[]> => {
    const { data } = await apiClient.get<any>('/providers/missions');
    return Array.isArray(data) ? data : data?.missions ?? [];
  },

  // ── Discovery ───────────────────────────────────────────────────────────────

  /**
   * GET /providers/nearby — prestataires proches d'une position
   * @param lat   Latitude
   * @param lng   Longitude
   * @param radius Rayon en mètres (défaut : 5000 m)
   */
  getNearbyProviders: async (lat: number, lng: number, radius = 5000): Promise<Provider[]> => {
    const { data } = await apiClient.get<any>(
      `/providers/nearby?lat=${lat}&lng=${lng}&radius=${radius}`,
    );
    return Array.isArray(data) ? data : data?.providers ?? [];
  },
};
