// lib/types/invoice.ts
// La facture d'une mission (GET /invoices). Montants en EUROS : la liste et
// la feuille de facture les affichent avec formatEUR (documents, InvoiceSheet).
import type { ISODateString, Enveloped } from './common';

export type InvoiceStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export interface InvoiceItem {
  label: string;
  quantity: number;
  /** Prix unitaire, en euros. */
  unitPrice: number;
  /** Total de la ligne, en euros. */
  total: number;
}

export interface Invoice {
  id: string;
  number: string;
  /** Montant facturé, en euros. */
  amount: number;
  currency: string;
  status: InvoiceStatus;
  issuedAt: ISODateString;
  requestId: number;
  userId: string;
  contractId?: string;
  breakdown?: {
    items?: InvoiceItem[];
    /** Sous-total HTVA, en euros. */
    subtotal?: number;
    /** Taux de TVA, fraction (0.21). */
    taxRate?: number;
    /** TVA, en euros. */
    taxAmount?: number;
    /** Total TVAC, en euros. */
    total?: number;
    paymentMethod?: 'card' | 'cash';
    /** Net reversé au prestataire, en euros. */
    providerEarnings?: number;
    /** Commission de la plateforme, en euros. */
    platformFee?: number;
    estimatedPayout?: string;
  };
  request?: {
    id: number;
    serviceType?: string;
    description?: string;
    /** Prix de la mission, en euros. */
    price?: number;
    address?: string;
    createdAt?: ISODateString;
    completedAt?: ISODateString;
    client?: { id: string; name?: string; email?: string };
    provider?: { id: string; name?: string };
  };
  file?: { url: string } | null;
}

/** GET /invoices — tableau, ou `{ data }` selon la version. */
export type InvoicesResponse = Enveloped<Invoice[]>;
