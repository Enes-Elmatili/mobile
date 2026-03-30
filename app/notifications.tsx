// app/notifications.tsx — Centre de notifications
// Palette monochrome · Read/Unread · Swipe to delete · Deep-link par type

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
  Platform, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useSocket } from '@/lib/SocketContext';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

// ─── Formatage date relative ───────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)  return 'À l\'instant';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ─── Icône selon le type ──────────────────────────────────────────────────────
function notifIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'success': return 'checkmark-circle';
    case 'warning': return 'warning';
    case 'error':   return 'close-circle';
    default:        return 'information-circle';
  }
}

// ─── Ligne de notification ─────────────────────────────────────────────────────
interface NotifItem {
  id: string;
  title: string;
  message: string;
  type: string;
  readAt: string | null;
  createdAt: string;
}

function NotifRow({
  item,
  onRead,
  onDelete,
}: {
  item: NotifItem;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const theme = useAppTheme();
  const icon = notifIcon(item.type);
  const isUnread = !item.readAt;

  return (
    <TouchableOpacity
      style={[
        s.row,
        {
          backgroundColor: theme.cardBg,
          borderColor: theme.border,
          ...Platform.select({
            ios: { shadowColor: theme.text, shadowOpacity: theme.shadowOpacity, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 1 },
          }),
        },
        isUnread && { borderColor: theme.borderLight, backgroundColor: theme.surface },
      ]}
      onPress={() => { if (isUnread) onRead(item.id); }}
      activeOpacity={0.75}
    >
      {/* Dot non-lu */}
      {isUnread && <View style={[s.unreadDot, { backgroundColor: theme.accent }]} />}

      {/* Icône type */}
      <View style={[s.iconWrap, { backgroundColor: theme.surface }]}>
        <Ionicons name={icon} size={20} color={theme.textSub} />
      </View>

      {/* Contenu */}
      <View style={s.content}>
        <Text
          style={[
            s.title,
            { color: theme.textSub, fontFamily: FONTS.sansMedium },
            isUnread && { color: theme.textAlt, fontFamily: FONTS.sansMedium },
          ]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text style={[s.message, { color: theme.textMuted, fontFamily: FONTS.sans }]} numberOfLines={2}>{item.message}</Text>
        <Text style={[s.time, { color: theme.textMuted, fontFamily: FONTS.mono }]}>{timeAgo(item.createdAt)}</Text>
      </View>

      {/* Supprimer */}
      <TouchableOpacity
        onPress={() => onDelete(item.id)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={s.deleteBtn}
      >
        <Ionicons name="close" size={16} color={theme.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
export default function NotificationsScreen() {
  const router = useRouter();
  const { clearUnread } = useSocket();
  const theme = useAppTheme();

  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [items,        setItems]        = useState<NotifItem[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await api.notifications.list();
      const data: NotifItem[] = res?.data ?? [];
      setItems(data);
    } catch (e) {
      devError('[Notifications] load error:', e);
      Alert.alert('Erreur', 'Impossible de charger les notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Réinitialiser le badge dès qu'on ouvre l'écran
    clearUnread();
  }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleRead = async (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    try { await api.notifications.markAsRead(id); } catch { /* silent */ }
  };

  const handleMarkAllRead = async () => {
    const unread = items.filter(n => !n.readAt);
    setItems(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    // Marquer chaque notification individuellement (pas d'endpoint bulk côté backend)
    await Promise.allSettled(unread.map(n => api.notifications.markAsRead(n.id)));
  };

  const handleDelete = async (id: string) => {
    setItems(prev => prev.filter(n => n.id !== id));
    try { await api.delete(`/notifications/${id}`); } catch { /* silent */ }
  };

  const unreadCount = items.filter(n => !n.readAt).length;

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

      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: theme.bg }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={theme.textAlt} />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={[s.headerBadge, { backgroundColor: theme.accent }]}>
              <Text style={[s.headerBadgeText, { color: theme.accentText, fontFamily: FONTS.monoMedium }]}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={s.markAllBtn}>
            <Text style={[s.markAllText, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>Tout lire</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {/* ── Liste ── */}
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <NotifRow item={item} onRead={handleRead} onDelete={handleDelete} />
        )}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
        ItemSeparatorComponent={() => <View style={s.separator} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={[s.emptyIcon, { backgroundColor: theme.surface }]}>
              <Ionicons name="notifications-off-outline" size={36} color={theme.textMuted} />
            </View>
            <Text style={[s.emptyTitle, { color: theme.textSub, fontFamily: FONTS.bebas }]}>Aucune notification</Text>
            <Text style={[s.emptySubtitle, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
              Vos notifications apparaîtront ici (nouvelles missions, statuts, gains…)
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 22, letterSpacing: 1 },
  headerBadge: {
    borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  headerBadgeText: { fontSize: 11 },
  markAllBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  markAllText: { fontSize: 13 },

  // Liste
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  separator: { height: 8 },

  // Ligne
  row: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18,
    padding: 14, gap: 12,
    borderWidth: 1,
  },
  rowUnread: {},
  unreadDot: {
    position: 'absolute', top: 14, left: 14,
    width: 8, height: 8, borderRadius: 4,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  content: { flex: 1 },
  title:   { fontSize: 14, marginBottom: 2 },
  titleUnread: {},
  message: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  time:    { fontSize: 11 },
  deleteBtn: { padding: 4 },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle:    { fontSize: 22, letterSpacing: 1 },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 40 },
});
