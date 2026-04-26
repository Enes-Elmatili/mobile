// components/ui/Avatar.tsx — Initials avatar with optional verified badge overlay
// Design system pattern: consistent avatar across all screens
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import VerifiedBadge from './VerifiedBadge';

interface AvatarProps {
  name?: string;
  size?: number;
  verified?: boolean;
  imageUri?: string | null;
}

export default function Avatar({ name = 'A B', size = 40, verified, imageUri }: AvatarProps) {
  const theme = useAppTheme();
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        />
      ) : (
        <View style={[
          s.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}>
          <Text style={[
            s.initials,
            {
              fontSize: size * 0.38,
              color: theme.text,
            },
          ]}>
            {initials}
          </Text>
        </View>
      )}
      {verified && (
        <View style={[s.badgeWrap, { backgroundColor: theme.cardBg }]}>
          <VerifiedBadge size={14} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  initials: {
    fontFamily: FONTS.sansMedium,
    letterSpacing: 0.5,
  },
  badgeWrap: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    borderRadius: 999,
    padding: 1.5,
  },
});
