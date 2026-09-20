// app/notifications.tsx — la cloche.
// Enfin complète : elle lit le même catalogue que le push (lib/notify.js côté
// serveur). Sections par jour, une ligne par événement avec sa famille, sa
// mission et sa destination — on tape, on y est. Appui long : le détail.
// Glisser à gauche supprime. « Tout lu » s'efface quand il n'y a rien à lire.
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl, StatusBar, Pressable, SectionList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated from 'react-native-reanimated';
import { api } from '@/lib/api';
import { feedback } from '@/lib/feedback/feedback';
import { devError } from '@/lib/logger';
import { useSocket } from '@/lib/SocketContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { BrandRefreshHeader, useBrandRefresh } from '@/components/ui/BrandRefresh';
import NotificationDetailSheet from '@/components/sheets/NotificationDetailSheet';
import { NotifRow } from '@/components/notifications/NotifRow';
import { groupBySection, type Notif, type Section } from '@/lib/notifications/model';
import { handleNotificationNavigation } from '@/lib/usePushNotifications';

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList) as unknown as typeof SectionList;
const SECTION_KEY: Record<Section, string> = { today: 'notifications.section_today', yesterday: 'notifications.section_yesterday', week: 'notifications.section_week', earlier: 'notifications.section_earlier' };

export default function NotificationsScreen() {
  const { user } = useAuth();
  const isProvider = !!user?.roles?.includes('PROVIDER');
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { clearUnread, socket } = useSocket();
  const brandRefresh = useBrandRefresh();

  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Notif | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const res: any = await api.notifications.list();
      setItems(res?.data ?? []);
      setNow(new Date());
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
    // Le badge tombe dès qu'on ouvre l'écran.
    clearUnread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Une notification qui arrive pendant qu'on est ici entre en tête de liste.
  useEffect(() => {
    if (!socket) return;
    const onNew = (n: any) => { if (n?.id) setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev])); };
    socket.on('notification:received', onNew);
    return () => { socket.off('notification:received', onNew); };
  }, [socket]);

  // Les étiquettes relatives (« il y a 4 min ») avancent toutes les 30 s.
  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(iv); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)));
    try { await api.notifications.markAsRead(id); } catch { /* silent */ }
  }, []);

  // Tap : on y va. La destination se re-résout contre l'état courant de la
  // mission (lib/requestDestination), jamais sur l'intention figée à la création.
  const navigating = useRef(false);
  const handleOpen = useCallback(async (n: Notif) => {
    feedback.haptic('selection');
    if (!n.readAt) markRead(n.id);
    if (!n.data) { setSelected(n); return; }
    if (navigating.current) return;
    navigating.current = true;
    try { await handleNotificationNavigation(n.data, { isProvider }); } finally { navigating.current = false; }
  }, [markRead]);

  const handleLongPress = useCallback((n: Notif) => { feedback.haptic('light'); if (!n.readAt) markRead(n.id); setSelected(n); }, [markRead]);

  const handleMarkAllRead = useCallback(async () => {
    feedback.haptic('light');
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    try { await api.notifications.markAllAsRead(); } catch { /* silent */ }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    try { await api.delete(`/notifications/${id}`); } catch { /* silent */ }
  }, []);

  const unreadCount = items.filter((n) => !n.readAt).length;
  const sections = useMemo(() => groupBySection(items, now).map((s) => ({ title: t(SECTION_KEY[s.section]), section: s.section, data: s.data })), [items, now, t]);

  if (loading) {
    return (
      <SafeAreaView style={[s.center, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <ActivityIndicator size="large" color={theme.accent as string} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      <View style={s.header}>
        <Pressable
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/dashboard'); }}
          style={({ pressed }) => [s.backBtn, { backgroundColor: theme.cardBg, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Feather name="arrow-left" size={18} color={theme.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: theme.text }]} maxFontSizeMultiplier={1.2} accessibilityRole="header">{t('notifications.title').toUpperCase()}</Text>
        <Pressable onPress={handleMarkAllRead} disabled={unreadCount === 0} style={({ pressed }) => [s.markAll, { opacity: unreadCount === 0 ? 0.3 : pressed ? 0.6 : 1 }]} accessibilityRole="button" accessibilityLabel={t('notifications.mark_all_read')} accessibilityState={{ disabled: unreadCount === 0 }} hitSlop={8}>
          <Text style={[s.markAllText, { color: theme.textSub }]} maxFontSizeMultiplier={1.2}>{t('notifications.mark_all_read')}</Text>
        </Pressable>
      </View>

      <BrandRefreshHeader style={brandRefresh.headerStyle} />
      <AnimatedSectionList
        onScroll={brandRefresh.onScroll}
        scrollEventThrottle={16}
        sections={sections}
        keyExtractor={(item: Notif) => item.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }: any) => (
          <View style={s.secHead}>
            <Text style={[s.secTitle, { color: theme.textMuted }]} maxFontSizeMultiplier={1.2}>{String(section.title).toUpperCase()}</Text>
            {section.section === 'today' && unreadCount > 0 ? (
              <Text style={[s.secCount, { color: theme.textSub }]} maxFontSizeMultiplier={1.2}>{t('notifications.unread_count', { count: unreadCount })}</Text>
            ) : null}
          </View>
        )}
        renderItem={({ item, index }: any) => (
          <NotifRow item={item} first={index === 0} now={now} onOpen={handleOpen} onLongPress={handleLongPress} onDelete={handleDelete} />
        )}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="transparent" colors={['transparent']} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={[s.emptyIcon, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Feather name="bell" size={26} color={theme.textMuted} />
            </View>
            <Text style={[s.emptyTitle, { color: theme.textSub }]} maxFontSizeMultiplier={1.2}>{t('notifications.empty_title').toUpperCase()}</Text>
            <Text style={[s.emptySubtitle, { color: theme.textMuted }]} maxFontSizeMultiplier={1.2}>{t('notifications.empty_subtitle')}</Text>
          </View>
        }
      />

      <NotificationDetailSheet
        notif={selected as any}
        isVisible={!!selected}
        onClose={() => setSelected(null)}
        onDelete={handleDelete}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FONTS.bebas, fontSize: 30, letterSpacing: 0.5, includeFontPadding: false },
  markAll: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' },
  markAllText: { fontFamily: FONTS.sansMedium, fontSize: 12.5 },
  list: { paddingBottom: 40 },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 6 },
  secTitle: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 2 },
  secCount: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1 },
  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 40, gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontFamily: FONTS.bebas, fontSize: 26, letterSpacing: 0.5, includeFontPadding: false },
  emptySubtitle: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
