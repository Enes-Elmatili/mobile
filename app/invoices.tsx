// app/invoices.tsx — Mes Factures
// Liste scrollable de toutes les factures du client ou provider
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  FlatList, ActivityIndicator, RefreshControl, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '../lib/api';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/lib/auth/AuthContext';
import InvoiceSheet from '@/components/sheets/InvoiceSheet';
import type { Invoice } from '@/hooks/useInvoice';

const formatEuros = (n: number) =>
  n.toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-BE', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

export default function InvoicesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user } = useAuth();
  const isProvider = user?.roles?.includes('PROVIDER');

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const loadInvoices = useCallback(async () => {
    try {
      const result = await api.invoices.list();
      setInvoices(result?.data || []);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadInvoices(); }, [loadInvoices]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadInvoices();
  }, [loadInvoices]);

  // Monthly total
  const now = new Date();
  const monthTotal = invoices
    .filter(inv => {
      const d = new Date(inv.issuedAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, inv) => sum + (inv.amount || 0), 0);

  const renderItem = useCallback(({ item }: { item: Invoice }) => {
    const isPaid = item.status === 'PAID';
    const invoiceNum = item.number
      ? `#FIXED-${item.number.replace(/^\d{4}-/, '')}`
      : `#${String(item.id).slice(-5).toUpperCase()}`;

    return (
      <TouchableOpacity
        style={[s.card, { backgroundColor: theme.cardBg }]}
        onPress={() => setSelectedInvoice(item)}
        activeOpacity={0.75}
      >
        <View style={[s.iconWrap, { backgroundColor: theme.surface }]}>
          <Ionicons
            name={isPaid ? 'receipt' : 'receipt-outline'}
            size={20}
            color={theme.textSub}
          />
        </View>
        <View style={s.cardContent}>
          <Text style={[s.cardTitle, { color: theme.textAlt }]}>{invoiceNum}</Text>
          <Text style={[s.cardSub, { color: theme.textMuted }]}>
            {item.request?.serviceType || 'Service'} · {fmtDate(item.issuedAt)}
          </Text>
        </View>
        <View style={s.cardRight}>
          <Text style={[s.cardAmount, { color: theme.textAlt }]}>
            {formatEuros(item.amount)}
          </Text>
          <View style={[s.statusPill, {
            backgroundColor: isPaid
              ? theme.isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.06)'
              : theme.isDark ? 'rgba(255,165,0,0.15)' : 'rgba(255,165,0,0.06)',
          }]}>
            <Text style={[s.statusText, {
              color: isPaid ? '#22C55E' : '#F59E0B',
            }]}>
              {isPaid ? 'Payé' : 'En attente'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [theme]);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.textAlt }]}>Mes factures</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Monthly summary */}
      <View style={[s.summaryCard, { backgroundColor: theme.cardBg }]}>
        <View style={[s.summaryIconWrap, { backgroundColor: theme.surface }]}>
          <Ionicons name="receipt-outline" size={22} color={theme.textSub} />
        </View>
        <View style={s.summaryContent}>
          <Text style={[s.summaryLabel, { color: theme.textMuted }]}>
            {isProvider ? 'FACTURÉ CE MOIS' : 'TOTAL CE MOIS'}
          </Text>
          <Text style={[s.summaryValue, { color: theme.textAlt }]}>
            {formatEuros(monthTotal)}
          </Text>
        </View>
        <Text style={[s.summaryCount, { color: theme.textMuted }]}>
          {invoices.filter(inv => {
            const d = new Date(inv.issuedAt);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          }).length} facture{invoices.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.textMuted} />
        </View>
      ) : invoices.length === 0 ? (
        <View style={s.center}>
          <View style={[s.emptyIcon, { backgroundColor: theme.surface }]}>
            <Ionicons name="receipt-outline" size={28} color={theme.textMuted} />
          </View>
          <Text style={[s.emptyTitle, { color: theme.textAlt }]}>Aucune facture</Text>
          <Text style={[s.emptySub, { color: theme.textMuted }]}>
            Vos factures apparaîtront ici après vos missions.
          </Text>
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.textMuted} />
          }
          ItemSeparatorComponent={() => (
            <View style={[s.separator, { backgroundColor: theme.border }]} />
          )}
        />
      )}

      {/* Invoice Detail Sheet */}
      <InvoiceSheet
        invoice={selectedInvoice}
        isVisible={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        userRole={isProvider ? 'provider' : 'client'}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },

  summaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, marginTop: 16, marginBottom: 8,
    padding: 16, borderRadius: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  summaryIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryContent: { flex: 1 },
  summaryLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 3 },
  summaryValue: { fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  summaryCount: { fontSize: 12, fontWeight: '600' },

  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'], marginBottom: 2 },
  cardSub: { fontSize: 12, fontWeight: '500' },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  cardAmount: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700' },

  separator: { height: 0.5, marginLeft: 56 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
