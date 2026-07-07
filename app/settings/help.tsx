// app/settings/help.tsx — Aide & support (refonte charte FIXED)
//
// Structure :
//   1. Header sobre (back + label mono)
//   2. Hero "BESOIN D'AIDE ?" Bebas + sous-titre + bandeau beta WhatsApp
//   3. Search bar
//   4. 2 cartes d'action (problème mission · contact support)
//   5. Mes tickets (ouverts + résolus) si l'utilisateur en a
//   6. FAQ catégorisée (Paiements · Missions · Compte · Prestataires)
//   7. Footer contact (email + WhatsApp + horaires + SLA "réponse sous 2h")
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Linking, Platform, StatusBar, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthContext';

// ── FAQ catégorisée ────────────────────────────────────────────────────────────

type FaqCategory = 'payments' | 'missions' | 'account' | 'providers';

interface FaqItem { q: string; a: string; cat: FaqCategory }

// Translation-key blueprints — actual strings resolved at render time via t().
const FAQ_CLIENT_KEYS: { cat: FaqCategory; n: number }[] = [
  { cat: 'payments', n: 1 },
  { cat: 'payments', n: 2 },
  { cat: 'payments', n: 3 },
  { cat: 'missions', n: 4 },
  { cat: 'missions', n: 5 },
  { cat: 'missions', n: 6 },
  { cat: 'account',  n: 7 },
  { cat: 'account',  n: 8 },
  { cat: 'account',  n: 9 },
  { cat: 'providers', n: 10 },
];

const FAQ_PROVIDER_KEYS: { cat: FaqCategory; n: number }[] = [
  { cat: 'payments', n: 1 },
  { cat: 'payments', n: 2 },
  { cat: 'payments', n: 3 },
  { cat: 'missions', n: 4 },
  { cat: 'missions', n: 5 },
  { cat: 'missions', n: 6 },
  { cat: 'missions', n: 7 },
  { cat: 'account',  n: 8 },
  { cat: 'account',  n: 9 },
  { cat: 'account',  n: 10 },
  { cat: 'providers', n: 11 },
  { cat: 'providers', n: 12 },
];

const CATEGORY_ICONS: Record<FaqCategory, keyof typeof Feather.glyphMap> = {
  payments: 'credit-card',
  missions: 'tool',
  account: 'user',
  providers: 'briefcase',
};

const CATEGORY_ORDER: FaqCategory[] = ['payments', 'missions', 'account', 'providers'];

// ── FAQ Item ──────────────────────────────────────────────────────────────────

