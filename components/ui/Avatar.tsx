// components/ui/Avatar.tsx — Consolidated avatar (single source of truth)
// Design system pattern: consistent avatar across all screens.
// Handles: raw backend avatarUrl (resolved via resolveAvatarUrl), pre-resolved
// imageUri, initials fallback, and broken-image fallback (onError → initials).
import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { resolveAvatarUrl } from '@/lib/avatarUrl';
import VerifiedBadge from './VerifiedBadge';

interface AvatarProps {
  name?: string;
  size?: number;
  verified?: boolean;
  /** URI déjà résolue (string complète prête pour <Image>). */
  imageUri?: string | null;
  /** Raw avatarUrl venant du backend — résolu automatiquement via resolveAvatarUrl. */
  avatarUrl?: string | null;
  /** Style supplémentaire appliqué au cercle (bordure, etc.). */
  style?: ViewStyle;
}

export default function Avatar({ name = 'A B', size = 40, verified, imageUri, avatarUrl, style }: AvatarProps) {
  const theme = useAppTheme();
  const initials = (name || '?')
    .split(/[\s#]+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  const [imgFailed, setImgFailed] = React.useState(false);
  const resolvedUri = imageUri || resolveAvatarUrl(avatarUrl);
  const showImage = !!resolvedUri && !imgFailed;

  // Reset l'état d'erreur quand l'URI change
  React.useEffect(() => { setImgFailed(false); }, [resolvedUri]);

  const a11yLabel = verified ? `${name}, vérifié` : name;

  return (
    <View
      style={[{ position: 'relative', width: size, height: size, flexShrink: 0 }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11yLabel}
    >
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
        {showImage ? (
          <Image
            source={{ uri: resolvedUri! }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            resizeMode="cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <Text style={[s.initials, { fontSize: size * 0.38, color: theme.text }]}>
            {initials}
          </Text>
        )}
      </View>
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
    overflow: 'hidden',
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
    zIndex: 1,
  },
});
