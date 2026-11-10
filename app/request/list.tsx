import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { devError } from '@/lib/logger';
import { feedback } from '@/lib/feedback/feedback';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import type { ServiceRequest } from '@/lib/types';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import Animated from 'react-native-reanimated';
import { BrandRefreshHeader, useBrandRefresh } from '@/components/ui/BrandRefresh';
import { formatEUR } from '@/lib/format';
import { goBack } from '@/lib/nav/back';
import { PressScale } from '@/components/ui/PressScale';
import { bookColumnsFor, foldLineFor, useHinge, useSceneFrame, useSplitPane } from '@/lib/layout';

// Retrait de chaque page du Duo déplié (de part et d'autre du pli).
const PAGE_PAD = 20;

// Clés i18n des statuts bruts de l'enum backend (traduits au rendu).
const STATUS_KEYS: Record<string, string> = {
  PENDING_PAYMENT: 'ext.reqstatus_pending_payment',
  PUBLISHED: 'ext.reqstatus_published',
  ACCEPTED: 'ext.reqstatus_accepted',
  ONGOING: 'ext.reqstatus_ongoing',
  QUOTE_PENDING: 'ext.reqstatus_quote_pending',
  QUOTE_SENT: 'ext.reqstatus_quote_sent',
  QUOTE_ACCEPTED: 'ext.reqstatus_quote_accepted',
  QUOTE_REFUSED: 'ext.reqstatus_quote_refused',
  QUOTE_EXPIRED: 'ext.reqstatus_quote_expired',
  CANCELLED: 'ext.reqstatus_cancelled',
  DONE: 'ext.reqstatus_done',
  COMPLETED: 'ext.reqstatus_done',
  REFUNDED: 'ext.reqstatus_refunded',
  EXPIRED: 'ext.reqstatus_expired',
};

export default function RequestsListScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();

  const statusLabel = (status?: string): string => {
    const key = STATUS_KEYS[(status || '').toUpperCase()];
    return key ? t(key) : (status || '');
  };
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const brandRefresh = useBrandRefresh();
  const [error, setError] = useState(false);

  // Duo déplié : deux colonnes de cartes, la gouttière posée EXACTEMENT sur le
  // pli (une colonne de 835 pt passait sous la charnière). L'écran remplit la
  // scène (InsetScope) : le pli s'y mesure directement.
  const isSplit = useSplitPane();
  const scene = useSceneFrame();
  const hinge = useHinge();
  const cols = bookColumnsFor(foldLineFor(hinge, scene), scene.width);
  const leftCardW = Math.max(0, cols.left - PAGE_PAD * 2);
  const columnGap = cols.gutter + PAGE_PAD * 2;

  const loadRequests = async () => {
    try {
      setError(false);
      const response = await api.requests.list();
      setRequests(response.data || response || []);
    } catch (err) {
      devError('Requests load error:', err);
      setError(true);
      feedback.error(t('ext.reqlist_load_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- un seul chargement au montage ; le focus rattrape
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  const renderRequest = ({ item, index }: { item: ServiceRequest; index: number }) => (
    <PressScale accessibilityRole="button"
      style={[styles.card, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }, isSplit && (index % 2 === 0 ? { width: leftCardW } : styles.rightCard)]}
      onPress={() => {
        router.push({
          pathname: '/request/[id]',
          params: { id: item.id },
        });
      }}
    >
      <Text style={[styles.title, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{item.title}</Text>
      <Text style={[styles.description, { color: theme.textMuted, fontFamily: FONTS.sans }]} numberOfLines={2}>
        {item.description}
      </Text>
      <View style={styles.footer}>
        <Text style={[styles.status, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>{statusLabel(item.status)}</Text>
        <Text style={[styles.price, { color: theme.textAlt, fontFamily: FONTS.bebas, includeFontPadding: false }]}>
          {item.price && item.price > 0
            ? formatEUR(item.price)
            : (item.pricingMode === 'estimate' || item.pricingMode === 'diagnostic')
              ? t('dashboard.badge_quote')
              : '—'}
        </Text>
      </View>
    </PressScale>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      {/* Déplié : le titre à côté du retour, en haut de la page gauche (centré,
          il tombait sur le pli) ; seul le fond de la barre traverse. */}
      <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }, isSplit && styles.headerPage]}>
        <PressScale onPress={() => { goBack(router, '/(tabs)/dashboard'); }} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={8}>
          <Feather name="arrow-left" size={24} color={theme.textAlt} />
        </PressScale>
        <Text style={[styles.headerTitle, { color: theme.textAlt, fontFamily: FONTS.bebas, includeFontPadding: false }]}>{t('ext.list_all_requests')}</Text>
        {isSplit ? null : <View style={{ width: 24 }} />}
      </View>

      {error && requests.length === 0 ? (
        <View style={[styles.empty, isSplit && { width: cols.left }]}>
          <Feather name="alert-circle" size={56} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textSub, fontFamily: FONTS.sans }]}>{t('ext.reqlist_load_error')}</Text>
          <PressScale accessibilityRole="button"
            style={[styles.retryBtn, { backgroundColor: theme.accent }]}
            onPress={() => { setLoading(true); loadRequests(); }}
          >
            <Feather name="refresh-cw" size={16} color={theme.accentText} />
            <Text style={[styles.retryText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>{t('common.retry')}</Text>
          </PressScale>
        </View>
      ) : (
        <>
        <BrandRefreshHeader style={brandRefresh.headerStyle} />
        <Animated.FlatList
          // numColumns ne change pas à chaud : une clé par disposition.
          key={isSplit ? 'book' : 'column'}
          numColumns={isSplit ? 2 : 1}
          columnWrapperStyle={isSplit ? { gap: columnGap } : undefined}
          onScroll={brandRefresh.onScroll}
          scrollEventThrottle={16}
          data={requests}
          renderItem={renderRequest}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={isSplit ? styles.listPage : styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="transparent" colors={['transparent']} />
          }
          ListEmptyComponent={
            <View style={[styles.empty, isSplit && { width: leftCardW }]}>
              <Feather name="file-text" size={64} color={theme.textDisabled} />
              <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>{t('ext.list_no_requests')}</Text>
            </View>
          }
        />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  headerPage: { justifyContent: 'flex-start', gap: 16, paddingHorizontal: PAGE_PAD, paddingTop: 12 },
  headerTitle: { fontSize: 20 },
  list: { padding: 16 },
  listPage: { paddingHorizontal: PAGE_PAD, paddingTop: 16, paddingBottom: 16 },
  rightCard: { flex: 1 },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  title: { fontSize: 18, marginBottom: 8 },
  description: { fontSize: 14, marginBottom: 12 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  status: { fontSize: 12 },
  price: { fontSize: 18 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 14 },
  emptyText: { fontSize: 16, marginTop: 4, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 100, paddingHorizontal: 20, paddingVertical: 12,
  },
  retryText: { fontSize: 14 },
});
