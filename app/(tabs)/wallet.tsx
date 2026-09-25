// app/(tabs)/wallet.tsx — Onglet Gains (prestataire), « le relevé » (planche B,
// spec 2026-09-14-gains-releve). La banque d'abord : ce qui arrive sur le
// compte et quand, ce qui est arrivé ; puis les missions par mois, une ligne
// chacune, le mois courant ouvert, les autres repliés. Chaque chiffre est un
// fait Stripe : le portefeuille est une projection des virements faits à la
// complétion, Stripe dépose sur le compte (quotidien, J+délai).
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { useTabBarPadding } from './_layout';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { feedback } from '@/lib/feedback/feedback';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { BrandRefreshHeader, useBrandRefresh } from '@/components/ui/BrandRefresh';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { usePressScale } from '@/lib/motion/press';
import { formatDay, formatEURCents, formatMonth } from '@/lib/format';
import { DEFAULT_PAYOUT_DELAY_DAYS, groupByMonth, inTransit, toLine, type GainLine, type MonthGroup, type Payout, type WalletTx } from '@/lib/gains/model';
import { GainRow } from '@/components/gains/GainRow';
import { MoneySheet } from '@/components/gains/MoneySheet';
import { PressScale } from '@/components/ui/PressScale';

type Segment = 'missions' | 'payouts';
type ConnectBalance = { needsOnboarding?: boolean; payoutsEnabled?: boolean; available?: number; pending?: number; lastPayout?: Payout | null; payouts?: Payout[]; payoutSchedule?: { interval: string; delayDays: number } | null; bank?: { last4: string; bankName?: string | null } | null };

