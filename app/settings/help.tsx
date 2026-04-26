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
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Linking, Platform, StatusBar, TextInput,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/lib/api';

// ── FAQ catégorisée ────────────────────────────────────────────────────────────

type FaqCategory = 'payments' | 'missions' | 'account' | 'providers';

interface FaqItem { q: string; a: string; cat: FaqCategory }

const FAQ: FaqItem[] = [
  // Paiements
  {
    cat: 'payments',
    q: 'Comment fonctionne le paiement ?',
    a: 'Pour une mission à prix fixe, vous payez à la commande via Stripe (carte, Bancontact, Apple Pay, Google Pay). Pour une demande avec devis, seuls les frais de déplacement (29€ standard, 49€ urgent) sont prélevés à la commande — le reste est facturé après acceptation du devis.',
  },
  {
    cat: 'payments',
    q: 'Bancontact et Apple Pay sont-ils acceptés ?',
    a: 'Oui, tous les moyens de paiement supportés par Stripe sont disponibles : carte, Bancontact, Apple Pay, Google Pay et Klarna selon le montant.',
  },
  {
    cat: 'payments',
    q: 'Comment se passe le remboursement si personne n\'accepte ma demande ?',
    a: 'Si aucun prestataire ne valide votre demande dans le délai imparti (72h pour un devis), vous êtes automatiquement remboursé sur le moyen de paiement utilisé.',
  },
  // Missions
  {
    cat: 'missions',
    q: 'Puis-je annuler une mission ?',
    a: 'Oui, tant que la mission est en recherche ou récemment acceptée. Une fois le prestataire sur place ou la mission en cours, l\'annulation passe par le support pour gérer le partage des coûts.',
  },
  {
    cat: 'missions',
    q: 'Comment communiquer le code PIN au prestataire ?',
    a: 'Le code PIN à 4 chiffres s\'affiche sur votre écran de suivi dès que le prestataire est en route. Communiquez-le verbalement à son arrivée — il le saisit dans son app pour démarrer la mission.',
  },
  {
    cat: 'missions',
    q: 'Que faire si mon prestataire est en retard ?',
    a: 'Vous pouvez l\'appeler directement depuis l\'écran de suivi (bouton vert). En cas de problème, ouvrez la fiche mission via les "..." en haut et choisissez "Contacter le support".',
  },
  // Compte
  {
    cat: 'account',
    q: 'Comment modifier mon adresse e-mail ?',
    a: 'Cette modification n\'est pas encore en libre-service. Contactez le support via WhatsApp ou e-mail en précisant votre ancienne et nouvelle adresse.',
  },
  {
    cat: 'account',
    q: 'Mon compte a été suspendu, que faire ?',
    a: 'Contactez immédiatement le support à support@thefixed.app en indiquant votre adresse e-mail. Notre équipe revient vers vous sous 24h ouvrables.',
  },
  {
    cat: 'account',
    q: 'Comment supprimer mon compte ?',
    a: 'Rendez-vous dans Profil → Paramètres → Confidentialité → Supprimer mon compte. Conformément au RGPD, vos données sont supprimées sous 30 jours, à l\'exception des justificatifs comptables conservés 7 ans.',
  },
  // Prestataires
  {
    cat: 'providers',
    q: 'Comment devenir prestataire FIXED ?',
    a: 'Depuis votre profil, appuyez sur "Devenir prestataire" et complétez les 4 étapes : présentation, zone d\'intervention, catégories de services, soumission. Notre équipe valide votre dossier sous 48h.',
  },
  {
    cat: 'providers',
    q: 'Quand suis-je payé pour mes missions ?',
    a: 'Dès que la mission est marquée terminée, 80% du montant client est crédité sur votre wallet FIXED. Vous pouvez retirer vos gains à tout moment vers votre compte bancaire (versement sous 1 à 3 jours ouvrables).',
  },
];

