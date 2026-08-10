// components/support/ProblemSelector.tsx
// Étape 2 : choix du problème, contextualisé par le statut de la mission.
// Les options sont enrichies d'une sévérité visible (low/medium/high) qui
// préfigure la réponse côté ResolutionView (auto-résolu / WhatsApp / escalade).

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

export type Severity = 'low' | 'medium' | 'high';

export interface ProblemOption {
  id: string;
  label: string;
  icon: string;
  severity: Severity;
  resolution: string;
  /** Hint optionnel affiché sous le label pour clarifier le scope. */
  hint?: string;
}

interface ProblemSelectorProps {
  missionStatus: string | null;
  onSelect: (problem: ProblemOption) => void;
  /** Catalogue prestataire (client injoignable, versement, litige…) au lieu du catalogue client. */
  isProvider?: boolean;
}

type ProblemDef = { id: string; labelKey: string; hintKey: string; icon: string; severity: Severity; resolutionKey: string };

const PROBLEMS_BY_STATUS: Record<string, ProblemDef[]> = {
  SEARCHING: [
    { id: 'provider_late', labelKey: 'ext.support_problem_label_arrival', hintKey: 'ext.support_problem_hint_arrival', icon: 'clock', severity: 'medium', resolutionKey: 'ext.support_problem_resolution_arrival' },
    { id: 'cannot_find',   labelKey: 'ext.support_problem_label_lost',    hintKey: 'ext.support_problem_hint_lost',    icon: 'search', severity: 'medium', resolutionKey: 'ext.support_problem_resolution_lost' },
    { id: 'want_cancel',   labelKey: 'ext.support_problem_label_cancel',  hintKey: 'ext.support_problem_hint_cancel',  icon: 'x-circle', severity: 'low', resolutionKey: 'ext.support_problem_resolution_cancel' },
  ],
  IN_PROGRESS: [
    { id: 'security',      labelKey: 'ext.support_problem_label_security', hintKey: 'ext.support_problem_hint_security', icon: 'shield', severity: 'high', resolutionKey: 'ext.support_problem_resolution_security' },
    { id: 'stop_mission',  labelKey: 'ext.support_problem_label_stop',     hintKey: 'ext.support_problem_hint_stop',     icon: 'minus-circle', severity: 'medium', resolutionKey: 'ext.support_problem_resolution_stop' },
  ],
  COMPLETED: [
    { id: 'unsatisfactory', labelKey: 'ext.support_problem_label_done_bad', hintKey: 'ext.support_problem_hint_done_bad', icon: 'thumbs-down', severity: 'medium', resolutionKey: 'ext.support_problem_resolution_done_bad' },
    { id: 'damage',         labelKey: 'ext.support_problem_label_damage',   hintKey: 'ext.support_problem_hint_damage',   icon: 'alert-triangle', severity: 'high', resolutionKey: 'ext.support_problem_resolution_damage' },
    { id: 'payment_issue',  labelKey: 'ext.support_problem_label_payment',  hintKey: 'ext.support_problem_hint_payment',  icon: 'credit-card', severity: 'medium', resolutionKey: 'ext.support_problem_resolution_payment' },
    { id: 'unknown_mission',labelKey: 'ext.support_problem_label_unauth',   hintKey: 'ext.support_problem_hint_unauth',   icon: 'alert-circle', severity: 'high', resolutionKey: 'ext.support_problem_resolution_unauth' },
  ],
  OTHER: [
    { id: 'account',          labelKey: 'ext.support_problem_label_account', hintKey: 'ext.support_problem_hint_account', icon: 'user', severity: 'medium', resolutionKey: 'ext.support_problem_resolution_account' },
    { id: 'invoice_question', labelKey: 'ext.support_problem_label_invoice', hintKey: 'ext.support_problem_hint_invoice', icon: 'file-text', severity: 'low', resolutionKey: 'ext.support_problem_resolution_invoice' },
    { id: 'other',            labelKey: 'ext.support_problem_label_other',   hintKey: 'ext.support_problem_hint_other',   icon: 'message-circle', severity: 'medium', resolutionKey: 'ext.support_problem_resolution_other' },
  ],
};

