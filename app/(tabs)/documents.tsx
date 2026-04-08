// app/(tabs)/documents.tsx — Client Documents (Glow Up v2)
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { InteractionManager } from 'react-native';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import InvoiceSheet from '../../components/sheets/InvoiceSheet';
import QuoteSheet from '../../components/sheets/QuoteSheet';
import type { Invoice } from '@/hooks/useInvoice';

const fmtEur = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtEurCents = (cents: number) => (cents / 100).toFixed(2);

type Tab = 'factures' | 'devis' | 'planifiees';
type Filter = 'all' | 'paid' | 'pending';

interface QuoteRequest {
  id: string;
  title?: string;
  serviceType?: string;
  status: string;
  calloutFee?: number;
  category?: { name: string };
  subcategory?: { name: string };
  createdAt: string;
}

interface ScheduledRequest {
  id: string;
  title?: string;
  serviceType?: string;
  status: string;
  address?: string;
  price?: number;
  pricingMode?: string | null;
  calloutFee?: number;
  preferredTimeStart: string;
  category?: { name: string; icon?: string };
  subcategory?: { name: string };
  createdAt: string;
}

// ── Summary Card ──
function SummaryCard({ icon, value, label, dark, theme }: {
  icon: string; value: string; label: string; dark?: boolean;
  theme: ReturnType<typeof useAppTheme>;
}) {
  const bg = dark ? '#0A0A0A' : theme.cardBg;
  const border = dark ? 'transparent' : theme.borderLight;
  const iconBg = dark ? 'rgba(255,255,255,0.08)' : theme.surface;
  const iconColor = dark ? 'rgba(255,255,255,0.6)' : theme.textSub;
  const valColor = dark ? '#FFFFFF' : theme.text;
  const labelColor = dark ? 'rgba(255,255,255,0.3)' : theme.textMuted;

  return (
    <View style={[sc.card, { backgroundColor: bg, borderColor: border }]}>
      <View style={[sc.icon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={13} color={iconColor} />
      </View>
      <Text style={[sc.value, { color: valColor }]}>{value}</Text>
      <Text style={[sc.label, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

const sc = StyleSheet.create({
  card: {
    flex: 1, borderRadius: 16, padding: 14, borderWidth: 1.5, gap: 5,
  },
  icon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  value: { fontFamily: FONTS.bebas, fontSize: 22, letterSpacing: 0.5, lineHeight: 22 },
  label: {
    fontFamily: FONTS.sansMedium, fontSize: 9, letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});

// ── Invoice Card (redesigned) ──
function InvoiceCard({ invoice, onPress, theme }: {
  invoice: Invoice; onPress: () => void;
  theme: ReturnType<typeof useAppTheme>;
}) {
  const status = invoice.status?.toUpperCase();
  const isPaid = status === 'PAID';
  const isRefunded = status === 'REFUNDED';
  const barColor = isPaid ? '#3D8B3D' : isRefunded ? '#888' : '#E8783A';
  const iconBg = isPaid ? 'rgba(61,139,61,0.08)' : isRefunded ? 'rgba(0,0,0,0.04)' : 'rgba(232,120,58,0.08)';
  const iconColor = isPaid ? '#3D8B3D' : isRefunded ? '#999' : '#E8783A';
  const pillBg = isPaid ? 'rgba(61,139,61,0.1)' : isRefunded ? theme.surface : 'rgba(232,120,58,0.1)';
  const pillColor = isPaid ? '#3D8B3D' : isRefunded ? theme.textMuted : '#E8783A';
  const pillLabel = isPaid ? 'Réglée' : isRefunded ? 'Remboursé' : 'En attente';
  const iconName = isPaid ? 'checkmark-circle-outline' : isRefunded ? 'refresh-outline' : 'time-outline';

  const number = invoice.number ? `#${invoice.number}` : `#INV-${String(invoice.id).slice(-4).toUpperCase()}`;
  const date = new Date(invoice.issuedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const service = (invoice as any).request?.serviceType || 'Service';

  return (
    <TouchableOpacity style={[iv.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]} onPress={onPress} activeOpacity={0.85}>
      <View style={[iv.bar, { backgroundColor: barColor }]} />
      <View style={[iv.icon, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName as any} size={16} color={iconColor} />
      </View>
      <View style={iv.body}>
        <Text style={[iv.name, { color: theme.text }]} numberOfLines={1}>{service}</Text>
        <Text style={[iv.meta, { color: theme.textMuted }]}>{date} · {number}</Text>
      </View>
      <View style={iv.right}>
        <Text style={[iv.amount, { color: theme.text }]}>{fmtEur(invoice.amount)}</Text>
        <View style={[iv.pill, { backgroundColor: pillBg }]}>
          <Text style={[iv.pillText, { color: pillColor }]}>{pillLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const iv = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 18, padding: 15, paddingLeft: 0,
    borderWidth: 1.5, overflow: 'hidden', position: 'relative',
  },
  bar: {
    position: 'absolute', left: 0, top: '16%', bottom: '16%', width: 3,
    borderTopRightRadius: 2, borderBottomRightRadius: 2,
  },
  icon: {
    width: 40, height: 40, borderRadius: 12, marginLeft: 16,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  body: { flex: 1 },
  name: { fontSize: 13, fontFamily: FONTS.sansMedium, marginBottom: 3 },
  meta: { fontSize: 11, fontFamily: FONTS.sans },
  right: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  amount: { fontFamily: FONTS.bebas, fontSize: 17, letterSpacing: 0.4, lineHeight: 17 },
  pill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 9, fontFamily: FONTS.sansMedium, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
});

// ── Main Screen ──
export default function Documents() {
  const theme = useAppTheme();
  const router = useRouter();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [scheduledRequests, setScheduledRequests] = useState<ScheduledRequest[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<QuoteRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [activeTab, setActiveTab] = useState<Tab>('factures');

  const QUOTE_STATUSES = ['QUOTE_SENT', 'QUOTE_ACCEPTED', 'QUOTE_PENDING'];
  const SCHEDULED_HIDDEN_STATUSES = ['CANCELLED', 'QUOTE_REFUSED', 'QUOTE_EXPIRED', 'DONE', 'REFUNDED'];

  const load = useCallback(async () => {
    try {
      const [invRes, reqRes] = await Promise.all([
        api.invoices.list(),
        api.requests.list(),
      ]);
      const invData = invRes?.data || invRes;
      setInvoices(Array.isArray(invData) ? invData : []);

      const reqData: any[] = reqRes?.data || reqRes || [];
      setQuoteRequests(
        reqData.filter((r: any) => {
          const st = r.status?.toUpperCase();
          if (!QUOTE_STATUSES.includes(st)) return false;
          // QUOTE_PENDING sans calloutFee = pas encore payé → ne pas afficher
          if (st === 'QUOTE_PENDING' && !(r.calloutFee > 0)) return false;
          return true;
        })
      );

      // Demandes planifiées : preferredTimeStart dans le futur, pas annulées/terminées
      const now = Date.now();
      setScheduledRequests(
        reqData
          .filter((r: any) => {
            const st = r.status?.toUpperCase();
            if (SCHEDULED_HIDDEN_STATUSES.includes(st)) return false;
            if (!r.preferredTimeStart) return false;
            return new Date(r.preferredTimeStart).getTime() > now;
          })
          .sort((a: any, b: any) =>
            new Date(a.preferredTimeStart).getTime() - new Date(b.preferredTimeStart).getTime()
          )
      );
    } catch (e) {
      devError('Documents load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const lastFetchRef = useRef(0);
  useFocusEffect(useCallback(() => {
    const now = Date.now();
    if (now - lastFetchRef.current > 60_000) { // 60s — invoices rarely change
      lastFetchRef.current = now;
      InteractionManager.runAfterInteractions(() => load());
    }
  }, [load]));
  const onRefresh = () => { lastFetchRef.current = 0; setRefreshing(true); load(); };

  // Stats
  const totalCount = invoices.length;
  const totalEur = useMemo(() => invoices.reduce((s, i) => s + (i.amount || 0), 0), [invoices]);
  const paidCount = useMemo(() => invoices.filter(i => i.status === 'PAID').length, [invoices]);

  // Filter
  const filtered = useMemo(() => {
    if (filter === 'paid') return invoices.filter(i => i.status === 'PAID');
    if (filter === 'pending') return invoices.filter(i => i.status === 'PENDING');
    return invoices;
  }, [invoices, filter]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Toutes' },
    { key: 'paid', label: 'Réglées' },
    { key: 'pending', label: 'En attente' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={[s.center, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.headerTitle, { color: theme.text }]}>DOCUMENTS</Text>
          <Text style={[s.headerSub, { color: theme.textMuted }]}>
            {activeTab === 'factures' ? 'Factures et reçus'
              : activeTab === 'devis' ? 'Devis et estimations'
              : 'Demandes planifiées'}
          </Text>
        </View>
        <TouchableOpacity
          style={[s.helpBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
          onPress={() => router.push('/settings/help')}
          activeOpacity={0.7}
        >
          <Ionicons name="help-circle-outline" size={16} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Main tabs */}
      <View style={[s.mainTabBar, { borderBottomColor: theme.borderLight }]}>
        {(['factures', 'devis', 'planifiees'] as Tab[]).map(tab => {
          const isActive = activeTab === tab;
          const label = tab === 'factures' ? 'FACTURES'
            : tab === 'devis' ? 'DEVIS'
            : 'PLANIFIÉES';
          const count = tab === 'factures' ? invoices.length
            : tab === 'devis' ? quoteRequests.length
            : scheduledRequests.length;
          return (
            <TouchableOpacity
              key={tab}
              style={[s.mainTab, isActive && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[s.mainTabText, { color: isActive ? theme.text : theme.textMuted }]}>{label}</Text>
              {count > 0 && (
                <View style={[s.mainTabBadge, { backgroundColor: isActive ? theme.accent : theme.surface }]}>
                  <Text style={[s.mainTabBadgeText, { color: isActive ? theme.accentText : theme.textMuted }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      >

        {/* ── FACTURES TAB ── */}
        {activeTab === 'factures' && (
          <>
            {/* Summary strip */}
            <View style={s.summaryRow}>
              <SummaryCard dark icon="document-text-outline" value={String(totalCount)} label="Factures" theme={theme} />
              <SummaryCard icon="cash-outline" value={String(Math.round(totalEur))} label="EUR total" theme={theme} />
              <SummaryCard icon="checkmark-outline" value={String(paidCount)} label="Réglées" theme={theme} />
            </View>

            {/* Filter tabs */}
            <View style={s.filterRow}>
              {FILTERS.map(f => {
                const active = filter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[s.filterTab, active
                      ? { backgroundColor: theme.accent }
                      : { backgroundColor: theme.cardBg, borderColor: theme.borderLight, borderWidth: 1.5 }
                    ]}
                    onPress={() => setFilter(f.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.filterTabText, { color: active ? theme.accentText : theme.textMuted }]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Invoice list */}
            {filtered.length === 0 ? (
              <View style={[s.empty, { borderColor: theme.borderLight }]}>
                <View style={[s.emptyIcon, { backgroundColor: theme.surface }]}>
                  <Ionicons name="document-text-outline" size={22} color={theme.textDisabled} />
                </View>
                <Text style={[s.emptyTitle, { color: theme.text }]}>Aucune facture</Text>
                <Text style={[s.emptyDesc, { color: theme.textMuted }]}>
                  Vos factures apparaîtront ici après chaque service terminé.
                </Text>
              </View>
            ) : (
              <View style={s.invoiceList}>
                {filtered.map(inv => (
                  <InvoiceCard
                    key={inv.id}
                    invoice={inv}
                    onPress={() => setSelectedInvoice(inv)}
                    theme={theme}
                  />
                ))}
              </View>
            )}

            {/* Assistance card */}
            <Text style={[s.sectionLabel, { color: theme.textMuted, marginTop: 10, marginBottom: 10 }]}>ASSISTANCE</Text>
            <TouchableOpacity style={s.assistCard} onPress={() => router.push('/settings/help')} activeOpacity={0.85}>
              <View style={s.assistIcon}>
                <Ionicons name="chatbubble-outline" size={18} color="rgba(255,255,255,0.7)" />
              </View>
              <View style={s.assistBody}>
                <Text style={s.assistTitle}>Un problème avec une facture ?</Text>
                <Text style={s.assistSub}>Ouvrir un ticket · Support client</Text>
              </View>
              <View style={s.assistArrow}>
                <Ionicons name="arrow-forward" size={13} color="rgba(255,255,255,0.6)" />
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* ── DEVIS TAB ── */}
        {activeTab === 'devis' && (
          <>
            {quoteRequests.length === 0 ? (
              <View style={[s.empty, { borderColor: theme.borderLight }]}>
                <View style={[s.emptyIcon, { backgroundColor: theme.surface }]}>
                  <Ionicons name="document-outline" size={22} color={theme.textDisabled} />
                </View>
                <Text style={[s.emptyTitle, { color: theme.text }]}>Aucun devis</Text>
                <Text style={[s.emptyDesc, { color: theme.textMuted }]}>
                  Vos devis apparaîtront ici une fois qu'un prestataire aura fait son diagnostic.
                </Text>
              </View>
            ) : (
              <View style={s.invoiceList}>
                {quoteRequests.slice(0, 5).map(req => {
                  const serviceName = req.serviceType || req.subcategory?.name || req.category?.name || req.title || 'Service';
                  const statusUp = req.status?.toUpperCase();
                  const isSent = statusUp === 'QUOTE_SENT';
                  const isAccepted = statusUp === 'QUOTE_ACCEPTED';
                  const isPending = statusUp === 'QUOTE_PENDING';
                  const pillBg = isSent ? 'rgba(232,120,58,0.1)' : isAccepted ? 'rgba(61,139,61,0.1)' : 'rgba(150,150,150,0.1)';
                  const pillColor = isSent ? '#E8783A' : isAccepted ? '#3D8B3D' : theme.textMuted as string;
                  const pillLabel = isSent ? 'À examiner' : isAccepted ? 'Accepté' : 'En cours';
                  const barColor = isSent ? '#E8783A' : isAccepted ? '#3D8B3D' : '#888';

                  const handlePress = () => {
                    if (isPending) {
                      router.push({ pathname: '/request/[id]/quote-pending', params: { id: req.id } });
                    } else {
                      setSelectedQuote(req);
                    }
                  };

                  return (
                    <TouchableOpacity
                      key={req.id}
                      style={[iv.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
                      onPress={handlePress}
                      activeOpacity={0.85}
                    >
                      <View style={[iv.bar, { backgroundColor: barColor }]} />
                      <View style={[iv.icon, { backgroundColor: pillBg }]}>
                        <Ionicons name="document-text-outline" size={16} color={pillColor} />
                      </View>
                      <View style={iv.body}>
                        <Text style={[iv.name, { color: theme.text }]} numberOfLines={1}>{serviceName}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          {req.calloutFee != null && req.calloutFee > 0 && (
                            <View style={{ backgroundColor: 'rgba(61,139,61,0.12)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                              <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: '#3D8B3D' }}>PAYÉ</Text>
                            </View>
                          )}
                          <Text style={[iv.meta, { color: theme.textMuted }]}>
                            {new Date(req.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </Text>
                        </View>
                      </View>
                      <View style={iv.right}>
                        {req.calloutFee != null && req.calloutFee > 0 && (
                          <Text style={[iv.amount, { color: theme.text }]}>{fmtEurCents(req.calloutFee)}</Text>
                        )}
                        <View style={[iv.pill, { backgroundColor: pillBg }]}>
                          <Text style={[iv.pillText, { color: pillColor }]}>{pillLabel}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* ── PLANIFIÉES TAB ── demandes avec preferredTimeStart futur */}
        {activeTab === 'planifiees' && (
          <>
            {scheduledRequests.length === 0 ? (
              <View style={[s.empty, { borderColor: theme.borderLight }]}>
                <View style={[s.emptyIcon, { backgroundColor: theme.surface }]}>
                  <Ionicons name="calendar-outline" size={22} color={theme.textDisabled} />
                </View>
                <Text style={[s.emptyTitle, { color: theme.text }]}>Aucune demande planifiée</Text>
                <Text style={[s.emptyDesc, { color: theme.textMuted }]}>
                  Vos missions à venir apparaîtront ici. Vous serez notifié dès qu'un prestataire accepte.
                </Text>
              </View>
            ) : (
              <View style={s.invoiceList}>
                {scheduledRequests.map(req => {
                  const serviceName = req.serviceType || req.subcategory?.name || req.category?.name || req.title || 'Service';
                  const isQuote = req.pricingMode === 'estimate' || req.pricingMode === 'diagnostic';
                  const scheduledDate = new Date(req.preferredTimeStart);
                  const dayLabel = scheduledDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
                  const timeLabel = scheduledDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                  const priceLabel = req.price && req.price > 0
                    ? `${req.price} €`
                    : isQuote ? 'Devis' : '—';
                  const pillBg = isQuote ? 'rgba(232,120,58,0.1)' : 'rgba(245,158,11,0.12)';
                  const pillColor = isQuote ? '#E8783A' : '#b45309';
                  const barColor = isQuote ? '#E8783A' : '#f59e0b';

                  return (
                    <TouchableOpacity
                      key={req.id}
                      style={[iv.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
                      onPress={() => router.push({
                        pathname: '/request/[id]/scheduled',
                        params: { id: req.id, mode: 'recap' },
                      })}
                      activeOpacity={0.85}
                    >
                      <View style={[iv.bar, { backgroundColor: barColor }]} />
                      <View style={[iv.icon, { backgroundColor: pillBg }]}>
                        <Ionicons name="calendar-outline" size={16} color={pillColor} />
                      </View>
                      <View style={iv.body}>
                        <Text style={[iv.name, { color: theme.text }]} numberOfLines={1}>{serviceName}</Text>
                        <Text style={[iv.meta, { color: theme.textMuted }]} numberOfLines={1}>
                          {dayLabel} · {timeLabel}
                        </Text>
                      </View>
                      <View style={iv.right}>
                        <Text style={[iv.amount, { color: theme.text }]}>{priceLabel}</Text>
                        <View style={[iv.pill, { backgroundColor: pillBg }]}>
                          <Text style={[iv.pillText, { color: pillColor }]}>
                            {isQuote ? 'Devis' : 'Planifiée'}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

      </ScrollView>

      <InvoiceSheet
        invoice={selectedInvoice}
        isVisible={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        userRole="client"
      />

      <QuoteSheet
        requestId={selectedQuote?.id ?? null}
        requestStatus={selectedQuote?.status ?? ''}
        serviceName={
          selectedQuote
            ? (selectedQuote.serviceType || selectedQuote.subcategory?.name || selectedQuote.category?.name || selectedQuote.title || 'Service')
            : ''
        }
        isVisible={!!selectedQuote}
        onClose={() => setSelectedQuote(null)}
      />
    </SafeAreaView>
  );
}

// ── Styles ──
const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12,
  },
  headerTitle: { fontFamily: FONTS.bebas, fontSize: 30, letterSpacing: 1, lineHeight: 30 },
  headerSub: { fontFamily: FONTS.sans, fontSize: 12, marginTop: 3 },
  helpBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 },

  // Summary
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 26 },

  // Section
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  sectionLabel: {
    fontFamily: FONTS.sansMedium, fontSize: 10, fontWeight: '600',
    letterSpacing: 1.5, textTransform: 'uppercase',
  },
  sectionAction: {
    fontFamily: FONTS.sansMedium, fontSize: 10, color: '#BBBBBB', letterSpacing: 0.4,
  },

  // Main tab bar
  mainTabBar: {
    flexDirection: 'row', borderBottomWidth: 1,
    paddingHorizontal: 20, marginBottom: 4,
  },
  mainTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 4, paddingVertical: 12, marginRight: 24,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  mainTabText: { fontFamily: FONTS.sansMedium, fontSize: 13, letterSpacing: 0.5 },
  mainTabBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  mainTabBadgeText: { fontFamily: FONTS.mono, fontSize: 10 },

  // Filter tabs (inside Factures)
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  filterTabText: { fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 0.4 },

  // Invoice list
  invoiceList: { gap: 8, marginBottom: 26 },

  // Empty
  empty: {
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 20,
    padding: 36, alignItems: 'center', gap: 10, marginBottom: 26,
  },
  emptyIcon: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontFamily: FONTS.sansMedium, fontSize: 14 },
  emptyDesc: { fontFamily: FONTS.sans, fontSize: 12, textAlign: 'center', lineHeight: 18, maxWidth: 220 },

  // Assistance dark card
  assistCard: {
    backgroundColor: '#0A0A0A', borderRadius: 18, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginBottom: 26, overflow: 'hidden',
  },
  assistIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  assistBody: { flex: 1 },
  assistTitle: { fontFamily: FONTS.sansMedium, fontSize: 13, color: '#FFFFFF', marginBottom: 3 },
  assistSub: { fontFamily: FONTS.sans, fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  assistArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
});
