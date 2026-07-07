// app/notifications.tsx — Centre de notifications
// Palette monochrome · Read/Unread · Swipe to delete · Deep-link par type

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
  Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import { api } from '@/lib/api';
import { feedback } from '@/lib/feedback/feedback';
import { devError } from '@/lib/logger';
import { useSocket } from '@/lib/SocketContext';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import NotificationDetailSheet from '@/components/sheets/NotificationDetailSheet';

// ─── Formatage date relative ───────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)  return i18n.t('notifications.time_now');
  if (diff < 3600) return i18n.t('notifications.time_min', { n: Math.floor(diff / 60) });
  if (diff < 86400) return i18n.t('notifications.time_hour', { n: Math.floor(diff / 3600) });
  if (diff < 604800) return i18n.t('notifications.time_day', { n: Math.floor(diff / 86400) });
  return new Date(dateStr).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
}

// ─── Icône selon le type ──────────────────────────────────────────────────────
function notifIcon(type: string): keyof typeof Feather.glyphMap {
  switch (type) {
    case 'success': return 'check-circle';
    case 'warning': return 'alert-triangle';
    case 'error':   return 'x-circle';
    default:        return 'info';
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
  data?: {
    category?: string;
    screen?: string;
    type?: string;
    requestId?: number | string;
    disputeId?: string;
    senderId?: string;
  } | null;
}

function NotifRow({
  item,
  onOpen,
  onDelete,
}: {
  item: NotifItem;
  onOpen: (item: NotifItem) => void;
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
      onPress={() => onOpen(item)}
      activeOpacity={0.75}
    >
      {/* Dot non-lu */}
      {isUnread && <View style={[s.unreadDot, { backgroundColor: theme.accent }]} />}

      {/* Icône type */}
      <View style={[s.iconWrap, { backgroundColor: theme.surface }]}>
        <Feather name={icon} size={20} color={theme.textSub} />
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
        <Feather name="x" size={16} color={theme.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
export default function NotificationsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { clearUnread } = useSocket();
  const theme = useAppTheme();

  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [items,        setItems]        = useState<NotifItem[]>([]);
  const [selected,     setSelected]     = useState<NotifItem | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.notifications.list();
      const data: NotifItem[] = res?.data ?? [];
      setItems(data);
    } catch (e) {
      devError('[Notifications] load error:', e);
      feedback.error('notifications.load_error');
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

  const handleOpen = (item: NotifItem) => {
    feedback.haptic('selection');
    setSelected(item);
    if (!item.readAt) handleRead(item.id);
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
          onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }}
          style={[s.backBtn, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={18} color={theme.textAlt} />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>{t('notifications.title')}</Text>
          {unreadCount > 0 && (
            <View style={[s.headerBadge, { backgroundColor: theme.accent }]}>
              <Text style={[s.headerBadgeText, { color: theme.accentText, fontFamily: FONTS.monoMedium }]}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={s.markAllBtn}>
            <Text style={[s.markAllText, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>{t('notifications.mark_all_read')}</Text>
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
          <NotifRow item={item} onOpen={handleOpen} onDelete={handleDelete} />
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
              <Feather name="bell-off" size={36} color={theme.textMuted} />
            </View>
            <Text style={[s.emptyTitle, { color: theme.textSub, fontFamily: FONTS.bebas }]}>{t('notifications.empty_title')}</Text>
            <Text style={[s.emptySubtitle, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
              {t('notifications.empty_subtitle')}
            </Text>
          </View>
        }
      />

      <NotificationDetailSheet
        notif={selected}
        isVisible={!!selected}
        onClose={() => setSelected(null)}
        onDelete={handleDelete}
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
  backBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
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
