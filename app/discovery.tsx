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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  useProviderDiscovery,
  type DiscoveredProvider,
} from '../hooks/useProviderDiscovery';
import { ProviderCard } from '../components/discovery/ProviderCard';
import { FilterSheet } from '../components/discovery/FilterSheet';

export default function DiscoveryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={styles.headerBack}
        >
          <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('discovery.title')}</Text>
        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFiltersCount > 0 && styles.filterButtonActive,
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
            color={activeFiltersCount > 0 ? '#fff' : '#1A1A1A'}
          />
          {activeFiltersCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Subtitle */}
      <Text style={styles.subtitle}>
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
          <ActivityIndicator size="large" color="#1A1A1A" />
        </View>
      ) : error === 'permission_denied' ? (
        <View style={styles.center}>
          <Ionicons
            name="location-outline"
            size={48}
            color="rgba(0,0,0,0.2)"
          />
          <Text style={styles.emptyText}>{t('discovery.locationDenied')}</Text>
        </View>
      ) : providers.length === 0 && !isLoading ? (
        <View style={styles.center}>
          <Ionicons
            name="search-outline"
            size={48}
            color="rgba(0,0,0,0.2)"
          />
          <Text style={styles.emptyText}>{t('discovery.noProviders')}</Text>
          <TouchableOpacity
            onPress={() => updateFilters({ radiusKm: filters.radiusKm + 5 })}
            style={styles.expandButton}
          >
            <Text style={styles.expandText}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
  },
  headerBack: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  subtitle: {
    fontSize: 13,
    color: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  list: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: {
    fontSize: 15,
    color: 'rgba(0,0,0,0.4)',
    fontWeight: '500',
    textAlign: 'center',
  },
  expandButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  expandText: { color: '#fff', fontWeight: '600', fontSize: 14 },
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
