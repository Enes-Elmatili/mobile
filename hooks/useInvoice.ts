// hooks/useInvoice.ts
// ─── Hook to fetch invoice data for a given mission (request) ──────────────

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { devLog, devWarn } from '@/lib/logger';

export interface InvoiceItem {
  label: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  issuedAt: string;
  requestId: number;
  userId: string;
  contractId?: string;
  breakdown?: {
    items?: InvoiceItem[];
    subtotal?: number;
    taxRate?: number;
    taxAmount?: number;
    total?: number;
    paymentMethod?: 'card' | 'cash';
    providerEarnings?: number;
    platformFee?: number;
    estimatedPayout?: string;
  };
  request?: {
    id: number;
    serviceType?: string;
    description?: string;
    price?: number;
    address?: string;
    createdAt?: string;
    completedAt?: string;
    client?: { id: string; name?: string; email?: string };
    provider?: { id: string; name?: string };
  };
  file?: { url: string } | null;
}

interface UseInvoiceReturn {
  invoice: Invoice | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useInvoice(requestId?: number | null): UseInvoiceReturn {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    setError(null);

    try {
      const result = await api.invoices.list();
      const invoices: Invoice[] = result?.data || result || [];
      const match = invoices.find(
        (inv) => inv.requestId === requestId || inv.requestId === Number(requestId),
      );

      if (match) {
        setInvoice(match);
        devLog('📄 Invoice found:', match.number);
      } else {
        setInvoice(null);
        devLog('📄 No invoice found for request', requestId);
      }
    } catch (e: any) {
      devWarn('📄 Invoice fetch error:', e?.message);
      setError(e?.message || 'Impossible de charger la facture');
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  return { invoice, loading, error, refetch: fetchInvoice };
}
