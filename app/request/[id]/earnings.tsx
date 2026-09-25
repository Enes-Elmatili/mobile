// app/request/[id]/earnings.tsx — Fin de mission côté prestataire : le net en
// héros avec la date d'arrivée sur le compte, les trois lignes de l'argent
// (taux réel de la mission, jamais un « 20 % » écrit ici), trois faits du
// mois, la prochaine mission, la facture. Spec 2026-09-14-gains-releve.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MOTION, useReduceMotion } from '@/lib/motion';
import { DigitReel } from '@/components/ui/DigitReel';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { feedback } from '@/lib/feedback/feedback';
import { useInvoice } from '@/hooks/useInvoice';
import InvoiceSheet from '@/components/sheets/InvoiceSheet';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { formatDayShort, formatEURCents } from '@/lib/format';
import { briefOf, formatRating, netFor } from '@/lib/mission/brief';
import { DEFAULT_PAYOUT_DELAY_DAYS, estimateArrival } from '@/lib/gains/model';
import { Ledger } from '@/components/gains/Ledger';
import { PressScale } from '@/components/ui/PressScale';

export default function EarningsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduced = useReduceMotion();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [delayDays, setDelayDays] = useState(DEFAULT_PAYOUT_DELAY_DAYS);
  const [invoiceVisible, setInvoiceVisible] = useState(false);
  const { invoice } = useInvoice(id ? Number(id) : null);

  // Le retour physique Android ne doit pas renvoyer vers la mission terminée.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const check = useSharedValue(0);
  const rise = useSharedValue(0);
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.6 + 0.4 * check.value }], opacity: check.value }));
  const riseStyle = useAnimatedStyle(() => ({ opacity: rise.value, transform: [{ translateY: (1 - rise.value) * 24 }] }));

  const load = useCallback(async () => {
    try {
      const [r, w, b] = await Promise.allSettled([api.get(`/requests/${id}`), api.wallet.balance(), api.connect.balance()]);
      if (r.status === 'fulfilled') setRequest((r.value as any)?.data ?? r.value);
      if (w.status === 'fulfilled') setWallet(w.value);
      if (b.status === 'fulfilled' && (b.value as any)?.payoutSchedule?.delayDays != null) setDelayDays(Number((b.value as any).payoutSchedule.delayDays));
    } catch (e) {
      devError('[Earnings] load', e);
    } finally {
      setLoading(false);
      // La coche atterrit, puis le reste monte (règle 2 : ressorts, pas de durée).
      check.value = reduced ? 1 : withSpring(1, MOTION.land);
      rise.value = reduced ? 1 : withDelay(200, withSpring(1, MOTION.pane));
    }
  }, [id, check, rise, reduced]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={[s.center, { backgroundColor: theme.bg }]}><ActivityIndicator size="large" color={theme.accent as string} /></View>;
  if (!request) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <Text style={[s.err, { color: theme.textMuted }]}>{t('ext.earnings_cant_load')}</Text>
        <PressScale onPress={() => router.replace('/(tabs)/dashboard')} accessibilityRole="button" style={s.link}><Text style={[s.linkText, { color: theme.text }]}>{t('gains.earn_next')}</Text></PressScale>
      </View>
    );
  }

  const brief = briefOf(request);
  const grossEur = brief.money.gross ?? (Number(request.price) > 0 ? Number(request.price) : null);
  const netEur = netFor(brief);
  const gross = grossEur != null ? Math.round(grossEur * 100) : null;
  const net = netEur != null ? Math.round(netEur * 100) : 0;
  const rate = request.commissionRate != null ? Number(request.commissionRate) : (gross && net ? Math.round((1 - net / gross) * 100) / 100 : null);
  const commission = gross != null ? gross - net : null;
  const arrives = formatDayShort(estimateArrival(request.completedAt ?? Date.now(), delayDays), i18n.language).toUpperCase();
  const monthNet: number | null = wallet?.month?.net ?? null;
  const monthMissions: number | null = wallet?.month?.missions ?? null;
  const rating = formatRating(request.provider?.avgRating);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]} edges={['top']}>
      <StatusBar barStyle={theme.statusBar} />
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <Animated.View style={[s.check, { backgroundColor: theme.greenText }, checkStyle]}>
          <Feather name="check" size={30} color={theme.bg as string} />
        </Animated.View>
        <Text style={[s.kicker, { color: theme.textMuted }]} maxFontSizeMultiplier={1.2}>{t('gains.earn_kicker')}</Text>
        <View style={s.hero} accessible accessibilityLabel={`${formatEURCents(net)} ${t('gains.earn_net')}`}>
          <DigitReel value={Math.round(net / 100)} lineHeight={68} textStyle={{ fontFamily: FONTS.bebas, fontSize: 68, color: theme.text as string, letterSpacing: 1 }} />
          <Text style={[s.heroUnit, { color: theme.textSub }]}>€</Text>
        </View>
        <Text style={[s.heroLabel, { color: theme.textMuted }]} maxFontSizeMultiplier={1.2}>{t('gains.earn_net_arrives', { date: arrives })}</Text>

        <Animated.View style={riseStyle}>
          <View style={{ marginTop: 18 }}><Ledger gross={gross} commission={commission} rate={rate} net={net} /></View>

          <View style={s.facts}>
            {monthNet != null ? <View style={[s.fact, { backgroundColor: theme.surface }]}><Text style={[s.factValue, { color: theme.text }]}>{formatEURCents(monthNet, 0)}</Text><Text style={[s.factLabel, { color: theme.textMuted }]}>{t('gains.earn_month').toUpperCase()}</Text></View> : null}
            {monthMissions != null ? <View style={[s.fact, { backgroundColor: theme.surface }]}><Text style={[s.factValue, { color: theme.text }]}>{monthMissions}</Text><Text style={[s.factLabel, { color: theme.textMuted }]}>{t('gains.earn_missions').toUpperCase()}</Text></View> : null}
            {rating ? <View style={[s.fact, { backgroundColor: theme.surface }]}><Text style={[s.factValue, { color: theme.text }]}>{rating}</Text><Text style={[s.factLabel, { color: theme.textMuted }]}>{t('gains.earn_rating').toUpperCase()}</Text></View> : null}
          </View>

          <PressScale style={[s.cta, { backgroundColor: theme.accent }]} onPress={() => { feedback.haptic('light'); router.replace('/(tabs)/dashboard'); }} accessibilityRole="button" accessibilityLabel={t('gains.earn_next')}>
            <Text style={[s.ctaText, { color: theme.accentText }]}>{t('gains.earn_next').toUpperCase()}</Text>
          </PressScale>
          {invoice ? (
            <PressScale style={[s.ghost, { borderColor: theme.border }]} onPress={() => setInvoiceVisible(true)} accessibilityRole="button" accessibilityLabel={t('gains.view_invoice')}>
              <Feather name="file-text" size={15} color={theme.text as string} />
              <Text style={[s.ghostText, { color: theme.text }]}>{t('gains.view_invoice').toUpperCase()}</Text>
            </PressScale>
          ) : null}
          <PressScale style={s.link} onPress={() => router.push('/(tabs)/wallet')} accessibilityRole="button" accessibilityLabel={t('gains.title')}>
            <Text style={[s.linkText, { color: theme.textMuted }]}>{t('gains.title')}</Text>
          </PressScale>
        </Animated.View>
      </ScrollView>

      <InvoiceSheet invoice={invoice} isVisible={invoiceVisible} onClose={() => setInvoiceVisible(false)} userRole="provider" serviceTitle={request?.serviceType} missionDate={request?.completedAt || request?.createdAt} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  err: { fontFamily: FONTS.sans, fontSize: 14 },
  scroll: { paddingHorizontal: 20, paddingTop: 24, alignItems: 'stretch' },
  check: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  kicker: { fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.5, textAlign: 'center', marginTop: 18 },
  hero: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginTop: 8 },
  heroUnit: { fontFamily: FONTS.bebas, fontSize: 26, letterSpacing: 1, includeFontPadding: false },
  heroLabel: { fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.5, textAlign: 'center', marginTop: 8 },
  facts: { flexDirection: 'row', gap: 8, marginTop: 12 },
  fact: { flex: 1, padding: 10, borderRadius: 12 },
  factValue: { fontFamily: FONTS.bebas, fontSize: 20, includeFontPadding: false, fontVariant: ['tabular-nums'] },
  factLabel: { fontFamily: FONTS.sans, fontSize: 10, letterSpacing: 0.5, marginTop: 2 },
  cta: { marginTop: 18, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: FONTS.bebas, fontSize: 17, letterSpacing: 1.5, includeFontPadding: false },
  ghost: { marginTop: 10, height: 48, borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ghostText: { fontFamily: FONTS.bebas, fontSize: 16, letterSpacing: 1.5, includeFontPadding: false },
  link: { alignItems: 'center', paddingVertical: 12 },
  linkText: { fontFamily: FONTS.sansMedium, fontSize: 13 },
});
