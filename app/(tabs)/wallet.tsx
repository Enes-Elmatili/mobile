// app/(tabs)/wallet.tsx — Onglet Gains (Provider)
// Solde · filtres · historique consolide par mission
import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  FlatList, ActivityIndicator,
  Platform, RefreshControl, StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { api } from '../../lib/api';
import { showSocketToast } from '@/lib/SocketContext';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { devError } from '@/lib/logger';

// --- Formatage ---
const fromCents = (n: number) => n / 100;
const fmtEur = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// --- Date relative pour les en-tetes ---
function dateGroup(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const txDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today.getTime() - txDay.getTime()) / 86_400_000;
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  if (diff < 7) return `Il y a ${Math.floor(diff)} jours`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// --- Label lisible depuis la reference ---
function readableLabel(type: string, reference?: string | null): string {
  if (!reference) return type === 'CREDIT' ? 'Crédit' : type === 'DEBIT' ? 'Débit' : type;
  const m = reference.match(/request[_-](\d+)/i);
  if (m) return `Mission #${m[1]}`;
  if (/withdraw|retrait/i.test(reference)) return 'Retrait bancaire';
  if (/stripe_transfer/i.test(reference)) return 'Virement Stripe';
  return reference.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).slice(0, 36);
}

// --- Onglets de filtre ---
type Filter = 'all' | 'gains' | 'pending' | 'withdrawals';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'gains', label: 'Gains' },
  { key: 'pending', label: 'En attente' },
  { key: 'withdrawals', label: 'Retraits' },
];

// --- Statut des retraits ---
const WD_STATUS: Record<string, { label: string; color: string }> = {
  PENDING:   { label: 'En attente', color: COLORS.amber },
  APPROVED:  { label: 'Approuvé',   color: COLORS.green },
  REJECTED:  { label: 'Refusé',     color: COLORS.red },
  COMPLETED: { label: 'Effectué',   color: COLORS.green },
};

// --- Consolidation : fusionne HOLD+RELEASE d'une meme mission ---
interface ConsolidatedTx {
  id: string;
  missionId: string | null;
  label: string;
  amount: number;
  status: 'released' | 'pending' | 'credit' | 'debit';
  date: string;
  balanceAfter: number | null;
}

function consolidateTxs(raw: any[]): ConsolidatedTx[] {
  const releasedMissions = new Set<string>();
  for (const t of raw) {
    if (t.type === 'RELEASE' && t.reference) {
      const m = t.reference.match(/request[_-](\d+)/i);
      if (m) releasedMissions.add(m[1]);
    }
  }

  const result: ConsolidatedTx[] = [];
  const seenMissions = new Set<string>();

  for (const t of raw) {
    const missionMatch = t.reference?.match(/request[_-](\d+)/i);
    const missionId = missionMatch?.[1] ?? null;

    if (t.type === 'HOLD' && missionId && releasedMissions.has(missionId)) continue;

    if (missionId && (t.type === 'RELEASE' || t.type === 'HOLD')) {
      if (seenMissions.has(missionId)) continue;
      seenMissions.add(missionId);
    }

    let status: ConsolidatedTx['status'];
    if (t.type === 'HOLD') status = 'pending';
    else if (t.type === 'RELEASE' || t.type === 'CREDIT') status = t.type === 'RELEASE' ? 'released' : 'credit';
    else status = 'debit';

    result.push({
      id: t.id,
      missionId,
      label: readableLabel(t.type, t.reference),
      amount: t.amount,
      status,
      date: t.createdAt,
      balanceAfter: t.type !== 'HOLD' ? t.balanceAfter : null,
    });
  }

  return result;
}

// --- Ligne transaction ---
function TxRow({ item, theme: t }: { item: ConsolidatedTx; theme: any }) {
  const cfg = {
    released: { icon: 'check-circle' as const, iconColor: COLORS.green, badge: 'Libéré', badgeColor: COLORS.green, sign: '+' },
    credit:   { icon: 'arrow-down' as const,   iconColor: COLORS.green, badge: 'Reçu',   badgeColor: COLORS.green, sign: '+' },
    pending:  { icon: 'clock' as const,        iconColor: COLORS.amber, badge: 'En validation', badgeColor: COLORS.amber, sign: '' },
    debit:    { icon: 'arrow-up' as const,     iconColor: COLORS.red, badge: 'Débité', badgeColor: COLORS.red, sign: '−' },
  }[item.status];

  const isGain = item.status === 'released' || item.status === 'credit';

  return (
    <View style={[styles.txCard, { backgroundColor: t.cardBg, shadowOpacity: t.shadowOpacity }]}>
      <View style={[styles.txIcon, { backgroundColor: t.surface }]}>
        <Feather name={cfg.icon} size={18} color={cfg.iconColor} />
      </View>
      <View style={styles.txInfo}>
        <Text style={[styles.txLabel, { color: t.text }]} numberOfLines={1}>{item.label}</Text>
        <Text style={[styles.txDate, { color: t.textMuted }]}>{fmtDate(item.date)} · {fmtTime(item.date)}</Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: isGain ? COLORS.green : item.status === 'pending' ? t.textMuted : COLORS.red }]}>
          {cfg.sign}{fmtEur(fromCents(item.amount))}
        </Text>
        <View style={[styles.txBadge, { backgroundColor: cfg.badgeColor + '18' }]}>
          <Text style={[styles.txBadgeText, { color: cfg.badgeColor }]}>{cfg.badge}</Text>
        </View>
      </View>
    </View>
  );
}

