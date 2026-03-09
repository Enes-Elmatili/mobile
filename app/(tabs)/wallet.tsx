// app/(tabs)/wallet.tsx — Onglet Gains (Provider)
// Écran complet : solde · dashboard Stripe · historique transactions
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  FlatList, ActivityIndicator,
  Platform, RefreshControl,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { api } from '../../lib/api';
import { showSocketToast } from '@/lib/SocketContext';
import { useAppTheme } from '@/hooks/use-app-theme';
import { devError } from '@/lib/logger';

// ─── Formatage ────────────────────────────────────────────────────────────────
const fromCents = (n: number) => n / 100;

const fmtEur = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// ─── Label de transaction ─────────────────────────────────────────────────────
function parseTxLabel(type: string, reference?: string | null): string {
  if (!reference) return type === 'CREDIT' ? 'Crédit' : 'Débit';
  const ref = reference.toLowerCase();
  const missionMatch = reference.match(/request[_-](\d+)/i);
  if (missionMatch) return `Mission #${missionMatch[1]}`;
  if (ref.includes('withdraw') || ref.includes('retrait')) return 'Retrait bancaire';
  if (ref.includes('stripe_transfer')) return 'Virement mission';
  if (ref.includes('subscription') || ref.includes('abonnement')) return 'Abonnement';
  return reference
    .replace(/stripe_transfer_/gi, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .slice(0, 36);
}

// ─── Statut des retraits ──────────────────────────────────────────────────────
const WITHDRAW_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: 'En attente', color: '#888',    bg: '#F5F5F5' },
  APPROVED:  { label: 'Approuvé',   color: '#1A1A1A', bg: '#F5F5F5' },
  REJECTED:  { label: 'Refusé',     color: '#888',    bg: '#F5F5F5' },
  COMPLETED: { label: 'Effectué',   color: '#ADADAD', bg: '#F5F5F5' },
};

// ─── Ligne transaction ─────────────────────────────────────────────────────────
const tx = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFF', borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 2 },
    }),
  },
  iconWrap:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconCredit: { backgroundColor: '#F5F5F5' },
  iconDebit:  { backgroundColor: '#F5F5F5' },
  iconHold:   { backgroundColor: '#F5F5F5' },
  info:       { flex: 1 },
  label:      { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 },
  date:       { fontSize: 11, color: '#ADADAD', fontWeight: '500' },
  balance:    { fontSize: 11, color: '#CACBCE', fontWeight: '500', marginTop: 2 },
  amountWrap:      { alignItems: 'flex-end', gap: 5 },
  amount:          { fontSize: 15, fontWeight: '800' },
  amountCredit:    { color: '#1A1A1A' },
  amountDebit:     { color: '#1A1A1A' },
  amountHold:      { color: '#ADADAD' },
  badge:           { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeCredit:     { backgroundColor: '#F5F5F5' },
  badgeDebit:      { backgroundColor: '#F5F5F5' },
  badgeHold:       { backgroundColor: '#F5F5F5' },
  badgeText:       { fontSize: 10, fontWeight: '700' },
  badgeTextCredit: { color: '#1A1A1A' },
  badgeTextDebit:  { color: '#888' },
  badgeTextHold:   { color: '#ADADAD' },
});

