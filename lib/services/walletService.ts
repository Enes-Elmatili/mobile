/**
 * walletService.ts — Wallet, transactions et retraits
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

  /**
   * POST /wallet/withdraw — soumettre une demande de retrait
   * @param amount      Montant en centimes
   * @param destination IBAN ou numéro de compte (optionnel)
   * @param note        Note libre (optionnel)
   */
  withdraw: async (
    amount: number,
    destination?: string,
    note?: string,
  ): Promise<WithdrawRequest> => {
    const { data } = await apiClient.post<WithdrawRequest>('/wallet/withdraw', {
      amount,
      method: 'BANK',
      destination,
      note,
    });
    return data;
  },
};
