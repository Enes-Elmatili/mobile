// app/(tabs)/wallet.tsx — Onglet Gains (Provider)
// Solde · filtres · historique consolide par mission
import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ScrollView, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView,
  Platform, RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabBarPadding } from './_layout';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { api } from '../../lib/api';
import { showSocketToast } from '@/lib/SocketContext';
import { feedback } from '@/lib/feedback/feedback';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { devError } from '@/lib/logger';
import { formatEUR as fmtEur } from '@/lib/format';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';

// --- Formatage ---
const fromCents = (n: number) => n / 100;
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
  if (diff === 0) return i18n.t('ext.wallet_date_today');
  if (diff === 1) return i18n.t('ext.wallet_date_yesterday');
  if (diff < 7) return i18n.t('ext.wallet_date_days_ago', { n: Math.floor(diff) });
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// --- Label lisible depuis la reference ---
function readableLabel(type: string, reference?: string | null): string {
  if (!reference) return type === 'CREDIT' ? i18n.t('ext.wallet_label_credit') : type === 'DEBIT' ? i18n.t('ext.wallet_label_debit') : type;
  const m = reference.match(/request[_-](\d+)/i);
  if (m) return i18n.t('ext.wallet_tx_mission', { id: m[1] });
  if (/withdraw|retrait/i.test(reference)) return i18n.t('ext.wallet_tx_withdraw');
  if (/stripe_transfer/i.test(reference)) return i18n.t('ext.wallet_tx_stripe_transfer');
  return reference.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).slice(0, 36);
}

// --- Onglets de filtre ---
type Filter = 'all' | 'gains' | 'pending' | 'withdrawals';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'ext.wallet_filter_all' },
  { key: 'gains', label: 'ext.wallet_earnings_title' },
  { key: 'pending', label: 'wallet.pending' },
  { key: 'withdrawals', label: 'ext.wallet_filter_withdrawals' },
];

// --- Statut des retraits ---
const WD_STATUS_CFG: Record<string, { i18nKey: string; color: string }> = {
  PENDING:   { i18nKey: 'ext.wallet_status_pending',   color: COLORS.amber },
  APPROVED:  { i18nKey: 'ext.wallet_status_approved',  color: COLORS.green },
  REJECTED:  { i18nKey: 'ext.wallet_status_rejected',  color: COLORS.red },
  COMPLETED: { i18nKey: 'ext.wallet_status_completed', color: COLORS.green },
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
  const { t: tr } = useTranslation();
  const cfg = {
    released: { icon: 'check-circle' as const, iconColor: COLORS.green, badge: tr('ext.wallet_tx_released'), badgeColor: COLORS.green, sign: '+' },
    credit:   { icon: 'arrow-down' as const,   iconColor: COLORS.green, badge: tr('ext.wallet_tx_credit'),   badgeColor: COLORS.green, sign: '+' },
    pending:  { icon: 'clock' as const,        iconColor: COLORS.amber, badge: tr('ext.wallet_tx_pending_validation'), badgeColor: COLORS.amber, sign: '' },
    debit:    { icon: 'arrow-up' as const,     iconColor: COLORS.red,   badge: tr('ext.wallet_tx_debit'),    badgeColor: COLORS.red, sign: '−' },
  }[item.status];

  const isGain = item.status === 'released' || item.status === 'credit';
  // vert de marque illisible en texte/icône sur fond clair → greenText theme-aware (tint gardé)
  const cfgIconFg  = cfg.iconColor  === COLORS.green ? t.greenText : cfg.iconColor;
  const cfgBadgeFg = cfg.badgeColor === COLORS.green ? t.greenText : cfg.badgeColor;

  return (
    <View style={[styles.txCard, { backgroundColor: t.cardBg, shadowOpacity: t.shadowOpacity }]}>
      <View style={[styles.txIcon, { backgroundColor: t.surface }]}>
        <Feather name={cfg.icon} size={18} color={cfgIconFg} />
      </View>
      <View style={styles.txInfo}>
        <Text style={[styles.txLabel, { color: t.text }]} numberOfLines={1}>{item.label}</Text>
        <Text style={[styles.txDate, { color: t.textMuted }]}>{fmtDate(item.date)} · {fmtTime(item.date)}</Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: isGain ? t.greenText : item.status === 'pending' ? t.textMuted : COLORS.red }]}>
          {cfg.sign}{fmtEur(fromCents(item.amount))}
        </Text>
        <View style={[styles.txBadge, { backgroundColor: cfg.badgeColor + '18' }]}>
          <Text style={[styles.txBadgeText, { color: cfgBadgeFg }]}>{cfg.badge}</Text>
        </View>
      </View>
    </View>
  );
}

