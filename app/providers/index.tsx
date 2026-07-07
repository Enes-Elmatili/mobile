import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

export default function ProvidersListScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const renderProvider = ({ item }: any) => {
    // Sous-titre : catégorie · ville (jamais l'email — donnée privée)
    const subtitleParts: string[] = [];
    if (item.categories?.[0]?.name) subtitleParts.push(item.categories[0].name);
    if (item.city) subtitleParts.push(item.city);
    const subtitle = subtitleParts.join(' · ');
    const avgRating = Number(item.avgRating) || 0;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}
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
      </TouchableOpacity>
    );
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
        <TouchableOpacity
          onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }}
          style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Feather name="arrow-left" size={18} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>Prestataires</Text>
        <View style={{ width: 36 }} />
      </View>

      {loadError && providers.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="wifi-off" size={64} color={theme.textDisabled} />
          <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
            Impossible de charger les prestataires.
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: theme.accent }]}
            onPress={() => { setLoading(true); loadProviders(); }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Réessayer"
          >
            <Feather name="refresh-cw" size={15} color={theme.accentText} />
            <Text style={[styles.retryBtnText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={providers}
          renderItem={renderProvider}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="users" size={64} color={theme.textDisabled} />
              <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Aucun prestataire disponible</Text>
            </View>
          }
        />
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
  backBtn: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  list: { padding: 16 },
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
