// components/settings/rows.tsx — la grammaire du profil et des réglages :
// un titre de section mono, un groupe (carte à lignes), une ligne (icône,
// titre, sous-titre, valeur à droite, chevron), un segment qui respire, des
// chips. Aucune carte sombre, aucune modale : des listes, comme l'agenda.
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS, COLORS, alpha } from '@/hooks/use-app-theme';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';

export type FeatherName = React.ComponentProps<typeof Feather>['name'];

export function SectionHead({ title, aside, style }: { title: string; aside?: string | null; style?: StyleProp<ViewStyle> }) {
  const theme = useAppTheme();
  return (
    <View style={[s.sec, style]}>
      <Text style={[s.secTitle, { color: theme.textSub }]} maxFontSizeMultiplier={1.2}>{title.toUpperCase()}</Text>
      {aside ? <Text style={[s.secAside, { color: theme.textMuted }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{aside.toUpperCase()}</Text> : null}
    </View>
  );
}

export function Group({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useAppTheme();
  return <View style={[s.group, { backgroundColor: theme.cardBg, borderColor: theme.border }, style]}>{children}</View>;
}

export type RowTone = 'default' | 'ok' | 'warn' | 'danger';

export function Row({ icon, glyph, title, sub, value, tone = 'default', chevron = true, right, onPress, first = false, danger = false, accessibilityLabel }: {
  icon?: FeatherName; glyph?: string; title: string; sub?: string | null; value?: string | null; tone?: RowTone; chevron?: boolean;
  right?: React.ReactNode; onPress?: () => void; first?: boolean; danger?: boolean; accessibilityLabel?: string;
}) {
  const theme = useAppTheme();
  const press = usePressScale(0.985);
  const toneColor = tone === 'ok' ? theme.greenText : tone === 'warn' ? COLORS.amber : tone === 'danger' ? COLORS.danger : theme.textSub;
  const titleColor = danger ? COLORS.danger : theme.text;
  const body = (
    <Animated.View style={[s.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.borderLight }, onPress && press.style]}>
      {icon || glyph ? (
        <View style={[s.ic, { backgroundColor: danger ? alpha(COLORS.danger, 0.12) : theme.surface }]}>
          {icon ? <Feather name={icon} size={15} color={danger ? COLORS.danger : (theme.textSub as string)} /> : <Text style={[s.glyph, { color: theme.textSub }]}>{glyph}</Text>}
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.title, { color: titleColor }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{title}</Text>
        {sub ? <Text style={[s.sub, { color: theme.textSub }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>{sub}</Text> : null}
      </View>
      {right ?? (
        <View style={s.valWrap}>
          {value ? <Text style={[s.val, { color: toneColor }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{value}</Text> : null}
          {chevron && onPress ? <Feather name="chevron-right" size={14} color={theme.textMuted as string} /> : null}
        </View>
      )}
    </Animated.View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={() => { feedback.haptic('light'); onPress(); }} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? `${title}${value ? `, ${value}` : ''}`}>
      {body}
    </Pressable>
  );
}

export function SwitchRow({ icon, title, sub, value, onChange, first = false, disabled = false }: { icon?: FeatherName; title: string; sub?: string | null; value: boolean; onChange: (v: boolean) => void; first?: boolean; disabled?: boolean }) {
  const theme = useAppTheme();
  return (
    <Row
      icon={icon}
      title={title}
      sub={sub}
      first={first}
      chevron={false}
      right={<Switch value={value} onValueChange={(v) => { feedback.haptic('selection'); onChange(v); }} disabled={disabled} trackColor={{ true: COLORS.greenBrand, false: theme.border as string }} thumbColor="#FFFFFF" accessibilityLabel={title} />}
    />
  );
}

/** Une chip (métier, adresse rapide) ; `add` = la chip en pointillés « + Ajouter ». */
export function Chip({ label, icon, add = false, onPress }: { label: string; icon?: FeatherName; add?: boolean; onPress?: () => void }) {
  const theme = useAppTheme();
  const press = usePressScale(0.96);
  return (
    <Pressable onPress={onPress ? () => { feedback.haptic('light'); onPress(); } : undefined} onPressIn={press.onPressIn} onPressOut={press.onPressOut} disabled={!onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Animated.View style={[s.chip, { backgroundColor: add ? 'transparent' : theme.cardBg, borderColor: theme.border, borderStyle: add ? 'dashed' : 'solid' }, press.style]}>
        {icon ? <Feather name={icon} size={13} color={theme.textSub as string} /> : null}
        <Text style={[s.chipText, { color: add ? theme.textSub : theme.text }]} maxFontSizeMultiplier={1.2}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** Un chiffre sobre (note · missions · acceptées). */
export function Figure({ value, label }: { value: string; label: string }) {
  const theme = useAppTheme();
  return (
    <View style={[s.fig, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      <Text style={[s.figValue, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{value}</Text>
      <Text style={[s.figLabel, { color: theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label.toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  sec: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, gap: 12 },
  secTitle: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 2 },
  secAside: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 1, flexShrink: 1 },
  group: { marginHorizontal: 20, marginTop: 10, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  ic: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontFamily: FONTS.sansMedium, fontSize: 13 },
  title: { fontFamily: FONTS.sansMedium, fontSize: 14, lineHeight: 18 },
  sub: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 16, marginTop: 2 },
  valWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  val: { fontFamily: FONTS.sansMedium, fontSize: 12.5 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  chipText: { fontFamily: FONTS.sansMedium, fontSize: 12.5 },
  fig: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1 },
  figValue: { fontFamily: FONTS.bebas, fontSize: 22, includeFontPadding: false },
  figLabel: { fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.2, marginTop: 5 },
});
