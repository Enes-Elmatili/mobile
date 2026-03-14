// app/(tabs)/documents.tsx — Client Document Hub (v3 — Factures only + dark mode)
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useAppTheme } from '@/hooks/use-app-theme';
import InvoiceSheet from '../../components/sheets/InvoiceSheet';
import type { Invoice } from '@/hooks/useInvoice';

// ============================================================================
// UTILS
// ============================================================================

const formatEuros = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

// ============================================================================
// INVOICE CARD
// ============================================================================

function InvoiceCard({
  invoice, onPress, isLast, theme,
}: {
  invoice: Invoice; onPress: () => void; isLast: boolean;
  theme: ReturnType<typeof useAppTheme>;
}) {
  const isPaid = invoice.status === 'PAID';
  const number = invoice.number
    ? `#${invoice.number}`
    : `#${String(invoice.id).slice(-5).toUpperCase()}`;
  const date = new Date(invoice.issuedAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const service = (invoice as any).request?.serviceType || 'Service';

  return (
    <>
      <TouchableOpacity style={ic.row} onPress={onPress} activeOpacity={0.7}>
        <View style={[ic.iconBox, { backgroundColor: theme.surface }]}>
          <Ionicons name="document-text-outline" size={18} color={theme.textSub} />
        </View>
        <View style={ic.content}>
          <Text style={[ic.label, { color: theme.textAlt }]} numberOfLines={1}>{service}</Text>
          <Text style={[ic.ref, { color: theme.textMuted }]}>{number} · {date}</Text>
          <View style={[ic.statusBadge, { backgroundColor: theme.surface }]}>
            <Ionicons
              name={isPaid ? 'checkmark-circle' : 'time-outline'}
              size={10}
              color={isPaid ? '#22C55E' : '#F59E0B'}
            />
            <Text style={[ic.statusText, { color: isPaid ? '#22C55E' : '#F59E0B' }]}>
              {isPaid ? 'Payée' : 'En attente'}
            </Text>
          </View>
        </View>
        <View style={ic.right}>
          <Text style={[ic.price, { color: theme.textAlt }]}>{formatEuros(invoice.amount)}</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textDisabled} style={{ marginTop: 4 }} />
        </View>
      </TouchableOpacity>
      {!isLast && <View style={[ic.divider, { backgroundColor: theme.border }]} />}
    </>
  );
}

const ic = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 14, paddingHorizontal: 16, gap: 12,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
  },
  content: { flex: 1, gap: 3 },
  label: { fontSize: 14, fontWeight: '700' },
  ref: { fontSize: 12, fontWeight: '500' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
    alignSelf: 'flex-start', marginTop: 2,
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  right: { alignItems: 'flex-end', flexShrink: 0, gap: 2 },
  price: { fontSize: 15, fontWeight: '800' },
  divider: { height: 1, marginLeft: 68 },
});

// ============================================================================
// SHARED SUB-COMPONENTS
// ============================================================================

function SectionHeader({ icon, label, count, theme }: { icon: string; label: string; count?: number; theme: ReturnType<typeof useAppTheme> }) {
  return (
    <View style={sh.wrap}>
      <Ionicons name={icon as any} size={15} color={theme.textMuted} />
      <Text style={[sh.label, { color: theme.textMuted }]}>{label}</Text>
      {count != null && (
        <View style={[sh.badge, { backgroundColor: theme.surface }]}>
          <Text style={[sh.badgeText, { color: theme.textSub }]}>{count}</Text>
        </View>
      )}
    </View>
  );
}

const sh = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 2 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  badge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontSize: 10, fontWeight: '700' },
});

function EmptyCard({ icon, text, sub, theme }: { icon: string; text: string; sub?: string; theme: ReturnType<typeof useAppTheme> }) {
  return (
    <View style={ec.wrap}>
      <View style={[ec.iconWrap, { backgroundColor: theme.surface }]}>
        <Ionicons name={icon as any} size={26} color={theme.textDisabled} />
      </View>
      <Text style={[ec.text, { color: theme.textAlt }]}>{text}</Text>
      {sub && <Text style={[ec.sub, { color: theme.textMuted }]}>{sub}</Text>}
    </View>
  );
}

const ec = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 14, fontWeight: '600' },
  sub: { fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
});

function Card({ children, theme }: { children: React.ReactNode; theme: ReturnType<typeof useAppTheme> }) {
  return <View style={[cw.card, { backgroundColor: theme.cardBg }]}>{children}</View>;
}

const cw = StyleSheet.create({
  card: {
    borderRadius: 18, overflow: 'hidden', marginBottom: 0,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 2 },
    }),
  },
});

