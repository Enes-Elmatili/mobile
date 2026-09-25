// components/request/SettingRow.tsx
// Ligne standard de l'étape Planning : icône 36 pt sur `surface`, titre,
// sous-titre, accessoire à droite (Switch, chevron) ; le contenu dépliable
// se rend sous la ligne, dans le même bloc.
import React from 'react';
import { StyleSheet, Text, View, type AccessibilityRole, type AccessibilityState } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { PressScale } from '@/components/ui/PressScale';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

type Props = {
  icon: FeatherName;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  children?: React.ReactNode;
};

export function SettingRow({ icon, title, subtitle, right, onPress, accessibilityRole = 'button', accessibilityState, children }: Props) {
  const theme = useAppTheme();
  const row = (
    <View style={s.row}>
      <View style={[s.icon, { backgroundColor: theme.surface }]}>
        <Feather name={icon} size={16} color={theme.textSub as string} />
      </View>
      <View style={s.texts}>
        <Text style={[s.title, { color: theme.text }]} maxFontSizeMultiplier={1.3}>{title}</Text>
        {subtitle ? <Text style={[s.sub, { color: theme.textMuted }]} maxFontSizeMultiplier={1.3}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
  return (
    <View style={[s.block, { borderTopColor: theme.borderLight }]}>
      {onPress ? (
        <PressScale onPress={onPress} accessibilityRole={accessibilityRole} accessibilityState={accessibilityState} accessibilityLabel={title}>
          {row}
        </PressScale>
      ) : row}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  block: { marginTop: 18, borderTopWidth: 1, paddingTop: 6 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  icon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1 },
  title: { fontFamily: FONTS.sansMedium, fontSize: 15 },
  sub:   { fontFamily: FONTS.sans, fontSize: 11, marginTop: 1 },
});
