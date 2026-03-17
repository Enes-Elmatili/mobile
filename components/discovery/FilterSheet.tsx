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
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
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
  const theme = useAppTheme();
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
    <View style={[styles.sheet, { backgroundColor: theme.cardBg }]}>
      <View style={[styles.handle, { backgroundColor: theme.textDisabled }]} />
      <Text style={[styles.title, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{t('discovery.filters')}</Text>

      {/* Category */}
      <Text style={[styles.sectionLabel, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>{t('discovery.filterService')}</Text>
      {loadingCats ? (
        <ActivityIndicator size="small" color={theme.accent} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.optionsRow}
        >
          <TouchableOpacity
            style={[styles.chip, { borderColor: theme.borderLight }, filters.categoryId === null && { backgroundColor: theme.accent, borderColor: theme.accent }]}
            onPress={() => onUpdate({ categoryId: null })}
            accessibilityRole="button"
            accessibilityState={{ selected: filters.categoryId === null }}
            accessibilityLabel={t('discovery.allServices')}
          >
            <Text
              style={[
                styles.chipText,
                { color: theme.text, fontFamily: FONTS.sansMedium },
                filters.categoryId === null && { color: theme.accentText },
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
                { borderColor: theme.borderLight },
                filters.categoryId === cat.id && { backgroundColor: theme.accent, borderColor: theme.accent },
              ]}
              onPress={() => onUpdate({ categoryId: cat.id })}
              accessibilityRole="button"
              accessibilityState={{ selected: filters.categoryId === cat.id }}
              accessibilityLabel={cat.name}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: theme.text, fontFamily: FONTS.sansMedium },
                  filters.categoryId === cat.id && { color: theme.accentText },
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Radius */}
      <Text style={[styles.sectionLabel, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>{t('discovery.filterRadius')}</Text>
      <View style={styles.optionsGrid}>
        {RADIUS_OPTIONS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, { borderColor: theme.borderLight }, filters.radiusKm === r && { backgroundColor: theme.accent, borderColor: theme.accent }]}
            onPress={() => onUpdate({ radiusKm: r })}
            accessibilityRole="button"
            accessibilityState={{ selected: filters.radiusKm === r }}
            accessibilityLabel={`${r} km`}
          >
            <Text
              style={[
                styles.chipText,
                { color: theme.text, fontFamily: FONTS.sansMedium },
                filters.radiusKm === r && { color: theme.accentText },
              ]}
            >
              {r} km
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Min rating */}
      <Text style={[styles.sectionLabel, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>{t('discovery.filterRating')}</Text>
      <View style={styles.optionsGrid}>
        {RATING_OPTIONS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, { borderColor: theme.borderLight }, filters.minRating === r && { backgroundColor: theme.accent, borderColor: theme.accent }]}
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
                { color: theme.text, fontFamily: FONTS.sansMedium },
                filters.minRating === r && { color: theme.accentText },
              ]}
            >
              {r === 0 ? t('discovery.allRatings') : `${r}+`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.closeButton, { backgroundColor: theme.accent }]}
        onPress={onClose}
        accessibilityRole="button"
      >
        <Text style={[styles.closeText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>{t('common.close')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    letterSpacing: -0.5,
  },
  sectionLabel: {
    fontSize: 12,
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
    marginRight: 8,
  },
  chipText: { fontSize: 13 },
  closeButton: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  closeText: { fontSize: 15 },
});