function FAQItem({ item, isLast }: { item: FaqItem; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const theme = useAppTheme();
  return (
    <View style={[fi.wrap, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.borderLight }]}>
      <TouchableOpacity style={fi.row} onPress={() => setOpen(v => !v)} activeOpacity={0.7}>
        <Text style={[fi.q, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{item.q}</Text>
        <Feather name={open ? 'minus' : 'plus'} size={16} color={theme.textMuted} />
      </TouchableOpacity>
      {open && (
        <Text style={[fi.a, { color: theme.textSub, fontFamily: FONTS.sans }]}>{item.a}</Text>
      )}
    </View>
  );
}

const fi = StyleSheet.create({
  wrap: {},
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14,
  },
  q: { flex: 1, fontSize: 14, lineHeight: 20 },
  a: { fontSize: 13, lineHeight: 19, paddingBottom: 14, paddingRight: 28 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

const WHATSAPP_BETA_URL = 'https://wa.me/message/SXNKDKILPEFMO1';

interface Ticket {
  id: string;
  title: string;
  description?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  requestId?: number | null;
  createdAt: string;
  updatedAt?: string;
}

export default function HelpScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { user } = useAuth();
  const isProvider = !!user?.roles?.includes('PROVIDER');

  const FAQ = useMemo<FaqItem[]>(() => {
    const prefix = isProvider ? 'provider' : 'client';
    const keys = isProvider ? FAQ_PROVIDER_KEYS : FAQ_CLIENT_KEYS;
    return keys.map(({ cat, n }) => ({
      cat,
      q: t(`help.${prefix}_q${n}`),
      a: t(`help.${prefix}_a${n}`),
    }));
  }, [isProvider, t]);

  const CATEGORIES = useMemo(() => CATEGORY_ORDER.map((id) => ({
    id,
    label: t(`help.cat_${id}`),
    icon: CATEGORY_ICONS[id],
  })), [t]);

  const [query, setQuery] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsTab, setTicketsTab] = useState<'open' | 'closed'>('open');
  const [ticketsError, setTicketsError] = useState(false);

  const loadTickets = async () => {
    try {
      const res: any = await api.tickets.list();
      const list = res?.data || res?.tickets || res;
      setTickets(Array.isArray(list) ? list : []);
      setTicketsError(false);
    } catch {
      setTickets([]);
      setTicketsError(true);
    }
  };

  useEffect(() => { loadTickets(); }, []);
  // Refetch quand on revient sur l'écran (ex: après création depuis /support)
  useFocusEffect(React.useCallback(() => {
    loadTickets();
  }, []));

  const openTickets = useMemo(
    () => tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS'),
    [tickets],
  );
  const closedTickets = useMemo(
    () => tickets.filter(t => t.status === 'CLOSED'),
    [tickets],
  );
  const visibleTickets = ticketsTab === 'open' ? openTickets : closedTickets;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQ;
    return FAQ.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }, [query, FAQ]);

  const groupedByCat = useMemo(() => {
    const map = new Map<FaqCategory, FaqItem[]>();
    for (const item of filtered) {
      if (!map.has(item.cat)) map.set(item.cat, []);
      map.get(item.cat)!.push(item);
    }
    return map;
  }, [filtered]);

  const openEmail    = () => Linking.openURL(`mailto:support@thefixed.app?subject=${encodeURIComponent(t('help.email_subject'))}`);
  const openWhatsApp = () => WebBrowser.openBrowserAsync(WHATSAPP_BETA_URL);
  const openMissionSupport = () => router.push('/support');

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Header — sobre, monochrome */}
      <View style={s.header}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
          onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }}
          activeOpacity={0.75}
          accessibilityLabel={t('help.back_label')}
        >
          <Feather name="arrow-left" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerLabel, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>
          {t('help.header')}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <View style={s.hero}>
          <Text style={[s.heroKicker, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>
            {t('help.hero_kicker')}
          </Text>
          <Text style={[s.heroTitle, { color: theme.text, fontFamily: FONTS.bebas }]}>
            {t('help.hero_title')}
          </Text>
          <Text style={[s.heroSub, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            {t('help.hero_sub')}
          </Text>
        </View>

        {/* ── Bandeau beta WhatsApp ────────────────────────────────────────── */}
        <TouchableOpacity
          style={[s.betaBanner, { backgroundColor: 'rgba(37,211,102,0.10)', borderColor: 'rgba(37,211,102,0.30)' }]}
          onPress={openWhatsApp}
          activeOpacity={0.85}
        >
          <View style={s.betaIconWrap}>
            <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.betaTitle, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
              {t('help.beta_title')}
            </Text>
            <Text style={[s.betaSub, { color: theme.textSub, fontFamily: FONTS.sans }]}>
              {t('help.beta_sub')}
            </Text>
          </View>
          <Feather name="arrow-up-right" size={16} color={theme.textMuted} />
        </TouchableOpacity>

        {/* ── Search ───────────────────────────────────────────────────────── */}
        <View style={[s.searchBar, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <Feather name="search" size={16} color={theme.textMuted} />
          <TextInput
            style={[s.searchInput, { color: theme.text, fontFamily: FONTS.sans }]}
            placeholder={t('help.search_placeholder')}
            placeholderTextColor={theme.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x-circle" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── 2 cartes d'action prioritaires ───────────────────────────────── */}
        <View style={s.actionsRow}>
          {/* Mission — accent fort (rouge subtil pour signaler "urgent") */}
          <TouchableOpacity
            style={[s.actionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
            onPress={openMissionSupport}
            activeOpacity={0.85}
          >
            <View style={[s.actionIcon, { backgroundColor: 'rgba(239,68,68,0.10)' }]}>
              <Feather name="alert-triangle" size={20} color="#EF4444" />
            </View>
            <Text style={[s.actionTitle, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
              {t('help.action_mission_title')}
            </Text>
            <Text style={[s.actionSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
              {t('help.action_mission_sub')}
            </Text>
          </TouchableOpacity>

          {/* Support direct */}
          <TouchableOpacity
            style={[s.actionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
            onPress={openWhatsApp}
            activeOpacity={0.85}
          >
            <View style={[s.actionIcon, { backgroundColor: 'rgba(37,211,102,0.10)' }]}>
              <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            </View>
            <Text style={[s.actionTitle, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
              {t('help.action_support_title')}
            </Text>
            <Text style={[s.actionSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
              {t('help.action_support_sub')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Erreur de chargement des tickets (≠ absence de tickets) ──────── */}
        {ticketsError && tickets.length === 0 && (
          <TouchableOpacity
            style={[s.ticketsErrorRow, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
            onPress={loadTickets}
            activeOpacity={0.8}
          >
            <Feather name="alert-triangle" size={14} color={theme.textSub} />
            <Text style={[s.ticketsErrorText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
              Impossible de charger vos tickets. Appuyez pour réessayer.
            </Text>
            <Feather name="refresh-cw" size={13} color={theme.textMuted} />
          </TouchableOpacity>
        )}

        {/* ── Mes tickets (ouverts + résolus) ──────────────────────────────── */}
        {tickets.length > 0 && (
          <View style={s.ticketsSection}>
            <View style={s.ticketsHeader}>
              <Text style={[s.ticketsLabel, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>
                {t('help.tickets_label')}
              </Text>
              <View style={[s.tabsRow, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
                <TouchableOpacity
                  onPress={() => setTicketsTab('open')}
                  style={[s.tab, ticketsTab === 'open' && { backgroundColor: theme.cardBg }]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.tabText, { color: ticketsTab === 'open' ? theme.text : theme.textMuted, fontFamily: FONTS.monoMedium }]}>
                    {t('help.tickets_tab_open')} ({openTickets.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setTicketsTab('closed')}
                  style={[s.tab, ticketsTab === 'closed' && { backgroundColor: theme.cardBg }]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.tabText, { color: ticketsTab === 'closed' ? theme.text : theme.textMuted, fontFamily: FONTS.monoMedium }]}>
                    {t('help.tickets_tab_closed')} ({closedTickets.length})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {visibleTickets.length === 0 ? (
              <View style={[s.ticketsEmpty, { borderColor: theme.borderLight }]}>
                <Text style={[s.ticketsEmptyText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
                  {ticketsTab === 'open' ? t('help.tickets_empty_open') : t('help.tickets_empty_closed')}
                </Text>
              </View>
            ) : (
              <View style={[s.ticketsList, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
                {visibleTickets.map((ticket, i) => {
                  const isLast = i === visibleTickets.length - 1;
                  const isClosed = ticket.status === 'CLOSED';
                  const statusLabel = ticket.status === 'OPEN' ? t('help.ticket_status_open')
                    : ticket.status === 'IN_PROGRESS' ? t('help.ticket_status_in_progress') : t('help.ticket_status_closed');
                  const dotColor = isClosed ? theme.textDisabled
                    : ticket.priority === 'HIGH' ? '#EF4444'
                    : COLORS.amber;
                  const date = new Date(ticket.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
                  return (
                    <TouchableOpacity
                      key={ticket.id}
                      style={[s.ticketRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.borderLight }]}
                      onPress={() => router.push({ pathname: '/tickets/[id]', params: { id: ticket.id } })}
                      activeOpacity={0.7}
                    >
                      <View style={[s.ticketDot, { backgroundColor: dotColor }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.ticketTitle, { color: theme.text, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>
                          {ticket.title}
                        </Text>
                        <Text style={[s.ticketMeta, { color: theme.textMuted, fontFamily: FONTS.mono }]} numberOfLines={1}>
                          {ticket.requestId ? `${t('help.ticket_mission_prefix')}${ticket.requestId} · ` : ''}{date}
                        </Text>
                      </View>
                      <View style={[s.ticketPill, isClosed
                        ? { backgroundColor: theme.surface }
                        : { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                        <Text style={[s.ticketPillText, {
                          color: isClosed ? theme.textMuted : COLORS.amber,
                          fontFamily: FONTS.monoMedium,
                        }]}>
                          {statusLabel.toUpperCase()}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={14} color={theme.textMuted} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ── FAQ catégorisée ──────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <View style={[s.emptyFaq, { borderColor: theme.borderLight }]}>
            <Feather name="search" size={24} color={theme.textMuted} />
            <Text style={[s.emptyFaqText, { color: theme.textSub, fontFamily: FONTS.sans }]}>
              {t('help.empty_faq')}
            </Text>
          </View>
        ) : (
          CATEGORIES.map((cat) => {
            const items = groupedByCat.get(cat.id);
            if (!items || items.length === 0) return null;
            return (
              <View key={cat.id} style={s.faqSection}>
                <View style={s.faqSectionHeader}>
                  <Feather name={cat.icon} size={13} color={theme.textMuted} />
                  <Text style={[s.faqSectionLabel, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>
                    {cat.label.toUpperCase()}
                  </Text>
                  <View style={[s.faqSectionLine, { backgroundColor: theme.borderLight }]} />
                </View>
                <View style={s.faqGroup}>
                  {items.map((item, i) => (
                    <FAQItem key={`${cat.id}-${i}`} item={item} isLast={i === items.length - 1} />
                  ))}
                </View>
              </View>
            );
          })
        )}

        {/* ── Footer contact ───────────────────────────────────────────────── */}
        <View style={[s.divider, { backgroundColor: theme.borderLight }]} />

        <View style={s.contactSection}>
          <Text style={[s.contactSectionLabel, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>
            {t('help.contact_section')}
          </Text>

          <TouchableOpacity style={s.contactRow} onPress={openEmail} activeOpacity={0.7}>
            <Feather name="mail" size={16} color={theme.textSub} />
            <View style={{ flex: 1 }}>
              <Text style={[s.contactValue, { color: theme.text, fontFamily: FONTS.sansMedium }]}>support@thefixed.app</Text>
              <Text style={[s.contactSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>{t('help.contact_email_sub')}</Text>
            </View>
            <Feather name="external-link" size={14} color={theme.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={s.contactRow} onPress={openWhatsApp} activeOpacity={0.7}>
            <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
            <View style={{ flex: 1 }}>
              <Text style={[s.contactValue, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{t('help.contact_whatsapp_title')}</Text>
              <Text style={[s.contactSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>{t('help.contact_whatsapp_sub')}</Text>
            </View>
            <Feather name="external-link" size={14} color={theme.textMuted} />
          </TouchableOpacity>

          <View style={s.contactRow}>
            <Feather name="clock" size={16} color={theme.textSub} />
            <View style={{ flex: 1 }}>
              <Text style={[s.contactValue, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{t('help.contact_hours_title')}</Text>
              <Text style={[s.contactSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>{t('help.contact_hours_sub')}</Text>
            </View>
          </View>
        </View>

        <Text style={[s.version, { color: theme.textMuted, fontFamily: FONTS.mono }]}>
          {t('help.version')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  headerLabel: { fontSize: 11, letterSpacing: 1.4 },

  scroll: { paddingHorizontal: 18, paddingBottom: 32 },

  // Hero
  hero: { paddingTop: 12, paddingBottom: 18 },
  heroKicker: { fontSize: 10, letterSpacing: 1.4, marginBottom: 8 },
  heroTitle: { fontSize: 44, lineHeight: 46, letterSpacing: -0.5, marginBottom: 8 },
  heroSub: { fontSize: 13, lineHeight: 19 },

  // Beta banner
  betaBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 14,
  },
  betaIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(37,211,102,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  betaTitle: { fontSize: 13, marginBottom: 1 },
  betaSub: { fontSize: 11 },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },

  // Action cards
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  actionCard: {
    flex: 1, borderRadius: 18, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 14,
    gap: 10,
  },
  actionIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  actionTitle: { fontSize: 14, lineHeight: 18 },
  actionSub: { fontSize: 11 },

  // Tickets section
  ticketsErrorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1, marginBottom: 22,
  },
  ticketsErrorText: { flex: 1, fontSize: 13 },
  ticketsSection: { marginBottom: 22 },
  ticketsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  ticketsLabel: { fontSize: 10, letterSpacing: 1.4 },
  tabsRow: {
    flexDirection: 'row', borderRadius: 8, borderWidth: 1, padding: 2,
  },
  tab: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  tabText: { fontSize: 9, letterSpacing: 0.8 },
  ticketsList: {
    borderRadius: 12, borderWidth: 1,
  },
  ticketRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  ticketDot: { width: 7, height: 7, borderRadius: 3.5 },
  ticketTitle: { fontSize: 13, marginBottom: 2 },
  ticketMeta: { fontSize: 10, letterSpacing: 0.4 },
  ticketPill: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  ticketPillText: { fontSize: 9, letterSpacing: 0.8 },
  ticketsEmpty: {
    borderWidth: 1, borderStyle: 'dashed', borderRadius: 12,
    paddingVertical: 18, alignItems: 'center',
  },
  ticketsEmptyText: { fontSize: 12 },

  // FAQ sections
  faqSection: { marginBottom: 16 },
  faqSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 6,
  },
  faqSectionLabel: { fontSize: 10, letterSpacing: 1.4 },
  faqSectionLine: { flex: 1, height: 1 },
  faqGroup: {},
  emptyFaq: {
    borderRadius: 12, borderWidth: 1, borderStyle: 'dashed',
    paddingVertical: 24, paddingHorizontal: 16,
    alignItems: 'center', gap: 8,
    marginBottom: 16,
  },
  emptyFaqText: { fontSize: 13, textAlign: 'center' },

  // Divider
  divider: { height: 1, marginVertical: 12 },

  // Contact
  contactSection: { marginTop: 4 },
  contactSectionLabel: { fontSize: 10, letterSpacing: 1.4, marginBottom: 8 },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
  },
  contactValue: { fontSize: 14, marginBottom: 1 },
  contactSub: { fontSize: 11 },

  version: { textAlign: 'center', fontSize: 10, letterSpacing: 1.2, marginTop: 24 },
});