function mapStatusToKey(status: string | null): keyof typeof PROBLEMS_BY_STATUS {
  if (!status) return 'OTHER';
  const s = status.toUpperCase();
  if (['PUBLISHED', 'ACCEPTED'].includes(s)) return 'SEARCHING';
  if (s === 'ONGOING') return 'IN_PROGRESS';
  if (s === 'DONE') return 'COMPLETED';
  return 'OTHER';
}

// ─── Catalogue PRESTATAIRE ───────────────────────────────────────────────────
// Le centre d'aide était 100% orienté client (« prestataire en retard »,
// « travail insatisfaisant »…) alors que les prestataires passent par le même
// écran. Mêmes mécaniques de résolution (low/medium/high), problèmes adaptés :
// client injoignable, PIN, versements, litiges, désengagement.

const PROVIDER_PROBLEMS_BY_STATUS: Record<string, ProblemDef[]> = {
  UPCOMING: [
    { id: 'p_client_unreachable', labelKey: 'ext.support_p_label_unreachable', hintKey: 'ext.support_p_hint_unreachable', icon: 'phone-off', severity: 'medium', resolutionKey: 'ext.support_p_resolution_unreachable' },
    { id: 'p_address_issue',      labelKey: 'ext.support_p_label_address',     hintKey: 'ext.support_p_hint_address',     icon: 'map-pin', severity: 'medium', resolutionKey: 'ext.support_p_resolution_address' },
    { id: 'p_running_late',       labelKey: 'ext.support_p_label_late',        hintKey: 'ext.support_p_hint_late',        icon: 'clock', severity: 'low', resolutionKey: 'ext.support_p_resolution_late' },
    { id: 'p_pin_issue',          labelKey: 'ext.support_p_label_pin',         hintKey: 'ext.support_p_hint_pin',         icon: 'key', severity: 'medium', resolutionKey: 'ext.support_p_resolution_pin' },
    { id: 'p_must_abandon',       labelKey: 'ext.support_p_label_abandon',     hintKey: 'ext.support_p_hint_abandon',     icon: 'x-circle', severity: 'medium', resolutionKey: 'ext.support_p_resolution_abandon' },
  ],
  IN_PROGRESS: [
    { id: 'p_safety',          labelKey: 'ext.support_p_label_safety',   hintKey: 'ext.support_p_hint_safety',   icon: 'shield', severity: 'high', resolutionKey: 'ext.support_p_resolution_safety' },
    { id: 'p_scope_bigger',    labelKey: 'ext.support_p_label_scope',    hintKey: 'ext.support_p_hint_scope',    icon: 'tool', severity: 'medium', resolutionKey: 'ext.support_p_resolution_scope' },
    { id: 'p_cannot_complete', labelKey: 'ext.support_p_label_blocked',  hintKey: 'ext.support_p_hint_blocked',  icon: 'minus-circle', severity: 'medium', resolutionKey: 'ext.support_p_resolution_blocked' },
  ],
  COMPLETED: [
    { id: 'p_payout_missing',      labelKey: 'ext.support_p_label_payout',     hintKey: 'ext.support_p_hint_payout',     icon: 'dollar-sign', severity: 'medium', resolutionKey: 'ext.support_p_resolution_payout' },
    { id: 'p_client_dispute',      labelKey: 'ext.support_p_label_dispute',    hintKey: 'ext.support_p_hint_dispute',    icon: 'alert-triangle', severity: 'high', resolutionKey: 'ext.support_p_resolution_dispute' },
    { id: 'p_commission_question', labelKey: 'ext.support_p_label_commission', hintKey: 'ext.support_p_hint_commission', icon: 'percent', severity: 'low', resolutionKey: 'ext.support_p_resolution_commission' },
  ],
  OTHER: [
    { id: 'p_account_docs',    labelKey: 'ext.support_p_label_account', hintKey: 'ext.support_p_hint_account', icon: 'user-check', severity: 'medium', resolutionKey: 'ext.support_p_resolution_account' },
    { id: 'p_wallet_question', labelKey: 'ext.support_p_label_wallet',  hintKey: 'ext.support_p_hint_wallet',  icon: 'credit-card', severity: 'low', resolutionKey: 'ext.support_p_resolution_wallet' },
    { id: 'p_other',           labelKey: 'ext.support_p_label_other',   hintKey: 'ext.support_p_hint_other',   icon: 'message-circle', severity: 'medium', resolutionKey: 'ext.support_p_resolution_other' },
  ],
};