// ─── Cartes banque ───────────────────────────────────────────────────────────
function BankCard({ icon, title, sub, onPress, accent }: { icon: React.ComponentProps<typeof Feather>['name']; title: string; sub?: string | null; onPress?: () => void; accent?: boolean }) {
  const theme = useAppTheme();
  const press = usePressScale(0.98);
  const body = (
    <Animated.View style={[s.bank, { borderColor: accent ? theme.accent : theme.border, backgroundColor: accent ? theme.surface : 'transparent' }, onPress ? press.style : null]}>
      <Feather name={icon} size={16} color={theme.textSub as string} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.bankTitle, { color: theme.text }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>{title}</Text>
        {sub ? <Text style={[s.bankSub, { color: theme.textSub }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>{sub}</Text> : null}
      </View>
      {onPress ? <Feather name="chevron-right" size={16} color={theme.textMuted as string} /> : null}
    </Animated.View>
  );
  if (!onPress) return body;
  return <Pressable onPress={() => { feedback.haptic('light'); onPress(); }} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={title}>{body}</Pressable>;
}

function MonthHeader({ group, open, onToggle, lang }: { group: MonthGroup; open: boolean; onToggle: () => void; lang: string }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <PressScale onPress={() => { feedback.haptic('selection'); onToggle(); }} style={s.month} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${formatMonth(group.year, group.month, lang)}, ${formatEURCents(group.net, 0)}`}>
      <Text style={[s.monthLabel, { color: theme.textMuted }]} maxFontSizeMultiplier={1.2}>{`${formatMonth(group.year, group.month, lang)} · ${t('gains.month_missions', { count: group.missions })}`.toUpperCase()}</Text>
      <View style={s.monthRight}>
        <Text style={[s.monthNet, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{formatEURCents(group.net, 0)}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textMuted as string} />
      </View>
    </PressScale>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function WalletTab() {
  const theme = useAppTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarPadding = useTabBarPadding();
  const brandRefresh = useBrandRefresh();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [txs, setTxs] = useState<WalletTx[]>([]);
  const [connect, setConnect] = useState<ConnectBalance | null>(null);
  const [stripeReady, setStripeReady] = useState<boolean | null>(null);
  const [segment, setSegment] = useState<Segment>('missions');
  const [openMonths, setOpenMonths] = useState<Set<string> | null>(null);
  const [selected, setSelected] = useState<GainLine | null>(null);
  const [stripeBusy, setStripeBusy] = useState(false);
  const now = Date.now();

  const load = useCallback(async () => {
    const [tx, status, bal] = await Promise.allSettled([api.wallet.transactions(100), api.connect.status(), api.connect.balance()]);
    if (tx.status === 'fulfilled') {
      const raw = tx.value as any;
      setTxs(Array.isArray(raw) ? raw : (raw?.transactions ?? raw?.data ?? []));
      setError(false);
    } else {
      devError('[Gains] txs', tx.reason);
      setError(true);
    }
    if (status.status === 'fulfilled') setStripeReady(!!(status.value as any)?.isStripeReady);
    if (bal.status === 'fulfilled') setConnect(bal.value as ConnectBalance);
    setLoading(false);
    setRefreshing(false);
  }, []);

  const lastFetch = useRef(0);
  useFocusEffect(useCallback(() => {
    if (Date.now() - lastFetch.current > 60_000) { lastFetch.current = Date.now(); load(); }
  }, [load]));
  const onRefresh = () => { lastFetch.current = 0; setRefreshing(true); load(); };

  // ─── Stripe Express : tableau de bord, ou reprise de l'onboarding ────────
  const openStripe = useCallback(async () => {
    setStripeBusy(true);
    const onboard = async () => {
      const Linking = await import('expo-linking');
      const onb: any = await api.connect.onboarding(Linking.createURL('connect/success'), Linking.createURL('connect/reauth'));
      if (onb?.url) await WebBrowser.openBrowserAsync(onb.url);
      else feedback.error('ext.wallet_stripe_setup_failed');
    };
    try {
      const res: any = await api.connect.dashboard();
      if (res?.url && !res?.needsOnboarding) await WebBrowser.openBrowserAsync(res.url);
      else if (res?.url) await WebBrowser.openBrowserAsync(res.url);
      else await onboard();
    } catch (e: any) {
      const body = e?.data ?? e;
      if (body?.needsOnboarding || body?.code === 'STRIPE_MODE_MISMATCH' || body?.code === 'NO_STRIPE_ACCOUNT') {
        try { await onboard(); } catch { feedback.error('ext.wallet_stripe_error'); }
      } else {
        feedback.error('ext.wallet_stripe_error');
      }
    } finally {
      setStripeBusy(false);
    }
  }, []);

  const openMenu = useCallback(async () => {
    const choice = await feedback.actionSheet({ titleKey: 'gains.title', options: [{ labelKey: 'gains.menu_manage' }, { labelKey: 'gains.menu_invoices' }], cancelKey: 'common.close' });
    if (choice === 0) openStripe();
    else if (choice === 1) router.push('/invoices');
  }, [openStripe, router]);

  // ─── Le relevé ───────────────────────────────────────────────────────────
  const delay = connect?.payoutSchedule?.delayDays ?? DEFAULT_PAYOUT_DELAY_DAYS;
  const payouts = useMemo<Payout[]>(() => connect?.payouts ?? (connect?.lastPayout ? [connect.lastPayout] : []), [connect]);
  const lines = useMemo(() => txs.map((tx) => toLine(tx, payouts, now, delay, lang)), [txs, payouts, now, delay, lang]);
  const months = useMemo(() => groupByMonth(lines), [lines]);
  const transit = useMemo(() => inTransit(lines), [lines]);
  const lastPaid = payouts.find((p) => p.status === 'paid') ?? null;
  const ready = stripeReady === true && connect?.payoutsEnabled !== false && !connect?.needsOnboarding;
  const bankLabel = connect?.bank?.last4 ? `${connect.bank.bankName ? `${connect.bank.bankName} ` : ''}···· ${connect.bank.last4}` : null;
  const isOpen = (key: string, index: number) => (openMonths ? openMonths.has(key) : index === 0);
  const toggleMonth = (key: string, index: number) => setOpenMonths((cur) => {
    const next = new Set(cur ?? months.filter((_, i) => i === 0).map((g) => g.key));
    if (isOpen(key, index)) next.delete(key); else next.add(key);
    return next;
  });

  type Item =
    | { key: string; kind: 'bank'; icon: React.ComponentProps<typeof Feather>['name']; title: string; sub?: string | null; onPress?: () => void; accent?: boolean }
    | { key: string; kind: 'month'; group: MonthGroup; index: number }
    | { key: string; kind: 'line'; line: GainLine }
    | { key: string; kind: 'payout'; payout: Payout }
    | { key: string; kind: 'empty'; title: string; sub: string; cta?: { label: string; onPress: () => void } };

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    if (segment === 'missions') {
      if (!ready) {
        out.push({ key: 'setup', kind: 'bank', icon: 'credit-card', title: t('gains.setup_title'), sub: t('gains.setup_body'), onPress: openStripe, accent: true });
      } else {
        if (transit.amount > 0) out.push({ key: 'transit', kind: 'bank', icon: 'clock', title: t('gains.in_transit', { amount: formatEURCents(transit.amount, 0) }), sub: [transit.arrivesAt ? t('gains.arrives_on', { date: formatDay(transit.arrivesAt, lang) }) : null, t('gains.missions_n', { count: transit.missions })].filter(Boolean).join(' · ') });
        if (lastPaid) out.push({ key: 'last', kind: 'bank', icon: 'check', title: t('gains.paid_out', { amount: formatEURCents(lastPaid.amount, 0), date: formatDay(lastPaid.arrivalDate ?? lastPaid.createdAt, lang) }), sub: bankLabel });
      }
      if (months.length === 0) {
        out.push({ key: 'empty', kind: 'empty', title: t('gains.empty_title'), sub: t('gains.empty_sub'), cta: ready ? { label: t('gains.go_online'), onPress: () => router.push('/(tabs)/dashboard') } : undefined });
      }
      months.forEach((g, i) => {
        out.push({ key: `m-${g.key}`, kind: 'month', group: g, index: i });
        if (isOpen(g.key, i)) g.lines.forEach((l) => out.push({ key: l.key, kind: 'line', line: l }));
      });
    } else {
      if (!ready) out.push({ key: 'setup', kind: 'bank', icon: 'credit-card', title: t('gains.setup_title'), sub: t('gains.setup_body'), onPress: openStripe, accent: true });
      if (payouts.length === 0) out.push({ key: 'empty', kind: 'empty', title: t('gains.no_payouts'), sub: t('gains.no_payouts_sub') });
      payouts.forEach((p) => out.push({ key: p.id, kind: 'payout', payout: p }));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openMonths pilote isOpen
  }, [segment, ready, transit, lastPaid, months, payouts, openMonths, bankLabel, lang, t, openStripe, router]);

  const renderItem = ({ item }: { item: Item }) => {
    switch (item.kind) {
      case 'bank': return <BankCard icon={item.icon} title={item.title} sub={item.sub} onPress={item.onPress} accent={item.accent} />;
      case 'month': return <MonthHeader group={item.group} open={isOpen(item.group.key, item.index)} onToggle={() => toggleMonth(item.group.key, item.index)} lang={lang} />;
      case 'line': return <GainRow line={item.line} onPress={setSelected} />;
      case 'payout': return (
        <View style={[s.payout, { borderBottomColor: theme.borderLight }]} accessible accessibilityLabel={`${formatEURCents(item.payout.amount)} ${t(`gains.payout_status_${item.payout.status}`, { defaultValue: item.payout.status })}`}>
          <View style={[s.payoutIc, { backgroundColor: theme.surface }]}><Feather name={item.payout.status === 'paid' ? 'check' : item.payout.status === 'failed' || item.payout.status === 'canceled' ? 'x' : 'clock'} size={15} color={theme.textSub as string} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[s.payoutTitle, { color: theme.text }]} maxFontSizeMultiplier={1.3}>{formatEURCents(item.payout.amount)}</Text>
            <Text style={[s.payoutSub, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{[formatDay(item.payout.arrivalDate ?? item.payout.createdAt, lang), bankLabel].filter(Boolean).join(' · ')}</Text>
          </View>
          <Text style={[s.payoutState, { color: item.payout.status === 'paid' ? theme.greenText : theme.textMuted }]} maxFontSizeMultiplier={1.2}>{t(`gains.payout_status_${item.payout.status}`, { defaultValue: item.payout.status }).toUpperCase()}</Text>
        </View>
      );
      case 'empty': return (
        <View style={s.empty}>
          <View style={[s.emptyIc, { backgroundColor: theme.surface }]}><Feather name="zap" size={22} color={theme.textSub as string} /></View>
          <Text style={[s.emptyTitle, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{item.title}</Text>
          <Text style={[s.emptySub, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{item.sub}</Text>
          {item.cta ? (
            <PressScale style={[s.cta, { backgroundColor: theme.accent }]} onPress={() => { feedback.haptic('light'); item.cta!.onPress(); }} accessibilityRole="button" accessibilityLabel={item.cta.label}>
              <Text style={[s.ctaText, { color: theme.accentText }]}>{item.cta.label.toUpperCase()}</Text>
            </PressScale>
          ) : null}
        </View>
      );
    }
  };

  const schedule = ready
    ? (bankLabel ? t('gains.schedule', { bank: bankLabel, days: delay }) : t('gains.schedule_no_bank', { days: delay }))
    : t('gains.setup_sub');

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]} edges={['top']}>
      <StatusBar barStyle={theme.statusBar} />
      <View style={s.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.title, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{t('gains.title')}</Text>
          <Text style={[s.schedule, { color: theme.textSub }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>{schedule}</Text>
        </View>
        <PressScale onPress={openMenu} disabled={stripeBusy} style={[s.menuBtn, { backgroundColor: theme.surface }]} accessibilityRole="button" accessibilityLabel={t('missions.options')} hitSlop={8}>
          {stripeBusy ? <ActivityIndicator size="small" color={theme.textSub as string} /> : <Feather name="more-horizontal" size={20} color={theme.text as string} />}
        </PressScale>
      </View>
      <View style={s.segment}>
        <SegmentedControl<Segment> options={[{ value: 'missions', label: t('gains.seg_missions') }, { value: 'payouts', label: t('gains.seg_payouts') }]} value={segment} onChange={(v) => { feedback.haptic('selection'); setSegment(v); }} />
      </View>
      {error ? <Text style={[s.error, { color: theme.textMuted }]}>{t('gains.balance_error')}</Text> : null}

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={theme.accent as string} /></View>
      ) : (
        <>
          <BrandRefreshHeader style={brandRefresh.headerStyle} top={insets.top} />
          <Animated.FlatList
            data={items}
            keyExtractor={(it) => it.key}
            renderItem={renderItem}
            contentContainerStyle={[s.list, { paddingBottom: tabBarPadding }]}
            showsVerticalScrollIndicator={false}
            onScroll={brandRefresh.onScroll}
            scrollEventThrottle={16}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="transparent" colors={['transparent']} />}
          />
        </>
      )}

      <MoneySheet line={selected} bankLabel={bankLabel} onClose={() => setSelected(null)} onInvoice={() => { setSelected(null); router.push('/invoices'); }} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  title: { fontFamily: FONTS.bebas, fontSize: 34, includeFontPadding: false, letterSpacing: 0.3 },
  schedule: { fontFamily: FONTS.sans, fontSize: 13, marginTop: 4, lineHeight: 18 },
  menuBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  segment: { paddingHorizontal: 20, paddingTop: 14 },
  error: { fontFamily: FONTS.sans, fontSize: 12, paddingHorizontal: 20, paddingTop: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20, paddingTop: 14 },
  bank: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, marginTop: 10 },
  bankTitle: { fontFamily: FONTS.sansMedium, fontSize: 13.5 },
  bankSub: { fontFamily: FONTS.sans, fontSize: 11.5, marginTop: 2 },
  month: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 22, paddingBottom: 6 },
  monthLabel: { fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.5, flex: 1 },
  monthRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthNet: { fontFamily: FONTS.bebas, fontSize: 18, includeFontPadding: false, fontVariant: ['tabular-nums'] },
  payout: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  payoutIc: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  payoutTitle: { fontFamily: FONTS.bebas, fontSize: 19, includeFontPadding: false, fontVariant: ['tabular-nums'] },
  payoutSub: { fontFamily: FONTS.sans, fontSize: 11.5, marginTop: 2 },
  payoutState: { fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 0.5 },
  empty: { alignItems: 'center', paddingTop: 36, paddingHorizontal: 12 },
  emptyIc: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontFamily: FONTS.bebas, fontSize: 24, includeFontPadding: false, textAlign: 'center' },
  emptySub: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 8 },
  cta: { marginTop: 16, height: 48, borderRadius: 24, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: FONTS.bebas, fontSize: 16, letterSpacing: 1.5, includeFontPadding: false },
});
