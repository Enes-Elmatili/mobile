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

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, StatusBar, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme, FONTS, COLORS, alpha } from '@/hooks/use-app-theme';
import { ProviderRow } from '@/components/tracking';
import { PhotoGallery } from '@/components/mission/photos';
import { briefOf } from '@/lib/mission/brief';
import { useCallParty } from '@/lib/webrtc/CallContext';
import { feedback } from '@/lib/feedback/feedback';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import type { ServiceRequest } from '@/lib/types';
import { useSocket } from '@/lib/SocketContext';
import { devError } from '@/lib/logger';
import { cleanName } from '@/lib/displayName';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';
import { PressScale } from '@/components/ui/PressScale';
import { BookSpread, useSplitPane } from '@/lib/layout';

// Format "Mer 8 à 19:00"
function formatScheduled(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${day} ${time}`;
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
  const callParty = useCallParty();
  const { t } = useTranslation();

  // État local alimenté par params puis écrasé par l'API quand disponible
  const [serviceName, setServiceName] = useState<string>(params.serviceName || '');
  const [address, setAddress] = useState<string>(params.address || '');
  const [scheduledLabel, setScheduledLabel] = useState<string>(params.scheduledLabel || '');
  const [price, setPrice] = useState<string>(params.price || '');
  const [isQuoteFlow, setIsQuoteFlow] = useState<boolean>(params.isQuote === '1');
  const [calloutFee, setCalloutFee] = useState<string>(params.calloutFee || '');
  const [providerName, setProviderName] = useState<string>('');
  // La demande complète : bloc prestataire (message, appel) et photos du récap.
  const [requestData, setRequestData] = useState<ServiceRequest | null>(null);
  const [isAccepted, setIsAccepted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(isRecapMode);
  const [cancelling, setCancelling] = useState<boolean>(false);

  // Confirmation : l'icône prend (léger dépassement), puis le contenu apparaît.
  const iconScale = useSharedValue(isRecapMode ? 1 : 0);
  const reduced = useReduceMotion();
  const contentFade = useSharedValue(isRecapMode ? 1 : 0);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentFade.value }));
  // Duo déplié : la page droite suit le même fondu (style distinct par vue).
  const contentStyleRight = useAnimatedStyle(() => ({ opacity: contentFade.value }));
  const isSplit = useSplitPane();

  // ── Fetch depuis API si mode recap OU params incomplets ──
  const fetchRequest = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.requests.get(String(id));
      const r = res?.data || res;
      if (!r) return;

      const srv = r.serviceType || r.subcategory?.name || r.category?.name || r.title || t('common.service');
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

      // ── Routage par statut ──
      // Paiement jamais finalisé (PaymentSheet abandonnée) → reprise du paiement.
      // Sans ce garde, le récap affirme que la demande est visible des prestataires
      // alors qu'elle ne sera publiée qu'au webhook Stripe.
      if (status === 'PENDING_PAYMENT') {
        router.replace({ pathname: '/request/[id]/resume-payment', params: { id } });
        return;
      }
      // Un prestataire a envoyé un devis → écran de revue de devis.
      if (status === 'QUOTE_SENT') {
        router.replace({ pathname: '/request/[id]/quote-review', params: { id } });
        return;
      }
      // Statuts terminaux (annulé / expiré / refusé / remboursé / terminé) → dashboard
      // avec un toast : ne pas laisser le récap "en attente" avec un bouton Annuler actif.
      if (['CANCELLED', 'QUOTE_EXPIRED', 'QUOTE_REFUSED', 'EXPIRED', 'REFUNDED', 'DONE', 'COMPLETED'].includes(status)) {
        feedback.info(status === 'CANCELLED'
          ? t('ext.request_cancelled_toast')
          : t('ext.request_inactive_toast'));
        router.replace('/(tabs)/dashboard');
        return;
      }

      // ACCEPTED pour une date future = prestataire engagé mais mission pas démarrée
      // → reste sur le récap, affiche juste "Confirmé par X" en badge.
      if (status === 'ACCEPTED' && isStillFuture) {
        setIsAccepted(true);
        setProviderName(cleanName(r.provider?.name, { fallback: '' }));
        setRequestData(r);
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
  }, [id, router, t]);

  useEffect(() => {
    // Mode confirmation : animations + déjà des params → fetch quand même en background
    // pour être sûr que les données correspondent à la DB (utile pour le re-focus plus tard)
    // Mode recap : obligatoire de fetch car pas de params
    fetchRequest();
  }, [fetchRequest]);

  // ── Animation d'entrée (mode confirmation uniquement) ──
  useEffect(() => {
    if (isRecapMode) return; // skip animation en recap
    feedback.haptic('success');
    // L'icône « prend » (MOTION.take, léger dépassement) ; sous réduction, l'état final posé.
    if (reduced) { iconScale.set(1); contentFade.set(withTiming(1, { duration: 150 })); return; }
    iconScale.set(withSpring(1, MOTION.take));
    contentFade.set(withDelay(400, withTiming(1, { duration: 300 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- séquence jouée à l'arrivée
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
      feedback.haptic('success');
      // Refetch — la logique dans fetchRequest décide si on reste sur le récap
      // (mission future) ou si on bascule vers missionview (mission en cours/passée).
      fetchRequest();
    };
    // Annulation temps réel (par le prestataire, un admin, ou expiration) : on ne
    // reste pas sur un récap périmé avec un bouton Annuler encore actif.
    const handleCancelled = (data: any) => {
      const incomingId = String(data?.id ?? data?.requestId ?? '');
      if (incomingId !== String(id)) return;
      feedback.info(t('ext.request_cancelled_toast'));
      router.replace('/(tabs)/dashboard');
    };
    socket.on('request:accepted', handleAccepted);
    socket.on('request:cancelled', handleCancelled);
    return () => {
      socket.off('request:accepted', handleAccepted);
      socket.off('request:cancelled', handleCancelled);
    };
  }, [socket, id, fetchRequest, router, t]);

  // ── Action : annuler la demande ──
  const handleCancel = async () => {
    const ok = await feedback.confirm({
      titleKey: 'missions.cancel',
      messageKey: isQuoteFlow ? 'ext.scheduled_cancel_quote' : 'ext.scheduled_cancel_msg',
      confirmKey: 'missions.yes_cancel',
      cancelKey: 'common.no',
      destructive: true,
    });
    if (!ok) return;
    setCancelling(true);
    try {
      await api.post(`/requests/${id}/cancel`);
      feedback.haptic('warning');
      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || t('mission_view.cancel_mission_failed');
      feedback.error(msg);
      setCancelling(false);
    }
  };

  if (loading && isRecapMode) {
    return (
      <SafeAreaView style={[st.root, st.center, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );
  }

  // Le prestataire engagé, s'il est connu (lu une fois pour les rappels ci-dessous).
  const engaged = requestData?.provider;

  // ── Les blocs du récap, assemblés selon la disposition ──
  const iconBlock = (
        <Animated.View style={[st.iconWrap, iconStyle]}>
          <View style={[st.iconCircle, { backgroundColor: theme.surface }]}>
            <Feather name="calendar" size={48} color={theme.text} />
          </View>
        </Animated.View>
  );

  const summaryBlock = (
    <>
          <Text style={[st.title, { color: theme.text, fontFamily: FONTS.bebas, includeFontPadding: false }]}>
            {isRecapMode ? t('ext.scheduled_my_request') : t('ext.scheduled_request')}
          </Text>
          <Text style={[st.subtitle, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            {isRecapMode
              ? (isQuoteFlow
                  ? t('ext.scheduled_recap_quote')
                  : t('ext.scheduled_recap_fixed'))
              : (isQuoteFlow
                  ? t('ext.scheduled_confirm_quote')
                  : t('ext.scheduled_confirm_fixed'))}
          </Text>

          {/* Recap card */}
          <View style={[st.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={st.row}>
              <Feather name="tool" size={16} color={theme.textSub} />
              <Text style={[st.rowText, { color: theme.text, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>{serviceName}</Text>
            </View>
            <View style={[st.sep, { backgroundColor: theme.border }]} />
            <View style={st.row}>
              <Feather name="calendar" size={16} color={theme.textSub} />
              <Text style={[st.rowText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{scheduledLabel}</Text>
            </View>
            <View style={[st.sep, { backgroundColor: theme.border }]} />
            <View style={st.row}>
              <Feather name="map-pin" size={16} color={theme.textSub} />
              <Text style={[st.rowText, { color: theme.text, fontFamily: FONTS.sans }]} numberOfLines={1}>{address}</Text>
            </View>
            {isQuoteFlow ? (
              <>
                <View style={[st.sep, { backgroundColor: theme.border }]} />
                <View style={st.row}>
                  <Feather name="file-text" size={16} color={theme.textSub} />
                  <Text style={[st.rowText, { color: theme.text, fontFamily: FONTS.sans }]}>
                    {calloutFee ? t('ext.scheduled_fees_paid', { fee: calloutFee }) : t('ext.scheduled_price_tbd')}
                  </Text>
                </View>
              </>
            ) : price ? (
              <>
                <View style={[st.sep, { backgroundColor: theme.border }]} />
                <View style={st.row}>
                  <Feather name="credit-card" size={16} color={theme.textSub} />
                  <Text style={[st.rowText, { color: theme.text, fontFamily: FONTS.bebas, includeFontPadding: false }]}>{price} €</Text>
                </View>
              </>
            ) : null}
          </View>
    </>
  );

  const statusBlock = (
    <>
          {isAccepted ? (
            <>
              <View style={[st.infoBadge, { backgroundColor: alpha(COLORS.greenBrand, 0.08), borderWidth: 1, borderColor: alpha(COLORS.greenBrand, 0.2) }]}>
                <Feather name="check-circle" size={16} color={theme.greenText} />
                <Text style={[st.infoText, { color: theme.greenText, fontFamily: FONTS.sansMedium }]}>
                  {providerName
                    ? t('ext.scheduled_confirmed_by', { name: providerName })
                    : t('ext.scheduled_confirmed_by_generic')}
                </Text>
              </View>
              {/* Le prestataire engagé : on peut lui écrire ou l'appeler avant le jour J. */}
              {engaged ? (
                <View style={st.providerWrap}>
                  <ProviderRow
                    provider={engaged}
                    onOpenProfile={() => router.push(`/providers/${engaged.id}`)}
                    onMessage={() => router.push({ pathname: '/messages/[userId]', params: { userId: String(engaged.userId || engaged.id), name: providerName, requestId: String(id) } })}
                    onCall={() => callParty({ userId: engaged.userId, name: providerName, requestId: id })}
                  />
                </View>
              ) : null}
              {requestData?.photos?.length ? (
                // La galerie va jusqu'aux bords : elle annule le retrait de sa page.
                <View style={[st.galleryBleed, isSplit && st.galleryBleedPage]}>
                  <PhotoGallery photos={briefOf(requestData).photos} title={t('mission.your_photos')} />
                </View>
              ) : null}
            </>
          ) : (
            <View style={[st.infoBadge, { backgroundColor: theme.surface }]}>
              <Feather name="info" size={16} color={theme.textSub} />
              <Text style={[st.infoText, { color: theme.textSub, fontFamily: FONTS.sans }]}>
                {isRecapMode
                  ? t('ext.scheduled_waiting_quote')
                  : t('ext.scheduled_waiting')}
              </Text>
            </View>
          )}
    </>
  );

  const ctaBlock = (
      <View style={[st.bottom, isSplit && st.bottomPage]}>
        <PressScale accessibilityRole="button"
          style={[st.btn, { backgroundColor: theme.accent }]}
          onPress={() => {
            feedback.haptic('light');
            router.replace('/(tabs)/dashboard');
          }}
        >
          <Text style={[st.btnText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>{t('ext.scheduled_back_home')}</Text>
          <Feather name="arrow-right" size={18} color={theme.accentText} />
        </PressScale>

        {isRecapMode ? (
          <PressScale accessibilityRole="button"
            style={[st.btnSecondary, { borderColor: COLORS.red }]}
            onPress={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color={COLORS.red} />
            ) : (
              <Text style={[st.btnSecondaryText, { color: COLORS.red, fontFamily: FONTS.sansMedium }]}>
                {t('missions.cancel')}
              </Text>
            )}
          </PressScale>
        ) : (
          <PressScale accessibilityRole="button"
            style={[st.btnSecondary, { borderColor: theme.border }]}
            onPress={() => {
              feedback.haptic('light');
              // En mode confirmation, "Suivre la demande" route vers ce même écran
              // en mode recap (cohérence — le client reste dans le flux planifié
              // jusqu'à ce qu'un prestataire accepte, moment où le socket bascule
              // automatiquement vers missionview).
              router.replace({
                pathname: '/request/[id]/scheduled',
                params: { id, mode: 'recap' },
              });
            }}
          >
            <Text style={[st.btnSecondaryText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{t('dashboard.track_request')}</Text>
          </PressScale>
        )}
      </View>
  );

  // Duo déplié : page gauche = la demande (icône, titre, récap) ; page droite =
  // le prestataire, les photos, et les CTA épinglés en bas de la page.
  if (isSplit) {
    return (
      <SafeAreaView style={[st.root, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <BookSpread
          left={
            <ScrollView contentContainerStyle={[st.body, st.page]} showsVerticalScrollIndicator={false}>
              {iconBlock}
              <Animated.View style={[st.content, contentStyle]}>{summaryBlock}</Animated.View>
            </ScrollView>
          }
          right={
            <View style={st.root}>
              <ScrollView contentContainerStyle={[st.body, st.page]} showsVerticalScrollIndicator={false}>
                <Animated.View style={[st.content, contentStyleRight]}>{statusBlock}</Animated.View>
              </ScrollView>
              {ctaBlock}
            </View>
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[st.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Le récap défile s'il dépasse (prestataire + photos) : sinon il passait
          sous les CTA. Centré tant qu'il tient, comme avant. */}
      <ScrollView style={st.root} contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
        {/* Calendar icon (animated in confirmation mode, static in recap) */}
        {iconBlock}

        <Animated.View style={[st.content, contentStyle]}>
          {summaryBlock}
          {statusBlock}
        </Animated.View>
      </ScrollView>

      {/* Bottom CTAs */}
      {ctaBlock}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  // Corps défilant : centré tant qu'il tient (flexGrow), défile au-delà.
  body:   { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  // Page du Duo : 20 pt de chaque côté, sous la barre système + 12.
  page:   { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },

  iconWrap:   { marginBottom: 16 },
  iconCircle: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },

  content:  { alignItems: 'center', width: '100%' },
  title:    { fontSize: 24, marginBottom: 6, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 18 },

  card:     { width: '100%', borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 10 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  rowText:  { fontSize: 14, flex: 1 },
  sep:      { height: 1, marginVertical: 6 },

  infoBadge:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 10, width: '100%' },
  infoText:   { fontSize: 12, lineHeight: 17, flex: 1 },
  providerWrap: { marginTop: 12 },
  galleryBleed: { marginTop: 8, marginHorizontal: -16 },
  galleryBleedPage: { marginHorizontal: -20 },

  bottom:          { paddingHorizontal: 16, paddingBottom: 18, gap: 8 },
  bottomPage:      { paddingHorizontal: 20 },
  btn:             { borderRadius: 100, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText:         { fontSize: 15 },
  btnSecondary:    { borderRadius: 12, paddingVertical: 11, alignItems: 'center', borderWidth: 1.5 },
  btnSecondaryText:{ fontSize: 14 },
});
