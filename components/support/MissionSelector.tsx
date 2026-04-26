// components/support/MissionSelector.tsx
// Étape 1 : choix de la mission concernée. Inclut une recherche pour les
// utilisateurs avec un historique long, et un empty state actionnable.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatEUR } from '@/lib/format';

interface Mission {
  id: number;
  serviceType: string;
  status: string;
  price: number | null;
  createdAt: string;
  address: string;
}

interface MissionSelectorProps {
  missions: Mission[];
  loading: boolean;
  onSelect: (mission: Mission) => void;
  onOther: () => void;
}

const VISIBLE_COUNT_DEFAULT = 5;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

const formatPrice = (price: number | null) => (!price ? '—' : formatEUR(price, 0));

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function MissionSelector({ missions, loading, onSelect, onOther }: MissionSelectorProps) {
  const theme = useAppTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return missions;
    const q = normalize(query);
    return missions.filter(m =>
      normalize(m.serviceType || '').includes(q) ||
      normalize(m.address || '').includes(q) ||
      String(m.id).includes(q),
    );
  }, [missions, query]);

  const visible = useMemo(
    () => (showAll || query.trim() ? filtered : filtered.slice(0, VISIBLE_COUNT_DEFAULT)),
    [filtered, showAll, query],
  );
  const hiddenCount = filtered.length - visible.length;

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="small" color={theme.text} />
        <Text style={[s.loadingLabel, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
          Chargement de vos missions…
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      {/* Recherche — affichée seulement si >3 missions pour éviter le bruit visuel */}
      {missions.length > 3 && (
        <View style={[s.searchBar, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
          <Feather name="search" size={16} color={theme.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher par service, adresse, ou n°"
            placeholderTextColor={theme.textMuted}
            style={[s.searchInput, { color: theme.text, fontFamily: FONTS.sans }]}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Liste */}
      {visible.length === 0 ? (
        <View style={[s.empty, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
          <View style={[s.emptyIcon, { backgroundColor: theme.cardBg }]}>
            <Feather name={query ? 'search' : 'inbox'} size={20} color={theme.textMuted} />
          </View>
          <Text style={[s.emptyTitle, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
            {query ? 'Aucun résultat' : 'Aucune mission récente'}
          </Text>
          <Text style={[s.emptyHint, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
            {query
              ? 'Essayez un autre terme ou choisissez « Question générale » ci-dessous.'
              : 'Créez votre première demande pour pouvoir y associer un ticket support.'}
          </Text>
          {!query && (
            <TouchableOpacity
              style={[s.emptyCta, { backgroundColor: theme.text }]}
              onPress={() => router.push('/request/NewRequestStepper')}
              activeOpacity={0.85}
            >
              <Feather name="plus" size={14} color={theme.bg} />
              <Text style={[s.emptyCtaText, { color: theme.bg, fontFamily: FONTS.sansMedium }]}>
                Nouvelle demande
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {visible.map(mission => (
            <MissionCard key={mission.id} mission={mission} onPress={() => onSelect(mission)} theme={theme} />
          ))}
          {hiddenCount > 0 && !showAll && !query.trim() && (
            <TouchableOpacity
              style={[s.showMore, { borderColor: theme.borderLight }]}
              onPress={() => setShowAll(true)}
              activeOpacity={0.7}
            >
              <Text style={[s.showMoreText, { color: theme.textSub, fontFamily: FONTS.sansMedium }]}>
                Voir {hiddenCount} mission{hiddenCount > 1 ? 's' : ''} de plus
              </Text>
              <Feather name="chevron-down" size={14} color={theme.textSub} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Question générale (toujours visible, séparée d'un divider visuel) */}
      <View style={{ marginTop: 6, gap: 10 }}>
        <View style={s.dividerRow}>
          <View style={[s.dividerLine, { backgroundColor: theme.borderLight }]} />
          <Text style={[s.dividerText, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>OU</Text>
          <View style={[s.dividerLine, { backgroundColor: theme.borderLight }]} />
        </View>
        <TouchableOpacity
          style={[s.otherBtn, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
          onPress={onOther}
          activeOpacity={0.75}
        >
          <View style={[s.otherIcon, { backgroundColor: theme.cardBg }]}>
            <Feather name="help-circle" size={18} color={theme.textSub} />
          </View>
          <View style={s.otherBody}>
            <Text style={[s.otherTitle, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
              Question générale
            </Text>
            <Text style={[s.otherSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
              Compte, facturation, autre sujet…
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={theme.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Mission card ────────────────────────────────────────────────────────────

function MissionCard({ mission, onPress, theme }: {
  mission: Mission;
  onPress: () => void;
  theme: ReturnType<typeof useAppTheme>;
}) {
  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <View style={[s.cardIcon, { backgroundColor: theme.surface }]}>
        <Feather name="tool" size={16} color={theme.textSub} />
      </View>
      <View style={s.cardBody}>
        <Text style={[s.cardTitle, { color: theme.text, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>
          {mission.serviceType || 'Mission'}
        </Text>
        <View style={s.cardMetaRow}>
          <Text style={[s.cardMeta, { color: theme.textMuted, fontFamily: FONTS.mono }]} numberOfLines={1}>
            #{mission.id} · {formatDate(mission.createdAt)}
          </Text>
        </View>
        {!!mission.address && (
          <Text style={[s.cardAddress, { color: theme.textMuted, fontFamily: FONTS.sans }]} numberOfLines={1}>
            {mission.address}
          </Text>
        )}
        <View style={s.cardFooter}>
          <StatusBadge status={mission.status as any} />
          <Text style={[s.cardPrice, { color: theme.text, fontFamily: FONTS.bebas }]}>
            {formatPrice(mission.price)}
          </Text>
        </View>
      </View>
      <Feather name="chevron-right" size={16} color={theme.textMuted} style={{ alignSelf: 'center' }} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  loadingWrap: { paddingVertical: 60, alignItems: 'center', gap: 10 },
  loadingLabel: { fontSize: 13 },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, height: 44,
    borderRadius: 12, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 14, padding: 14, borderWidth: 1,
  },
  cardIcon: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 14 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardMeta: { fontSize: 11, letterSpacing: 0.4 },
  cardAddress: { fontSize: 12 },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4,
  },
  cardPrice: { fontSize: 15, letterSpacing: 0.3 },

  // Show more
  showMore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed',
  },
  showMoreText: { fontSize: 12, letterSpacing: 0.3 },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 10, letterSpacing: 1.4 },

  // Other (Question générale)
  otherBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 14, borderWidth: 1,
  },
  otherIcon: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  otherBody: { flex: 1, gap: 2 },
  otherTitle: { fontSize: 14 },
  otherSub: { fontSize: 12 },

  // Empty
  empty: {
    borderRadius: 16, padding: 24, alignItems: 'center', gap: 10, borderWidth: 1,
  },
  emptyIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 14, marginTop: 4 },
  emptyHint: { fontSize: 12, textAlign: 'center', lineHeight: 18, maxWidth: 260 },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, marginTop: 6,
  },
  emptyCtaText: { fontSize: 13, letterSpacing: 0.4 },
});
