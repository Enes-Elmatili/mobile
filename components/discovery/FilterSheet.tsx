// components/discovery/FilterSheet.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { DiscoveryFilters } from '../../hooks/useProviderDiscovery';

interface Props {
  filters: DiscoveryFilters;
  onUpdate: (filters: Partial<DiscoveryFilters>) => void;
  onClose: () => void;
}

interface CategoryOption {
  id: number;
  name: string;
}

const RADIUS_OPTIONS = [2, 5, 10, 20];
const RATING_OPTIONS = [0, 3, 4, 4.5];

export function FilterSheet({ filters, onUpdate, onClose }: Props) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await api.taxonomies.list();
        const cats = res?.categories ?? res?.data ?? res ?? [];
        setCategories(Array.isArray(cats) ? cats : []);
      } catch {
        setCategories([]);
      } finally {
        setLoadingCats(false);
      }
    })();
  }, []);

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <Text style={styles.title}>{t('discovery.filters')}</Text>

      {/* Category */}
      <Text style={styles.sectionLabel}>{t('discovery.filterService')}</Text>
      {loadingCats ? (
        <ActivityIndicator size="small" color="#1A1A1A" />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.optionsRow}
        >
          <TouchableOpacity
            style={[styles.chip, filters.categoryId === null && styles.chipActive]}
            onPress={() => onUpdate({ categoryId: null })}
            accessibilityRole="button"
            accessibilityState={{ selected: filters.categoryId === null }}
            accessibilityLabel={t('discovery.allServices')}
          >
            <Text
              style={[
                styles.chipText,
                filters.categoryId === null && styles.chipTextActive,
              ]}
            >
              {t('discovery.allServices')}
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.chip,
                filters.categoryId === cat.id && styles.chipActive,
              ]}
              onPress={() => onUpdate({ categoryId: cat.id })}
              accessibilityRole="button"
              accessibilityState={{ selected: filters.categoryId === cat.id }}
              accessibilityLabel={cat.name}
            >
              <Text
                style={[
                  styles.chipText,
                  filters.categoryId === cat.id && styles.chipTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Radius */}
      <Text style={styles.sectionLabel}>{t('discovery.filterRadius')}</Text>
      <View style={styles.optionsGrid}>
        {RADIUS_OPTIONS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, filters.radiusKm === r && styles.chipActive]}
            onPress={() => onUpdate({ radiusKm: r })}
            accessibilityRole="button"
            accessibilityState={{ selected: filters.radiusKm === r }}
            accessibilityLabel={`${r} km`}
          >
            <Text
              style={[
                styles.chipText,
                filters.radiusKm === r && styles.chipTextActive,
              ]}
            >
              {r} km
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Min rating */}
      <Text style={styles.sectionLabel}>{t('discovery.filterRating')}</Text>
      <View style={styles.optionsGrid}>
        {RATING_OPTIONS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, filters.minRating === r && styles.chipActive]}
            onPress={() => onUpdate({ minRating: r })}
            accessibilityRole="button"
            accessibilityState={{ selected: filters.minRating === r }}
            accessibilityLabel={
              r === 0 ? t('discovery.allRatings') : `${r} min`
            }
          >
            <Text
              style={[
                styles.chipText,
                filters.minRating === r && styles.chipTextActive,
              ]}
            >
              {r === 0 ? t('discovery.allRatings') : `${r}+`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.closeButton}
        onPress={onClose}
        accessibilityRole="button"
      >
        <Text style={styles.closeText}>{t('common.close')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  optionsRow: { flexDirection: 'row' },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  chipTextActive: { color: '#fff' },
  closeButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  closeText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
