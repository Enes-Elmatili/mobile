// app/invoices.tsx — Mes Factures
// Liste scrollable de toutes les factures du client ou provider
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, RefreshControl, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { useAuth } from '@/lib/auth/AuthContext';
import InvoiceSheet from '@/components/sheets/InvoiceSheet';
import type { Invoice } from '@/hooks/useInvoice';
import { formatEUR as formatEuros } from '@/lib/format';

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  });

export default function InvoicesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isProvider = user?.roles?.includes('PROVIDER');

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const loadInvoices = useCallback(async () => {
    try {
      const result = await api.invoices.list();
      setInvoices(result?.data || []);
      setLoadError(false);
    } catch {
      // Pas d'état vide trompeur (« aucune facture ») sur une panne réseau.
      setInvoices([]);
      setLoadError(true);
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
  const monthlyCount = invoices.filter(inv => {
    const d = new Date(inv.issuedAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

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
          <Feather
            name="file-text"
            size={20}
            color={theme.textSub}
          />
        </View>
        <View style={s.cardContent}>
          <Text style={[s.cardTitle, { color: theme.textAlt, fontFamily: FONTS.mono }]} numberOfLines={1}>{invoiceNum}</Text>
          <Text style={[s.cardSub, { color: theme.textMuted, fontFamily: FONTS.sans }]} numberOfLines={1}>
            {item.request?.serviceType || t('common.service')} · {fmtDate(item.issuedAt)}
          </Text>
        </View>
        <View style={s.cardRight}>
          <Text style={[s.cardAmount, { color: theme.textAlt, fontFamily: FONTS.monoMedium }]} numberOfLines={1}>
            {formatEuros(item.amount)}
          </Text>
          <View style={[s.statusPill, {
            backgroundColor: isPaid
              ? theme.isDark ? 'rgba(21,193,110,0.15)' : 'rgba(21,193,110,0.06)'
              : theme.isDark ? 'rgba(255,165,0,0.15)' : 'rgba(255,165,0,0.06)',
          }]}>
            <Text style={[s.statusText, {
              color: isPaid ? theme.greenText : COLORS.amber,
              fontFamily: FONTS.sansMedium,
            }]}>
              {isPaid ? t('ext.invoice_paid') : t('ext.invoice_pending')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [theme, t]);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }} style={[s.backBtn, { backgroundColor: theme.surface, borderColor: theme.borderLight }]} activeOpacity={0.7}>
          <Feather name="arrow-left" size={18} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.textAlt, fontFamily: FONTS.bebas, letterSpacing: 0.5 }]}>{t('ext.wallet_my_invoices')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Monthly summary */}
      <View style={[s.summaryCard, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}>
        <View style={[s.summaryIconWrap, { backgroundColor: theme.surface }]}>
          <Feather name="file-text" size={22} color={theme.textSub} />
        </View>
        <View style={s.summaryContent}>
          <Text style={[s.summaryLabel, { color: theme.textMuted, fontFamily: FONTS.mono }]}>
            {isProvider ? t('ext.invoice_billed_this_month') : t('ext.invoice_total_this_month')}
          </Text>
          <Text style={[s.summaryValue, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>
            {formatEuros(monthTotal)}
          </Text>
        </View>
        <Text style={[s.summaryCount, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>
          {monthlyCount} {monthlyCount === 1 ? t('ext.invoice_word_singular') : t('ext.invoice_word_plural')}
        </Text>
      </View>

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.textMuted} />
        </View>
      ) : invoices.length === 0 ? (
        loadError ? (
          <View style={s.center}>
            <View style={[s.emptyIcon, { backgroundColor: theme.surface }]}>
              <Feather name="wifi-off" size={28} color={theme.textMuted} />
            </View>
            <Text style={[s.emptyTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{t('ext.invoice_load_failed')}</Text>
            <Text style={[s.emptySub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
              {t('ext.invoice_check_connection')}
            </Text>
            <TouchableOpacity
              style={[s.retryBtn, { backgroundColor: theme.accent }]}
              onPress={() => { setLoading(true); loadInvoices(); }}
              activeOpacity={0.85}
            >
              <Feather name="refresh-cw" size={14} color={theme.accentText} />
              <Text style={[s.retryBtnText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.center}>
            <View style={[s.emptyIcon, { backgroundColor: theme.surface }]}>
              <Feather name="file-text" size={28} color={theme.textMuted} />
            </View>
            <Text style={[s.emptyTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{t('ext.invoice_empty_title')}</Text>
            <Text style={[s.emptySub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
              {t('ext.invoice_empty')}
            </Text>
          </View>
        )
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
  backBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, letterSpacing: -0.3 },

  summaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, marginTop: 16, marginBottom: 8,
    padding: 16, borderRadius: 18,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  summaryIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryContent: { flex: 1 },
  summaryLabel: { fontSize: 10, letterSpacing: 0.8, marginBottom: 3 },
  summaryValue: { fontSize: 22, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  summaryCount: { fontSize: 12 },

  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  cardContent: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 14, fontVariant: ['tabular-nums'], marginBottom: 2 },
  cardSub: { fontSize: 12 },
  cardRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0, marginLeft: 8 },
  cardAmount: { fontSize: 15, fontVariant: ['tabular-nums'] },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10 },

  separator: { height: 0.5, marginLeft: 56 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 20, paddingVertical: 11, borderRadius: 100, marginTop: 6,
  },
  retryBtnText: { fontSize: 14 },
});
