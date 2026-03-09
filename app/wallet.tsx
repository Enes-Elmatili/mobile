// app/wallet.tsx — Portefeuille v2
// Palette monochrome · Retrait · Labels contextuels · Solde instantané
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  FlatList, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert, RefreshControl,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../lib/api';
import { devError } from '@/lib/logger';

// ─── Formatage ────────────────────────────────────────────────────────────────
// Le backend stocke les montants en centimes (entiers). On divise par 100 à l'affichage.
const fromCents = (n: number) => n / 100;

const fmtEur = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

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
        <View style={wm.sheet}>
          <View style={wm.handle} />
          <Text style={wm.title}>Retirer des fonds</Text>
          <Text style={wm.subtitle}>Solde disponible : {fmtEur(fromCents(balance))}</Text>

          <Text style={wm.label}>Montant (€)</Text>
          <TextInput
            style={wm.input}
            placeholder="Ex : 50,00"
            placeholderTextColor="#ADADAD"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            returnKeyType="next"
          />

          <Text style={wm.label}>IBAN (optionnel)</Text>
          <TextInput
            style={wm.input}
            placeholder="BE12 3456 7890 1234"
            placeholderTextColor="#ADADAD"
            value={iban}
            onChangeText={setIban}
            autoCapitalize="characters"
            returnKeyType="next"
          />

          <Text style={wm.label}>Note (optionnelle)</Text>
          <TextInput
            style={wm.input}
            placeholder="Référence virement…"
            placeholderTextColor="#ADADAD"
            value={note}
            onChangeText={setNote}
            returnKeyType="done"
          />

          <Text style={wm.notice}>
            Les retraits sont traités sous 2–3 jours ouvrés. Un administrateur validera votre demande.
          </Text>

          <TouchableOpacity
            style={[wm.btn, loading && wm.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <Text style={wm.btnText}>Confirmer le retrait</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={wm.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={wm.cancelText}>Annuler</Text>
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
    backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },
  handle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 20 },
  title:      { fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  subtitle:   { fontSize: 14, color: '#ADADAD', marginBottom: 22 },
  label:      { fontSize: 11, fontWeight: '700', color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 7 },
  input: {
    backgroundColor: '#F5F5F5', borderRadius: 14, height: 50, paddingHorizontal: 16,
    fontSize: 15, color: '#1A1A1A', marginBottom: 14,
    borderWidth: 1, borderColor: '#EBEBEB',
  },
  notice:     { fontSize: 12, color: '#ADADAD', lineHeight: 18, marginBottom: 20, marginTop: 4 },
  btn:        { backgroundColor: '#1A1A1A', borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  btnDisabled:{ opacity: 0.6 },
  btnText:    { fontSize: 16, fontWeight: '700', color: '#FFF' },
  cancelBtn:  { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#ADADAD' },
});

// ─── Ligne de transaction ──────────────────────────────────────────────────────
function TxRow({ item }: { item: any }) {
  const isCredit = item.type === 'CREDIT';
  const label    = parseTxLabel(item.type, item.reference);

  return (
    <View style={tx.card}>
      {/* Icône */}
      <View style={[tx.iconWrap, isCredit ? tx.iconCredit : tx.iconDebit]}>
        <Ionicons
          name={isCredit ? 'arrow-down-outline' : 'arrow-up-outline'}
          size={17}
          color={isCredit ? '#059669' : '#1A1A1A'}
        />
      </View>

      {/* Infos */}
      <View style={tx.info}>
        <Text style={tx.label} numberOfLines={1}>{label}</Text>
        <Text style={tx.date}>{fmtDate(item.createdAt)} · {fmtTime(item.createdAt)}</Text>
        {item.balanceAfter != null && (
          <Text style={tx.balance}>Solde après : {fmtEur(fromCents(item.balanceAfter))}</Text>
        )}
      </View>

      {/* Montant */}
      <View style={tx.amountWrap}>
        <Text style={[tx.amount, isCredit ? tx.amountCredit : tx.amountDebit]}>
          {isCredit ? '+' : '−'}{fmtEur(fromCents(Math.abs(item.amount)))}
        </Text>
        <View style={[tx.badge, isCredit ? tx.badgeCredit : tx.badgeDebit]}>
          <Text style={[tx.badgeText, isCredit ? tx.badgeTextCredit : tx.badgeTextDebit]}>
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
    backgroundColor: '#FFF', borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  iconCredit: { backgroundColor: '#ECFDF5' },
  iconDebit:  { backgroundColor: '#F5F5F5' },
  info:       { flex: 1 },
  label:      { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 },
  date:       { fontSize: 11, color: '#ADADAD', fontWeight: '500' },
  balance:    { fontSize: 11, color: '#CACBCE', fontWeight: '500', marginTop: 2 },
  amountWrap: { alignItems: 'flex-end', gap: 5 },
  amount:     { fontSize: 15, fontWeight: '800' },
  amountCredit: { color: '#059669' },
  amountDebit:  { color: '#1A1A1A' },
  badge:      { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeCredit: { backgroundColor: '#ECFDF5' },
  badgeDebit:  { backgroundColor: '#F5F5F5' },
  badgeText:  { fontSize: 10, fontWeight: '700' },
  badgeTextCredit: { color: '#059669' },
  badgeTextDebit:  { color: '#888' },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
export default function Wallet() {
  const router = useRouter();
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
      'Votre demande de retrait a bien été enregistrée. Elle sera traitée sous 2–3 jours ouvrés.',
      [{ text: 'OK', onPress: load }]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Portefeuille</Text>
        <TouchableOpacity onPress={onRefresh} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="refresh-outline" size={20} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {/* ── Solde héro ── */}
      <View style={s.hero}>
        <Text style={s.heroLabel}>Solde disponible</Text>
        <Text style={s.heroAmount}>{fmtEur(fromCents(balance))}</Text>

        {/* Bouton retrait — call to action principal */}
        <TouchableOpacity
          style={[s.withdrawBtn, fromCents(balance) <= 0 && s.withdrawBtnDisabled]}
          onPress={() => setShowWithdraw(true)}
          disabled={fromCents(balance) <= 0}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-up-circle-outline" size={18} color="#1A1A1A" />
          <Text style={s.withdrawBtnText}>Retirer les fonds</Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A1A1A" />
        }
        ListHeaderComponent={
          <Text style={s.listTitle}>
            Transactions {transactions.length > 0 ? `(${transactions.length})` : ''}
          </Text>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="wallet-outline" size={52} color="#E0E0E0" />
            <Text style={s.emptyTitle}>Aucune transaction</Text>
            <Text style={s.emptySubtitle}>Vos gains apparaîtront ici une fois vos missions terminées.</Text>
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
  root:             { flex: 1, backgroundColor: '#F5F5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#F5F5F5',
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },

  // Héro balance
  hero: {
    backgroundColor: '#1A1A1A',
    marginHorizontal: 16, borderRadius: 24, paddingVertical: 28, paddingHorizontal: 24,
    marginBottom: 20, alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 10 },
    }),
  },
  heroLabel:  { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, marginBottom: 8 },
  heroAmount: { fontSize: 48, fontWeight: '900', color: '#FFF', letterSpacing: -1.5, marginBottom: 22 },

  // Bouton retrait
  withdrawBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF', borderRadius: 14,
    paddingHorizontal: 22, paddingVertical: 13,
  },
  withdrawBtnDisabled: { opacity: 0.4 },
  withdrawBtnText:     { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },

  // Liste
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  listTitle:   { fontSize: 13, fontWeight: '700', color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 14 },

  // Vide
  empty:         { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle:    { fontSize: 17, fontWeight: '700', color: '#888' },
  emptySubtitle: { fontSize: 13, color: '#ADADAD', textAlign: 'center', lineHeight: 19, paddingHorizontal: 30 },
});
