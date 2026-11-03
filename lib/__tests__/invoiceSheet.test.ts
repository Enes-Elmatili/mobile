// Feuille facture (lib/invoice/invoiceSheet.ts) : montants en EUROS, affichés
// tels que le backend les fournit (aucune TVA inventée), numéro, PDF et dates.
import {
  invoiceItems, invoiceAmounts, vatPercent, displayInvoiceNumber, invoicePdfFileName, pdfLang,
  pdfDownloadHeaders, statusBadgeBg, fmtInvoiceDate, fmtInvoiceDateShort, payoutDateOf,
} from '../invoice/invoiceSheet';
import type { Invoice } from '../types';

const INVOICE: Invoice = {
  id: 'clx0000000000abcdef',
  number: '2026-0042',
  amount: 121,
  currency: 'EUR',
  status: 'PAID',
  issuedAt: '2026-03-10T10:00:00.000Z',
  requestId: 7,
  userId: 'u1',
};

describe('invoiceAmounts — euros, seulement ce que fournit le backend', () => {
  it('breakdown complet : sous-total, TVA 21 %, total, net et commission', () => {
    const a = invoiceAmounts({
      ...INVOICE,
      breakdown: { subtotal: 100, taxRate: 0.21, taxAmount: 21, total: 121, paymentMethod: 'cash', providerEarnings: 96.8 },
    });
    expect(a).toEqual({
      subtotal: 100, taxRate: 0.21, taxAmount: 21, total: 121, paymentMethod: 'cash', isPaid: true,
      netEarnings: 96.8, commissionPct: 20,
    });
  });

  it('sans breakdown : total = invoice.amount (euros), aucune décomposition, carte par défaut', () => {
    expect(invoiceAmounts({ ...INVOICE, status: 'PENDING' })).toEqual({
      subtotal: null, taxRate: null, taxAmount: null, total: 121, paymentMethod: 'card', isPaid: false,
      netEarnings: null, commissionPct: null,
    });
  });

  it('facture absente : total 0, rien de payé', () => {
    expect(invoiceAmounts(null)).toMatchObject({ total: 0, isPaid: false, commissionPct: null });
  });

  it('breakdown.total prime sur invoice.amount, même à 0', () => {
    expect(invoiceAmounts({ ...INVOICE, breakdown: { total: 0 } }).total).toBe(0);
  });

  it('commission : arrondie à l’entier, jamais calculée sur un total nul', () => {
    expect(invoiceAmounts({ ...INVOICE, breakdown: { total: 90, providerEarnings: 76.5 } }).commissionPct).toBe(15);
    expect(invoiceAmounts({ ...INVOICE, breakdown: { total: 0, providerEarnings: 0 } }).commissionPct).toBeNull();
    expect(invoiceAmounts({ ...INVOICE, breakdown: { total: 50, providerEarnings: 0 } }).netEarnings).toBe(0);
  });
});

describe('lignes et TVA', () => {
  it('lignes uniquement si fournies', () => {
    const items = [{ label: 'Main d’œuvre', quantity: 2, unitPrice: 45, total: 90 }];
    expect(invoiceItems({ items })).toBe(items);
    expect(invoiceItems({ items: [] })).toEqual([]);
    expect(invoiceItems(undefined)).toEqual([]);
  });

  it('pourcentage de TVA : 0.21 → 21, 0.06 → 6, absent → 0', () => {
    expect(vatPercent(0.21)).toBe(21);
    expect(vatPercent(0.06)).toBe(6);
    expect(vatPercent(null)).toBe(0);
  });
});

describe('numéro affiché et fichier PDF', () => {
  it('« 2026-0042 » → « #FIXED-0042 » (préfixe d’année retiré)', () => {
    expect(displayInvoiceNumber(INVOICE)).toBe('#FIXED-0042');
    expect(displayInvoiceNumber({ ...INVOICE, number: 'A-12' })).toBe('#FIXED-A-12');
  });

  it('sans numéro : 5 derniers caractères de l’id, en majuscules', () => {
    expect(displayInvoiceNumber({ ...INVOICE, number: '' })).toBe('#FIXED-BCDEF');
  });

  it('nom du PDF : le numéro, sinon facture-<6 derniers de l’id>', () => {
    expect(invoicePdfFileName(INVOICE.id, '2026-0042')).toBe('2026-0042.pdf');
    expect(invoicePdfFileName(INVOICE.id, undefined)).toBe('facture-abcdef.pdf');
    expect(invoicePdfFileName(INVOICE.id, '')).toBe('facture-abcdef.pdf');
  });

  it('langue du PDF : code court en minuscules, « fr » par défaut', () => {
    expect(pdfLang('nl-BE')).toBe('nl');
    expect(pdfLang('EN')).toBe('en');
    expect(pdfLang('')).toBe('fr');
    expect(pdfLang(undefined)).toBe('fr');
  });

  it('en-têtes : Bearer seulement si connecté, langue doublée', () => {
    expect(pdfDownloadHeaders('tok', 'nl')).toEqual({ Authorization: 'Bearer tok', 'Accept-Language': 'nl', 'X-Client-Lang': 'nl' });
    expect(pdfDownloadHeaders(null, 'fr')).toEqual({ 'Accept-Language': 'fr', 'X-Client-Lang': 'fr' });
  });
});

describe('badge de statut', () => {
  it('vert payé / ambre en attente, plus dense en sombre', () => {
    expect(statusBadgeBg(true, true)).toBe('rgba(21,193,110,0.15)');
    expect(statusBadgeBg(true, false)).toBe('rgba(21,193,110,0.06)');
    expect(statusBadgeBg(false, true)).toBe('rgba(255,165,0,0.15)');
    expect(statusBadgeBg(false, false)).toBe('rgba(255,165,0,0.06)');
  });
});

describe('dates', () => {
  it('date longue et courte dans la locale donnée', () => {
    expect(fmtInvoiceDate('2026-03-10T10:00:00.000Z', 'fr-BE')).toBe('10 mars 2026');
    expect(fmtInvoiceDateShort('2026-03-10T10:00:00.000Z', 'fr-BE')).toBe('10/03');
  });

  it('virement estimé : 48 h après l’émission', () => {
    expect(payoutDateOf('2026-03-10T10:00:00.000Z', 'fr-BE')).toBe('12/03');
    expect(payoutDateOf('2026-02-27T10:00:00.000Z', 'fr-BE')).toBe('01/03');
  });
});
