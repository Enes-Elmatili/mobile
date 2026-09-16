// components/tracking/AccessChips.tsx — l'accès en puces mono, avant même
// l'adresse : 3E · SANS ASCENSEUR · MAISON · URGENT. Et la note du client.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS, alpha } from '@/hooks/use-app-theme';
import type { MissionBrief } from '@/lib/mission/brief';

export function accessChips(brief: MissionBrief, t: (k: string, o?: any) => string): { label: string; hot?: boolean }[] {
  const out: { label: string; hot?: boolean }[] = [];
  const a = brief.access;
  if (a?.floor != null) out.push({ label: a.floor === 0 ? t('ext.missions_ground_floor') : t('mission.floor_short', { n: a.floor }) });
  if (a?.hasElevator === true) out.push({ label: t('mission.elevator_short') });
  if (a?.hasElevator === false) out.push({ label: t('mission.no_elevator_short') });
  if (a?.buildingType) out.push({ label: t(`ext.missions_building_${a.buildingType}`) });
  if (brief.client?.language) out.push({ label: brief.client.language });
  if (brief.schedule.urgent) out.push({ label: t('mission.urgent'), hot: true });
  return out;
}

const HOT_BG = alpha(COLORS.amber, 0.15);

export function AccessChips({ brief }: { brief: MissionBrief }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const chips = accessChips(brief, t);
  const note = brief.access?.notes?.trim();
  if (!chips.length && !note) return null;
  return (
    <View style={s.wrap}>
      {chips.length ? (
        <View style={s.row}>
          {chips.map((c) => (
            <View key={c.label} style={[s.chip, { backgroundColor: c.hot ? HOT_BG : theme.surface }]}>
              <Text style={[s.chipText, { color: c.hot ? COLORS.amber : theme.textSub }]} maxFontSizeMultiplier={1.2}>{c.label.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {note ? (
        <View style={[s.note, { backgroundColor: theme.bg }]}>
          <Text style={[s.noteLabel, { color: theme.textMuted }]}>{t('mission.access').toUpperCase()}</Text>
          <Text style={[s.noteText, { color: theme.text }]} maxFontSizeMultiplier={1.3}>{note}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 },
  chipText: { fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 0.5 },
  note: { marginTop: 10, padding: 12, paddingHorizontal: 14, borderRadius: 14 },
  noteLabel: { fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.5, marginBottom: 6 },
  noteText: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 18 },
});
