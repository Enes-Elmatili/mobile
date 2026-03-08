// components/discovery/ProviderCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
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
  const isOnline = provider.status === 'ONLINE' || provider.status === 'READY';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(provider)}
      accessibilityRole="button"
      accessibilityLabel={`${provider.name}, ${provider.avgRating} ${t('providers.rating')}, ${provider.distanceKm.toFixed(1)} km`}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{initials(provider.name)}</Text>
        </View>
        {isOnline && (
          <View
            style={styles.onlineDot}
            accessibilityLabel={t('providers.online')}
          />
        )}
      </View>

      {/* Infos */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {provider.name}
        </Text>

        <View style={styles.metaRow}>
          <Ionicons name="star" size={12} color="#1A1A1A" />
          <Text style={styles.metaText}>
            {provider.avgRating.toFixed(1)} · {provider.jobsCompleted}{' '}
            {t('providers.missions')}
          </Text>
        </View>

        {/* Categories */}
        <View style={styles.tagsRow}>
          {provider.categories.slice(0, 3).map((c) => (
            <View key={c.id} style={styles.tag}>
              <Text style={styles.tagText}>{c.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Distance + ETA */}
      <View style={styles.distanceCol}>
        <Text style={styles.distance}>
          {provider.distanceKm.toFixed(1)} {t('providers.km')}
        </Text>
        <Text style={styles.eta}>~{provider.responseTimeMinutes} min</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  avatarContainer: { position: 'relative' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#16a34a',
    borderWidth: 2,
    borderColor: '#fff',
  },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.5)',
    fontWeight: '500',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  tag: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { fontSize: 10, fontWeight: '600', color: '#1A1A1A' },
  distanceCol: { alignItems: 'flex-end', gap: 2 },
  distance: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  eta: { fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: '500' },
});
