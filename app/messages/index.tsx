// app/messages/index.tsx — Inbox : liste des conversations
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, RefreshControl, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/AuthContext';
import { api } from '../../lib/api';
import { onIncomingMessage, useSocket } from '../../lib/SocketContext';

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

function Avatar({ name, size = 46 }: { name: string; size?: number }) {
  const initials = name
    .split(/[\s#]/)
    .filter(Boolean)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
  const palette = ['#1A1A1A', '#2D2D2D', '#404040', '#555', '#333', '#666'];
  const bg = palette[name.charCodeAt(0) % palette.length];
  return (
    <View style={[av.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[av.text, { fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
  );
}

const av = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#FFF', fontWeight: '800' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function MessagesInbox() {
  const { user } = useAuth();
  const { clearUnreadMessages } = useSocket();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInbox = useCallback(async () => {
    try {
      const res = await api.messages.inbox();
      const messages: Message[] = res?.data ?? res ?? [];

      // Group by the other party (inbox only has received messages, so senderId = other)
      const map = new Map<string, Message>();
      for (const msg of messages) {
        const otherId = msg.senderId === user?.id ? msg.recipientId : msg.senderId;
        const existing = map.get(otherId);
        if (!existing || new Date(msg.createdAt) > new Date(existing.createdAt)) {
          map.set(otherId, msg);
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
        unread: !msg.readAt && msg.recipientId === user?.id,
      }));

      setConversations(convos);
    } catch {
      // keep empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchInbox();
    clearUnreadMessages();
  }, []);

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
      style={s.row}
      activeOpacity={0.7}
      onPress={() =>
        router.push({ pathname: '/messages/[userId]', params: { userId: item.userId } })
      }
    >
      <Avatar name={item.displayName} />
      <View style={s.rowContent}>
        <View style={s.rowTop}>
          <Text style={[s.rowName, item.unread && s.rowNameBold]}>{item.displayName}</Text>
          <Text style={s.rowTime}>{timeAgo(item.lastAt)}</Text>
        </View>
        <Text
          style={[s.rowPreview, item.unread && s.rowPreviewBold]}
          numberOfLines={1}
        >
          {item.lastMessage}
        </Text>
      </View>
      {item.unread && <View style={s.unreadDot} />}
    </TouchableOpacity>
  ), [router]);

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Messages</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#111" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={s.centered}>
          <Text style={s.emptyTitle}>Aucun message.</Text>
          <TouchableOpacity
            style={s.emptyBtn}
            onPress={() => router.replace('/(tabs)/dashboard')}
            activeOpacity={0.85}
          >
            <Text style={s.emptyBtnText}>TROUVER UN PRO</Text>
            <Ionicons name="arrow-forward" size={15} color="#FFF" />
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.userId}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111" />
          }
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FB' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 20 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#111', borderRadius: 4,
    paddingHorizontal: 22, paddingVertical: 14,
  },
  emptyBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF', letterSpacing: 1 },

  list: { paddingVertical: 8 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 13,
    backgroundColor: '#FFF',
  },
  rowContent: { flex: 1, gap: 4 },
  rowTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  rowName: { fontSize: 15, fontWeight: '600', color: '#111' },
  rowNameBold: { fontWeight: '800' },
  rowTime: { fontSize: 12, color: '#ADADAD' },
  rowPreview: { fontSize: 13, color: '#ADADAD' },
  rowPreviewBold: { color: '#111', fontWeight: '600' },
  unreadDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#111', flexShrink: 0,
  },
  separator: { height: 1, backgroundColor: '#F0F0F0', marginLeft: 75 },
});
