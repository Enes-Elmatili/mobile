// components/request/ShotStrip.tsx
// Les prises demandées par la prestation (planche 1A) : une tuile carrée par
// consigne, « REQUIS » sur celles qui le sont, une tuile « + » pour une photo
// libre tant qu'on est sous la limite. Tuile faite : vignette et coche ;
// toucher = reprendre. Toucher une tuile vide ouvre l'appareil photo.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';
import { SHOT_ICONS, type ShotSpec } from '@/constants/photoGuides';
import { MAX_PHOTOS, type LocalShot } from '@/lib/request/photos';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

type Props = {
  specs: ShotSpec[];
  shots: LocalShot[];
  /** Ouvrir l'appareil photo pour cette prise (null = photo libre). */
  onTake: (key: string | null) => void;
  /** Retirer une photo libre (index dans `shots`). */
  onRemoveFree?: (index: number) => void;
};

function Tile({ label, icon, required, uri, onPress, accessibilityLabel }: {
  label: string; icon: FeatherName; required?: boolean; uri?: string; onPress: () => void; accessibilityLabel: string;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const press = usePressScale(0.96);
  const done = !!uri;
  return (
    <Pressable
      onPress={() => { feedback.haptic('light'); onPress(); }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={s.tileWrap}
    >
      <Animated.View style={[s.tile, { borderColor: theme.border }, done && s.tileDone, press.style]}>
        {done ? (
          <>
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            <View style={s.shade} />
            <View style={[s.check, { backgroundColor: COLORS.greenBrand }]}>
              <Feather name="check" size={12} color="#0A0A0A" />
            </View>
            <Text style={s.doneLabel} numberOfLines={2} maxFontSizeMultiplier={1.2}>{label}</Text>
          </>
        ) : (
          <>
            {required ? <Text style={[s.req, { color: COLORS.amber }]}>{t('stepper.shot_required')}</Text> : null}
            <Feather name={icon} size={18} color={theme.textSub as string} />
            <Text style={[s.label, { color: theme.textSub }]} numberOfLines={2} maxFontSizeMultiplier={1.2}>{label}</Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function ShotStrip({ specs, shots, onTake, onRemoveFree }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const byKey = new Map(shots.filter((x) => x.key).map((x) => [x.key as string, x]));
  const free = shots.map((x, i) => ({ ...x, i })).filter((x) => x.key === null);
  const done = specs.filter((sp) => byKey.has(sp.key)).length;
  const canAdd = shots.length < MAX_PHOTOS;

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={[s.title, { color: theme.text }]} maxFontSizeMultiplier={1.3}>{t('stepper.photos_title')}</Text>
        <Text style={[s.count, { color: theme.textMuted }]} maxFontSizeMultiplier={1.3}>{t('stepper.photos_count', { done, total: specs.length })}</Text>
      </View>
      <View style={s.row}>
        {specs.map((sp) => (
          <Tile
            key={sp.key}
            label={t(`shots.${sp.key}.label`)}
            icon={(SHOT_ICONS[sp.key] ?? 'camera') as FeatherName}
            required={sp.required}
            uri={byKey.get(sp.key)?.uri}
            onPress={() => onTake(sp.key)}
            accessibilityLabel={`${t(`shots.${sp.key}.label`)}${sp.required ? `, ${t('stepper.shot_required')}` : ''}`}
          />
        ))}
        {free.map((f) => (
          <Tile
            key={`free-${f.i}`}
            label={t('stepper.shot_free')}
            icon="camera"
            uri={f.uri}
            onPress={() => onRemoveFree?.(f.i)}
            accessibilityLabel={t('stepper.shot_free')}
          />
        ))}
        {canAdd ? (
          <Tile label="" icon="plus" onPress={() => onTake(null)} accessibilityLabel={t('stepper.shot_free')} />
        ) : null}
      </View>
      <Text style={[s.nudge, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{t('stepper.photos_nudge')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:      { paddingHorizontal: 24, paddingTop: 16 },
  head:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  title:     { fontFamily: FONTS.sansMedium, fontSize: 13 },
  count:     { fontFamily: FONTS.sans, fontSize: 11.5 },
  row:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tileWrap:  { width: '23%', flexGrow: 1, maxWidth: '31%' },
  tile:      { aspectRatio: 1, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 6, overflow: 'hidden' },
  tileDone:  { borderStyle: 'solid', justifyContent: 'flex-end', alignItems: 'flex-start', padding: 8 },
  shade:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  check:     { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  doneLabel: { fontFamily: FONTS.sansMedium, fontSize: 11, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } },
  req:       { position: 'absolute', top: 6, right: 8, fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1 },
  label:     { fontFamily: FONTS.sansMedium, fontSize: 11, textAlign: 'center' },
  nudge:     { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 17, marginTop: 10 },
});
