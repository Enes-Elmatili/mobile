// app/request/[id]/scheduled.tsx — Confirmation ET récap d'une demande planifiée
//
// Deux modes via param ?mode=recap :
//   • confirmation (défaut, depuis NewRequestStepper post-paiement) :
//     animation success, CTA "Suivre la demande" → missionview
//   • recap (depuis dashboard "À venir" ou documents "Planifiées") :
//     pas d'animation, self-fetch depuis API, CTA "Annuler la demande"
//
// Socket listener actif dans les deux modes : quand un prestataire accepte
// la demande, transition automatique vers missionview.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  Animated, Easing, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api';
import { useSocket } from '@/lib/SocketContext';
import { devError } from '@/lib/logger';

// Format "Mer 8 à 19:00"
function formatScheduled(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const day = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${day} à ${time}`;
}

export default function ScheduledConfirmation() {
  const params = useLocalSearchParams<{
    id: string;
    mode?: string;
    serviceName?: string;
    address?: string;
    price?: string;
    scheduledLabel?: string;
    isQuote?: string;
    calloutFee?: string;
    lat?: string;
    lng?: string;
  }>();

  const id = params.id;
  const isRecapMode = params.mode === 'recap';
  const router = useRouter();
  const theme = useAppTheme();
  const { socket } = useSocket();

  // État local alimenté par params puis écrasé par l'API quand disponible
  const [serviceName, setServiceName] = useState<string>(params.serviceName || '');
  const [address, setAddress] = useState<string>(params.address || '');
  const [scheduledLabel, setScheduledLabel] = useState<string>(params.scheduledLabel || '');
  const [price, setPrice] = useState<string>(params.price || '');
  const [isQuoteFlow, setIsQuoteFlow] = useState<boolean>(params.isQuote === '1');
  const [calloutFee, setCalloutFee] = useState<string>(params.calloutFee || '');
  const [providerName, setProviderName] = useState<string>('');
  const [isAccepted, setIsAccepted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(isRecapMode);
  const [cancelling, setCancelling] = useState<boolean>(false);

  const scaleAnim = useRef(new Animated.Value(isRecapMode ? 1 : 0)).current;
  const fadeAnim = useRef(new Animated.Value(isRecapMode ? 1 : 0)).current;

  // ── Fetch depuis API si mode recap OU params incomplets ──
  const fetchRequest = useCallback(async () => {
    if (!id) return;
    try {
      const res: any = await api.get(`/requests/${id}`);
      const r = res?.data || res;
      if (!r) return;

      const srv = r.serviceType || r.subcategory?.name || r.category?.name || r.title || 'Service';
      setServiceName(srv);
      setAddress(r.address || '');
      setScheduledLabel(formatScheduled(r.preferredTimeStart));
      const quote = r.pricingMode === 'estimate' || r.pricingMode === 'diagnostic';
      setIsQuoteFlow(quote);
      if (quote) {
        if (r.calloutFee && r.calloutFee > 0) {
          setCalloutFee((r.calloutFee / 100).toFixed(2));
        }
        setPrice('');
      } else {
        setPrice(r.price && r.price > 0 ? String(r.price) : '');
      }

      const status = (r.status || '').toUpperCase();
      const isStillFuture = r.preferredTimeStart && new Date(r.preferredTimeStart).getTime() > Date.now();

      // ACCEPTED pour une date future = prestataire engagé mais mission pas démarrée
      // → reste sur le récap, affiche juste "Confirmé par X" en badge.
      if (status === 'ACCEPTED' && isStillFuture) {
        setIsAccepted(true);
        setProviderName(r.provider?.name || '');
      } else if (status === 'ONGOING' || (status === 'ACCEPTED' && !isStillFuture)) {
        // Mission vraiment en cours (ONGOING) OU ACCEPTED dont l'heure est passée
        // → basculer vers le flow actif missionview.
        router.replace({ pathname: '/request/[id]/missionview', params: { id } });
        return;
      }
    } catch (e) {
      devError('[scheduled] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    // Mode confirmation : animations + déjà des params → fetch quand même en background
    // pour être sûr que les données correspondent à la DB (utile pour le re-focus plus tard)
    // Mode recap : obligatoire de fetch car pas de params
    fetchRequest();
  }, [fetchRequest]);

  // ── Animation d'entrée (mode confirmation uniquement) ──
  useEffect(() => {
    if (isRecapMode) return; // skip animation en recap
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [isRecapMode]);

  // ── Socket listener : quand un prestataire accepte ──
  // Si la mission est planifiée pour plus tard → refetch pour afficher
  // "Confirmé par X", mais rester sur le récap.
  // Si la mission est pour maintenant/passé → basculer vers missionview.
  useEffect(() => {
    if (!socket || !id) return;
    const handleAccepted = (data: any) => {
      const incomingId = String(data?.id ?? data?.requestId ?? '');
      if (incomingId !== String(id)) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Refetch — la logique dans fetchRequest décide si on reste sur le récap
      // (mission future) ou si on bascule vers missionview (mission en cours/passée).
      fetchRequest();
    };
    socket.on('request:accepted', handleAccepted);
    return () => {
      socket.off('request:accepted', handleAccepted);
    };
  }, [socket, id, fetchRequest]);

  // ── Action : annuler la demande ──
  const handleCancel = () => {
    Alert.alert(
      'Annuler la demande',
      isQuoteFlow
        ? 'Votre demande de devis sera annulée et les frais de déplacement vous seront remboursés sous 3-5 jours ouvrés.'
        : 'Votre demande sera annulée et le montant intégralement remboursé sous 3-5 jours ouvrés.',
      [
        { text: 'Non, garder', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await api.post(`/requests/${id}/cancel`);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
              router.replace('/(tabs)/dashboard');
            } catch (e: any) {
              const msg = e?.response?.data?.message || e?.message || 'Impossible d\'annuler la demande';
              Alert.alert('Erreur', msg);
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  if (loading && isRecapMode) {
    return (
      <SafeAreaView style={[st.root, st.center, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[st.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      <View style={st.center}>
        {/* Calendar icon (animated in confirmation mode, static in recap) */}
        <Animated.View style={[st.iconWrap, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[st.iconCircle, { backgroundColor: theme.surface }]}>
            <Ionicons name="calendar-outline" size={48} color={theme.text} />
          </View>
        </Animated.View>

        <Animated.View style={[st.content, { opacity: fadeAnim }]}>
          <Text style={[st.title, { color: theme.text, fontFamily: FONTS.bebas }]}>
            {isRecapMode ? 'Ma demande planifiée' : 'Demande planifiée'}
          </Text>
          <Text style={[st.subtitle, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            {isRecapMode
              ? (isQuoteFlow
                  ? 'Un prestataire qualifié vous enverra un devis. Vous recevrez une notification dès qu\'il accepte.'
                  : 'Les prestataires qualifiés peuvent consulter et accepter votre demande. Vous serez notifié dès qu\'un prestataire accepte.')
              : (isQuoteFlow
                  ? 'Votre demande de devis a bien été enregistrée. Un prestataire qualifié vous enverra un devis.'
                  : 'Votre demande a bien été enregistrée. Les prestataires qualifiés pourront la consulter et l\'accepter.')}
          </Text>

          {/* Recap card */}
          <View style={[st.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={st.row}>
              <Ionicons name="construct-outline" size={16} color={theme.textSub} />
              <Text style={[st.rowText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{serviceName}</Text>
            </View>
            <View style={[st.sep, { backgroundColor: theme.border }]} />
            <View style={st.row}>
              <Ionicons name="calendar-outline" size={16} color={theme.textSub} />
              <Text style={[st.rowText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{scheduledLabel}</Text>
            </View>
            <View style={[st.sep, { backgroundColor: theme.border }]} />
            <View style={st.row}>
              <Ionicons name="location-outline" size={16} color={theme.textSub} />
              <Text style={[st.rowText, { color: theme.text, fontFamily: FONTS.sans }]} numberOfLines={1}>{address}</Text>
            </View>
            {isQuoteFlow ? (
              <>
                <View style={[st.sep, { backgroundColor: theme.border }]} />
                <View style={st.row}>
                  <Ionicons name="document-text-outline" size={16} color={theme.textSub} />
                  <Text style={[st.rowText, { color: theme.text, fontFamily: FONTS.sans }]}>
                    {calloutFee ? `Frais de déplacement payés : ${calloutFee} €` : 'Prix à définir dans le devis'}
                  </Text>
                </View>
              </>
            ) : price ? (
              <>
                <View style={[st.sep, { backgroundColor: theme.border }]} />
                <View style={st.row}>
                  <Ionicons name="card-outline" size={16} color={theme.textSub} />
                  <Text style={[st.rowText, { color: theme.text, fontFamily: FONTS.monoMedium }]}>{price} €</Text>
                </View>
              </>
            ) : null}
          </View>

          {isAccepted ? (
            <View style={[st.infoBadge, { backgroundColor: 'rgba(61,139,61,0.08)', borderWidth: 1, borderColor: 'rgba(61,139,61,0.2)' }]}>
              <Ionicons name="checkmark-circle" size={16} color="#3D8B3D" />
              <Text style={[st.infoText, { color: '#3D8B3D', fontFamily: FONTS.sansMedium }]}>
                {providerName
                  ? `Confirmé par ${providerName}. Il interviendra à la date prévue.`
                  : 'Confirmé par un prestataire. Il interviendra à la date prévue.'}
              </Text>
            </View>
          ) : (
            <View style={[st.infoBadge, { backgroundColor: theme.surface }]}>
              <Ionicons name="information-circle-outline" size={16} color={theme.textSub} />
              <Text style={[st.infoText, { color: theme.textSub, fontFamily: FONTS.sans }]}>
                {isRecapMode
                  ? 'Vous serez notifié dès qu\'un prestataire accepte. La mission démarre à la date prévue.'
                  : 'Vous recevrez une notification dès qu\'un prestataire accepte votre demande.'}
              </Text>
            </View>
          )}
        </Animated.View>
      </View>

      {/* Bottom CTAs */}
      <View style={st.bottom}>
        <TouchableOpacity
          style={[st.btn, { backgroundColor: theme.accent }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.replace('/(tabs)/dashboard');
          }}
          activeOpacity={0.85}
        >
          <Text style={[st.btnText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>Retour à l'accueil</Text>
        </TouchableOpacity>

        {isRecapMode ? (
          <TouchableOpacity
            style={[st.btnSecondary, { borderColor: COLORS.red }]}
            onPress={handleCancel}
            disabled={cancelling}
            activeOpacity={0.85}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color={COLORS.red} />
            ) : (
              <Text style={[st.btnSecondaryText, { color: COLORS.red, fontFamily: FONTS.sansMedium }]}>
                Annuler la demande
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[st.btnSecondary, { borderColor: theme.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // En mode confirmation, "Suivre la demande" route vers ce même écran
              // en mode recap (cohérence — le client reste dans le flux planifié
              // jusqu'à ce qu'un prestataire accepte, moment où le socket bascule
              // automatiquement vers missionview).
              router.replace({
                pathname: '/request/[id]/scheduled',
                params: { id, mode: 'recap' },
              });
            }}
            activeOpacity={0.85}
          >
            <Text style={[st.btnSecondaryText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>Suivre la demande</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },

  iconWrap:   { marginBottom: 24 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },

  content:  { alignItems: 'center', width: '100%' },
  title:    { fontSize: 28, marginBottom: 8, letterSpacing: -0.3 },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28 },

  card:     { width: '100%', borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  rowText:  { fontSize: 15, flex: 1 },
  sep:      { height: 1, marginVertical: 8 },

  infoBadge:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 14, borderRadius: 12, width: '100%' },
  infoText:   { fontSize: 13, lineHeight: 18, flex: 1 },

  bottom:          { paddingHorizontal: 24, paddingBottom: 36, gap: 10 },
  btn:             { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnText:         { fontSize: 16 },
  btnSecondary:    { borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5 },
  btnSecondaryText:{ fontSize: 15 },
});
