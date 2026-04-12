// components/discovery/ProviderCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import type { DiscoveredProvider } from '../../hooks/useProviderDiscovery';

interface Props {
  provider: DiscoveredProvider;
  onPress: (provider: DiscoveredProvider) => void;
}

function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ProviderCard({ provider, onPress }: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const isOnline = provider.status === 'ONLINE' || provider.status === 'READY';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
      onPress={() => onPress(provider)}
      accessibilityRole="button"
      accessibilityLabel={`${provider.name}, ${provider.avgRating} ${t('providers.rating')}, ${provider.distanceKm.toFixed(1)} km`}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
          <Text style={[styles.avatarInitial, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>{initials(provider.name)}</Text>
        </View>
        {isOnline && (
          <View
            style={[styles.onlineDot, { backgroundColor: COLORS.green, borderColor: theme.cardBg }]}
            accessibilityLabel={t('providers.online')}
          />
        )}
      </View>

      {/* Infos */}
      <View style={styles.info}>
        <Text style={[styles.name, { color: theme.text, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>
          {provider.name}
        </Text>

        <View style={styles.metaRow}>
          <Feather name="star" size={12} color={theme.text} />
          <Text style={[styles.metaText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
            {provider.avgRating.toFixed(1)} · {provider.jobsCompleted}{' '}
            {t('providers.missions')}
          </Text>
        </View>

        {/* Categories */}
        <View style={styles.tagsRow}>
          {provider.categories.slice(0, 3).map((c) => (
            <View key={c.id} style={[styles.tag, { backgroundColor: theme.surfaceAlt }]}>
              <Text style={[styles.tagText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{c.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Distance + ETA */}
      <View style={styles.distanceCol}>
        <Text style={[styles.distance, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
          {provider.distanceKm.toFixed(1)} {t('providers.km')}
        </Text>
        <Text style={[styles.eta, { color: theme.textMuted, fontFamily: FONTS.sans }]}>~{provider.responseTimeMinutes} min</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
  },
  avatarContainer: { position: 'relative' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 16 },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 14, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: {
    fontSize: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  tag: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { fontSize: 10 },
  distanceCol: { alignItems: 'flex-end', gap: 2 },
  distance: { fontSize: 13 },
  eta: { fontSize: 11 },
});