const CATEGORIES: { id: FaqCategory; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: 'payments',  label: 'Paiements',    icon: 'credit-card' },
  { id: 'missions',  label: 'Missions',     icon: 'tool' },
  { id: 'account',   label: 'Compte',       icon: 'user' },
  { id: 'providers', label: 'Prestataires', icon: 'briefcase' },
];

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

  const [query, setQuery] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsTab, setTicketsTab] = useState<'open' | 'closed'>('open');

  const loadTickets = async () => {
    try {
      const res: any = await api.tickets.list();
      const list = res?.data || res?.tickets || res;
      setTickets(Array.isArray(list) ? list : []);
    } catch {
      setTickets([]);
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
  }, [query]);

  const groupedByCat = useMemo(() => {
    const map = new Map<FaqCategory, FaqItem[]>();
    for (const item of filtered) {
      if (!map.has(item.cat)) map.set(item.cat, []);
      map.get(item.cat)!.push(item);
    }
    return map;
  }, [filtered]);

  const openEmail    = () => Linking.openURL('mailto:support@thefixed.app?subject=Support FIXED');
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
          accessibilityLabel="Retour"
        >
          <Feather name="chevron-left" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerLabel, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>
          AIDE & SUPPORT
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <View style={s.hero}>
          <Text style={[s.heroKicker, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>
            ON EST LÀ POUR VOUS
          </Text>
          <Text style={[s.heroTitle, { color: theme.text, fontFamily: FONTS.bebas }]}>
            BESOIN D'AIDE ?
          </Text>
          <Text style={[s.heroSub, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            Recherchez votre question, ou écrivez-nous directement. Réponse en moins de 2h en moyenne.
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
              Beta — support prioritaire WhatsApp
            </Text>
            <Text style={[s.betaSub, { color: theme.textSub, fontFamily: FONTS.sans }]}>
              Réponse rapide pendant la phase de test
            </Text>
          </View>
          <Feather name="arrow-up-right" size={16} color={theme.textMuted} />
        </TouchableOpacity>

        {/* ── Search ───────────────────────────────────────────────────────── */}
        <View style={[s.searchBar, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <Feather name="search" size={16} color={theme.textMuted} />
          <TextInput
            style={[s.searchInput, { color: theme.text, fontFamily: FONTS.sans }]}
            placeholder="Rechercher une question…"
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
              Problème avec{'\n'}une mission
            </Text>
            <Text style={[s.actionSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
              Diagnostic guidé →
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
              Contacter{'\n'}le support
            </Text>
            <Text style={[s.actionSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
              WhatsApp →
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Mes tickets (ouverts + résolus) ──────────────────────────────── */}
        {tickets.length > 0 && (
          <View style={s.ticketsSection}>
            <View style={s.ticketsHeader}>
              <Text style={[s.ticketsLabel, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>
                MES TICKETS
              </Text>
              <View style={[s.tabsRow, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
                <TouchableOpacity
                  onPress={() => setTicketsTab('open')}
                  style={[s.tab, ticketsTab === 'open' && { backgroundColor: theme.cardBg }]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.tabText, { color: ticketsTab === 'open' ? theme.text : theme.textMuted, fontFamily: FONTS.monoMedium }]}>
                    OUVERTS ({openTickets.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setTicketsTab('closed')}
                  style={[s.tab, ticketsTab === 'closed' && { backgroundColor: theme.cardBg }]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.tabText, { color: ticketsTab === 'closed' ? theme.text : theme.textMuted, fontFamily: FONTS.monoMedium }]}>
                    RÉSOLUS ({closedTickets.length})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {visibleTickets.length === 0 ? (
              <View style={[s.ticketsEmpty, { borderColor: theme.borderLight }]}>
                <Text style={[s.ticketsEmptyText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
                  {ticketsTab === 'open' ? 'Aucun ticket ouvert.' : 'Aucun ticket résolu.'}
                </Text>
              </View>
            ) : (
              <View style={[s.ticketsList, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
                {visibleTickets.map((ticket, i) => {
                  const isLast = i === visibleTickets.length - 1;
                  const isClosed = ticket.status === 'CLOSED';
                  const statusLabel = ticket.status === 'OPEN' ? 'Ouvert'
                    : ticket.status === 'IN_PROGRESS' ? 'En cours' : 'Résolu';
                  const dotColor = isClosed ? theme.textDisabled
                    : ticket.priority === 'HIGH' ? '#EF4444'
                    : COLORS.amber;
                  const date = new Date(ticket.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
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
                          {ticket.requestId ? `Mission #${ticket.requestId} · ` : ''}{date}
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
              Aucune question ne correspond. Contactez-nous via WhatsApp.
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
            CONTACT DIRECT
          </Text>

          <TouchableOpacity style={s.contactRow} onPress={openEmail} activeOpacity={0.7}>
            <Feather name="mail" size={16} color={theme.textSub} />
            <View style={{ flex: 1 }}>
              <Text style={[s.contactValue, { color: theme.text, fontFamily: FONTS.sansMedium }]}>support@thefixed.app</Text>
              <Text style={[s.contactSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>E-mail · réponse sous 24h ouvrables</Text>
            </View>
            <Feather name="external-link" size={14} color={theme.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={s.contactRow} onPress={openWhatsApp} activeOpacity={0.7}>
            <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
            <View style={{ flex: 1 }}>
              <Text style={[s.contactValue, { color: theme.text, fontFamily: FONTS.sansMedium }]}>WhatsApp beta</Text>
              <Text style={[s.contactSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Réponse moyenne en moins de 2h</Text>
            </View>
            <Feather name="external-link" size={14} color={theme.textMuted} />
          </TouchableOpacity>

          <View style={s.contactRow}>
            <Feather name="clock" size={16} color={theme.textSub} />
            <View style={{ flex: 1 }}>
              <Text style={[s.contactValue, { color: theme.text, fontFamily: FONTS.sansMedium }]}>Lun – Ven · 9h – 18h CET</Text>
              <Text style={[s.contactSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Urgences mission : 24/7 via WhatsApp</Text>
            </View>
          </View>
        </View>

        <Text style={[s.version, { color: theme.textMuted, fontFamily: FONTS.mono }]}>
          FIXED v1.0.0 · Made in Brussels
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
    flex: 1, borderRadius: 14, borderWidth: 1,
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
