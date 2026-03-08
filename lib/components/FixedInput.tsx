// lib/components/FixedInput.tsx — Composant d'input réutilisable FIXED
import React from 'react';
import {
  View, Text, TextInput, TextInputProps,
  StyleSheet, Platform, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── Tokens ───────────────────────────────────────────────────────────────────
export type InputState = 'idle' | 'active' | 'valid' | 'error';

export const ACCENT = '#FFF';              // blanc pur — focus
export const VALID  = '#FFF';             // blanc validation (monochrome)
export const ERROR  = '#FF453A';           // rouge erreur
export const MONO   = Platform.select({
  ios:     'Courier New',
  android: 'monospace',
  default: 'monospace',
}) as string;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATE_BORDER: Record<InputState, string> = {
  idle:   'rgba(255,255,255,0.08)',
  active: 'rgba(255,255,255,0.35)',
  valid:  'rgba(255,255,255,0.25)',
  error:  'rgba(255,69,58,0.5)',
};

const STATE_BG: Record<InputState, string> = {
  idle:   'rgba(255,255,255,0.04)',
  active: 'rgba(255,255,255,0.06)',
  valid:  'rgba(255,255,255,0.04)',
  error:  'rgba(255,69,58,0.04)',
};

const STATE_ICON: Record<InputState, string> = {
  idle:   'rgba(255,255,255,0.3)',
  active: 'rgba(255,255,255,0.7)',
  valid:  VALID,
  error:  ERROR,
};

// ─── Component ────────────────────────────────────────────────────────────────
export interface FixedInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
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
  const bc = STATE_BORDER[state];
  const bg = STATE_BG[state];
  const ic = STATE_ICON[state];

  return (
    <View style={[fi.wrap, containerStyle]}>
      <Text style={[fi.label, state === 'active' && fi.labelActive]}>
        {label}
      </Text>
      <View style={[fi.row, { borderColor: bc, backgroundColor: bg }]}>
        <Ionicons name={icon} size={16} color={ic} style={fi.leadIcon} />
        <TextInput
          style={fi.input}
          placeholderTextColor="rgba(255,255,255,0.25)"
          {...rest}
        />
        {state === 'valid' && !rightElement && (
          <Ionicons name="checkmark-circle" size={16} color={VALID} style={fi.trailIcon} />
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
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  labelActive: {
    color: 'rgba(255,255,255,0.85)',
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
    color: '#FFF',
  },

  trailIcon: { paddingRight: 16 },
  trailWrap: { paddingRight: 16, alignItems: 'center', justifyContent: 'center' },
});