function TxRow({ item }: { item: any }) {
  const t = useAppTheme();
  const isCredit = item.type === 'CREDIT' || item.type === 'RELEASE';
  const isHold = item.type === 'HOLD';
  const label = parseTxLabel(item.type, item.reference);

  const iconName = isHold ? 'time-outline' : isCredit ? 'arrow-down-outline' : 'arrow-up-outline';
  const iconColor = isHold ? '#ADADAD' : isCredit ? '#1A1A1A' : '#1A1A1A';
  const iconBg = isHold ? tx.iconHold : isCredit ? tx.iconCredit : tx.iconDebit;
  const amountStyle = isHold ? tx.amountHold : isCredit ? tx.amountCredit : tx.amountDebit;
  const badgeStyle = isHold ? tx.badgeHold : isCredit ? tx.badgeCredit : tx.badgeDebit;
  const badgeTextStyle = isHold ? tx.badgeTextHold : isCredit ? tx.badgeTextCredit : tx.badgeTextDebit;
  const badgeLabel = isHold ? 'En attente' : item.type === 'RELEASE' ? 'Libéré' : isCredit ? 'Reçu' : 'Débité';
  const sign = isHold ? '' : isCredit ? '+' : '−';

  return (
    <View style={[tx.card, { backgroundColor: t.cardBg }]}>
      <View style={[tx.iconWrap, iconBg, { backgroundColor: t.surface }]}>
        <Ionicons name={iconName} size={17} color={iconColor} />
      </View>
      <View style={tx.info}>
        <Text style={[tx.label, { color: t.text }]} numberOfLines={1}>{label}</Text>
        <Text style={[tx.date, { color: t.textMuted }]}>{fmtDate(item.createdAt)} · {fmtTime(item.createdAt)}</Text>
        {item.balanceAfter != null && !isHold && (
          <Text style={[tx.balance, { color: t.textVeryMuted }]}>Solde après : {fmtEur(fromCents(item.balanceAfter))}</Text>
        )}
      </View>
      <View style={tx.amountWrap}>
        <Text style={[tx.amount, amountStyle, { color: isHold ? t.textMuted : t.text }]}>
          {sign}{fmtEur(fromCents(Math.abs(item.amount)))}
        </Text>
        <View style={[tx.badge, badgeStyle, { backgroundColor: t.surface }]}>
          <Text style={[tx.badgeText, badgeTextStyle, { color: isHold ? t.textMuted : isCredit ? t.text : t.textSub }]}>{badgeLabel}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Ligne retrait (historique) ───────────────────────────────────────────────
function WithdrawRow({ item }: { item: any }) {
  const t = useAppTheme();
  const st = WITHDRAW_STATUS[item.status] ?? WITHDRAW_STATUS.PENDING;
  return (
    <View style={[wr.card, { backgroundColor: t.cardBg }]}>
      <View style={[wr.iconWrap, { backgroundColor: t.surface }]}>
        <Ionicons name="arrow-up-circle-outline" size={18} color="#1A1A1A" />
      </View>
      <View style={wr.info}>
        <Text style={[wr.label, { color: t.text }]}>Demande de retrait</Text>
        <Text style={[wr.date, { color: t.textMuted }]}>{fmtDate(item.createdAt)}</Text>
        {item.destination ? <Text style={[wr.iban, { color: t.textMuted }]} numberOfLines={1}>{item.destination}</Text> : null}
      </View>
      <View style={wr.right}>
        <Text style={[wr.amount, { color: t.text }]}>−{fmtEur(fromCents(item.amount))}</Text>
        <View style={[wr.badge, { backgroundColor: t.surface }]}>
          <Text style={[wr.badgeText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>
    </View>
  );
}

const wr = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFF', borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 2 },
    }),
  },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info:     { flex: 1 },
  label:    { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 },
  date:     { fontSize: 11, color: '#ADADAD', fontWeight: '500' },
  iban:     { fontSize: 11, color: '#ADADAD', fontWeight: '500', marginTop: 1 },
  right:    { alignItems: 'flex-end', gap: 5 },
  amount:   { fontSize: 15, fontWeight: '800', color: '#1A1A1A' },
  badge:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:{ fontSize: 10, fontWeight: '700' },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
interface StripeStatus {
  isProvider: boolean;
  isConnected: boolean;
  isStripeReady: boolean;
}

export default function WalletTab() {
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [balance,      setBalance]      = useState(0);
  const [escrowAmount, setEscrowAmount] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [withdrawals,  setWithdrawals]  = useState<any[]>([]);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
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
        const bal = balData.value as any;
        setBalance(bal?.balance ?? 0);
        setEscrowAmount(bal?.escrowAmount ?? 0);
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
        setStripeStatus((connectData.value as any) ?? null);
      }
    } catch (e) {
      devError('[WalletTab] load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleOpenStripeDashboard = useCallback(async () => {
    setStripeLoading(true);
    try {
      const res: any = await api.connect.dashboard();
      const url = res?.url;
      if (url) {
        await WebBrowser.openBrowserAsync(url);
      } else {
        showSocketToast('Impossible d\'ouvrir le dashboard Stripe.', 'error');
      }
    } catch (e: any) {
      showSocketToast(e?.message || 'Erreur Stripe', 'error');
    } finally {
      setStripeLoading(false);
    }
  }, []);

  // Recharge à chaque fois que l'onglet devient actif
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  // ── Stats calculées depuis les transactions ────────────────────────────────
  const totalEarnings = useMemo(() =>
    transactions
      .filter(t => t.type === 'CREDIT' || t.type === 'RELEASE')
      .reduce((sum, t) => sum + (t.amount ?? 0), 0),
    [transactions]
  );

  const pendingWithdrawTotal = useMemo(() =>
    withdrawals
      .filter(w => w.status === 'PENDING')
      .reduce((sum, w) => sum + (w.amount ?? 0), 0),
    [withdrawals]
  );

  // ── Sections FlatList ──────────────────────────────────────────────────────
  const sections: any[] = useMemo(() => {
    const items: any[] = [];

    // Retraits en attente (historique, si existants)
    if (withdrawals.length > 0) {
      items.push({ key: 'wd-header', type: 'section-header', title: `Retraits (${withdrawals.length})` });
      withdrawals.forEach(w => items.push({ key: `wd-${w.id}`, type: 'withdraw', data: w }));
    }

    // Transactions
    items.push({ key: 'tx-header', type: 'section-header', title: transactions.length > 0 ? `Transactions (${transactions.length})` : 'Transactions' });
    if (transactions.length === 0) {
      items.push({ key: 'tx-empty', type: 'tx-empty' });
    } else {
      transactions.forEach(t => items.push({ key: `tx-${t.id}`, type: 'tx', data: t }));
    }

    return items;
  }, [transactions, withdrawals]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    if (item.type === 'stats') {
      return (
        <View style={s.statsRow}>
          <View style={[s.statCard, { backgroundColor: t.cardBg }]}>
            <Ionicons name="trending-up-outline" size={18} color={t.text} />
            <Text style={[s.statValue, { color: t.text }]}>{fmtEur(fromCents(totalEarnings))}</Text>
            <Text style={[s.statLabel, { color: t.textMuted }]}>Total gagné</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: t.cardBg }]}>
            <Ionicons name="receipt-outline" size={18} color={t.text} />
            <Text style={[s.statValue, { color: t.text }]}>{transactions.length}</Text>
            <Text style={[s.statLabel, { color: t.textMuted }]}>Transactions</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: t.cardBg }]}>
            <Ionicons name="time-outline" size={18} color={t.textMuted} />
            <Text style={[s.statValue, { color: t.text }]}>{fmtEur(fromCents(pendingWithdrawTotal))}</Text>
            <Text style={[s.statLabel, { color: t.textMuted }]}>En attente</Text>
          </View>
        </View>
      );
    }
    if (item.type === 'section-header') {
      return <Text style={[s.sectionTitle, { color: t.textMuted }]}>{item.title}</Text>;
    }
    if (item.type === 'withdraw') return <WithdrawRow item={item.data} />;
    if (item.type === 'tx') return <TxRow item={item.data} />;
    if (item.type === 'tx-empty') {
      return (
        <View style={s.empty}>
          <Ionicons name="wallet-outline" size={52} color={t.textDisabled} />
          <Text style={[s.emptyTitle, { color: t.textSub }]}>Aucune transaction</Text>
          <Text style={[s.emptySubtitle, { color: t.textMuted }]}>Vos gains apparaîtront ici après vos missions.</Text>
        </View>
      );
    }
    return null;
  }, [totalEarnings, pendingWithdrawTotal, transactions.length]);

  if (loading) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: t.bg }]}>
        <StatusBar barStyle={t.statusBar} />
        <View style={s.loadingCenter}>
          <ActivityIndicator size="large" color={t.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const balanceEur = fromCents(balance);
  const canOpenDashboard = stripeStatus?.isStripeReady || stripeStatus?.isConnected;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={t.statusBar} />

      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: t.bg }]}>
        <Text style={[s.headerTitle, { color: t.text }]}>Gains</Text>
        <TouchableOpacity onPress={onRefresh} style={s.refreshBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="refresh-outline" size={20} color={t.accent} />
        </TouchableOpacity>
      </View>

      {/* ── Hero solde ── */}
      <View style={[s.hero, { backgroundColor: t.heroBg }]}>
        <Text style={s.heroLabel}>Solde disponible</Text>
        <Text style={s.heroAmount}>{fmtEur(balanceEur)}</Text>
        {escrowAmount > 0 && (
          <Text style={s.escrowInline}>
            +{fmtEur(fromCents(escrowAmount))} en validation
          </Text>
        )}

        {!canOpenDashboard && (
          <View style={s.payoutNotice}>
            <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.5)" />
            <Text style={s.payoutNoticeText}>
              Configurez Stripe pour recevoir vos virements.
            </Text>
          </View>
        )}
      </View>

      {/* ── Stripe dashboard — lien discret sous le hero ── */}
      {canOpenDashboard && (
        <TouchableOpacity
          style={s.stripeLinkRow}
          onPress={handleOpenStripeDashboard}
          disabled={stripeLoading}
          activeOpacity={0.7}
        >
          {stripeLoading
            ? <ActivityIndicator size="small" color={t.accent} />
            : <>
                <Ionicons name="card-outline" size={15} color={t.accent} />
                <Text style={[s.stripeLinkText, { color: t.text }]}>Gérer mes paiements</Text>
                <Ionicons name="chevron-forward" size={13} color={t.textVeryMuted} />
              </>
          }
        </TouchableOpacity>
      )}

      {/* ── Liste principale ── */}
      <FlatList
        data={sections}
        keyExtractor={item => item.key}
        renderItem={renderItem}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />
        }
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#FFFFFF' },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1A1A1A' },
  refreshBtn:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // Héro balance
  hero: {
    backgroundColor: '#1A1A1A',
    marginHorizontal: 16, borderRadius: 24,
    paddingVertical: 28, paddingHorizontal: 24,
    marginBottom: 12, alignItems: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 10 },
    }),
  },
  heroLabel:  { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, marginBottom: 8 },
  heroAmount: { fontSize: 48, fontWeight: '900', color: '#FFF', letterSpacing: -1.5, marginBottom: 12 },

  // Escrow inline text (under hero amount)
  escrowInline: {
    fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)',
    marginBottom: 4,
  },

  // Notice payout non configuré
  payoutNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
  },
  payoutNoticeText: {
    fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '500',
  },

  // Stripe link row
  stripeLinkRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    marginHorizontal: 16, marginBottom: 12,
    paddingVertical: 10,
  },
  stripeLinkText: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 18,
    padding: 14, alignItems: 'center', gap: 6,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 2 },
    }),
  },
  statValue: { fontSize: 15, fontWeight: '800', color: '#1A1A1A', textAlign: 'center' },
  statLabel: { fontSize: 10, fontWeight: '600', color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },

  // Liste
  listContent:  { paddingHorizontal: 16, paddingBottom: 100 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12, marginTop: 6 },

  // Vide
  empty:         { alignItems: 'center', paddingVertical: 50, gap: 12 },
  emptyTitle:    { fontSize: 17, fontWeight: '700', color: '#888' },
  emptySubtitle: { fontSize: 13, color: '#ADADAD', textAlign: 'center', lineHeight: 19, paddingHorizontal: 30 },
});
