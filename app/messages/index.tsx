// app/messages/index.tsx — Inbox : liste des conversations
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Platform, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../lib/auth/AuthContext';
import { api } from '../../lib/api';
import { onIncomingMessage, useSocket } from '../../lib/SocketContext';
import { useAppTheme, FONTS, COLORS } from '../../hooks/use-app-theme';
import Avatar from '@/components/ui/Avatar';

// DTO backend: { id, senderId, recipientId, text, createdAt, readAt }
interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  createdAt: string;
  readAt: string | null;
}

interface Conversation {
  userId: string;
  displayName: string;
  lastMessage: string;
  lastAt: string;
  unread: boolean;
}

// ── Contact name cache (module-level, survives unmount, shared with [userId].tsx) ──
const contactNameCache = new Map<string, string>();
export const contactNameCacheGet = (id: string) => contactNameCache.get(id);
export const contactNameCacheSet = (id: string, name: string) => { contactNameCache.set(id, name); };

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} j`;
  return new Date(isoString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function displayLabel(userId: string): string {
  return `Contact #${userId.slice(0, 6).toUpperCase()}`;
}

// ── Avatar ────────────────────────────────────────────────────────────────────
// Consolidé sur le composant partagé @/components/ui/Avatar (voir import en tête).

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function MessagesInbox() {
  const { user } = useAuth();
  const { refreshUnreadMessages } = useSocket();
  const router = useRouter();
  const theme = useAppTheme();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInbox = useCallback(async () => {
    try {
      const res = await api.messages.inbox();
      const messages: Message[] = res?.data ?? res ?? [];

      // Group by the other party (inbox only has received messages, so senderId = other)
      // + compter les messages reçus non lus sur TOUS les messages du groupe
      // (pas seulement le dernier — sinon une conversation dont le dernier
      // message est le mien paraît lue malgré des non-lus en dessous).
      const map = new Map<string, Message>();
      const unreadByContact = new Map<string, boolean>();
      for (const msg of messages) {
        const otherId = msg.senderId === user?.id ? msg.recipientId : msg.senderId;
        const existing = map.get(otherId);
        if (!existing || new Date(msg.createdAt) > new Date(existing.createdAt)) {
          map.set(otherId, msg);
        }
        if (!msg.readAt && msg.recipientId === user?.id) {
          unreadByContact.set(otherId, true);
        }
      }

      const sorted = Array.from(map.entries()).sort(
        ([, a], [, b]) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      const convos: Conversation[] = sorted.map(([uid, msg]) => ({
        userId: uid,
        displayName: displayLabel(uid),
        lastMessage: msg.text,
        lastAt: msg.createdAt,
        unread: unreadByContact.get(uid) === true,
      }));

      // Résoudre les vrais noms AVANT le premier rendu pour éviter le flash
      // "Contact #XXXXXX" — cache module-level pour éviter N appels par ouverture
      const uncachedConvos = convos.filter(c => !contactNameCache.has(c.userId));
      if (uncachedConvos.length > 0) {
        const namePromises = uncachedConvos.map(async (c) => {
          try {
            const res = await api.messages.contactInfo(c.userId);
            const n = res?.data?.name;
            if (n) { contactNameCache.set(c.userId, n); }
          } catch {}
        });
        await Promise.all(namePromises);
      }

      setConversations(convos.map(c => ({
        ...c,
        displayName: contactNameCache.get(c.userId) || c.displayName,
      })));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  // Rafraîchir à chaque focus (retour depuis une conversation : points "non lu"
  // et aperçus à jour) + resynchroniser le badge global depuis le serveur.
  useFocusEffect(useCallback(() => {
    fetchInbox();
    refreshUnreadMessages();
  }, [fetchInbox, refreshUnreadMessages]));

  // Real-time: refresh inbox when a new message arrives
  useEffect(() => {
    return onIncomingMessage(() => {
      fetchInbox();
    });
  }, [fetchInbox]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInbox();
  };

  const renderItem = useCallback(({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={[s.row, { backgroundColor: theme.cardBg }]}
      activeOpacity={0.7}
      onPress={() =>
        router.push({ pathname: '/messages/[userId]', params: { userId: item.userId, name: item.displayName } })
      }
    >
      <Avatar name={item.displayName} size={46} />
      <View style={s.rowContent}>
        <View style={s.rowTop}>
          <Text style={[s.rowName, { color: theme.textAlt }, item.unread && s.rowNameBold]}>{item.displayName}</Text>
          <Text style={[s.rowTime, { color: theme.textMuted }]}>{timeAgo(item.lastAt)}</Text>
        </View>
        <Text
          style={[s.rowPreview, { color: theme.textMuted }, item.unread && { color: theme.textAlt, fontFamily: FONTS.sansBold }]}
          numberOfLines={1}
        >
          {item.lastMessage}
        </Text>
      </View>
      {item.unread && <View style={[s.unreadDot, { backgroundColor: theme.accent }]} />}
    </TouchableOpacity>
  ), [router, theme]);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Header */}
      <View style={[s.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }}
          style={[s.backBtn, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Feather name="arrow-left" size={18} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.textAlt }]}>Messages</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : loadError && conversations.length === 0 ? (
        <View style={s.centered}>
          <Feather name="wifi-off" size={56} color={theme.textDisabled} style={{ marginBottom: 14 }} />
          <Text style={[s.emptyTitle, { color: theme.textAlt }]}>Impossible de charger vos messages.</Text>
          <Text style={[s.emptyTitle, { color: theme.textMuted, fontSize: 13, marginTop: 6, marginBottom: 18 }]}>
            Vérifiez votre connexion et réessayez.
          </Text>
          <TouchableOpacity
            style={[s.emptyBtn, { backgroundColor: theme.accent }]}
            onPress={() => { setLoading(true); fetchInbox(); }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Réessayer"
          >
            <Text style={[s.emptyBtnText, { color: theme.accentText }]}>RÉESSAYER</Text>
            <Feather name="refresh-cw" size={15} color={theme.accentText} />
          </TouchableOpacity>
        </View>
      ) : conversations.length === 0 ? (
        <View style={s.centered}>
          <Feather name="message-circle" size={56} color={theme.textDisabled} style={{ marginBottom: 14 }} />
          <Text style={[s.emptyTitle, { color: theme.textAlt }]}>Aucun message.</Text>
          <Text style={[s.emptyTitle, { color: theme.textMuted, fontSize: 13, marginTop: 6, marginBottom: 18 }]}>
            Vos échanges avec les prestataires apparaîtront ici.
          </Text>
          <TouchableOpacity
            style={[s.emptyBtn, { backgroundColor: theme.accent }]}
            onPress={() => router.replace('/(tabs)/dashboard')}
            activeOpacity={0.85}
          >
            <Text style={[s.emptyBtnText, { color: theme.accentText }]}>TROUVER UN PRO</Text>
            <Feather name="arrow-right" size={15} color={theme.accentText} />
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.userId}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
          }
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={[s.separator, { backgroundColor: theme.border }]} />}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontFamily: FONTS.bebas, letterSpacing: 0.5 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { fontSize: 22, fontFamily: FONTS.bebas, marginBottom: 20 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 100,
    paddingHorizontal: 22, paddingVertical: 14,
  },
  emptyBtnText: { fontSize: 13, fontFamily: FONTS.sansMedium, letterSpacing: 1 },

  list: { paddingVertical: 8 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 13,
  },
  rowContent: { flex: 1, gap: 4 },
  rowTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  rowName: { fontSize: 15, fontFamily: FONTS.sansMedium },
  rowNameBold: { fontFamily: FONTS.sansBold },
  rowTime: { fontSize: 12, fontFamily: FONTS.mono },
  rowPreview: { fontSize: 13, fontFamily: FONTS.sans },
  unreadDot: {
    width: 10, height: 10, borderRadius: 5,
    flexShrink: 0,
  },
  separator: { height: 1, marginLeft: 75 },
});
