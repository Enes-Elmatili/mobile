// app/request/[id]/early.tsx
// Écran "trop tôt" — provider qui ouvre une mission planifiée hors fenêtre.
// L'écran ongoing.tsx ne devrait pas afficher la mission tant qu'on n'est pas
// dans la fenêtre d'activation (~30 min avant RDV). On redirige ici à la place,
// avec un compte à rebours pro et les actions disponibles avant le démarrage.

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, StatusBar,
  TouchableOpacity, ScrollView, Linking, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { feedback } from '@/lib/feedback/feedback';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { formatEUR } from '@/lib/format';
import { cleanName } from '@/lib/displayName';

interface MissionData {
  id: number;
  serviceType: string;
  description?: string;
  address: string;
  lat?: number;
  lng?: number;
  price: number | null;
  preferredTimeStart: string;
  status: string;
  client?: { name?: string; phone?: string; floor?: number | null; hasElevator?: boolean | null; buildingType?: string | null; accessNotes?: string | null };
  category?: { name: string };
}

const ACTIVATION_WINDOW_MIN = 30;

export default function EarlyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();

  const [mission, setMission] = useState<MissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // Refresh tick chaque 30s pour recalculer le compte à rebours et auto-redirect.
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res: any = await api.get(`/requests/${id}`);
      const data = res?.data || res;
      setMission(data);
    } catch (e) {
      devError('[early] load mission failed:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Auto-redirect quand on entre dans la fenêtre d'activation.
  useEffect(() => {
    if (!mission?.preferredTimeStart) return;
    const minsUntil = (new Date(mission.preferredTimeStart).getTime() - Date.now()) / 60_000;
    if (minsUntil <= ACTIVATION_WINDOW_MIN) {
      router.replace({ pathname: '/request/[id]/ongoing', params: { id: String(mission.id) } });
    }
  }, [mission?.preferredTimeStart, mission?.id, router, tick]);

  const countdown = useMemo(() => {
    if (!mission?.preferredTimeStart) return null;
    const target = new Date(mission.preferredTimeStart).getTime();
    const now = Date.now();
    const diffMs = target - now;
    if (diffMs <= 0) return null;
    const totalMin = Math.floor(diffMs / 60_000);
    const days = Math.floor(totalMin / (60 * 24));
    const hours = Math.floor((totalMin % (60 * 24)) / 60);
    const mins = totalMin % 60;
    return { days, hours, mins, totalMin };
  }, [mission?.preferredTimeStart, tick]);

  const formattedDate = useMemo(() => {
    if (!mission?.preferredTimeStart) return '—';
    return new Date(mission.preferredTimeStart).toLocaleDateString(undefined, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }, [mission?.preferredTimeStart]);

  const formattedTime = useMemo(() => {
    if (!mission?.preferredTimeStart) return '';
    return new Date(mission.preferredTimeStart).toLocaleTimeString(undefined, {
      hour: '2-digit', minute: '2-digit',
    });
  }, [mission?.preferredTimeStart]);

  const handleNavigate = useCallback(() => {
    if (!mission?.lat || !mission?.lng) {
      feedback.error('ext.early_no_address_sub');
      return;
    }
    // Uniquement destination=lat,lng — un `destination_place_id` doit être un vrai
    // place_id Google, pas une adresse encodée (sinon paramètre ignoré par Maps).
    const url = `https://www.google.com/maps/dir/?api=1&destination=${mission.lat},${mission.lng}`;
    feedback.haptic('light');
    Linking.openURL(url).catch(() => feedback.error('ext.early_navigation_failed'));
  }, [mission, t]);

  const handleCallClient = useCallback(() => {
    const phone = mission?.client?.phone;
    if (!phone) {
      feedback.error('ext.early_no_phone_sub');
      return;
    }
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() => {});
  }, [mission?.client?.phone, t]);

  if (loading) {
    return (
      <SafeAreaView style={[s.root, s.center, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <ActivityIndicator size="small" color={theme.text} />
      </SafeAreaView>
    );
  }

  if (!mission) {
    return (
      <SafeAreaView style={[s.root, s.center, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <Feather name="alert-circle" size={32} color={theme.textMuted} />
        <Text style={[s.errorTitle, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
          {t('missions.mission_unavailable')}
        </Text>
        <TouchableOpacity
          style={[s.errorBtn, { backgroundColor: theme.text }]}
          onPress={() => router.replace('/(tabs)/missions')}
          activeOpacity={0.85}
        >
          <Text style={[s.errorBtnText, { color: theme.bg, fontFamily: FONTS.sansMedium }]}>{t('common.back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
          onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/missions'); }}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={18} color={theme.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={[s.kicker, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>{t('missions.mission').toUpperCase()}</Text>
          <Text style={[s.title, { color: theme.text, fontFamily: FONTS.bebas }]}>{t('missions.tab_upcoming')}</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero countdown */}
        <View style={[s.heroCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={[s.iconCircle, { backgroundColor: theme.surface }]}>
            <Feather name="clock" size={28} color={theme.text} />
          </View>

          <Text style={[s.heroLabel, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>{t('missions.departure_planned').toUpperCase()}</Text>

          {countdown ? (
            <View style={s.countdownRow}>
              {countdown.days > 0 && (
                <CountdownBlock value={countdown.days} unit={t(countdown.days > 1 ? 'ext.early_days_other' : 'ext.early_days_one')} theme={theme} />
              )}
              {(countdown.days > 0 || countdown.hours > 0) && (
                <CountdownBlock value={countdown.hours} unit={t(countdown.hours > 1 ? 'ext.early_hours_other' : 'ext.early_hours_one')} theme={theme} />
              )}
              <CountdownBlock value={countdown.mins} unit={t('ext.early_min')} theme={theme} />
            </View>
          ) : (
            <Text style={[s.heroDate, { color: theme.text, fontFamily: FONTS.bebas }]}>{t('ext.early_soon')}</Text>
          )}

          <Text style={[s.heroDate, { color: theme.text, fontFamily: FONTS.sansMedium, fontSize: 15, marginTop: 6 }]}>
            {formattedDate}
          </Text>
          <Text style={[s.heroTime, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            {t('ext.early_at', { time: formattedTime })}
          </Text>

          <View style={[s.activationHint, { backgroundColor: theme.surface }]}>
            <Feather name="info" size={12} color={theme.textSub} />
            <Text style={[s.activationHintText, { color: theme.textSub, fontFamily: FONTS.sans }]}>
              {t('ext.early_window', { min: ACTIVATION_WINDOW_MIN })}
            </Text>
          </View>
        </View>

        {/* Mission summary */}
        <View style={[s.section, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <Text style={[s.sectionLabel, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>
            {t('missions.mission_details').toUpperCase()}
          </Text>
          <View style={s.row}>
            <Feather name="tool" size={16} color={theme.textMuted} />
            <Text style={[s.rowText, { color: theme.text, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>
              {mission.serviceType || mission.category?.name || t('missions.mission')}
            </Text>
            {mission.price && mission.price > 0 ? (
              <Text style={[s.rowValue, { color: theme.text, fontFamily: FONTS.bebas }]}>
                {formatEUR(mission.price, 0)}
              </Text>
            ) : null}
          </View>
          <View style={[s.divider, { backgroundColor: theme.borderLight }]} />
          <View style={s.row}>
            <Feather name="map-pin" size={16} color={theme.textMuted} />
            <Text style={[s.rowText, { color: theme.text, fontFamily: FONTS.sans }]} numberOfLines={2}>
              {mission.address || t('ext.early_address_tbc')}
            </Text>
          </View>
          {mission.client?.name && (
            <>
              <View style={[s.divider, { backgroundColor: theme.borderLight }]} />
              <View style={s.row}>
                <Feather name="user" size={16} color={theme.textMuted} />
                <Text style={[s.rowText, { color: theme.text, fontFamily: FONTS.sans }]}>
                  {cleanName(mission.client.name)}
                </Text>
              </View>
            </>
          )}
          {(mission.client?.floor != null || mission.client?.hasElevator != null || mission.client?.buildingType) && (
            <>
              <View style={[s.divider, { backgroundColor: theme.borderLight }]} />
              <View style={s.row}>
                <Feather name="home" size={16} color={theme.textMuted} />
                <Text style={[s.rowText, { color: theme.text, fontFamily: FONTS.sans }]} numberOfLines={1}>
                  {[
                    mission.client?.buildingType === 'apartment' ? t('ext.early_building_apartment') : mission.client?.buildingType === 'house' ? t('ext.early_building_house') : mission.client?.buildingType,
                    mission.client?.floor != null ? t('ext.early_floor', { n: mission.client.floor }) : null,
                    mission.client?.hasElevator != null ? (mission.client.hasElevator ? t('ext.early_elevator') : t('ext.early_no_elevator')) : null,
                  ].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Description */}
        {mission.description ? (
          <View style={[s.section, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
            <Text style={[s.sectionLabel, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>
              {t('ext.early_description_label')}
            </Text>
            <Text style={[s.descriptionText, { color: theme.textSub, fontFamily: FONTS.sans }]}>
              {mission.description}
            </Text>
          </View>
        ) : null}

        {/* Actions */}
        <View style={s.actionsRow}>
          <TouchableOpacity
            style={[s.actionPrimary, { backgroundColor: theme.text }]}
            onPress={handleNavigate}
            activeOpacity={0.85}
          >
            <Feather name="navigation" size={16} color={theme.bg} />
            <Text style={[s.actionPrimaryText, { color: theme.bg, fontFamily: FONTS.sansMedium }]}>
              {t('ext.early_itinerary')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionSecondary, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
            onPress={handleCallClient}
            activeOpacity={0.85}
            disabled={!mission.client?.phone}
          >
            <Feather name="phone" size={15} color={mission.client?.phone ? theme.text : theme.textMuted} />
            <Text style={[s.actionSecondaryText, { color: mission.client?.phone ? theme.text : theme.textMuted, fontFamily: FONTS.sansMedium }]}>
              {t('common.call')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Reminder */}
        <View style={[s.reminder, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
          <Feather name="bell" size={14} color={theme.textSub} />
          <Text style={[s.reminderText, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            {t('ext.early_notify')}
          </Text>
        </View>

        {/* Cancel */}
        <TouchableOpacity
          style={[s.refuseBtn, { borderColor: theme.borderLight }]}
          onPress={async () => {
            const ok = await feedback.confirm({
              titleKey: 'ext.missions_refuse',
              messageKey: 'ext.early_cancel_msg',
              confirmKey: 'ext.missions_refuse',
              cancelKey: 'common.cancel',
              destructive: true,
            });
            if (!ok) return;
            try {
              await api.post(`/requests/${mission.id}/refuse`);
              router.replace('/(tabs)/missions');
            } catch (e: any) {
              feedback.error(e?.message || t('ext.early_refuse_failed'));
            }
          }}
          activeOpacity={0.7}
        >
          <Feather name="x" size={14} color={COLORS.red} />
          <Text style={[s.refuseBtnText, { color: COLORS.red, fontFamily: FONTS.sansMedium }]}>
            {t('ext.missions_refuse')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function CountdownBlock({ value, unit, theme }: { value: number; unit: string; theme: ReturnType<typeof useAppTheme> }) {
  return (
    <View style={cdStyles.block}>
      <Text style={[cdStyles.value, { color: theme.text, fontFamily: FONTS.bebas }]}>
        {String(value).padStart(2, '0')}
      </Text>
      <Text style={[cdStyles.unit, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>
        {unit}
      </Text>
    </View>
  );
}

const cdStyles = StyleSheet.create({
  block: { alignItems: 'center', minWidth: 64 },
  value: { fontSize: 56, lineHeight: 56, letterSpacing: -1 },
  unit: { fontSize: 9, letterSpacing: 1.4, marginTop: 4 },
});

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorTitle: { fontSize: 16 },
  errorBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, marginTop: 8 },
  errorBtnText: { fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center', gap: 1 },
  kicker: { fontSize: 9.5, letterSpacing: 1.6 },
  title: { fontSize: 20, letterSpacing: 1, lineHeight: 22 },

  scroll: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 18, gap: 10 },

  heroCard: {
    borderRadius: 16, padding: 16, alignItems: 'center', gap: 6, borderWidth: 1,
  },
  iconCircle: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  heroLabel: { fontSize: 10, letterSpacing: 1.4 },
  countdownRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 4 },
  heroDate: { fontSize: 24, letterSpacing: 0.5, lineHeight: 26, marginTop: 2, textAlign: 'center' },
  heroTime: { fontSize: 12, marginTop: 2 },
  activationHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginTop: 8,
  },
  activationHintText: { fontSize: 11 },

  section: {
    borderRadius: 14, padding: 12, gap: 8, borderWidth: 1,
  },
  sectionLabel: { fontSize: 10, letterSpacing: 1.4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { flex: 1, fontSize: 13 },
  rowValue: { fontSize: 15, letterSpacing: 0.3 },
  divider: { height: 1 },
  descriptionText: { fontSize: 13, lineHeight: 18 },

  actionsRow: { flexDirection: 'row', gap: 8 },
  actionPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 44, borderRadius: 12,
  },
  actionPrimaryText: { fontSize: 14, letterSpacing: 0.3 },
  actionSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 44, borderRadius: 12, borderWidth: 1,
  },
  actionSecondaryText: { fontSize: 13.5, letterSpacing: 0.3 },

  reminder: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 10, borderRadius: 10, borderWidth: 1,
  },
  reminderText: { flex: 1, fontSize: 12, lineHeight: 17 },

  refuseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 40, borderRadius: 10, borderWidth: 1, marginTop: 4,
  },
  refuseBtnText: { fontSize: 13, letterSpacing: 0.3 },
});