// --- Ligne retrait ---
function WithdrawRow({ item, theme: t }: { item: any; theme: any }) {
  const { t: tr } = useTranslation();
  const st = WD_STATUS_CFG[item.status] ?? WD_STATUS_CFG.PENDING;
  // vert de marque illisible en texte/icône sur fond clair → greenText theme-aware (tint gardé)
  const stFg = st.color === COLORS.green ? t.greenText : st.color;
  return (
    <View style={[styles.txCard, { backgroundColor: t.cardBg, shadowOpacity: t.shadowOpacity }]}>
      <View style={[styles.txIcon, { backgroundColor: t.surface }]}>
        <Feather name="credit-card" size={18} color={stFg} />
      </View>
      <View style={styles.txInfo}>
        <Text style={[styles.txLabel, { color: t.text }]} numberOfLines={1}>{tr('wallet.withdraw')}</Text>
        <Text style={[styles.txDate, { color: t.textMuted }]}>{fmtDate(item.createdAt)}</Text>
        {item.destination ? <Text style={[styles.txDate, { color: t.textMuted }]} numberOfLines={1}>{item.destination}</Text> : null}
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: COLORS.red }]}>−{fmtEur(fromCents(item.amount))}</Text>
        <View style={[styles.txBadge, { backgroundColor: st.color + '18' }]}>
          <Text style={[styles.txBadgeText, { color: stFg }]}>{tr(st.i18nKey)}</Text>
        </View>
      </View>
    </View>
  );
}

// --- Modale de retrait (portee depuis l'ancien app/wallet.tsx) ---
interface WithdrawModalProps {
  visible: boolean;
  balance: number; // en centimes
  onClose: () => void;
  onSuccess: () => void;
}

