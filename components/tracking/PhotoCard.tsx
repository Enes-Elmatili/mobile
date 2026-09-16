// components/tracking/PhotoCard.tsx — une photo du chantier en carte pleine
// largeur, avec son étiquette mono (AVANT · 14:33). Tap → visionneuse.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { photoUri } from '@/components/mission/photos';

type Props = { uri: string | null; label: string; onPress?: () => void; /** Emplacement vide (à prendre). */ placeholder?: string; pending?: boolean };

export function PhotoCard({ uri, label, onPress, placeholder, pending }: Props) {
  const theme = useAppTheme();
  if (!uri) {
    return (
      <View style={[s.card, s.empty, { borderColor: theme.border }]} accessible accessibilityLabel={placeholder ?? label}>
        <Feather name="camera" size={18} color={theme.textMuted as string} />
        {placeholder ? <Text style={[s.placeholder, { color: theme.textMuted }]}>{placeholder}</Text> : null}
      </View>
    );
  }
  const src = /^(file|content):/.test(uri) ? uri : (photoUri(uri) ?? uri);
  return (
    <Pressable style={[s.card, { backgroundColor: theme.surface }]} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'imagebutton' : 'image'} accessibilityLabel={label}>
      <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      <Text style={[s.tag, { color: theme.text, backgroundColor: theme.cardBg }]}>{label.toUpperCase()}{pending ? ' · …' : ''}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, aspectRatio: 16 / 10, borderRadius: 16, overflow: 'hidden' },
  empty: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6 },
  placeholder: { fontFamily: FONTS.sans, fontSize: 11.5 },
  tag: { position: 'absolute', left: 10, bottom: 10, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
});
