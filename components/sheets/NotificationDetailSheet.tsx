// components/sheets/NotificationDetailSheet.tsx
// ─── Détail d'une notification — bottom sheet ────────────────────────────────
// Affiche le contenu complet + une guidance contextuelle ("que faire ?") et une
// action utile (espace / support). Les notifs in-app n'ont qu'une sévérité
// (info/success/warning/error) : la guidance et l'action en découlent.

import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { feedback } from '@/lib/feedback/feedback';

export interface NotifData {
  category?: string;
  screen?: string;
  type?: string;
  requestId?: number | string;
  disputeId?: string;
  senderId?: string;
}

export interface NotifDetail {
  id: string;
  title: string;
  message: string;
  type: string;
  readAt: string | null;
  createdAt: string;
  data?: NotifData | null;
}

// ─── Config par sévérité ────────────────────────────────────────────────────
function severityConfig(type: string, theme: any) {
  switch (type) {
    case 'success':
      return { icon: 'check' as const, color: COLORS.green, tint: 'rgba(70,220,147,0.14)', guide: 'notifications.guidance_success' };
    case 'warning':
      return { icon: 'alert-triangle' as const, color: COLORS.amber, tint: 'rgba(245,158,11,0.14)', guide: 'notifications.guidance_warning' };
    case 'error':
      return { icon: 'alert-octagon' as const, color: COLORS.red, tint: 'rgba(239,68,68,0.14)', guide: 'notifications.guidance_error' };
    default:
      return { icon: 'info' as const, color: theme.textSub, tint: theme.surfaceAlt, guide: 'notifications.guidance_info' };
  }
}

// Libellé court de domaine (mono, uppercase) — déduit de la catégorie, sinon de la sévérité
const CATEGORY_TAG: Record<string, string> = {
  mission: 'tag_mission', mission_update: 'tag_mission', rating: 'tag_rating',
  refund: 'tag_refund', dispute: 'tag_dispute', support: 'tag_support',
};
function tagLabel(notif: NotifDetail, t: any): string {
  const key = (notif.data?.category && CATEGORY_TAG[notif.data.category])
    || { success: 'tag_success', warning: 'tag_warning', error: 'tag_error' }[notif.type]
    || 'tag_info';
  return t(`notifications.${key}`);
}

function relTime(d: string): string {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return i18n.t('notifications.time_now');
  if (diff < 3600) return i18n.t('notifications.time_min', { n: Math.floor(diff / 60) });
  if (diff < 86400) return i18n.t('notifications.time_hour', { n: Math.floor(diff / 3600) });
  if (diff < 604800) return i18n.t('notifications.time_day', { n: Math.floor(diff / 86400) });
  return new Date(d).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
}

