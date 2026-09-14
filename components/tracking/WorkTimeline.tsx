// components/tracking/WorkTimeline.tsx
// La chronologie du chantier : heure mono, fait, vignette de photo ; la fin
// prévue est grisée et précédée d'un tilde.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { photoUri } from '@/components/mission/photos';

export type TimelineRow = { key: string; time: string; label: string; sub?: string | null; photoUrl?: string | null; next?: boolean; onPhoto?: () => void };

export function WorkTimeline({ rows }: { rows: TimelineRow[] }) {
  const theme = useAppTheme();
  return (
    <View style={s.wrap} accessibilityRole="list">
      {rows.map((r) => (
        <View key={r.key} style={s.row} accessible accessibilityLabel={`${r.next ? '~' : ''}${r.time} ${r.label}${r.sub ? `, ${r.sub}` : ''}`}>
          <Text style={[s.time, { color: theme.textMuted }]} maxFontSizeMultiplier={1.2}>{r.next ? '~' : ''}{r.time}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.label, { color: r.next ? theme.textSub : theme.text }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>{r.label}</Text>
            {r.sub ? <Text style={[s.sub, { color: theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{r.sub}</Text> : null}
          </View>
          {r.photoUrl ? (
            <Pressable onPress={r.onPhoto} disabled={!r.onPhoto} accessibilityRole={r.onPhoto ? 'imagebutton' : 'image'} accessibilityLabel={r.label}>
              <Image source={{ uri: photoUri(r.photoUrl) ?? undefined }} style={[s.thumb, { backgroundColor: theme.surface }]} contentFit="cover" transition={120} />
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  time: { width: 46, fontFamily: FONTS.monoMedium, fontSize: 11, fontVariant: ['tabular-nums'] },
  label: { fontFamily: FONTS.sans, fontSize: 13.5 },
  sub: { fontFamily: FONTS.sans, fontSize: 11.5, marginTop: 1 },
  thumb: { width: 44, height: 33, borderRadius: 8 },
});
