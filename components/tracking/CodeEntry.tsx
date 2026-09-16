// components/tracking/CodeEntry.tsx — la saisie du code du client : quatre
// cases en grand, clavier numérique, champ invisible par-dessus (tappable).
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';

type Props = { value: string; onChange: (v: string) => void; onSubmit?: () => void; autoFocus?: boolean; hint?: string | null; error?: boolean };

export function CodeEntry({ value, onChange, onSubmit, autoFocus = true, hint, error = false }: Props) {
  const theme = useAppTheme();
  const ref = useRef<TextInput>(null);
  useEffect(() => { if (autoFocus) { const tm = setTimeout(() => ref.current?.focus(), 450); return () => clearTimeout(tm); } }, [autoFocus]);
  const digits = [0, 1, 2, 3].map((i) => value[i] ?? '');
  return (
    <View style={s.wrap}>
      <Pressable style={s.boxes} onPress={() => ref.current?.focus()} accessible accessibilityRole="none" accessibilityLabel={`${value.length} / 4`}>
        {digits.map((d, i) => {
          const active = i === value.length;
          return (
            <View key={i} style={[s.box, { borderColor: error ? theme.danger : d || active ? theme.accent : theme.border, backgroundColor: theme.surface }]}>
              <Text style={[s.digit, { color: theme.text }]}>{d}</Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={ref}
        style={s.input}
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9]/g, '').slice(0, 4))}
        onSubmitEditing={onSubmit}
        keyboardType="number-pad"
        maxLength={4}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        caretHidden
        returnKeyType="done"
        accessibilityLabel="code"
      />
      {hint ? <Text style={[s.hint, { color: error ? theme.danger : theme.textSub }]} maxFontSizeMultiplier={1.3}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 16, alignItems: 'center' },
  boxes: { flexDirection: 'row', gap: 10 },
  box: { width: 62, height: 72, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: FONTS.bebas, fontSize: 40, includeFontPadding: false },
  input: { position: 'absolute', opacity: 0.01, width: 1, height: 1 },
  hint: { fontFamily: FONTS.sans, fontSize: 12.5, marginTop: 10, textAlign: 'center' },
});