// Statuts vus côté prestataire : le flux devis (QUOTE_*) relève de « mission à
// venir », pas de « autre » comme côté client.
function mapProviderStatusToKey(status: string | null): keyof typeof PROVIDER_PROBLEMS_BY_STATUS {
  if (!status) return 'OTHER';
  const s = status.toUpperCase();
  if (['PUBLISHED', 'ACCEPTED', 'QUOTE_PENDING', 'QUOTE_SENT', 'QUOTE_ACCEPTED'].includes(s)) return 'UPCOMING';
  if (s === 'ONGOING') return 'IN_PROGRESS';
  if (s === 'DONE') return 'COMPLETED';
  return 'OTHER';
}

function severityLabel(sev: Severity, t: (k: string) => string) {
  if (sev === 'high') return t('ext.support_sev_high');
  if (sev === 'medium') return t('ext.support_sev_medium');
  return t('ext.support_sev_low');
}

function severityColor(sev: Severity, theme: ReturnType<typeof useAppTheme>) {
  if (sev === 'high') return COLORS.red;
  if (sev === 'medium') return COLORS.amber;
  return theme.textSub as string;
}

export default function ProblemSelector({ missionStatus, onSelect, isProvider }: ProblemSelectorProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const defs = isProvider
    ? (PROVIDER_PROBLEMS_BY_STATUS[mapProviderStatusToKey(missionStatus)] || PROVIDER_PROBLEMS_BY_STATUS.OTHER)
    : (PROBLEMS_BY_STATUS[mapStatusToKey(missionStatus)] || PROBLEMS_BY_STATUS.OTHER);
  const problems: ProblemOption[] = defs.map(d => ({
    id: d.id,
    label: t(d.labelKey),
    hint: t(d.hintKey),
    icon: d.icon,
    severity: d.severity,
    resolution: t(d.resolutionKey),
  }));

  return (
    <View style={{ gap: 8 }}>
      {problems.map(problem => {
        const tone = severityColor(problem.severity, theme);
        return (
          <TouchableOpacity
            key={problem.id}
            style={[s.option, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
            onPress={() => onSelect(problem)}
            activeOpacity={0.78}
          >
            <View style={[s.iconWrap, { backgroundColor: theme.surface }]}>
              <Feather name={problem.icon as any} size={18} color={theme.textSub} />
            </View>

            <View style={s.body}>
              <Text style={[s.label, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
                {problem.label}
              </Text>
              {!!problem.hint && (
                <Text style={[s.hint, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
                  {problem.hint}
                </Text>
              )}
            </View>

            <View style={[s.sevPill, { backgroundColor: `${tone}1A` }]}>
              <View style={[s.sevDot, { backgroundColor: tone }]} />
              <Text style={[s.sevText, { color: tone, fontFamily: FONTS.monoMedium }]}>
                {severityLabel(problem.severity, t)}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 14, borderWidth: 1,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  body: { flex: 1, gap: 2 },
  label: { fontSize: 14 },
  hint: { fontSize: 11.5 },

  sevPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  sevDot: { width: 5, height: 5, borderRadius: 2.5 },
  sevText: { fontSize: 9.5, letterSpacing: 0.8 },
});
