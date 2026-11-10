import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import Animated from 'react-native-reanimated';
import { BrandRefreshHeader, useBrandRefresh } from '@/components/ui/BrandRefresh';
import { goBack } from '@/lib/nav/back';
import { PressScale } from '@/components/ui/PressScale';
import { useTranslation } from 'react-i18next';
import { bookColumnsFor, foldLineFor, useHinge, useSceneFrame, useSplitPane } from '@/lib/layout';

export default function ProvidersListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useAppTheme();
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const brandRefresh = useBrandRefresh();
  // Duo déplié : deux colonnes, la gouttière posée sur le pli (la liste
  // occupe toute la scène, ses colonnes se calent sur le cadre de la scène).
  const isSplit = useSplitPane();
  const scene = useSceneFrame();
  const hinge = useHinge();
  const cols = bookColumnsFor(foldLineFor(hinge, scene), scene.width);

  const loadProviders = useCallback(async () => {
    try {
      const response = await api.providers.list();
      setProviders(response.data || response || []);
      setLoadError(false);
    } catch (error) {
      devError('Providers load error:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const onRefresh = () => {
    setRefreshing(true);
    loadProviders();
  };

  const renderProvider = ({ item, index }: any) => {
    // Sous-titre : catégorie · ville (jamais l'email — donnée privée)
    const subtitleParts: string[] = [];
    if (item.categories?.[0]?.name) subtitleParts.push(item.categories[0].name);
    if (item.city) subtitleParts.push(item.city);
    const subtitle = subtitleParts.join(' · ');
    const avgRating = Number(item.avgRating) || 0;

    const card = (
      <PressScale accessibilityRole="button"
        style={[styles.card, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }, isSplit && styles.cardCell]}
        onPress={() => {
          router.push({
            pathname: '/providers/[id]',
            params: { id: item.id },
          });
        }}
      >
        <View style={[styles.avatar, { backgroundColor: theme.surface }]}>
          <Feather name="user" size={32} color={theme.textAlt} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{item.name || 'Prestataire'}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: FONTS.sans }]}>{subtitle}</Text>
          ) : null}
          {avgRating > 0 && (
            <View style={styles.ratingRow}>
              <Feather name="star" size={12} color={COLORS.amber} />
              <Text style={[styles.ratingText, { color: theme.textSub, fontFamily: FONTS.sansMedium }]}>
                {avgRating.toFixed(1)}
              </Text>
            </View>
          )}
        </View>
        <Feather name="chevron-right" size={24} color={theme.textMuted} />
      </PressScale>
    );
    if (!isSplit) return card;
    // Colonne gauche : s'arrête au pli ; colonne droite : reprend après lui.
    return index % 2 === 0
      ? <View style={[styles.cell, { width: cols.left }]}>{card}</View>
      : <View style={[styles.cell, styles.cellRight, { marginLeft: cols.gutter }]}>{card}</View>;
  };

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
      <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
        <PressScale
          onPress={() => { goBack(router, '/(tabs)/dashboard'); }}
          style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Feather name="arrow-left" size={18} color={theme.textAlt} />
        </PressScale>
        <Text style={[styles.title, { color: theme.textAlt, fontFamily: FONTS.bebas, includeFontPadding: false }, isSplit && styles.titlePage]} numberOfLines={isSplit ? 1 : undefined}>Prestataires</Text>
        {isSplit ? null : <View style={{ width: 36 }} />}
      </View>

      {loadError && providers.length === 0 ? (
        <View style={[styles.empty, isSplit && { width: cols.left }]}>
          <Feather name="wifi-off" size={64} color={theme.textDisabled} />
          <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
            Impossible de charger les prestataires.
          </Text>
          <PressScale
            style={[styles.retryBtn, { backgroundColor: theme.accent }]}
            onPress={() => { setLoading(true); loadProviders(); }}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
          >
            <Feather name="refresh-cw" size={15} color={theme.accentText} />
            <Text style={[styles.retryBtnText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>Réessayer</Text>
          </PressScale>
        </View>
      ) : (
        <>
        {isSplit ? (
          // Le « fixed. » du tirage reste sur la page gauche, pas sur le pli.
          <View pointerEvents="none" style={[styles.refreshPage, { width: cols.left }]}>
            <BrandRefreshHeader style={brandRefresh.headerStyle} />
          </View>
        ) : (
          <BrandRefreshHeader style={brandRefresh.headerStyle} />
        )}
        <Animated.FlatList
          // Changer numColumns exige un nouveau montage (pliage / dépliage).
          key={isSplit ? 'book' : 'column'}
          numColumns={isSplit ? 2 : 1}
          onScroll={brandRefresh.onScroll}
          scrollEventThrottle={16}
          data={providers}
          renderItem={renderProvider}
          keyExtractor={(item) => item.id}
          contentContainerStyle={isSplit ? styles.listBook : styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="transparent" colors={['transparent']} />
          }
          ListEmptyComponent={
            <View style={[styles.empty, isSplit && { width: cols.left }]}>
              <Feather name="users" size={64} color={theme.textDisabled} />
              <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Aucun prestataire disponible</Text>
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
  title: { fontSize: 20 },
  // Duo déplié : titre calé à côté du retour, en haut de la page gauche.
  titlePage: { flex: 1, marginLeft: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  list: { padding: 16 },
  // Duo déplié : pas de marge latérale, chaque cellule porte ses 20 pt de page.
  listBook: { paddingTop: 16, paddingBottom: 16 },
  cell: { paddingHorizontal: 20 },
  cellRight: { flex: 1 },
  cardCell: { flex: 1 },
  refreshPage: { position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: { flex: 1 },
  name: { fontSize: 16 },
  subtitle: { fontSize: 13, marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, marginTop: 16 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 100, paddingHorizontal: 22, paddingVertical: 12,
    marginTop: 18,
  },
  retryBtnText: { fontSize: 13, letterSpacing: 0.5 },
});
