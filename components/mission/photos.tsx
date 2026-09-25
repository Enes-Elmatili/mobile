// components/mission/photos.tsx
// Les photos d'une fiche mission, sous trois formes :
//   PhotoThumbs  — jusqu'à trois vignettes 4:3 avec la consigne en légende, « +n »
//   PhotoGallery — rangée défilante 120×90 avec légendes (fiche) ; grille sur regular
//   PhotoViewer  — plein écran, pagination horizontale, fermeture au toucher
// Une URL cassée retombe sur l'icône de catégorie : la fiche ne casse jamais.
import React, { useState } from 'react';
import { FlatList, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { useLayoutClass } from '@/lib/layout';
import type { BriefPhoto } from '@/lib/mission/brief';
import { PressScale } from '@/components/ui/PressScale';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const SERVER_BASE = API_BASE_URL.replace(/\/api\/?$/, '');

/** URL affichable d'une photo (relative serveur → absolue). */
export function photoUri(raw?: string | null): string | null {
  if (!raw) return null;
  if (/^(https?|file|content|data):/.test(raw)) return raw;
  return `${SERVER_BASE}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

export function shotCaption(shotKey: string | null, t: (k: string) => string): string | null {
  if (!shotKey) return null;
  const label = t(`shots.${shotKey}.label`);
  return label === `shots.${shotKey}.label` ? null : label;
}

// ─── Plein écran ─────────────────────────────────────────────────────────────
export function PhotoViewer({ photos, index, onClose }: { photos: BriefPhoto[]; index: number | null; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useLayoutClass();
  const [current, setCurrent] = useState(index ?? 0);
  if (index === null) return null;
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={v.root}>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(p) => String(p.id)}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <PressScale onPress={onClose} style={{ width }} accessibilityRole="button" accessibilityLabel={t('mission.close')}>
              <Image source={{ uri: photoUri(item.url) ?? undefined }} style={v.full} contentFit="contain" transition={120} />
            </PressScale>
          )}
        />
        <View style={[v.top, { top: insets.top + 12 }]} pointerEvents="box-none">
          <Text style={v.counter} accessibilityLabel={t('mission.photo_a11y', { n: current + 1, total: photos.length })}>{current + 1} / {photos.length}</Text>
          <PressScale onPress={onClose} hitSlop={10} style={v.close} accessibilityRole="button" accessibilityLabel={t('mission.close')}>
            <Feather name="x" size={20} color="#FFFFFF" />
          </PressScale>
        </View>
        {shotCaption(photos[current]?.shotKey ?? null, t) ? (
          <Text style={[v.caption, { bottom: insets.bottom + 24 }]}>{shotCaption(photos[current]?.shotKey ?? null, t)}</Text>
        ) : null}
      </View>
    </Modal>
  );
}

const v = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#000000' },
  full:    { width: '100%', height: '100%' },
  top:     { position: 'absolute', left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { fontFamily: FONTS.mono, fontSize: 12, letterSpacing: 1, color: 'rgba(255,255,255,0.85)' },
  close:   { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  caption: { position: 'absolute', left: 24, right: 24, textAlign: 'center', fontFamily: FONTS.bebas, fontSize: 22, letterSpacing: 0.5, color: '#FFFFFF', includeFontPadding: false },
});

// ─── Vignettes (carte entrante, planche 2A) ──────────────────────────────────
export function PhotoThumbs({ photos, max = 3 }: { photos: BriefPhoto[]; max?: number }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return null;
  const shown = photos.slice(0, max);
  const rest = photos.length - shown.length;
  return (
    <View style={th.row}>
      {shown.map((p, i) => {
        const cap = shotCaption(p.shotKey, t);
        const last = i === shown.length - 1 && rest > 0;
        return (
          <PressScale key={p.id} style={th.item} onPress={() => setOpen(i)} accessibilityRole="imagebutton" accessibilityLabel={cap ?? t('mission.photo_a11y', { n: i + 1, total: photos.length })}>
            <Image source={{ uri: photoUri(p.url) ?? undefined }} style={[th.img, { backgroundColor: theme.surface }]} contentFit="cover" transition={120} />
            {cap && !last ? <Text style={th.cap} numberOfLines={1}>{cap.toUpperCase()}</Text> : null}
            {last ? (
              <View style={th.more}><Text style={th.moreText}>+{rest}</Text></View>
            ) : null}
          </PressScale>
        );
      })}
      <PhotoViewer photos={photos} index={open} onClose={() => setOpen(null)} />
    </View>
  );
}

const th = StyleSheet.create({
  row:      { flexDirection: 'row', gap: 6 },
  item:     { flex: 1, aspectRatio: 4 / 3, borderRadius: 10, overflow: 'hidden' },
  img:      { width: '100%', height: '100%' },
  cap:      { position: 'absolute', left: 6, bottom: 5, fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 0.5, color: 'rgba(255,255,255,0.9)', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } },
  more:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: FONTS.sansMedium, fontSize: 14, color: '#FFFFFF' },
});

// ─── Galerie (fiche, planche 4A) ─────────────────────────────────────────────
export function PhotoGallery({ photos, title }: { photos: BriefPhoto[]; title: string }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { isRegular } = useLayoutClass();
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return null;
  const items = photos.map((p, i) => (
    <PressScale key={p.id} style={[g.item, isRegular && g.itemGrid]} onPress={() => setOpen(i)} accessibilityRole="imagebutton" accessibilityLabel={shotCaption(p.shotKey, t) ?? t('mission.photo_a11y', { n: i + 1, total: photos.length })}>
      <Image source={{ uri: photoUri(p.url) ?? undefined }} style={[g.img, { backgroundColor: theme.surface }]} contentFit="cover" transition={120} />
      {shotCaption(p.shotKey, t) ? <Text style={g.cap} numberOfLines={1}>{shotCaption(p.shotKey, t)!.toUpperCase()}</Text> : null}
    </PressScale>
  ));
  return (
    <View>
      <Text style={[g.title, { color: theme.textMuted }]}>{title.toUpperCase()} · {photos.length}</Text>
      {isRegular ? (
        <View style={g.grid}>{items}</View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={g.row}>{items}</ScrollView>
      )}
      <PhotoViewer photos={photos} index={open} onClose={() => setOpen(null)} />
    </View>
  );
}

const g = StyleSheet.create({
  title:    { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 1.5, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 8 },
  row:      { paddingHorizontal: 24, gap: 8 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 24 },
  item:     { width: 120, height: 90, borderRadius: 12, overflow: 'hidden' },
  itemGrid: { width: '31%', height: 110 },
  img:      { width: '100%', height: '100%' },
  cap:      { position: 'absolute', left: 8, bottom: 6, fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.5, color: 'rgba(255,255,255,0.9)', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } },
});
