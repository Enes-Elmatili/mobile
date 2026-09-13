/**
 * walletService.ts — Wallet, transactions et historique des retraits
 *
 * Plus de demande de retrait : les gains sont versés automatiquement à la
 * complétion de chaque mission (le backend répond 410 sur POST /wallet/withdraw).
 *
 * Le solde est stocké en centimes côté DB (Int).
 * Afficher `balance / 100` pour obtenir des euros/MAD.
 *
 * Toutes les erreurs sont des ApiError { message, status, data }.
 */

import apiClient from './apiClient';
import type { WalletAccount, WalletTransaction, WithdrawRequest } from './types';

export const walletService = {

  // ── Solde ────────────────────────────────────────────────────────────────────

  /** GET /wallet — solde du wallet de l'utilisateur connecté */
  getBalance: async (): Promise<WalletAccount> => {
    const { data } = await apiClient.get<WalletAccount>('/wallet');
    return data;
  },

  // ── Transactions ─────────────────────────────────────────────────────────────

  /**
   * GET /wallet/txs?limit=N — historique des transactions
   * @param limit Nombre max de transactions à retourner (défaut : 50)
   */
  getTransactions: async (limit = 50): Promise<WalletTransaction[]> => {
    const { data } = await apiClient.get<any>(`/wallet/txs?limit=${limit}`);
    return Array.isArray(data) ? data : data?.transactions ?? [];
  },

  // ── Retraits ─────────────────────────────────────────────────────────────────

  /** GET /wallet/withdraws — historique des demandes de retrait */
  getWithdrawHistory: async (): Promise<WithdrawRequest[]> => {
    const { data } = await apiClient.get<any>('/wallet/withdraws');
    return Array.isArray(data) ? data : data?.withdraws ?? [];
  },
};
