// lib/components/FixedInput.tsx — Composant d'input réutilisable FIXED
import React from 'react';
import {
  View, Text, TextInput, TextInputProps,
  StyleSheet, Platform, ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';

// ─── Tokens ───────────────────────────────────────────────────────────────────
export type InputState = 'idle' | 'active' | 'valid' | 'error';

export const ERROR  = '#FF453A';           // rouge erreur
export const MONO   = Platform.select({
  ios:     'Courier New',
  android: 'monospace',
  default: 'monospace',
}) as string;

// ─── Component ────────────────────────────────────────────────────────────────
export interface FixedInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  state?: InputState;
  rightElement?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export function FixedInput({
  label,
  icon,
  state = 'idle',
  rightElement,
  containerStyle,
  ...rest
}: FixedInputProps) {
  const theme = useAppTheme();
  const isDark = theme.isDark;

  // ─── Theme-aware state maps ───
  const borderColor = {
    idle:   isDark ? 'rgba(255,255,255,0.08)' : theme.borderLight,
    active: isDark ? 'rgba(255,255,255,0.35)' : theme.border,
    valid:  isDark ? 'rgba(255,255,255,0.25)' : theme.border,
    error:  'rgba(255,69,58,0.5)',
  }[state];

  const bgColor = {
    idle:   isDark ? 'rgba(255,255,255,0.04)' : theme.cardBg,
    active: isDark ? 'rgba(255,255,255,0.06)' : theme.cardBg,
    valid:  isDark ? 'rgba(255,255,255,0.04)' : theme.cardBg,
    error:  'rgba(255,69,58,0.04)',
  }[state];

  const iconColor = {
    idle:   isDark ? 'rgba(255,255,255,0.3)' : theme.textMuted,
    active: isDark ? 'rgba(255,255,255,0.7)' : theme.text,
    valid:  isDark ? '#FFF'                   : theme.text,
    error:  ERROR,
  }[state];

  const labelColor = state === 'active'
    ? (isDark ? 'rgba(255,255,255,0.85)' : theme.text)
    : (isDark ? 'rgba(255,255,255,0.55)' : theme.textSub);

  return (
    <View style={[fi.wrap, containerStyle]}>
      <Text style={[fi.label, { color: labelColor }]}>
        {label}
      </Text>
      <View style={[fi.row, { borderColor, backgroundColor: bgColor }]}>
        <Feather name={icon} size={16} color={iconColor} style={fi.leadIcon} />
        <TextInput
          style={[fi.input, { color: theme.text }]}
          placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : theme.textMuted}
          {...rest}
        />
        {state === 'valid' && !rightElement && (
          <Feather name="check-circle" size={16} color={theme.text} style={fi.trailIcon} />
        )}
        {rightElement && <View style={fi.trailWrap}>{rightElement}</View>}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const fi = StyleSheet.create({
  wrap: { marginBottom: 18 },

  label: {
    fontSize: 12,
    fontFamily: FONTS.sansMedium,
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 52,
  },

  leadIcon: { marginLeft: 16, marginRight: 4 },

  input: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 15,
  },

  trailIcon: { paddingRight: 16 },
  trailWrap: { paddingRight: 16, alignItems: 'center', justifyContent: 'center' },
});
