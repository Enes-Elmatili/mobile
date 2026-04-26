// components/ui/SectionHeader.tsx — Mono uppercase label + optional action text
// Design system pattern: consistent section headers across all screens
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';

interface SectionHeaderProps {
  label: string;
  action?: string;
  onAction?: () => void;
}

export default function SectionHeader({ label, action, onAction }: SectionHeaderProps) {
  const theme = useAppTheme();
  return (
    <View style={s.row}>
      <Text style={[s.label, { color: theme.textMuted }]}>{label}</Text>
      {action ? (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
          <Text style={[s.action, { color: theme.textSub }]}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  label: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  action: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
  },
});
