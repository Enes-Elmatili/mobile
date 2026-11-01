// components/dashboard/RequestDetailContent.tsx — le contenu de la sheet de
// détail d'une demande (accueil client) : statut, description, adresse, prix,
// et l'action qui correspond à l'état (suivre, relancer, facture, payer, devis…).
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { translateRequestServiceRaw } from '@/lib/categoryLabel';
import { api } from '@/lib/api';
import { formatEUR } from '@/lib/format';
import { FONTS } from '@/hooks/use-app-theme';
import type { AppTheme } from '@/hooks/use-app-theme';
import { PulseDot } from '@/components/ui/PulseDot';
import { PressScale } from '@/components/ui/PressScale';
import { getStatusInfo, type FeatherName } from '@/lib/dashboard/status';
import { quoteHref } from '@/lib/dashboard/navigation';
import type { RequestDetails } from '@/lib/dashboard/types';
import { reportError } from '@/lib/logger';

type DetailRow = { icon: FeatherName; val: string };

export function RequestDetailContent({
  loading,
  request,
  hasInvoice,
  close,
  onTrackMission,
  onTrackSearch,
  onShowInvoice,
  theme,
}: {
  loading: boolean;
  request: RequestDetails | null;
  hasInvoice: boolean;
  /** Ferme la sheet (bottomSheetRef.current?.close()). */
  close: () => void;
  /** Ferme la sheet et ouvre le suivi. */
  onTrackMission: (r: RequestDetails) => void;
  /** Ouvre le suivi de la recherche (la sheet est déjà fermée). */
  onTrackSearch: (r: RequestDetails) => void;
  onShowInvoice: () => void;
  theme: AppTheme;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  if (loading) return <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 50 }} />;
  if (!request) return null;

  const statusUp = request.status?.toUpperCase();
  const rows = [
    { icon: 'file-text', val: request.description || t('dashboard.no_description') },
    request.address && { icon: 'map-pin', val: request.address },
    request.price    && { icon: 'dollar-sign', val: formatEUR(request.price) },
  ].filter((row): row is DetailRow => Boolean(row));

  return (
    <>
      <Text style={[s.sheetTitle, { color: theme.text }]}>{translateRequestServiceRaw(request)}</Text>

      <View style={[s.statusBadge, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
        <PulseDot size={6} color={getStatusInfo(request.status, t).ledColor} />
        <Text style={[s.statusBadgeText, { color: theme.textSub }]}>{getStatusInfo(request.status, t).label}</Text>
      </View>

      {rows.map((row, i) => (
        <View key={i} style={s.sheetRow}>
          <View style={[s.sheetRowIcon, { backgroundColor: theme.surface }]}>
            <Feather name={row.icon} size={14} color={theme.textSub} />
          </View>
          <Text style={[s.sheetVal, { color: theme.textSub }]}>{row.val}</Text>
        </View>
      ))}

      {['ACCEPTED', 'ONGOING'].includes(statusUp) && (
        <PressScale accessibilityRole="button" style={[s.actionBtn, { backgroundColor: theme.accent }]} onPress={() => onTrackMission(request)}>
          <Text style={[s.actionBtnText, { color: theme.accentText }]}>
            {request.status === 'ACCEPTED' ? t('dashboard.track_provider') : t('dashboard.track_mission')}
          </Text>
          <Feather name="navigation" size={17} color={theme.accentText} />
        </PressScale>
      )}

      {statusUp === 'PUBLISHED' && (
        <>
          <PressScale accessibilityRole="button"
            style={[s.actionBtn, { backgroundColor: theme.accent }]}
            onPress={() => {
              close();
              onTrackSearch(request);
            }}
          >
            <Text style={[s.actionBtnText, { color: theme.accentText }]}>{t('dashboard.track_search')}</Text>
            <Feather name="radio" size={17} color={theme.accentText} />
          </PressScale>
          <PressScale accessibilityRole="button"
            style={[s.resendBtn, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
            onPress={async () => {
              try { await api.post(`/requests/${request.id}/notify`); } catch (e) { reportError(e, 'dashboard.notify_provider'); }
            }}
          >
            <Feather name="refresh-cw" size={15} color={theme.textSub} />
            <Text style={[s.resendText, { color: theme.textSub }]}>{t('dashboard.resend_providers')}</Text>
          </PressScale>
        </>
      )}

      {statusUp === 'DONE' && (
        <>
          <View style={[s.doneCard, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
            <Feather name="check-circle" size={20} color={theme.greenText} />
            <Text style={[s.doneText, { color: theme.text }]}>{t('dashboard.mission_success')}</Text>
          </View>
          {hasInvoice && (
            <PressScale accessibilityRole="button"
              style={[s.actionBtn, { backgroundColor: theme.accent, marginTop: 10 }]}
              onPress={() => {
                close();
                onShowInvoice();
              }}
            >
              <Feather name="file-text" size={17} color={theme.accentText} />
              <Text style={[s.actionBtnText, { color: theme.accentText }]}>{t('dashboard.view_invoice')}</Text>
            </PressScale>
          )}
        </>
      )}

      {statusUp === 'PENDING_PAYMENT' && (
        <PressScale accessibilityRole="button"
          style={[s.actionBtn, { backgroundColor: theme.accent }]}
          onPress={() => {
            close();
            router.push({
              pathname: '/request/[id]/resume-payment',
              params: { id: String(request.id) },
            });
          }}
        >
          <Text style={[s.actionBtnText, { color: theme.accentText }]}>{t('dashboard.resume_payment')}</Text>
          <Feather name="credit-card" size={17} color={theme.accentText} />
        </PressScale>
      )}

      {['QUOTE_PENDING', 'QUOTE_SENT'].includes(statusUp) && (
        <PressScale accessibilityRole="button"
          style={[s.actionBtn, { backgroundColor: theme.accent }]}
          onPress={() => {
            close();
            router.push(quoteHref(request));
          }}
        >
          <Text style={[s.actionBtnText, { color: theme.accentText }]}>
            {statusUp === 'QUOTE_SENT' ? t('dashboard.view_quote') : t('dashboard.track_request')}
          </Text>
          <Feather name={statusUp === 'QUOTE_SENT' ? 'file-text' : 'clock'} size={17} color={theme.accentText} />
        </PressScale>
      )}

      {statusUp === 'QUOTE_ACCEPTED' && (
        <PressScale accessibilityRole="button"
          style={[s.actionBtn, { backgroundColor: theme.accent }]}
          onPress={() => onTrackMission(request)}
        >
          <Text style={[s.actionBtnText, { color: theme.accentText }]}>{t('dashboard.track_intervention')}</Text>
          <Feather name="navigation" size={17} color={theme.accentText} />
        </PressScale>
      )}

      {statusUp === 'EXPIRED' && (
        <>
          <View style={[s.expiredCard, { backgroundColor: theme.surfaceAlt, borderColor: theme.borderLight }]}>
            <Feather name="clock" size={20} color={theme.textSub} />
            <View style={{ flex: 1 }}>
              <Text style={[s.expiredTitle, { color: theme.text }]}>{t('dashboard.no_provider_found')}</Text>
              <Text style={[s.expiredSub, { color: theme.textMuted }]}>{t('dashboard.restart_search_sub')}</Text>
            </View>
          </View>
          <PressScale accessibilityRole="button" style={[s.actionBtn, { backgroundColor: theme.accent }]} onPress={() => { close(); router.push('/request/NewRequestStepper'); }}>
            <Text style={[s.actionBtnText, { color: theme.accentText }]}>{t('dashboard.restart_search')}</Text>
            <Feather name="refresh-cw" size={17} color={theme.accentText} />
          </PressScale>
        </>
      )}
    </>
  );
}

const s = StyleSheet.create({
  sheetTitle: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 24, marginBottom: 10, letterSpacing: 0.5 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, marginBottom: 20,
    borderWidth: 1,
  },
  statusBadgeText: { fontFamily: FONTS.mono, fontSize: 12 },

  sheetRow: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
  sheetRowIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetVal: { fontFamily: FONTS.sans, flex: 1, fontSize: 14, lineHeight: 21, paddingTop: 5 },

  actionBtn: {
    flexDirection: 'row', height: 54,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    gap: 10, marginTop: 18,
  },
  actionBtnText: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 17, letterSpacing: 0.8 },

  resendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, marginTop: 12, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1,
  },
  resendText: { fontFamily: FONTS.mono, fontSize: 13 },

  doneCard: {
    borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18,
    borderWidth: 1,
  },
  doneText: { fontFamily: FONTS.sansMedium, fontSize: 14 },

  expiredCard: {
    borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 18,
    borderWidth: 1,
  },
  expiredTitle: { fontFamily: FONTS.sansMedium, fontSize: 14, marginBottom: 4 },
  expiredSub: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19 },
});