function Pagination({
  page, total, onPrev, onNext, theme,
}: {
  page: number; total: number; onPrev: () => void; onNext: () => void; theme: ReturnType<typeof useAppTheme>;
}) {
  if (total <= 1) return null;
  return (
    <View style={[pg.wrap, { borderTopColor: theme.border }]}>
      <TouchableOpacity
        style={[pg.btn, { backgroundColor: theme.surface }, page === 1 && pg.btnDisabled]}
        onPress={onPrev} disabled={page === 1} activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={18} color={page === 1 ? theme.textMuted : theme.textAlt} />
      </TouchableOpacity>
      <Text style={[pg.text, { color: theme.textSub }]}>Page {page} sur {total}</Text>
      <TouchableOpacity
        style={[pg.btn, { backgroundColor: theme.surface }, page === total && pg.btnDisabled]}
        onPress={onNext} disabled={page === total} activeOpacity={0.7}
      >
        <Ionicons name="chevron-forward" size={18} color={page === total ? theme.textMuted : theme.textAlt} />
      </TouchableOpacity>
    </View>
  );
}

const pg = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1,
  },
  btn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.4 },
  text: { fontSize: 13, fontWeight: '600' },
});

// ============================================================================
// MAIN SCREEN
// ============================================================================

const PER_PAGE = 5;

export default function Documents() {
  const theme = useAppTheme();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicePage, setInvoicePage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInvoices = useCallback(async () => {
    try {
      const res = await api.invoices.list();
      const data = res.data || res;
      setInvoices(Array.isArray(data) ? data : []);
    } catch (e) {
      devError('Documents load error:', e);
      Alert.alert('Erreur', 'Impossible de charger les factures.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadInvoices(); }, []);

  const onRefresh = () => { setRefreshing(true); loadInvoices(); };

  // Pagination locale (max 5 par page)
  const totalPages = Math.max(1, Math.ceil(invoices.length / PER_PAGE));
  const pagedInvoices = invoices.slice((invoicePage - 1) * PER_PAGE, invoicePage * PER_PAGE);

  if (loading) {
    return (
      <SafeAreaView style={[s.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.textAlt} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
        <View>
          <Text style={[s.headerTitle, { color: theme.textAlt }]}>Documents</Text>
          <Text style={[s.headerSub, { color: theme.textMuted }]}>Vos factures</Text>
        </View>
        <TouchableOpacity
          style={[s.helpBtn, { backgroundColor: theme.surface }]}
          activeOpacity={0.7}
          onPress={() => {/* support */}}
        >
          <Ionicons name="help-circle-outline" size={20} color={theme.textAlt} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.textAlt} />}
      >

        {/* ══ FACTURES ══ */}
        <View style={s.section}>
          <SectionHeader
            icon="document-text-outline"
            label="Factures"
            count={invoices.length}
            theme={theme}
          />
          <Card theme={theme}>
            {invoices.length === 0 ? (
              <EmptyCard
                icon="document-text-outline"
                text="Aucune facture"
                sub="Vos factures apparaîtront ici après chaque service terminé."
                theme={theme}
              />
            ) : (
              <>
                {pagedInvoices.map((inv, i) => (
                  <InvoiceCard
                    key={inv.id}
                    invoice={inv}
                    onPress={() => setSelectedInvoice(inv)}
                    isLast={i === pagedInvoices.length - 1}
                    theme={theme}
                  />
                ))}
                <Pagination
                  page={invoicePage}
                  total={totalPages}
                  onPrev={() => setInvoicePage(p => Math.max(1, p - 1))}
                  onNext={() => setInvoicePage(p => Math.min(totalPages, p + 1))}
                  theme={theme}
                />
              </>
            )}
          </Card>
        </View>

        {/* ══ ASSISTANCE ══ */}
        <View style={s.section}>
          <SectionHeader icon="shield-checkmark-outline" label="Assistance" theme={theme} />
          <Card theme={theme}>
            <TouchableOpacity style={s.supportRow} activeOpacity={0.7}>
              <View style={[s.supportIcon, { backgroundColor: theme.surface }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.textSub} />
              </View>
              <View style={s.supportContent}>
                <Text style={[s.supportLabel, { color: theme.textAlt }]}>Un problème avec une facture ?</Text>
                <Text style={[s.supportSub, { color: theme.textMuted }]}>Contactez notre support client</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          </Card>
        </View>

      </ScrollView>

      {/* BottomSheet facture */}
      <InvoiceSheet
        invoice={selectedInvoice}
        isVisible={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        userRole="client"
      />
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 26, fontWeight: '800' },
  headerSub: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  helpBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48 },
  section: { marginBottom: 20 },

  supportRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 16,
  },
  supportIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  supportContent: { flex: 1 },
  supportLabel: { fontSize: 14, fontWeight: '600' },
  supportSub: { fontSize: 12, marginTop: 1 },
});