// --- Ligne retrait ---
function WithdrawRow({ item, theme: t }: { item: any; theme: any }) {
  const st = WD_STATUS[item.status] ?? WD_STATUS.PENDING;
  return (
    <View style={[styles.txCard, { backgroundColor: t.cardBg, shadowOpacity: t.shadowOpacity }]}>
      <View style={[styles.txIcon, { backgroundColor: t.surface }]}>
        <Feather name="credit-card" size={18} color={st.color} />
      </View>
      <View style={styles.txInfo}>
        <Text style={[styles.txLabel, { color: t.text }]} numberOfLines={1}>Retrait</Text>
        <Text style={[styles.txDate, { color: t.textMuted }]}>{fmtDate(item.createdAt)}</Text>
        {item.destination ? <Text style={[styles.txDate, { color: t.textMuted }]} numberOfLines={1}>{item.destination}</Text> : null}
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: COLORS.red }]}>−{fmtEur(fromCents(item.amount))}</Text>
        <View style={[styles.txBadge, { backgroundColor: st.color + '18' }]}>
          <Text style={[styles.txBadgeText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>
    </View>
  );
}

// ====================================================================
// MAIN SCREEN
// ====================================================================
export default function WalletTab() {
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [balance, setBalance]           = useState(0);
  const [escrowAmount, setEscrowAmount] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [withdrawals, setWithdrawals]   = useState<any[]>([]);
  const [stripeReady, setStripeReady]   = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [filter, setFilter]             = useState<Filter>('all');
  const t = useAppTheme();

  const load = useCallback(async () => {
    try {
      const [balData, txData, wdData, connectData] = await Promise.allSettled([
        api.wallet.balance(),
        api.wallet.transactions(50),
        api.wallet.withdraws(),
        api.connect.status(),
      ]);

      if (balData.status === 'fulfilled') {
        const b = balData.value as any;
        setBalance(b?.balance ?? 0);
        setEscrowAmount(b?.escrowAmount ?? 0);
        setTotalEarnings(b?.totalEarnings ?? 0);
      }
      if (txData.status === 'fulfilled') {
        const raw = txData.value as any;
        setTransactions(Array.isArray(raw) ? raw : (raw?.transactions ?? raw?.data ?? []));
      }
      if (wdData.status === 'fulfilled') {
        const raw = wdData.value as any;
        setWithdrawals(Array.isArray(raw) ? raw : (raw?.data ?? []));
      }
      if (connectData.status === 'fulfilled') {
        const c = connectData.value as any;
        setStripeReady(!!c?.isStripeReady);
      }
    } catch (e) {
      devError('[WalletTab] load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const lastWalletFetch = useRef(0);
  useFocusEffect(useCallback(() => {
    const now = Date.now();
    if (now - lastWalletFetch.current > 60_000) { // 60s cache between focus
      lastWalletFetch.current = now;
      load();
    }
  }, [load]));
  const onRefresh = () => { lastWalletFetch.current = 0; setRefreshing(true); load(); };

  const handleOpenStripeDashboard = useCallback(async () => {
    setStripeLoading(true);
    try {
      const res: any = await api.connect.dashboard();
      if (res?.needsOnboarding && res?.url) {
        // Compte reset (mode mismatch) → relancer l'onboarding
        await WebBrowser.openBrowserAsync(res.url);
      } else if (res?.needsOnboarding || res?.code === 'STRIPE_MODE_MISMATCH') {
        // Pas d'URL → rediriger vers la page d'onboarding
        const Linking = await import('expo-linking');
        const returnUrl = Linking.createURL('connect/success');
        const refreshUrl = Linking.createURL('connect/reauth');
        const onb: any = await api.connect.onboarding(returnUrl, refreshUrl);
        if (onb?.url) await WebBrowser.openBrowserAsync(onb.url);
        else showSocketToast("Impossible de lancer la configuration Stripe.", 'error');
      } else if (res?.url) {
        await WebBrowser.openBrowserAsync(res.url);
      } else {
        showSocketToast("Impossible d'ouvrir le dashboard Stripe.", 'error');
      }
    } catch (e: any) {
      // Backend returns 400 with needsOnboarding on mode mismatch
      if (e?.code === 'STRIPE_MODE_MISMATCH' || e?.needsOnboarding) {
        try {
          const Linking = await import('expo-linking');
          const returnUrl = Linking.createURL('connect/success');
          const refreshUrl = Linking.createURL('connect/reauth');
          const onb: any = await api.connect.onboarding(returnUrl, refreshUrl);
          if (onb?.url) await WebBrowser.openBrowserAsync(onb.url);
        } catch { /* silent */ }
      } else {
        showSocketToast(e?.message || 'Erreur Stripe', 'error');
      }
    } finally {
      setStripeLoading(false);
    }
  }, []);

  // -- Consolidation et filtrage --
  const consolidated = useMemo(() => consolidateTxs(transactions), [transactions]);

  const pendingWithdrawTotal = useMemo(() =>
    withdrawals.filter(w => w.status === 'PENDING').reduce((s, w) => s + (w.amount ?? 0), 0),
    [withdrawals],
  );

  const filteredItems = useMemo(() => {
    type ListItem =
      | { key: string; type: 'date-header'; title: string }
      | { key: string; type: 'tx'; data: ConsolidatedTx }
      | { key: string; type: 'withdraw'; data: any }
      | { key: string; type: 'empty' };

    let txList: ConsolidatedTx[] = [];
    let wdList: any[] = [];

    switch (filter) {
      case 'gains':
        txList = consolidated.filter(t => t.status === 'released' || t.status === 'credit');
        break;
      case 'pending':
        txList = consolidated.filter(t => t.status === 'pending');
        break;
      case 'withdrawals':
        wdList = withdrawals;
        break;
      default:
        txList = consolidated;
        wdList = withdrawals;
    }

    const items: ListItem[] = [];
    let lastGroup = '';

    const combined: { date: string; type: 'tx' | 'withdraw'; data: any }[] = [
      ...txList.map(tx => ({ date: tx.date, type: 'tx' as const, data: tx })),
      ...wdList.map(wd => ({ date: wd.createdAt, type: 'withdraw' as const, data: wd })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (combined.length === 0) {
      items.push({ key: 'empty', type: 'empty' });
    } else {
      for (const entry of combined) {
        const group = dateGroup(entry.date);
        if (group !== lastGroup) {
          items.push({ key: `dh-${group}`, type: 'date-header', title: group });
          lastGroup = group;
        }
        if (entry.type === 'tx') {
          items.push({ key: `tx-${entry.data.id}`, type: 'tx', data: entry.data });
        } else {
          items.push({ key: `wd-${entry.data.id}`, type: 'withdraw', data: entry.data });
        }
      }
    }

    return items;
  }, [consolidated, withdrawals, filter]);

  // -- Rendu --
  const renderItem = useCallback(({ item }: { item: any }) => {
    if (item.type === 'date-header') {
      return <Text style={[styles.dateHeader, { color: t.textMuted }]}>{item.title}</Text>;
    }
    if (item.type === 'tx') return <TxRow item={item.data} theme={t} />;
    if (item.type === 'withdraw') return <WithdrawRow item={item.data} theme={t} />;
    if (item.type === 'empty') {
      return (
        <View style={styles.empty}>
          <Feather name="credit-card" size={48} color={t.textDisabled} />
          <Text style={[styles.emptyTitle, { color: t.textSub }]}>Aucune transaction</Text>
          <Text style={[styles.emptySubtitle, { color: t.textMuted }]}>
            Vos gains apparaitront ici apres vos missions.
          </Text>
        </View>
      );
    }
    return null;
  }, [t]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]}>
        <StatusBar barStyle={t.statusBar} />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={t.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={t.statusBar} />

      {/* -- Header -- */}
      <View style={[styles.header, { backgroundColor: t.bg }]}>
        <Text style={[styles.headerTitle, { color: t.text }]}>Gains</Text>
        <TouchableOpacity onPress={onRefresh} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="refresh-cw" size={20} color={t.accent} />
        </TouchableOpacity>
      </View>

      {/* -- Hero solde -- */}
      <View style={[styles.hero, { backgroundColor: t.heroBg }]}>
        <Text style={[styles.heroLabel, { color: t.heroSub }]}>Solde disponible</Text>
        <Text style={[styles.heroAmount, { color: t.heroText }]}>{fmtEur(fromCents(balance))}</Text>

        {/* Sous-stats inline */}
        <View style={styles.heroStats}>
          {escrowAmount > 0 && (
            <View style={styles.heroStatItem}>
              <Feather name="clock" size={13} color={t.heroSub} />
              <Text style={[styles.heroStatText, { color: t.heroSubFaint }]}>{fmtEur(fromCents(escrowAmount))} en validation</Text>
            </View>
          )}
          {pendingWithdrawTotal > 0 && (
            <View style={styles.heroStatItem}>
              <Feather name="arrow-up" size={13} color={t.heroSub} />
              <Text style={[styles.heroStatText, { color: t.heroSubFaint }]}>{fmtEur(fromCents(pendingWithdrawTotal))} en retrait</Text>
            </View>
          )}
        </View>

        {/* Total gagné */}
        <View style={[styles.heroTotalRow, { borderTopColor: 'rgba(255,255,255,0.12)' }]}>
          <Text style={[styles.heroTotalLabel, { color: t.heroSub }]}>Total gagné</Text>
          <Text style={[styles.heroTotalValue, { color: t.heroText }]}>{fmtEur(fromCents(totalEarnings))}</Text>
        </View>

        {!stripeReady && (
          <View style={styles.payoutNotice}>
            <Feather name="info" size={14} color={t.heroSub} />
            <Text style={[styles.payoutNoticeText, { color: t.heroSubFaint }]}>Configurez Stripe pour recevoir vos virements.</Text>
          </View>
        )}
      </View>

      {/* -- Stripe link -- */}
      <TouchableOpacity
        style={styles.stripeLink}
        onPress={handleOpenStripeDashboard}
        disabled={stripeLoading}
        activeOpacity={0.7}
      >
        {stripeLoading
          ? <ActivityIndicator size="small" color={t.accent} />
          : <>
              <Feather name="credit-card" size={15} color={t.accent} />
              <Text style={[styles.stripeLinkText, { color: t.text }]}>
                {stripeReady ? 'Gérer mes paiements' : 'Configurer Stripe'}
              </Text>
              <Feather name="chevron-right" size={13} color={t.textVeryMuted} />
            </>
        }
      </TouchableOpacity>

      {/* -- Filtres -- */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, { borderColor: t.borderLight }, active && { backgroundColor: t.text, borderColor: t.text }]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, { color: active ? t.bg : t.textMuted }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* -- Liste -- */}
      <FlatList
        data={filteredItems}
        keyExtractor={item => item.key}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      />
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12,
  },
  headerTitle: { fontSize: 28, fontFamily: FONTS.bebas, letterSpacing: 0.5 },

  // Hero
  hero: {
    marginHorizontal: 16, borderRadius: 24,
    paddingVertical: 24, paddingHorizontal: 24, marginBottom: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 10 },
    }),
  },
  heroLabel: { fontSize: 13, fontFamily: FONTS.sansMedium, letterSpacing: 0.5, marginBottom: 6 },
  heroAmount: { fontSize: 44, fontFamily: FONTS.bebas, letterSpacing: -1.5, marginBottom: 8 },

  heroStats: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  heroStatItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroStatText: { fontSize: 12, fontFamily: FONTS.mono },

  heroTotalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  heroTotalLabel: { fontSize: 13, fontFamily: FONTS.sansMedium },
  heroTotalValue: { fontSize: 16, fontFamily: FONTS.monoMedium },

  payoutNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  payoutNoticeText: { fontSize: 12, fontFamily: FONTS.sans },

  // Stripe link
  stripeLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    marginHorizontal: 16, marginBottom: 8, paddingVertical: 10,
  },
  stripeLinkText: { fontSize: 13, fontFamily: FONTS.sansMedium },

  // Filters
  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: 'transparent',
    borderWidth: 1,
  },
  filterChipText: { fontSize: 13, fontFamily: FONTS.sansMedium },

  // Date headers
  dateHeader: {
    fontSize: 13, fontFamily: FONTS.sansMedium, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 10, marginTop: 8,
  },

  // Tx card
  txCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 1 },
    }),
  },
  txIcon: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  txInfo: { flex: 1 },
  txLabel: { fontSize: 14, fontFamily: FONTS.sansMedium, marginBottom: 2 },
  txDate: { fontSize: 11, fontFamily: FONTS.mono },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: { fontSize: 15, fontFamily: FONTS.monoMedium },
  txBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  txBadgeText: { fontSize: 10, fontFamily: FONTS.sansMedium },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: FONTS.sansMedium },
  emptySubtitle: { fontSize: 13, fontFamily: FONTS.sans, textAlign: 'center', lineHeight: 19, paddingHorizontal: 30 },
});
