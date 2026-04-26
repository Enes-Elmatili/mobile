// app/request/[id]/early.tsx
// Écran "trop tôt" — provider qui ouvre une mission planifiée hors fenêtre.
// L'écran ongoing.tsx ne devrait pas afficher la mission tant qu'on n'est pas
// dans la fenêtre d'activation (~30 min avant RDV). On redirige ici à la place,
// avec un compte à rebours pro et les actions disponibles avant le démarrage.

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity, ScrollView, Linking, Alert, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { formatEUR } from '@/lib/format';

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
    return new Date(mission.preferredTimeStart).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }, [mission?.preferredTimeStart]);

  const formattedTime = useMemo(() => {
    if (!mission?.preferredTimeStart) return '';
    return new Date(mission.preferredTimeStart).toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit',
    });
  }, [mission?.preferredTimeStart]);

  const handleNavigate = useCallback(() => {
    if (!mission?.lat || !mission?.lng) {
      Alert.alert('Adresse indisponible', 'Coordonnées GPS manquantes pour cette mission.');
      return;
    }
    const label = encodeURIComponent(mission.address || 'Mission FIXED');
    const url = `https://www.google.com/maps/dir/?api=1&destination=${mission.lat},${mission.lng}&destination_place_id=${label}`;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(url).catch(() => Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application de navigation.'));
  }, [mission]);

  const handleCallClient = useCallback(() => {
    const phone = mission?.client?.phone;
    if (!phone) {
      Alert.alert('Numéro indisponible', 'Le client n\'a pas partagé son numéro.');
      return;
    }
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() => {});
  }, [mission?.client?.phone]);

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
          Mission introuvable
        </Text>
        <TouchableOpacity
          style={[s.errorBtn, { backgroundColor: theme.text }]}
          onPress={() => router.replace('/(tabs)/missions')}
          activeOpacity={0.85}
        >
          <Text style={[s.errorBtnText, { color: theme.bg, fontFamily: FONTS.sansMedium }]}>Retour</Text>
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
          style={[s.backBtn, { backgroundColor: theme.surface }]}
          onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/missions'); }}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="chevron-left" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={[s.kicker, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>MISSION CONFIRMÉE</Text>
          <Text style={[s.title, { color: theme.text, fontFamily: FONTS.bebas }]}>À venir</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero countdown */}
        <View style={[s.heroCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={[s.iconCircle, { backgroundColor: theme.surface }]}>
            <Feather name="clock" size={28} color={theme.text} />
          </View>

          <Text style={[s.heroLabel, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>DÉMARRAGE PROGRAMMÉ</Text>

          {countdown ? (
            <View style={s.countdownRow}>
              {countdown.days > 0 && (
                <CountdownBlock value={countdown.days} unit={countdown.days > 1 ? 'JOURS' : 'JOUR'} theme={theme} />
              )}
              {(countdown.days > 0 || countdown.hours > 0) && (
                <CountdownBlock value={countdown.hours} unit={countdown.hours > 1 ? 'HEURES' : 'HEURE'} theme={theme} />
              )}
              <CountdownBlock value={countdown.mins} unit="MIN" theme={theme} />
            </View>
          ) : (
            <Text style={[s.heroDate, { color: theme.text, fontFamily: FONTS.bebas }]}>BIENTÔT</Text>
          )}

          <Text style={[s.heroDate, { color: theme.text, fontFamily: FONTS.sansMedium, fontSize: 15, marginTop: 6 }]}>
            {formattedDate}
          </Text>
          <Text style={[s.heroTime, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            à {formattedTime}
          </Text>

          <View style={[s.activationHint, { backgroundColor: theme.surface }]}>
            <Feather name="info" size={12} color={theme.textSub} />
            <Text style={[s.activationHintText, { color: theme.textSub, fontFamily: FONTS.sans }]}>
              Démarrage possible {ACTIVATION_WINDOW_MIN} min avant l'heure
            </Text>
          </View>
        </View>

        {/* Mission summary */}
        <View style={[s.section, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <Text style={[s.sectionLabel, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>
            DÉTAILS
          </Text>
          <View style={s.row}>
            <Feather name="tool" size={16} color={theme.textMuted} />
            <Text style={[s.rowText, { color: theme.text, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>
              {mission.serviceType || mission.category?.name || 'Mission'}
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
              {mission.address || 'Adresse à confirmer'}
            </Text>
          </View>
          {mission.client?.name && (
            <>
              <View style={[s.divider, { backgroundColor: theme.borderLight }]} />
              <View style={s.row}>
                <Feather name="user" size={16} color={theme.textMuted} />
                <Text style={[s.rowText, { color: theme.text, fontFamily: FONTS.sans }]}>
                  {mission.client.name}
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
                    mission.client?.buildingType === 'apartment' ? 'Appartement' : mission.client?.buildingType === 'house' ? 'Maison' : mission.client?.buildingType,
                    mission.client?.floor != null ? `Étage ${mission.client.floor}` : null,
                    mission.client?.hasElevator != null ? (mission.client.hasElevator ? 'Ascenseur' : 'Sans ascenseur') : null,
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
              DESCRIPTION DU CLIENT
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
              Itinéraire
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
              Appeler
            </Text>
          </TouchableOpacity>
        </View>

        {/* Reminder */}
        <View style={[s.reminder, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
          <Feather name="bell" size={14} color={theme.textSub} />
          <Text style={[s.reminderText, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            Vous serez notifié 30 minutes avant le démarrage. Cet écran s'ouvrira automatiquement à temps.
          </Text>
        </View>

        {/* Cancel */}
        <TouchableOpacity
          style={[s.refuseBtn, { borderColor: theme.borderLight }]}
          onPress={() => {
            Alert.alert(
              'Refuser cette mission ?',
              'Le client sera notifié et la mission sera renvoyée à d\'autres prestataires.',
              [
                { text: 'Garder la mission', style: 'cancel' },
                {
                  text: 'Refuser', style: 'destructive',
                  onPress: async () => {
                    try {
                      await api.post(`/requests/${mission.id}/refuse`);
                      router.replace('/(tabs)/missions');
                    } catch (e: any) {
                      Alert.alert('Erreur', e?.message || 'Impossible de refuser cette mission.');
                    }
                  },
                },
              ],
            );
          }}
          activeOpacity={0.7}
        >
          <Feather name="x" size={14} color={COLORS.red} />
          <Text style={[s.refuseBtnText, { color: COLORS.red, fontFamily: FONTS.sansMedium }]}>
            Refuser cette mission
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
    width: 38, height: 38, borderRadius: 12,
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
