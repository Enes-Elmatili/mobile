// app/(tabs)/documents.tsx — Client Documents (Glow Up v2)
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { InteractionManager } from 'react-native';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl, Platform, StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useAppTheme, FONTS, COLORS, darkTokens } from '@/hooks/use-app-theme';
import InvoiceSheet from '../../components/sheets/InvoiceSheet';
import QuoteSheet from '../../components/sheets/QuoteSheet';
import type { Invoice } from '@/hooks/useInvoice';
import { formatEUR, formatEURCents, formatEURInt } from '@/lib/format';

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

// ── Summary Card (tappable filter) ──
function SummaryCard({ icon, value, label, dark, active, onPress, theme }: {
  icon: string; value: string; label: string; dark?: boolean;
  active?: boolean; onPress?: () => void;
  theme: ReturnType<typeof useAppTheme>;
}) {
  const bg = dark ? darkTokens.bg : theme.cardBg;
  const border = active ? theme.accent : (dark ? 'transparent' : theme.borderLight);
  const iconBg = dark ? 'rgba(255,255,255,0.08)' : theme.surface;
  const iconColor = dark ? 'rgba(255,255,255,0.6)' : theme.textSub;
  const valColor = dark ? darkTokens.text : theme.text;
  const labelColor = dark ? 'rgba(255,255,255,0.3)' : theme.textMuted;

  const Wrapper: any = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.85 } : {};

  return (
    <Wrapper style={[sc.card, { backgroundColor: bg, borderColor: border }]} {...wrapperProps}>
      <View style={[sc.icon, { backgroundColor: iconBg }]}>
        <Feather name={icon as any} size={13} color={iconColor} />
      </View>
      <Text style={[sc.value, { color: valColor }]} numberOfLines={1}>{value}</Text>
      <Text style={[sc.label, { color: labelColor }]}>{label}</Text>
    </Wrapper>
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
  const { t, i18n } = useTranslation();
  const status = invoice.status?.toUpperCase();
  const isPaid = status === 'PAID';
  const isRefunded = status === 'REFUNDED';
  const barColor = isPaid ? COLORS.greenBrand : isRefunded ? '#888' : COLORS.orangeBrand;
  const iconBg = isPaid ? 'rgba(61,139,61,0.08)' : isRefunded ? 'rgba(0,0,0,0.04)' : 'rgba(232,120,58,0.08)';
  const iconColor = isPaid ? COLORS.greenBrand : isRefunded ? '#999' : COLORS.orangeBrand;
  const pillBg = isPaid ? 'rgba(61,139,61,0.1)' : isRefunded ? theme.surface : 'rgba(232,120,58,0.1)';
  const pillColor = isPaid ? COLORS.greenBrand : isRefunded ? theme.textMuted : COLORS.orangeBrand;
  const pillLabel = isPaid ? t('ext.invoice_pill_paid') : isRefunded ? t('ext.invoice_pill_refunded') : t('ext.invoice_pill_pending');
  const iconName = isPaid ? 'check-circle' : isRefunded ? 'refresh-cw' : 'clock';

  const number = invoice.number ? `#${invoice.number}` : `#INV-${String(invoice.id).slice(-4).toUpperCase()}`;
  const date = new Date(invoice.issuedAt).toLocaleDateString(i18n.language || 'fr-FR', { day: 'numeric', month: 'short' });
  const service = (invoice as any).request?.serviceType || t('ext.invoice_service_default');

  return (
    <TouchableOpacity style={[iv.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]} onPress={onPress} activeOpacity={0.85}>
      <View style={[iv.bar, { backgroundColor: barColor }]} />
      <View style={[iv.icon, { backgroundColor: iconBg }]}>
        <Feather name={iconName as any} size={16} color={iconColor} />
      </View>
      <View style={iv.body}>
        <Text style={[iv.name, { color: theme.text }]} numberOfLines={1}>{service}</Text>
        <Text style={[iv.meta, { color: theme.textMuted }]}>{date} · {number}</Text>
      </View>
      <View style={iv.right}>
        <Text style={[iv.amount, { color: theme.text }]}>{formatEUR(invoice.amount)}</Text>
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
  const { t, i18n } = useTranslation();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [scheduledRequests, setScheduledRequests] = useState<ScheduledRequest[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<QuoteRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [activeTab, setActiveTab] = useState<Tab>('factures');

  // Deep-link "preuve de remboursement" : une notif refund ouvre directement la
  // facture de la demande concernée (passée en "Remboursé"), pas l'onglet brut.
  const { openRequestId } = useLocalSearchParams<{ openRequestId?: string }>();
  const openedRef = useRef<string | null>(null);

  // Statuts terminaux communs aux deux onglets (Devis + Planifiées).
  const TERMINAL_STATUSES = ['CANCELLED', 'QUOTE_REFUSED', 'QUOTE_EXPIRED', 'DONE', 'REFUNDED'];

  // Une demande appartient au flow Devis si elle est en mode estimate/diagnostic
  // ET que le callout fee a été payé (la transition QUOTE_PENDING peut ne pas être
  // encore arrivée si le webhook tarde — on s'appuie donc sur calloutFee, pas le statut).
  const isQuoteFlow = (r: any) =>
    (r.pricingMode === 'estimate' || r.pricingMode === 'diagnostic') && r.calloutFee > 0;

  const load = useCallback(async () => {
    try {
      const [invRes, reqRes] = await Promise.all([
        api.invoices.list(),
        api.requests.list(),
      ]);
      const invData = invRes?.data || invRes;
      setInvoices(Array.isArray(invData) ? invData : []);

      const reqData: any[] = reqRes?.data || reqRes || [];

      // Devis : toute demande en flow estimate/diagnostic dont le callout est payé,
      // tant qu'elle n'est pas dans un état terminal. On ne filtre PAS sur QUOTE_*
      // pour ne pas masquer les devis payés bloqués brièvement en PENDING_PAYMENT.
      setQuoteRequests(
        reqData.filter((r: any) => {
          const st = r.status?.toUpperCase();
          if (TERMINAL_STATUSES.includes(st)) return false;
          return isQuoteFlow(r);
        })
      );

      // Planifiées : demandes actives en prix fixe uniquement (les devis vivent dans l'onglet Devis).
      setScheduledRequests(
        reqData
          .filter((r: any) => {
            const st = r.status?.toUpperCase();
            if (TERMINAL_STATUSES.includes(st)) return false;
            if (isQuoteFlow(r)) return false;
            return true;
          })
          .sort((a: any, b: any) => {
            const aTime = a.preferredTimeStart ? new Date(a.preferredTimeStart).getTime() : new Date(a.createdAt).getTime();
            const bTime = b.preferredTimeStart ? new Date(b.preferredTimeStart).getTime() : new Date(b.createdAt).getTime();
            return aTime - bTime;
          })
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

  // Une fois les factures chargées, ouvre celle ciblée par le deep-link refund.
  useEffect(() => {
    if (!openRequestId || openedRef.current === openRequestId || invoices.length === 0) return;
    const target = invoices.find(inv => String(inv.requestId) === String(openRequestId));
    if (target) {
      openedRef.current = openRequestId;
      setActiveTab('factures');
      setSelectedInvoice(target);
    }
  }, [openRequestId, invoices]);

  // Stats
  const totalCount = invoices.length;
  const totalEur = useMemo(() => invoices.reduce((s, i) => s + (i.amount || 0), 0), [invoices]);
  const pendingEur = useMemo(
    () => invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + (i.amount || 0), 0),
    [invoices],
  );

  // Filter
  const filtered = useMemo(() => {
    if (filter === 'paid') return invoices.filter(i => i.status === 'PAID');
    if (filter === 'pending') return invoices.filter(i => i.status === 'PENDING');
    return invoices;
  }, [invoices, filter]);

  const cycleFilter = (next: Filter) => setFilter(prev => (prev === next ? 'all' : next));

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
            {activeTab === 'factures' ? t('ext.documents_tab_invoices_sub')
              : activeTab === 'devis' ? t('ext.documents_tab_quotes_sub')
              : t('ext.documents_tab_scheduled_sub')}
          </Text>
        </View>
        <TouchableOpacity
          style={[s.helpBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
          onPress={() => router.push('/settings/help')}
          activeOpacity={0.7}
        >
          <Feather name="help-circle" size={16} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Main tabs */}
      <View style={[s.mainTabBar, { borderBottomColor: theme.borderLight }]}>
        {(['factures', 'devis', 'planifiees'] as Tab[]).map(tab => {
          const isActive = activeTab === tab;
          const label = tab === 'factures' ? t('ext.documents_tab_invoices')
            : tab === 'devis' ? t('ext.documents_tab_quotes')
            : t('ext.documents_tab_scheduled');
          // Pas de badge sur Factures (le compte est déjà dans la SummaryCard).
          const count = tab === 'factures' ? 0
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
            {/* Summary strip — cards are filter chips */}
            <View style={s.summaryRow}>
              <SummaryCard
                dark
                icon="file-text"
                value={String(totalCount)}
                label={t('ext.documents_summary_invoices')}
                active={filter === 'all'}
                onPress={() => setFilter('all')}
                theme={theme}
              />
              <SummaryCard
                icon="trending-up"
                value={formatEURInt(totalEur)}
                label={t('ext.documents_summary_total')}
                active={filter === 'paid'}
                onPress={() => cycleFilter('paid')}
                theme={theme}
              />
              <SummaryCard
                icon="clock"
                value={pendingEur > 0 ? formatEURInt(pendingEur) : '0'}
                label={t('ext.documents_summary_pending')}
                active={filter === 'pending'}
                onPress={() => cycleFilter('pending')}
                theme={theme}
              />
            </View>

            {/* Invoice list */}
            {filtered.length === 0 ? (
              <View style={[s.empty, { backgroundColor: theme.cardBg }]}>
                <View style={[s.emptyIcon, { backgroundColor: theme.surface }]}>
                  <Feather name="file-text" size={22} color={theme.textDisabled} />
                </View>
                <Text style={[s.emptyTitle, { color: theme.text }]}>
                  {filter === 'all' ? t('ext.documents_empty_invoices_none') : filter === 'paid' ? t('ext.documents_empty_invoices_paid') : t('ext.documents_empty_invoices_pending')}
                </Text>
                <Text style={[s.emptyDesc, { color: theme.textMuted }]}>
                  {filter === 'all'
                    ? t('ext.documents_empty_invoices_desc')
                    : t('ext.documents_empty_invoices_filter_desc')}
                </Text>
                {filter === 'all' && (
                  <TouchableOpacity
                    style={[s.emptyCta, { backgroundColor: theme.accent }]}
                    onPress={() => router.push('/request/NewRequestStepper')}
                    activeOpacity={0.85}
                  >
                    <Feather name="plus" size={14} color={theme.accentText} />
                    <Text style={[s.emptyCtaText, { color: theme.accentText }]}>{t('ext.documents_order_cta')}</Text>
                  </TouchableOpacity>
                )}
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
            <Text style={[s.sectionLabel, { color: theme.textMuted, marginTop: 10, marginBottom: 10 }]}>{t('ext.documents_assistance')}</Text>
            <TouchableOpacity style={s.assistCard} onPress={() => router.push('/settings/help')} activeOpacity={0.85}>
              <View style={s.assistIcon}>
                <Feather name="message-circle" size={18} color="rgba(255,255,255,0.7)" />
              </View>
              <View style={s.assistBody}>
                <Text style={s.assistTitle}>{t('ext.documents_invoice_issue_title')}</Text>
                <Text style={s.assistSub}>{t('ext.documents_invoice_issue_sub')}</Text>
              </View>
              <View style={s.assistArrow}>
                <Feather name="arrow-right" size={13} color="rgba(255,255,255,0.6)" />
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* ── DEVIS TAB ── */}
        {activeTab === 'devis' && (
          <>
            {quoteRequests.length === 0 ? (
              <View style={[s.empty, { backgroundColor: theme.cardBg }]}>
                <View style={[s.emptyIcon, { backgroundColor: theme.surface }]}>
                  <Feather name="file-text" size={22} color={theme.textDisabled} />
                </View>
                <Text style={[s.emptyTitle, { color: theme.text }]}>Aucun devis</Text>
                <Text style={[s.emptyDesc, { color: theme.textMuted }]}>
                  Vos devis apparaîtront ici une fois qu'un prestataire aura fait son diagnostic.
                </Text>
                <TouchableOpacity
                  style={[s.emptyCta, { backgroundColor: theme.accent }]}
                  onPress={() => router.push('/request/NewRequestStepper')}
                  activeOpacity={0.85}
                >
                  <Feather name="plus" size={14} color={theme.accentText} />
                  <Text style={[s.emptyCtaText, { color: theme.accentText }]}>Demander un devis</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.invoiceList}>
                {quoteRequests.map(req => {
                  const serviceName = req.serviceType || req.subcategory?.name || req.category?.name || req.title || t('ext.invoice_service_default');
                  const statusUp = req.status?.toUpperCase();
                  const isPendingPay = statusUp === 'PENDING_PAYMENT';
                  const isPending = statusUp === 'QUOTE_PENDING';
                  const isSent = statusUp === 'QUOTE_SENT';
                  const isAccepted = statusUp === 'QUOTE_ACCEPTED';
                  const isOngoing = statusUp === 'ONGOING';

                  const pillTone = isSent ? COLORS.orangeBrand
                    : isAccepted || isOngoing ? COLORS.greenBrand
                    : isPendingPay ? COLORS.amber
                    : (theme.textMuted as string);
                  const pillLabel = isPendingPay ? t('ext.documents_pill_payment')
                    : isPending ? t('ext.documents_pill_diagnostic')
                    : isSent ? t('ext.documents_pill_to_review')
                    : isAccepted ? t('ext.documents_pill_accepted')
                    : isOngoing ? t('ext.documents_pill_ongoing')
                    : t('ext.documents_pill_ongoing');
                  const pillBg = `${pillTone}1A`;
                  const barColor = pillTone;

                  // Routage : Devis tab = vue contractuelle, jamais de tracking GPS ici.
                  // PENDING_PAYMENT → resume-payment, QUOTE_PENDING → écran d'attente,
                  // toutes les autres transitions (SENT/ACCEPTED/ONGOING) ouvrent la fiche devis.
                  // Pour suivre une mission ONGOING en GPS, l'utilisateur passe par l'îlot dashboard.
                  const handlePress = () => {
                    if (isPendingPay) {
                      router.push({ pathname: '/request/[id]/resume-payment', params: { id: req.id } });
                    } else if (isPending) {
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
                        <Feather name="file-text" size={16} color={pillTone} />
                      </View>
                      <View style={iv.body}>
                        <Text style={[iv.name, { color: theme.text }]} numberOfLines={1}>{serviceName}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          {req.calloutFee != null && req.calloutFee > 0 && (
                            <View style={{ backgroundColor: 'rgba(61,139,61,0.12)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                              <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.greenBrand }}>{t('ext.documents_pill_paid_tag')}</Text>
                            </View>
                          )}
                          <Text style={[iv.meta, { color: theme.textMuted }]}>
                            {new Date(req.createdAt).toLocaleDateString(i18n.language || 'fr-FR', { day: 'numeric', month: 'short' })}
                          </Text>
                        </View>
                      </View>
                      <View style={iv.right}>
                        {req.calloutFee != null && req.calloutFee > 0 && (
                          <Text style={[iv.amount, { color: theme.text }]}>{formatEURCents(req.calloutFee)}</Text>
                        )}
                        <View style={[iv.pill, { backgroundColor: pillBg }]}>
                          <Text style={[iv.pillText, { color: pillTone }]}>{pillLabel}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* ── PLANIFIÉES TAB ── demandes actives en prix fixe */}
        {activeTab === 'planifiees' && (
          <>
            {scheduledRequests.length === 0 ? (
              <View style={[s.empty, { backgroundColor: theme.cardBg }]}>
                <View style={[s.emptyIcon, { backgroundColor: theme.surface }]}>
                  <Feather name="calendar" size={22} color={theme.textDisabled} />
                </View>
                <Text style={[s.emptyTitle, { color: theme.text }]}>{t('ext.documents_empty_scheduled_title')}</Text>
                <Text style={[s.emptyDesc, { color: theme.textMuted }]}>
                  {t('ext.documents_empty_scheduled_desc')}
                </Text>
                <TouchableOpacity
                  style={[s.emptyCta, { backgroundColor: theme.accent }]}
                  onPress={() => router.push('/request/NewRequestStepper')}
                  activeOpacity={0.85}
                >
                  <Feather name="calendar" size={14} color={theme.accentText} />
                  <Text style={[s.emptyCtaText, { color: theme.accentText }]}>{t('ext.documents_schedule_cta')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.invoiceList}>
                {scheduledRequests.map(req => {
                  const serviceName = req.serviceType || req.subcategory?.name || req.category?.name || req.title || t('ext.invoice_service_default');
                  const isQuote = req.pricingMode === 'estimate' || req.pricingMode === 'diagnostic';
                  const statusUp = (req.status || '').toUpperCase();
                  const isOngoing = statusUp === 'ONGOING';
                  const isAccepted = statusUp === 'ACCEPTED';
                  const isPublished = statusUp === 'PUBLISHED';
                  const isPendingPay = statusUp === 'PENDING_PAYMENT';

                  // Date affichée : preferredTimeStart si défini, sinon createdAt (immédiates).
                  const dateSrc = req.preferredTimeStart || req.createdAt;
                  const d = dateSrc ? new Date(dateSrc) : null;
                  const dayLabel = d ? d.toLocaleDateString(i18n.language || 'fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '—';
                  const timeLabel = d ? d.toLocaleTimeString(i18n.language || 'fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

                  const priceLabel = req.price && req.price > 0
                    ? formatEUR(req.price)
                    : isQuote ? t('ext.documents_pill_quote') : '—';

                  const pillLabel = isOngoing ? t('ext.documents_pill_ongoing')
                    : isAccepted ? t('ext.documents_pill_accepted_f')
                    : isPublished ? t('ext.documents_pill_search')
                    : isPendingPay ? t('ext.documents_pill_payment')
                    : isQuote ? t('ext.documents_pill_quote')
                    : t('ext.documents_pill_scheduled_f');
                  const pillTone = isOngoing || isAccepted ? COLORS.greenBrand
                    : isQuote ? COLORS.orangeBrand
                    : COLORS.amber;
                  const pillBg = `${pillTone}1A`;
                  const barColor = pillTone;

                  // Routage par état : ONGOING → missionview, PENDING_PAYMENT → resume-payment, sinon → scheduled.
                  const target: any = isOngoing
                    ? { pathname: '/request/[id]/missionview', params: { id: req.id } }
                    : isPendingPay
                      ? { pathname: '/request/[id]/resume-payment', params: { id: req.id } }
                      : { pathname: '/request/[id]/scheduled', params: { id: req.id, mode: 'recap' } };

                  return (
                    <TouchableOpacity
                      key={req.id}
                      style={[iv.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
                      onPress={() => router.push(target)}
                      activeOpacity={0.85}
                    >
                      <View style={[iv.bar, { backgroundColor: barColor }]} />
                      <View style={[iv.icon, { backgroundColor: pillBg }]}>
                        <Feather name="calendar" size={16} color={pillTone} />
                      </View>
                      <View style={iv.body}>
                        <Text style={[iv.name, { color: theme.text }]} numberOfLines={1}>{serviceName}</Text>
                        <Text style={[iv.meta, { color: theme.textMuted }]} numberOfLines={1}>
                          {timeLabel ? `${dayLabel} · ${timeLabel}` : dayLabel}
                        </Text>
                      </View>
                      <View style={iv.right}>
                        <Text style={[iv.amount, { color: theme.text }]}>{priceLabel}</Text>
                        <View style={[iv.pill, { backgroundColor: pillBg }]}>
                          <Text style={[iv.pillText, { color: pillTone }]}>{pillLabel}</Text>
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
            ? (selectedQuote.serviceType || selectedQuote.subcategory?.name || selectedQuote.category?.name || selectedQuote.title || t('ext.invoice_service_default'))
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
    fontFamily: FONTS.sansMedium, fontSize: 10, color: darkTokens.textSub, letterSpacing: 0.4,
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

  // Invoice list
  invoiceList: { gap: 8, marginBottom: 26 },

  // Empty
  empty: {
    borderRadius: 20,
    paddingVertical: 44, paddingHorizontal: 24,
    alignItems: 'center', gap: 10, marginBottom: 26,
  },
  emptyIcon: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontFamily: FONTS.sansMedium, fontSize: 14 },
  emptyDesc: { fontFamily: FONTS.sans, fontSize: 12, textAlign: 'center', lineHeight: 18, maxWidth: 240 },
  emptyCta: {
    marginTop: 14, paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  emptyCtaText: { fontFamily: FONTS.sansMedium, fontSize: 12, letterSpacing: 0.4 },

  // Assistance dark card
  assistCard: {
    backgroundColor: darkTokens.bg, borderRadius: 18, padding: 18,
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
  assistTitle: { fontFamily: FONTS.sansMedium, fontSize: 13, color: darkTokens.text, marginBottom: 3 },
  assistSub: { fontFamily: FONTS.sans, fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  assistArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
});
