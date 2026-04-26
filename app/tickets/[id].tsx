// app/tickets/[id].tsx — Détail d'un ticket support
//
// Ouvre depuis profil ou page aide quand l'utilisateur clique sur un ticket.
// Affiche : récap, timeline d'avancement (basée sur status), actions disponibles.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, StatusBar, Alert, Linking,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthContext';
import { devError } from '@/lib/logger';

const WHATSAPP_URL = 'https://wa.me/message/SXNKDKILPEFMO1';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH';

type EventType = 'CREATED' | 'STATUS_CHANGED' | 'PRIORITY_CHANGED' | 'MESSAGE' | 'ASSIGNED' | 'RESOLVED' | 'REOPENED';

interface TicketEvent {
  id: string;
  ticketId: string;
  type: EventType;
  payload?: any;
  authorId?: string | null;
  visibility?: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  userId: string;
  requestId?: number | null;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt?: string;
  events?: TicketEvent[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(s: TicketStatus) {
  return s === 'OPEN' ? 'Ouvert' : s === 'IN_PROGRESS' ? 'En cours' : 'Résolu';
}

function priorityLabel(p: TicketPriority) {
  return p === 'HIGH' ? 'Urgent' : p === 'MEDIUM' ? 'Standard' : 'Faible';
}

function priorityColor(p: TicketPriority) {
  return p === 'HIGH' ? '#EF4444' : p === 'MEDIUM' ? COLORS.amber : COLORS.greenBrand;
}

function statusColor(s: TicketStatus) {
  return s === 'CLOSED' ? COLORS.greenBrand : COLORS.amber;
}

function ticketRef(id: string) {
  return `FXD-${id.slice(-8).toUpperCase()}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function slaText(p: TicketPriority) {
  return p === 'HIGH' ? 'Réponse sous 1h' : p === 'MEDIUM' ? 'Réponse sous 4h' : 'Réponse sous 24h';
}

// ── Event rendering helpers ──────────────────────────────────────────────────

function eventLabel(ev: TicketEvent): string {
  switch (ev.type) {
    case 'CREATED': return 'Ticket créé';
    case 'MESSAGE': return ev.payload?.fromAdmin ? 'Réponse de l\'équipe' : 'Votre message';
    case 'STATUS_CHANGED': {
      const to = ev.payload?.to;
      return to === 'IN_PROGRESS' ? 'Pris en charge' : `Statut mis à jour : ${to}`;
    }
    case 'PRIORITY_CHANGED': return `Priorité : ${ev.payload?.to ?? '—'}`;
    case 'ASSIGNED': return 'Assigné à un agent';
    case 'RESOLVED': return 'Marqué comme résolu';
    case 'REOPENED': return 'Ticket rouvert';
    default: return ev.type;
  }
}

function eventDetail(ev: TicketEvent, currentUserId?: string | null): string | null {
  switch (ev.type) {
    case 'CREATED':
      if (ev.payload?.source === 'support_escalation') {
        return `Signalement envoyé via le diagnostic : ${ev.payload?.problemType ?? 'problème non précisé'}.`;
      }
      return 'Votre ticket a été enregistré et l\'équipe support notifiée.';
    case 'MESSAGE':
      return ev.payload?.content ?? null;
    case 'STATUS_CHANGED':
      if (ev.payload?.to === 'IN_PROGRESS') return 'Un agent travaille sur votre demande.';
      return null;
    case 'RESOLVED':
      return 'Si le problème persiste, ajoutez un message ci-dessous pour rouvrir le ticket.';
    case 'REOPENED':
      return ev.payload?.reason === 'client_replied' ? 'Réouvert automatiquement suite à votre réponse.' : null;
    default:
      return null;
  }
}

function eventDot(ev: TicketEvent, currentUserId?: string | null): { color: string; icon?: keyof typeof Feather.glyphMap; filled: boolean } {
  const isOwn = currentUserId && ev.authorId === currentUserId;
  switch (ev.type) {
    case 'CREATED': return { color: COLORS.greenBrand, icon: 'check', filled: true };
    case 'RESOLVED': return { color: COLORS.greenBrand, icon: 'check', filled: true };
    case 'REOPENED': return { color: COLORS.amber, icon: 'rotate-ccw', filled: true };
    case 'STATUS_CHANGED':
      return ev.payload?.to === 'CLOSED'
        ? { color: COLORS.greenBrand, icon: 'check', filled: true }
        : { color: COLORS.amber, filled: true };
    case 'MESSAGE': return ev.payload?.fromAdmin
      ? { color: COLORS.amber, filled: true }
      : { color: isOwn ? '#3B82F6' : COLORS.greenBrand, filled: true };
    default: return { color: COLORS.amber, filled: true };
  }
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function TicketDetailScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user: authUser } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res: any = await api.tickets.get(id);
      setTicket(res?.data || res);
    } catch (err) {
      devError('[ticket detail]', err);
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Polling léger toutes les 30s pour récupérer les nouvelles réponses admin
  // (en attendant un canal socket dédié aux tickets).
  useEffect(() => {
    if (!id) return;
    const t = setInterval(() => {
      api.tickets.events(id).then((res: any) => {
        const events = res?.data || res;
        if (Array.isArray(events) && ticket && events.length !== (ticket.events?.length ?? 0)) {
          load();
        }
      }).catch(() => {});
    }, 30_000);
    return () => clearInterval(t);
  }, [id, load, ticket]);

  const events = useMemo(() => ticket?.events ?? [], [ticket]);

  const sendMessage = useCallback(async () => {
    if (!id || !message.trim() || sending) return;
    const text = message.trim();
    setSending(true);
    setMessage('');
    try {
      await api.tickets.addMessage(id, text);
      await load();
    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'envoyer votre message.');
      setMessage(text);
    } finally {
      setSending(false);
    }
  }, [id, message, sending, load]);

  const openWhatsApp = useCallback(() => {
    WebBrowser.openBrowserAsync(WHATSAPP_URL);
  }, []);

  const openEmail = useCallback(() => {
    if (!ticket) return;
    const subject = encodeURIComponent(`[${ticketRef(ticket.id)}] ${ticket.title}`);
    Linking.openURL(`mailto:support@thefixed.app?subject=${subject}`);
  }, [ticket]);

  const markResolved = useCallback(() => {
    if (!ticket) return;
    Alert.alert(
      'Marquer comme résolu',
      'Confirmez que votre problème est résolu. Vous pourrez rouvrir le ticket si besoin.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer', onPress: async () => {
            setUpdating(true);
            try {
              await api.patch(`/tickets/${ticket.id}`, { status: 'CLOSED' });
              await load();
            } catch (err) {
              Alert.alert('Erreur', 'Impossible de mettre à jour le ticket.');
            } finally {
              setUpdating(false);
            }
          },
        },
      ],
    );
  }, [ticket, load]);

  const reopen = useCallback(() => {
    if (!ticket) return;
    Alert.alert(
      'Rouvrir le ticket',
      'Le ticket sera marqué comme ouvert et l\'équipe support sera notifiée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Rouvrir', onPress: async () => {
            setUpdating(true);
            try {
              await api.patch(`/tickets/${ticket.id}`, { status: 'OPEN' });
              await load();
            } catch (err) {
              Alert.alert('Erreur', 'Impossible de rouvrir le ticket.');
            } finally {
              setUpdating(false);
            }
          },
        },
      ],
    );
  }, [ticket, load]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={[s.center, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <ActivityIndicator color={theme.text} />
      </SafeAreaView>
    );
  }

  if (!ticket) {
    return (
      <SafeAreaView style={[s.center, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <Feather name="alert-circle" size={36} color={theme.textMuted} />
        <Text style={[s.errText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Ticket introuvable</Text>
        <TouchableOpacity onPress={() => router.back()} style={[s.errBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <Text style={[s.errBtnText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const ref = ticketRef(ticket.id);
  const isClosed = ticket.status === 'CLOSED';

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
          onPress={() => { router.canGoBack() ? router.back() : router.replace('/settings/help'); }}
          activeOpacity={0.75}
          accessibilityLabel="Retour"
        >
          <Feather name="chevron-left" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={[s.refPill, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <Text style={[s.refText, { color: theme.text, fontFamily: FONTS.monoMedium }]}>{ref}</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Status + priority pills ───────────────────────────────────── */}
        <View style={s.pillRow}>
          <View style={[s.pill, { backgroundColor: `${statusColor(ticket.status)}1A` }]}>
            <View style={[s.pillDot, { backgroundColor: statusColor(ticket.status) }]} />
            <Text style={[s.pillText, { color: statusColor(ticket.status), fontFamily: FONTS.monoMedium }]}>
              {statusLabel(ticket.status).toUpperCase()}
            </Text>
          </View>
          <View style={[s.pill, { backgroundColor: `${priorityColor(ticket.priority)}1A` }]}>
            <Feather name="flag" size={11} color={priorityColor(ticket.priority)} />
            <Text style={[s.pillText, { color: priorityColor(ticket.priority), fontFamily: FONTS.monoMedium }]}>
              {priorityLabel(ticket.priority).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* ── Hero title ─────────────────────────────────────────────────── */}
        <Text style={[s.heroTitle, { color: theme.text, fontFamily: FONTS.bebas }]} numberOfLines={3}>
          {ticket.title.toUpperCase()}
        </Text>
        <Text style={[s.heroMeta, { color: theme.textMuted, fontFamily: FONTS.mono }]}>
          OUVERT LE {formatDateTime(ticket.createdAt).toUpperCase()}
          {ticket.requestId ? ` · MISSION #${ticket.requestId}` : ''}
        </Text>

        {/* ── Mission link (si rattaché) ─────────────────────────────────── */}
        {ticket.requestId && (
          <TouchableOpacity
            style={[s.missionLink, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
            onPress={() => router.push({ pathname: '/request/[id]/missionview', params: { id: String(ticket.requestId) } })}
            activeOpacity={0.75}
          >
            <Feather name="link" size={14} color={theme.textSub} />
            <Text style={[s.missionLinkText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
              Ouvrir la mission #{ticket.requestId}
            </Text>
            <Feather name="arrow-up-right" size={14} color={theme.textMuted} />
          </TouchableOpacity>
        )}

        {/* ── Description ─────────────────────────────────────────────── */}
        <View style={[s.divider, { backgroundColor: theme.borderLight }]} />
        <Text style={[s.sectionLabel, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>
          VOTRE SIGNALEMENT
        </Text>
        <Text style={[s.descText, { color: theme.text, fontFamily: FONTS.sans }]}>
          {ticket.description}
        </Text>

        {/* ── Timeline (events réels) ─────────────────────────────────── */}
        <View style={[s.divider, { backgroundColor: theme.borderLight }]} />
        <View style={s.timelineHeader}>
          <Text style={[s.sectionLabel, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>
            HISTORIQUE
          </Text>
          {!isClosed && (
            <Text style={[s.slaText, { color: theme.textSub, fontFamily: FONTS.mono }]}>
              {slaText(ticket.priority)}
            </Text>
          )}
        </View>

        <View style={s.timeline}>
          {events.map((ev, i) => {
            const isLast = i === events.length - 1;
            const dot = eventDot(ev, authUser?.id);
            const isOwnMessage = ev.type === 'MESSAGE' && ev.authorId === authUser?.id;
            const isAdminMessage = ev.type === 'MESSAGE' && ev.payload?.fromAdmin;
            const detail = eventDetail(ev, authUser?.id);
            return (
              <View key={ev.id} style={s.tlRow}>
                <View style={s.tlGutter}>
                  <View style={[s.tlDot, { backgroundColor: dot.filled ? dot.color : 'transparent', borderColor: dot.color }]}>
                    {dot.icon ? (
                      <Feather name={dot.icon} size={10} color="#fff" />
                    ) : (
                      <View style={[s.tlActiveInner, { backgroundColor: '#fff' }]} />
                    )}
                  </View>
                  {!isLast && <View style={[s.tlLine, { backgroundColor: theme.borderLight }]} />}
                </View>
                <View style={s.tlBody}>
                  <View style={s.tlBodyHeader}>
                    <Text style={[s.tlLabel, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
                      {eventLabel(ev)}
                    </Text>
                    <Text style={[s.tlDate, { color: theme.textMuted, fontFamily: FONTS.mono }]}>
                      {formatDateTime(ev.createdAt)}
                    </Text>
                  </View>
                  {detail && (
                    ev.type === 'MESSAGE' ? (
                      <View style={[
                        s.tlMessageBubble,
                        {
                          backgroundColor: isOwnMessage ? theme.surface : isAdminMessage ? 'rgba(245,158,11,0.10)' : theme.cardBg,
                          borderColor: isAdminMessage ? 'rgba(245,158,11,0.30)' : theme.borderLight,
                        },
                      ]}>
                        <Text style={[s.tlMessageText, { color: theme.text, fontFamily: FONTS.sans }]}>
                          {detail}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[s.tlDetail, { color: theme.textSub, fontFamily: FONTS.sans }]}>
                        {detail}
                      </Text>
                    )
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Champ message inline */}
        <View style={[s.replyBox, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <TextInput
            style={[s.replyInput, { color: theme.text, fontFamily: FONTS.sans }]}
            placeholder={isClosed ? 'Rouvrir avec un message…' : 'Ajouter un message…'}
            placeholderTextColor={theme.textMuted}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={2000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[s.replyBtn, { backgroundColor: theme.accent }, (!message.trim() || sending) && { opacity: 0.4 }]}
            onPress={sendMessage}
            disabled={!message.trim() || sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator color={theme.accentText} size="small" />
            ) : (
              <Feather name="arrow-up" size={16} color={theme.accentText} />
            )}
          </TouchableOpacity>
        </View>

        {/* ── Quick actions ───────────────────────────────────────────── */}
        <View style={[s.divider, { backgroundColor: theme.borderLight }]} />
        <Text style={[s.sectionLabel, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>
          CONTACTER LE SUPPORT
        </Text>

        <View style={s.actionsCol}>
          <TouchableOpacity style={s.actionRow} onPress={openWhatsApp} activeOpacity={0.75}>
            <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
            <View style={{ flex: 1 }}>
              <Text style={[s.actionTitle, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
                Continuer sur WhatsApp
              </Text>
              <Text style={[s.actionSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
                Réponse rapide pendant la beta
              </Text>
            </View>
            <Feather name="arrow-up-right" size={14} color={theme.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={s.actionRow} onPress={openEmail} activeOpacity={0.75}>
            <Feather name="mail" size={16} color={theme.textSub} />
            <View style={{ flex: 1 }}>
              <Text style={[s.actionTitle, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
                Répondre par e-mail
              </Text>
              <Text style={[s.actionSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
                support@thefixed.app · sujet pré-rempli
              </Text>
            </View>
            <Feather name="external-link" size={14} color={theme.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Footer CTA ─────────────────────────────────────────────────── */}
      <View style={[s.ctaWrap, { borderTopColor: theme.borderLight, backgroundColor: theme.bg }]}>
        {isClosed ? (
          <TouchableOpacity
            style={[s.ctaBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, borderWidth: 1 }, updating && { opacity: 0.5 }]}
            onPress={reopen}
            disabled={updating}
            activeOpacity={0.8}
          >
            {updating ? <ActivityIndicator color={theme.text} /> : (
              <>
                <Feather name="rotate-ccw" size={16} color={theme.text} />
                <Text style={[s.ctaText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
                  Rouvrir le ticket
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.ctaBtn, { backgroundColor: theme.accent }, updating && { opacity: 0.6 }]}
            onPress={markResolved}
            disabled={updating}
            activeOpacity={0.85}
          >
            {updating ? <ActivityIndicator color={theme.accentText} /> : (
              <>
                <Feather name="check-circle" size={18} color={theme.accentText} />
                <Text style={[s.ctaText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>
                  Marquer comme résolu
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errText: { fontSize: 14 },
  errBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginTop: 8 },
  errBtnText: { fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  refPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  refText: { fontSize: 11, letterSpacing: 1.4 },

  scroll: { paddingHorizontal: 18, paddingBottom: 32 },

  // Pills row
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 10, letterSpacing: 1.2 },

  // Hero
  heroTitle: { fontSize: 32, lineHeight: 34, letterSpacing: -0.4, marginBottom: 6 },
  heroMeta: { fontSize: 10, letterSpacing: 1.2, marginBottom: 14 },

  // Mission link
  missionLink: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 12, borderWidth: 1,
  },
  missionLinkText: { flex: 1, fontSize: 13 },

  // Sections
  divider: { height: 1, marginVertical: 16 },
  sectionLabel: { fontSize: 10, letterSpacing: 1.4, marginBottom: 8 },
  descText: { fontSize: 14, lineHeight: 20 },

  // Timeline
  timelineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  slaText: { fontSize: 10, letterSpacing: 0.8 },
  timeline: { gap: 0 },
  tlRow: { flexDirection: 'row', gap: 14 },
  tlGutter: { alignItems: 'center', width: 18 },
  tlDot: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  tlActiveInner: { width: 6, height: 6, borderRadius: 3 },
  tlLine: { width: 2, flex: 1, marginVertical: 2 },
  tlBody: { flex: 1, paddingBottom: 18 },
  tlBodyHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 2 },
  tlLabel: { fontSize: 14, flexShrink: 1 },
  tlDate: { fontSize: 10, letterSpacing: 0.4 },
  tlDetail: { fontSize: 12, lineHeight: 17 },
  tlMessageBubble: {
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
    marginTop: 4,
  },
  tlMessageText: { fontSize: 13, lineHeight: 18 },

  // Reply input
  replyBox: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8,
    marginTop: 4,
  },
  replyInput: {
    flex: 1, fontSize: 14,
    paddingVertical: 6, paddingHorizontal: 4,
    minHeight: 30, maxHeight: 100,
  },
  replyBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },

  // Actions
  actionsCol: { gap: 4 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
  },
  actionTitle: { fontSize: 14, marginBottom: 1 },
  actionSub: { fontSize: 11 },

  // CTA
  ctaWrap: {
    paddingHorizontal: 18, paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
  },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 14, borderRadius: 14,
  },
  ctaText: { fontSize: 15 },
});