function WithdrawModal({ visible, balance, onClose, onSuccess }: WithdrawModalProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [iban, setIban] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const amt = parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(amt) || amt <= 0) {
      feedback.error(t('wallet.invalid_amount'));
      return;
    }
    const balanceEur = fromCents(balance);
    if (amt > balanceEur) {
      feedback.error(t('wallet.insufficient_balance'));
      return;
    }
    setLoading(true);
    try {
      // Le backend attend des centimes (entiers)
      await api.wallet.withdraw(Math.round(amt * 100), iban.trim() || undefined, note.trim() || undefined);
      setAmount('');
      setIban('');
      setNote('');
      onSuccess();
    } catch (e: any) {
      feedback.error(e?.message || t('wallet.withdraw_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={wm.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={wm.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[wm.sheet, { backgroundColor: theme.cardBg }]}>
          <View style={[wm.handle, { backgroundColor: theme.border }]} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
          <Text style={[wm.title, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>{t('ext.wallet_withdraw_title')}</Text>
          <Text style={[wm.subtitle, { color: theme.textMuted, fontFamily: FONTS.sans }]}>{t('ext.wallet_available_balance')} : {fmtEur(fromCents(balance))}</Text>

          <Text style={[wm.label, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>{t('ext.wallet_amount_eur')}</Text>
          <TextInput
            style={[wm.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textAlt, fontFamily: FONTS.sans }]}
            placeholder={t('ext.wallet_amount_placeholder')}
            placeholderTextColor={theme.textMuted}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            returnKeyType="next"
          />

          <Text style={[wm.label, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>{t('ext.wallet_iban_optional')}</Text>
          <TextInput
            style={[wm.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textAlt, fontFamily: FONTS.mono }]}
            placeholder="BE12 3456 7890 1234"
            placeholderTextColor={theme.textMuted}
            value={iban}
            onChangeText={setIban}
            autoCapitalize="characters"
            returnKeyType="next"
          />

          <Text style={[wm.label, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>{t('ext.wallet_note_optional')}</Text>
          <TextInput
            style={[wm.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textAlt, fontFamily: FONTS.sans }]}
            placeholder={t('ext.wallet_note_placeholder')}
            placeholderTextColor={theme.textMuted}
            value={note}
            onChangeText={setNote}
            returnKeyType="done"
          />

          <Text style={[wm.notice, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
            {t('ext.wallet_withdraw_notice')}
          </Text>

          <TouchableOpacity
            style={[wm.btn, { backgroundColor: theme.accent }, loading && wm.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={theme.accentText} />
              : <Text style={[wm.btnText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>{t('ext.wallet_confirm_withdraw')}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={wm.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={[wm.cancelText, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const wm = StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'flex-end' },
  backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    maxHeight: '88%',
  },
  handle:     { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:      { fontSize: 28, marginBottom: 4 },
  subtitle:   { fontSize: 14, marginBottom: 22 },
  label:      { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 7 },
  input: {
    borderRadius: 14, height: 50, paddingHorizontal: 16,
    fontSize: 15, marginBottom: 14,
    borderWidth: 1,
  },
  notice:     { fontSize: 12, lineHeight: 18, marginBottom: 20, marginTop: 4 },
  btn:        { borderRadius: 100, height: 55, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  btnDisabled:{ opacity: 0.6 },
  btnText:    { fontSize: 16 },
  cancelBtn:  { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 15 },
});

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
  const [stripeData, setStripeData]     = useState<{
    needsOnboarding?: boolean; payoutsEnabled?: boolean; available: number; pending: number;
    lastPayout: { amount: number; currency?: string; status?: string; arrivalDate: number | null } | null;
  } | null>(null);
  const [filter, setFilter]             = useState<Filter>('all');
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [balanceError, setBalanceError] = useState(false);
  const t = useAppTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const tabBarPadding = useTabBarPadding();

  const load = useCallback(async () => {
    try {
      const [balData, txData, wdData, connectData, stripeBalData] = await Promise.allSettled([
        api.wallet.balance(),
        api.wallet.transactions(50),
        api.wallet.withdraws(),
        api.connect.status(),
        api.connect.balance(),
      ]);

      if (balData.status === 'fulfilled') {
        const b = balData.value as any;
        setBalance(b?.balance ?? 0);
        setEscrowAmount(b?.escrowAmount ?? 0);
        setTotalEarnings(b?.totalEarnings ?? 0);
        setBalanceError(false);
      } else {
        // Le solde n'a pas pu etre charge : ne pas afficher un faux "0,00 €".
        devError('[WalletTab] balance error:', balData.reason);
        setBalanceError(true);
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
      if (stripeBalData.status === 'fulfilled') {
        setStripeData(stripeBalData.value as any);
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

  const handleWithdrawSuccess = () => {
    setShowWithdraw(false);
    showSocketToast(tr('ext.wallet_request_sent_sub'), 'success');
    lastWalletFetch.current = 0;
    load();
  };

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
        else showSocketToast(tr('ext.wallet_stripe_setup_failed'), 'error');
      } else if (res?.url) {
        await WebBrowser.openBrowserAsync(res.url);
      } else {
        showSocketToast(tr('ext.wallet_stripe_open_failed'), 'error');
      }
    } catch (e: any) {
      // api.ts place le corps de la réponse dans e.data → code/needsOnboarding
      // sont là-dedans, pas à la racine de l'erreur (sinon on affichait juste le
      // message « Aucun compte Stripe Connect lié » en cul-de-sac).
      const body = e?.data ?? e;
      const needsOnboarding =
        body?.needsOnboarding ||
        body?.code === 'STRIPE_MODE_MISMATCH' ||
        body?.code === 'NO_STRIPE_ACCOUNT';
      if (needsOnboarding) {
        try {
          const Linking = await import('expo-linking');
          const returnUrl = Linking.createURL('connect/success');
          const refreshUrl = Linking.createURL('connect/reauth');
          const onb: any = await api.connect.onboarding(returnUrl, refreshUrl);
          if (onb?.url) await WebBrowser.openBrowserAsync(onb.url);
          else showSocketToast(tr('ext.wallet_stripe_setup_failed'), 'error');
        } catch (onbErr: any) {
          showSocketToast(onbErr?.message || tr('ext.wallet_stripe_error'), 'error');
        }
      } else {
        showSocketToast(e?.message || tr('ext.wallet_stripe_error'), 'error');
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
          <Text style={[styles.emptyTitle, { color: t.textSub }]}>{tr('ext.wallet_no_transactions')}</Text>
          <Text style={[styles.emptySubtitle, { color: t.textMuted }]}>
            {tr('ext.wallet_no_tx_sub')}
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
        <View>
          <Text style={[styles.headerGreeting, { color: t.textMuted }]}>{tr('ext.wallet_available_balance')}</Text>
          <Text style={[styles.headerTitle, { color: t.text }]}>{tr('ext.wallet_earnings_title')}</Text>
        </View>
        <TouchableOpacity
          style={[styles.headerIconBtn, { backgroundColor: t.surface, borderColor: t.borderLight }]}
          onPress={onRefresh}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={tr('common.refresh')}
        >
          <Feather name="refresh-cw" size={18} color={t.text} />
        </TouchableOpacity>
      </View>

      {/* -- Hero solde -- */}
      <View style={[styles.hero, { backgroundColor: t.heroBg }]}>
        <Text style={[styles.heroLabel, { color: t.heroSub }]}>{tr('ext.wallet_available_balance')}</Text>
        <Text style={[styles.heroAmount, { color: t.heroText }]}>{fmtEur(fromCents(stripeData ? stripeData.available : balance))}</Text>

        {/* Sous-stats : en transit (pending Stripe, pas encore settle) */}
        <View style={styles.heroStats}>
          {(stripeData?.pending ?? 0) > 0 && (
            <View style={styles.heroStatItem}>
              <Feather name="clock" size={13} color={t.heroSub} />
              <Text style={[styles.heroStatText, { color: t.heroSubFaint }]}>{fmtEur(fromCents(stripeData!.pending))} {tr('ext.wallet_in_transit')}</Text>
            </View>
          )}
        </View>

        {/* Dernier virement (payout Stripe vers la banque) */}
        <View style={[styles.heroTotalRow, { borderTopColor: 'rgba(255,255,255,0.12)' }]}>
          <Text style={[styles.heroTotalLabel, { color: t.heroSub }]}>{tr('ext.wallet_last_payout')}</Text>
          {stripeData?.lastPayout ? (
            <Text style={[styles.heroTotalValue, { color: t.heroText }]}>
              {fmtEur(fromCents(stripeData.lastPayout.amount))}
              {stripeData.lastPayout.arrivalDate ? ` · ${fmtDate(new Date(stripeData.lastPayout.arrivalDate).toISOString())}` : ''}
            </Text>
          ) : (
            <Text style={[styles.heroTotalLabel, { color: t.heroSubFaint }]}>{tr('ext.wallet_no_payout')}</Text>
          )}
        </View>

        {(stripeData ? !stripeData.payoutsEnabled : !stripeReady) && (
          <View style={styles.payoutNotice}>
            <Feather name="info" size={14} color={t.heroSub} />
            <Text style={[styles.payoutNoticeText, { color: t.heroSubFaint }]}>{tr('wallet.configure_stripe')}</Text>
          </View>
        )}
      </View>

      {/* -- Bannière erreur solde -- */}
      {balanceError && (
        <TouchableOpacity
          style={[styles.errorBanner, { backgroundColor: COLORS.red + '15', borderColor: COLORS.red + '40' }]}
          onPress={onRefresh}
          activeOpacity={0.8}
        >
          <Feather name="alert-triangle" size={15} color={COLORS.red} />
          <Text style={[styles.errorBannerText, { color: t.text }]}>{tr('ext.wallet_balance_unavailable')}</Text>
          <Feather name="refresh-cw" size={14} color={t.textMuted} />
        </TouchableOpacity>
      )}

      {/* -- Stripe + Factures (côte à côte) -- */}
      <View style={styles.linkRow}>
        <TouchableOpacity
          style={[styles.linkCard, { backgroundColor: t.surface, borderColor: t.borderLight }]}
          onPress={handleOpenStripeDashboard}
          disabled={stripeLoading}
          activeOpacity={0.75}
          accessibilityRole="button"
        >
          {stripeLoading
            ? <ActivityIndicator size="small" color={t.accent} />
            : <>
                <Feather name="credit-card" size={18} color={t.accent} />
                <Text style={[styles.linkCardText, { color: t.text }]} numberOfLines={1}>
                  {stripeReady ? tr('ext.wallet_manage_payments') : tr('ext.wallet_setup_stripe')}
                </Text>
              </>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.linkCard, { backgroundColor: t.surface, borderColor: t.borderLight }]}
          onPress={() => router.push('/invoices')}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={tr('ext.wallet_my_invoices')}
        >
          <Feather name="file-text" size={18} color={t.accent} />
          <Text style={[styles.linkCardText, { color: t.text }]} numberOfLines={1}>{tr('ext.wallet_my_invoices')}</Text>
        </TouchableOpacity>
      </View>

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
                {tr(f.label)}
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
        contentContainerStyle={[styles.listContent, { paddingBottom: tabBarPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      />

      {/* -- Modale retrait -- */}
      <WithdrawModal
        visible={showWithdraw}
        balance={balance}
        onClose={() => setShowWithdraw(false)}
        onSuccess={handleWithdrawSuccess}
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
  headerGreeting: {
    fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 6,
  },
  headerTitle: { fontSize: 34, fontFamily: FONTS.bebas, letterSpacing: 0.5 },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },

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
  heroLabel: { fontSize: 10.5, fontFamily: FONTS.mono, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' },
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

  // Bouton retrait
  withdrawBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12,
    marginTop: 16, alignSelf: 'stretch',
  },
  withdrawBtnDisabled: { opacity: 0.4 },
  withdrawBtnText: { fontSize: 15, fontFamily: FONTS.sansMedium },

  // Bannière erreur
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1,
  },
  errorBannerText: { flex: 1, fontSize: 13, fontFamily: FONTS.sansMedium },

  // Stripe link
  stripeLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    marginHorizontal: 16, marginBottom: 8, paddingVertical: 10,
  },
  stripeLinkText: { fontSize: 13, fontFamily: FONTS.sansMedium },
  linkRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 8 },
  linkCard: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 11, paddingHorizontal: 10,
    borderRadius: 12, borderWidth: 1,
  },
  linkCardText: { fontSize: 13, fontFamily: FONTS.sansMedium, flexShrink: 1 },

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
    fontSize: 11, fontFamily: FONTS.mono, textTransform: 'uppercase',
    letterSpacing: 1.2, marginBottom: 10, marginTop: 8,
  },

  // Tx card
  txCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12,
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
