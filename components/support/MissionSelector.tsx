// components/support/MissionSelector.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import StatusBadge from '@/components/ui/StatusBadge';

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

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatPrice = (price: number | null): string => {
  if (!price) return '--';
  return price.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';
};

export default function MissionSelector({ missions, loading, onSelect, onOther }: MissionSelectorProps) {
  const theme = useAppTheme();

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Text style={[s.title, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
        Quelle mission concerne votre problème ?
      </Text>
      <Text style={[s.subtitle, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
        Sélectionnez la mission concernée
      </Text>

      <View style={s.list}>
        {missions.map((mission) => (
          <TouchableOpacity
            key={mission.id}
            style={[s.card, {
              backgroundColor: theme.cardBg, borderColor: theme.borderLight,
              ...Platform.select({
                ios: { shadowColor: '#000', shadowOpacity: theme.shadowOpacity, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
                android: { elevation: 2 },
              }),
            }]}
            onPress={() => onSelect(mission)}
            activeOpacity={0.7}
          >
            <View style={s.cardTop}>
              <View style={s.cardInfo}>
                <Text style={[s.serviceName, { color: theme.text, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>
                  {mission.serviceType}
                </Text>
                <Text style={[s.date, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
                  {formatDate(mission.createdAt)}
                </Text>
              </View>
              <Text style={[s.price, { color: theme.text, fontFamily: FONTS.monoMedium }]}>
                {formatPrice(mission.price)}
              </Text>
            </View>
            <View style={s.cardBottom}>
              <StatusBadge status={mission.status as any} />
              <Feather name="chevron-right" size={16} color={theme.textMuted} />
            </View>
          </TouchableOpacity>
        ))}

        {missions.length === 0 && (
          <View style={[s.emptyCard, { backgroundColor: theme.surface }]}>
            <Text style={[s.emptyText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
              Aucune mission récente
            </Text>
          </View>
        )}
      </View>

      {/* Autre probleme */}
      <TouchableOpacity
        style={[s.otherBtn, { backgroundColor: theme.surface }]}
        onPress={onOther}
        activeOpacity={0.7}
      >
        <View style={[s.otherIcon, { backgroundColor: theme.cardBg }]}>
          <Feather name="help-circle" size={20} color={theme.textSub} />
        </View>
        <Text style={[s.otherText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
          Autre problème
        </Text>
        <Feather name="chevron-right" size={16} color={theme.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 16 },
  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  title: { fontSize: 20, lineHeight: 26 },
  subtitle: { fontSize: 14, marginTop: -8 },
  list: { gap: 10 },
  card: {
    borderRadius: 14, padding: 16, gap: 12, borderWidth: 1,
  },
  cardTop: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
  },
  cardInfo: { flex: 1, gap: 2 },
  serviceName: { fontSize: 15 },
  date: { fontSize: 12 },
  price: { fontSize: 14 },
  cardBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  emptyCard: {
    borderRadius: 14, padding: 24, alignItems: 'center',
  },
  emptyText: { fontSize: 14 },
  otherBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 14,
  },
  otherIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  otherText: { flex: 1, fontSize: 15 },
});
