// components/ui/IconBtn.tsx — 36x36 icon button with surface background
// Design system pattern: consistent icon buttons across all screens
import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, COLORS } from '@/hooks/use-app-theme';

interface IconBtnProps {
  icon: string;
  onPress?: () => void;
  size?: number;
  badge?: boolean;
}

export default function IconBtn({ icon, onPress, size = 36, badge }: IconBtnProps) {
  const theme = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        s.btn,
        {
          width: size,
          height: size,
          borderRadius: size * 0.28,
          backgroundColor: theme.surface,
          borderColor: theme.borderLight,
        },
      ]}
    >
      <Feather name={icon as any} size={size * 0.5} color={theme.text} />
      {badge && (
        <View style={[s.badge, { backgroundColor: COLORS.orangeBrand, borderColor: theme.surface }]} />
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1.5,
  },
});
