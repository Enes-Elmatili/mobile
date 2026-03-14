// app/discovery.tsx — Provider discovery screen with filters
import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  useProviderDiscovery,
  type DiscoveredProvider,
} from '../hooks/useProviderDiscovery';
import { ProviderCard } from '../components/discovery/ProviderCard';
import { FilterSheet } from '../components/discovery/FilterSheet';

export default function DiscoveryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useAppTheme();
  const { providers, filters, updateFilters, isLoading, error, refresh } =
    useProviderDiscovery();
  const [showFilters, setShowFilters] = useState(false);

  const activeFiltersCount = [
    filters.categoryId !== null,
    filters.radiusKm !== 5,
    filters.minRating > 0,
  ].filter(Boolean).length;

  function handleProviderPress(provider: DiscoveredProvider) {
    router.push(`/providers/${provider.id}` as any);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={[styles.headerBack, { backgroundColor: theme.surface }]}
        >
          <Ionicons name="arrow-back" size={20} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textAlt }]}>{t('discovery.title')}</Text>
        <TouchableOpacity
          style={[
            styles.filterButton,
            { borderColor: theme.border },
            activeFiltersCount > 0 && { backgroundColor: theme.accent, borderColor: theme.accent },
          ]}
          onPress={() => setShowFilters(true)}
          accessibilityRole="button"
          accessibilityLabel={t('discovery.openFilters', {
            count: activeFiltersCount,
          })}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={activeFiltersCount > 0 ? theme.accentText : theme.textAlt}
          />
          {activeFiltersCount > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: theme.accent }]}>
              <Text style={[styles.filterBadgeText, { color: theme.accentText }]}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Subtitle */}
      <Text style={[styles.subtitle, { color: theme.textMuted, backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        {isLoading
          ? t('discovery.searching')
          : t('discovery.found', {
              count: providers.length,
              radius: filters.radiusKm,
            })}
      </Text>

      {/* Content */}
      {isLoading && providers.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : error === 'permission_denied' ? (
        <View style={styles.center}>
          <Ionicons
            name="location-outline"
            size={48}
            color={theme.textDisabled}
          />
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t('discovery.locationDenied')}</Text>
        </View>
      ) : providers.length === 0 && !isLoading ? (
        <View style={styles.center}>
          <Ionicons
            name="search-outline"
            size={48}
            color={theme.textDisabled}
          />
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t('discovery.noProviders')}</Text>
          <TouchableOpacity
            onPress={() => updateFilters({ radiusKm: filters.radiusKm + 5 })}
            style={[styles.expandButton, { backgroundColor: theme.accent }]}
          >
            <Text style={[styles.expandText, { color: theme.accentText }]}>
              {t('discovery.expandRadius')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={providers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProviderCard provider={item} onPress={handleProviderPress} />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Filter Bottom Sheet */}
      {showFilters && (
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.overlayBg}
            onPress={() => setShowFilters(false)}
            activeOpacity={1}
          />
          <View style={styles.sheetContainer}>
            <FilterSheet
              filters={filters}
              onUpdate={(f) => updateFilters(f)}
              onClose={() => setShowFilters(false)}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
  },
  headerBack: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 9, fontWeight: '700' },
  subtitle: {
    fontSize: 13,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  list: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  expandButton: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  expandText: { fontWeight: '600', fontSize: 14 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetContainer: { margin: 16 },
});