export default function NotificationDetailSheet({
  notif, isVisible, onClose, onDelete,
}: {
  notif: NotifDetail | null;
  isVisible: boolean;
  onClose: () => void;
  onDelete?: (id: string) => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.35} pressBehavior="close" />
    ), [],
  );

  if (!isVisible || !notif) return null;

  const sev = severityConfig(notif.type, theme);
  const isWarn = notif.type === 'warning' || notif.type === 'error';

  const goToSupport = () => {
    onClose();
    router.push('/support');
  };

  const handleDelete = () => {
    feedback.haptic('medium');
    onDelete?.(notif.id);
    onClose();
  };

  return (
    <BottomSheet
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={[s.indicator, { backgroundColor: theme.heroSubFaint }]}
      backgroundStyle={{ backgroundColor: theme.heroBg }}
      maxDynamicContentSize={Dimensions.get('window').height * 0.9}
    >
      <BottomSheetScrollView showsVerticalScrollIndicator={false}>
        {/* ═══ HERO sombre (signature premium FIXED) ═══ */}
        <View style={s.hero}>
          <View style={s.heroTop}>
            <View style={[s.emblem, { borderColor: sev.color, shadowColor: sev.color }]}>
              <Feather name={sev.icon} size={23} color={sev.color} />
            </View>
            <Text style={[s.heroTime, { color: theme.heroSubFaint, fontFamily: FONTS.mono }]}>{relTime(notif.createdAt)}</Text>
          </View>
          <Text style={[s.heroTag, { color: theme.heroSub, fontFamily: FONTS.monoMedium }]}>{tagLabel(notif, t).toUpperCase()}</Text>
          <Text style={[s.heroTitle, { color: theme.heroText, fontFamily: FONTS.bebas }]}>{notif.title}</Text>
        </View>

        {/* ═══ BODY (carte claire qui émerge du sombre) ═══ */}
        <View style={[s.body, { backgroundColor: theme.cardBg, paddingBottom: insets.bottom + 22 }]}>
          <Text style={[s.message, { color: theme.textSub, fontFamily: FONTS.sans }]}>{notif.message}</Text>

          {/* Guidance "que faire ?" — séparée par un filet, non encadrée */}
          <View style={[s.guide, { borderTopColor: theme.borderLight }]}>
            <View style={[s.guideDot, { backgroundColor: sev.tint }]}>
              <Feather name="info" size={12} color={sev.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.guideLabel, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>{t('notifications.detail_what_to_do').toUpperCase()}</Text>
              <Text style={[s.guideText, { color: theme.textSub, fontFamily: FONTS.sans }]}>{t(sev.guide)}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={s.actions}>
            {isWarn && notif.data?.category !== 'support' && (
              <TouchableOpacity
                style={[s.ctaGhost, { borderColor: theme.borderLight }]}
                onPress={goToSupport}
                activeOpacity={0.85}
              >
                <Feather name="life-buoy" size={17} color={theme.textMuted} />
                <Text style={[s.ctaGhostText, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>{t('notifications.contact_support')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[s.ctaGhost, { borderColor: COLORS.red + '55' }]}
              onPress={handleDelete}
              activeOpacity={0.85}
            >
              <Feather name="trash-2" size={17} color={COLORS.red} />
              <Text style={[s.ctaGhostText, { color: COLORS.red, fontFamily: FONTS.sansMedium }]}>{t('notifications.delete')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.6}>
              <Text style={[s.closeText, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>{t('notifications.understood')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  indicator: { width: 32, height: 4 },

  // ═══ HERO sombre ═══
  hero:      { paddingHorizontal: 24, paddingTop: 6, paddingBottom: 32 },
  heroTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  emblem: {
    width: 54, height: 54, borderRadius: 27, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    ...Platform.select({
      ios: { shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
      android: { elevation: 0 },
    }),
  },
  heroTime:  { fontSize: 12, letterSpacing: 0.3 },
  heroTag:   { fontSize: 11, letterSpacing: 2.5, marginBottom: 8 },
  heroTitle: { fontSize: 33, letterSpacing: 0.5, lineHeight: 35 },

  // ═══ BODY clair ═══
  body:    { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 26 },
  message: { fontSize: 15.5, lineHeight: 24 },

  // ── Guidance (filet de séparation, non encadrée) ──
  guide:      { flexDirection: 'row', gap: 12, marginTop: 24, paddingTop: 22, borderTopWidth: StyleSheet.hairlineWidth },
  guideDot:   { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  guideLabel: { fontSize: 10, letterSpacing: 1.3, marginBottom: 5 },
  guideText:  { fontSize: 13.5, lineHeight: 20 },

  // ── Actions ──
  actions:      { marginTop: 30, gap: 10 },
  cta:          { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingVertical: 17, paddingHorizontal: 18 },
  ctaSpinner:   { height: 21 },
  ctaText:      { flex: 1, fontSize: 15.5 },
  ctaGhost:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 15, borderWidth: 1.5, backgroundColor: 'transparent' },
  ctaGhostText: { fontSize: 14.5 },
  closeBtn:     { alignItems: 'center', paddingVertical: 14, marginTop: 2 },
  closeText:    { fontSize: 14 },
});
