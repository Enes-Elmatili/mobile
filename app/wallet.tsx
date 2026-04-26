// app/wallet.tsx — Portefeuille v2
// Palette monochrome · Retrait · Labels contextuels · Solde instantané
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  FlatList, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert, RefreshControl,
  StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../lib/api';
import { devError } from '@/lib/logger';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { formatEUR as fmtEur } from '@/lib/format';

// ─── Formatage ────────────────────────────────────────────────────────────────
// Le backend stocke les montants en centimes (entiers). On divise par 100 à l'affichage.
const fromCents = (n: number) => n / 100;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// ─── Extraction du libellé depuis la référence ────────────────────────────────
function parseTxLabel(type: string, reference?: string | null): string {
  if (!reference) return type === 'CREDIT' ? 'Crédit' : 'Débit';

  const ref = reference.toLowerCase();

  const missionMatch = reference.match(/request[_-](\d+)/i);
  if (missionMatch) return `Mission #${missionMatch[1]}`;

  if (ref.includes('withdraw') || ref.includes('retrait')) return 'Retrait bancaire';
  if (ref.includes('stripe_transfer')) return 'Virement mission';
  if (ref.includes('subscription') || ref.includes('abonnement')) return 'Abonnement';
  if (ref.includes('credit') && type === 'CREDIT') return 'Crédit manuel';
  if (ref.includes('debit') && type === 'DEBIT') return 'Débit manuel';

  // Formatage lisible de la référence brute
  return reference
    .replace(/stripe_transfer_/gi, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .slice(0, 36);
}

// ─── Modale de retrait ────────────────────────────────────────────────────────
interface WithdrawModalProps {
  visible: boolean;
  balance: number;
  onClose: () => void;
  onSuccess: () => void;
}

function WithdrawModal({ visible, balance, onClose, onSuccess }: WithdrawModalProps) {
  const theme = useAppTheme();
  const [amount, setAmount] = useState('');
  const [iban, setIban] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const amt = parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(amt) || amt <= 0) {
      Alert.alert('Montant invalide', 'Entrez un montant valide.');
      return;
    }
    const balanceEur = fromCents(balance);
    if (amt > balanceEur) {
      Alert.alert('Solde insuffisant', `Votre solde disponible est de ${fmtEur(balanceEur)}.`);
      return;
    }
    setLoading(true);
    try {
      // Le backend attend des centimes (entiers)
      await api.post('/wallet/withdraw', {
        amount: Math.round(amt * 100),
        method: 'BANK',
        destination: iban.trim() || undefined,
        note: note.trim() || undefined,
      });
      setAmount('');
      setIban('');
      setNote('');
      onSuccess();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible d\'effectuer le retrait.');
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
          <Text style={[wm.title, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>Retirer des fonds</Text>
          <Text style={[wm.subtitle, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Solde disponible : {fmtEur(fromCents(balance))}</Text>

          <Text style={[wm.label, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>Montant (€)</Text>
          <TextInput
            style={[wm.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textAlt, fontFamily: FONTS.sans }]}
            placeholder="Ex : 50,00"
            placeholderTextColor={theme.textMuted}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            returnKeyType="next"
          />

          <Text style={[wm.label, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>IBAN (optionnel)</Text>
          <TextInput
            style={[wm.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textAlt, fontFamily: FONTS.mono }]}
            placeholder="BE12 3456 7890 1234"
            placeholderTextColor={theme.textMuted}
            value={iban}
            onChangeText={setIban}
            autoCapitalize="characters"
            returnKeyType="next"
          />

          <Text style={[wm.label, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>Note (optionnelle)</Text>
          <TextInput
            style={[wm.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textAlt, fontFamily: FONTS.sans }]}
            placeholder="Référence virement..."
            placeholderTextColor={theme.textMuted}
            value={note}
            onChangeText={setNote}
            returnKeyType="done"
          />

          <Text style={[wm.notice, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
            Les retraits sont traités sous 2-3 jours ouvrés. Un administrateur validera votre demande.
          </Text>

          <TouchableOpacity
            style={[wm.btn, { backgroundColor: theme.accent }, loading && wm.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={theme.accentText} />
              : <Text style={[wm.btnText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>Confirmer le retrait</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={wm.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={[wm.cancelText, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>Annuler</Text>
          </TouchableOpacity>
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
  btn:        { borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  btnDisabled:{ opacity: 0.6 },
  btnText:    { fontSize: 16 },
  cancelBtn:  { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 15 },
});

// ─── Ligne de transaction ──────────────────────────────────────────────────────
function TxRow({ item }: { item: any }) {
  const theme = useAppTheme();
  const isCredit = item.type === 'CREDIT';
  const label    = parseTxLabel(item.type, item.reference);

  return (
    <View style={[tx.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      {/* Icône */}
      <View style={[tx.iconWrap, isCredit ? { backgroundColor: theme.isDark ? 'rgba(5,150,105,0.15)' : 'rgba(61,139,61,0.08)' } : { backgroundColor: theme.surface }]}>
        <Feather
          name={isCredit ? 'arrow-down' : 'arrow-up'}
          size={17}
          color={isCredit ? COLORS.green : theme.textAlt}
        />
      </View>

      {/* Infos */}
      <View style={tx.info}>
        <Text style={[tx.label, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>{label}</Text>
        <Text style={[tx.date, { color: theme.textMuted, fontFamily: FONTS.mono }]}>{fmtDate(item.createdAt)} · {fmtTime(item.createdAt)}</Text>
        {item.balanceAfter != null && (
          <Text style={[tx.balance, { color: theme.textVeryMuted, fontFamily: FONTS.mono }]}>Solde après : {fmtEur(fromCents(item.balanceAfter))}</Text>
        )}
      </View>

      {/* Montant */}
      <View style={tx.amountWrap}>
        <Text style={[tx.amount, { fontFamily: FONTS.monoMedium }, isCredit ? { color: COLORS.green } : { color: theme.textAlt }]}>
          {isCredit ? '+' : '-'}{fmtEur(fromCents(Math.abs(item.amount)))}
        </Text>
        <View style={[tx.badge, isCredit ? { backgroundColor: theme.isDark ? 'rgba(5,150,105,0.15)' : 'rgba(61,139,61,0.08)' } : { backgroundColor: theme.surface }]}>
          <Text style={[tx.badgeText, { fontFamily: FONTS.sansMedium }, isCredit ? { color: COLORS.green } : { color: theme.textMuted }]}>
            {isCredit ? 'Reçu' : 'Débité'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const tx = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10,
    borderWidth: 1,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  info:       { flex: 1 },
  label:      { fontSize: 14, marginBottom: 2 },
  date:       { fontSize: 11 },
  balance:    { fontSize: 11, marginTop: 2 },
  amountWrap: { alignItems: 'flex-end', gap: 5 },
  amount:     { fontSize: 15 },
  badge:      { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:  { fontSize: 10 },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
export default function Wallet() {
  const router = useRouter();
  const theme = useAppTheme();
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [balance,      setBalance]      = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const load = useCallback(async () => {
    try {
      const [balData, txData] = await Promise.all([
        api.wallet.balance(),
        api.wallet.transactions(50),
      ]);
      setBalance(balData?.balance ?? 0);
      const txs = Array.isArray(txData) ? txData : (txData?.transactions ?? txData?.data ?? []);
      setTransactions(txs);
    } catch (e) {
      devError('[Wallet] load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleWithdrawSuccess = () => {
    setShowWithdraw(false);
    Alert.alert(
      'Demande envoyée',
      'Votre demande de retrait a bien été enregistrée. Elle sera traitée sous 2-3 jours ouvrés.',
      [{ text: 'OK', onPress: load }]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.loadingContainer, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: theme.bg }]}>
        <TouchableOpacity onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="chevron-left" size={22} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>Portefeuille</Text>
        <TouchableOpacity onPress={onRefresh} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="refresh-cw" size={20} color={theme.textAlt} />
        </TouchableOpacity>
      </View>

      {/* ── Solde héro ── */}
      <View style={[s.hero, { backgroundColor: theme.heroBg, shadowOpacity: theme.shadowOpacity }]}>
        <Text style={[s.heroLabel, { color: theme.heroSub, fontFamily: FONTS.sansMedium }]}>Solde disponible</Text>
        <Text style={[s.heroAmount, { color: theme.heroText, fontFamily: FONTS.bebas }]}>{fmtEur(fromCents(balance))}</Text>

        {/* Bouton retrait — call to action principal */}
        <TouchableOpacity
          style={[s.withdrawBtn, { backgroundColor: theme.isDark ? theme.bg : '#FFF' }, fromCents(balance) <= 0 && s.withdrawBtnDisabled]}
          onPress={() => setShowWithdraw(true)}
          disabled={fromCents(balance) <= 0}
          activeOpacity={0.85}
        >
          <Feather name="upload" size={18} color={theme.textAlt} />
          <Text style={[s.withdrawBtnText, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>Retirer les fonds</Text>
        </TouchableOpacity>
      </View>

      {/* ── Transactions ── */}
      <FlatList
        data={transactions}
        keyExtractor={(item, i) => item.id ?? String(i)}
        renderItem={({ item }) => <TxRow item={item} />}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
        ListHeaderComponent={
          <Text style={[s.listTitle, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>
            Transactions {transactions.length > 0 ? `(${transactions.length})` : ''}
          </Text>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Feather name="credit-card" size={52} color={theme.textDisabled} />
            <Text style={[s.emptyTitle, { color: theme.textSub, fontFamily: FONTS.sansMedium }]}>Aucune transaction</Text>
            <Text style={[s.emptySubtitle, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Vos gains apparaitront ici une fois vos missions terminées.</Text>
          </View>
        }
      />

      {/* ── Modale retrait ── */}
      <WithdrawModal
        visible={showWithdraw}
        balance={balance}
        onClose={() => setShowWithdraw(false)}
        onSuccess={handleWithdrawSuccess}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:             { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17 },

  // Héro balance
  hero: {
    marginHorizontal: 16, borderRadius: 24, paddingVertical: 28, paddingHorizontal: 24,
    marginBottom: 20, alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 10 },
    }),
  },
  heroLabel:  { fontSize: 13, letterSpacing: 0.5, marginBottom: 8 },
  heroAmount: { fontSize: 52, letterSpacing: -1.5, marginBottom: 22 },

  // Bouton retrait
  withdrawBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14,
    paddingHorizontal: 22, paddingVertical: 13,
  },
  withdrawBtnDisabled: { opacity: 0.4 },
  withdrawBtnText:     { fontSize: 15 },

  // Liste
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  listTitle:   { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 14 },

  // Vide
  empty:         { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle:    { fontSize: 17 },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 30 },
});
