// components/sheets/invoice/styles.ts — Styles de la feuille facture (vues
// client et prestataire partagent badges, totaux et boutons).
import { StyleSheet, Platform } from 'react-native';
import type { AppTheme } from '@/hooks/use-app-theme';

// ── Colors — driven by system theme ──
export function invoicePalette(theme: AppTheme) {
  return {
    bg: theme.cardBg,
    textPrimary: theme.text,
    textSecondary: theme.textSub,
    textMuted: theme.textMuted,
    surfaceBg: theme.surfaceAlt,
    borderColor: theme.border,
    accentBg: theme.accent,
    accentText: theme.accentText,
  };
}

export type InvoicePalette = ReturnType<typeof invoicePalette>;

export const s = StyleSheet.create({
  indicator: { width: 36, height: 4 },
  scroll: { paddingBottom: 24 },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 20,
  },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  logo: {
    width: 48,
    height: 48,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  invoiceLabel: {
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 3,
  },
  invoiceNumber: {
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },

  // ── Compact Header (provider) ──
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 12,
  },
  compactDate: {
    fontSize: 13,
  },
  compactService: {
    fontSize: 13,
    marginBottom: 2,
  },

  // ── Body ──
  body: { paddingHorizontal: 22 },

  // ── Service Block ──
  serviceBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    padding: 14,
  },
  serviceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceInfo: { flex: 1 },
  serviceTitle: {
    fontSize: 16,
    marginBottom: 2,
  },
  serviceProvider: {
    fontSize: 13,
    marginBottom: 4,
  },
  serviceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serviceMetaText: {
    fontSize: 12,
  },
  serviceMetaDot: {
    fontSize: 12,
  },

  // ── Sections ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
  },

  // ── Totals ──
  totalsBlock: {
    gap: 6,
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  totalLineLabel: {
    fontSize: 14,
  },
  totalLineValue: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  totalDivider: {
    height: 0.5,
    marginVertical: 8,
  },
  grandTotalLabel: {
    fontSize: 16,
  },
  grandTotalValue: {
    fontSize: 26,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    textAlign: 'right',
  },

  // ── Provider Net Block ──
  netBlock: {
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    gap: 10,
  },
  netHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  netLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  netValue: {
    fontSize: 28,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
  },
  netSub: {
    fontSize: 12,
    marginTop: 2,
  },
  payoutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  payoutText: {
    fontSize: 12,
  },

  // ── Status ──
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 13,
  },
  paymentMethodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  paymentMethodText: {
    fontSize: 12,
  },

  // ── Buttons ──
  actions: {
    gap: 6,
  },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  btnOutlineText: {
    fontSize: 15,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    // Raised tactile : top highlight + bottom chamfer + drop shadow renforcée.
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.45)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.18)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.32,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 6 },
    }),
  },
  btnPrimaryText: {
    fontSize: 15,
  },
  // Close : bouton secondaire sans cadre ni fond (texte seul), sous le CTA principal
  btnGhost: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  btnGhostText: {
    fontSize: 15,
  },
});

export const li = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  left: { flex: 1, paddingRight: 12 },
  label: { fontSize: 14, marginBottom: 2 },
  detail: { fontSize: 12 },
  total: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
});
