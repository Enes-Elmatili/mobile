// app/request/camera.tsx — appareil photo guidé (planche 1A).
// Plein écran, une consigne à la fois : barres de file en haut, consigne en
// Bebas, aide sur une ligne, cadre à guides verts, déclencheur, « Passer »
// pour une prise conseillée. Après le déclenchement : aperçu, « Reprendre » /
// « Garder », puis la prise suivante. La file vient de lib/request/cameraSession
// (pas d'URIs dans les params) ; le résultat y retourne.
// Permission refusée : explication, Réglages, ou la galerie (expo-image-picker).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { FONTS, COLORS } from '@/hooks/use-app-theme';
import { usePressScale } from '@/lib/motion/press';
import { useEntrance } from '@/lib/motion/useEntrance';
import { feedback } from '@/lib/feedback/feedback';
import { cameraSession } from '@/lib/request/cameraSession';
import type { LocalShot, ShotQueueItem } from '@/lib/request/photos';

const MAX_WIDTH = 1600;
const JPEG_QUALITY = 0.75;

/** Réduit la photo pour l'envoi (≈ 300–500 Ko) et renvoie ses dimensions. */
async function shrink(uri: string, width: number): Promise<{ uri: string; width: number; height: number }> {
  const actions = width > MAX_WIDTH ? [{ resize: { width: MAX_WIDTH } }] : [];
  const out = await manipulateAsync(uri, actions, { compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  return { uri: out.uri, width: out.width, height: out.height };
}

function Btn({ label, onPress, primary, icon }: { label: string; onPress: () => void; primary?: boolean; icon?: React.ComponentProps<typeof Feather>['name'] }) {
  const press = usePressScale();
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={label}>
      <Animated.View style={[s.btn, primary && s.btnPrimary, press.style]}>
        {icon ? <Feather name={icon} size={16} color={primary ? '#0A0A0A' : '#FFFFFF'} /> : null}
        <Text style={[s.btnText, primary && s.btnTextPrimary]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function GuidedCamera() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const session = useRef(cameraSession.current()).current;
  const queue: ShotQueueItem[] = session?.queue ?? [{ key: null, required: false }];
  const [index, setIndex] = useState(0);
  const [taken, setTaken] = useState<LocalShot[]>([]);
  const [preview, setPreview] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const entrance = useEntrance(12);

  const item = queue[Math.min(index, queue.length - 1)];
  const label = item.key ? t(`shots.${item.key}.label`) : t('camera.free_label');
  const hint = item.key ? t(`shots.${item.key}.hint`) : t('camera.free_hint');

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  const finish = useCallback((shots: LocalShot[]) => {
    cameraSession.resolve(shots);
    router.back();
  }, [router]);

  const advance = useCallback((next: LocalShot[]) => {
    if (index + 1 >= queue.length) finish(next);
    else { setIndex(index + 1); setPreview(null); }
  }, [index, queue.length, finish]);

  const keep = useCallback(() => {
    if (!preview) return;
    feedback.haptic('success');
    const next = [...taken, { key: item.key, uri: preview.uri, width: preview.width, height: preview.height }];
    setTaken(next);
    advance(next);
  }, [preview, taken, item.key, advance]);

  const skip = useCallback(() => { feedback.haptic('light'); advance(taken); }, [advance, taken]);

  const close = useCallback(() => {
    cameraSession.cancel(taken);
    router.back();
  }, [router, taken]);

  const shoot = useCallback(async () => {
    if (busy || !cameraRef.current) return;
    setBusy(true);
    feedback.haptic('medium');
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (pic?.uri) setPreview(await shrink(pic.uri, pic.width));
    } catch {
      feedback.error(t('camera.denied_title'));
    } finally {
      setBusy(false);
    }
  }, [busy, t]);

  const pickFromLibrary = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setPreview(await shrink(a.uri, a.width));
  }, []);

  // ── Permission refusée ────────────────────────────────────────────────
  if (permission && !permission.granted && !permission.canAskAgain) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Pressable onPress={close} style={[s.close, { top: insets.top + 12 }]} accessibilityRole="button" accessibilityLabel={t('camera.close')}>
          <Feather name="x" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={s.denied}>
          <Feather name="camera-off" size={28} color="rgba(255,255,255,0.7)" />
          <Text style={s.deniedTitle}>{t('camera.denied_title')}</Text>
          <Text style={s.deniedBody}>{t('camera.denied_body')}</Text>
          <View style={s.deniedBtns}>
            <Btn label={t('camera.open_settings')} onPress={() => Linking.openSettings()} />
            <Btn label={t('camera.pick_gallery')} onPress={pickFromLibrary} primary icon="image" />
          </View>
        </View>
        {preview ? (
          <View style={s.previewBar}>
            <Btn label={t('camera.keep')} onPress={keep} primary icon="check" />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={s.root}>
      {preview ? (
        <Image source={{ uri: preview.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : permission?.granted ? (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />
      )}

      {/* File de prises */}
      <View style={[s.steps, { top: insets.top + 12 }]} accessibilityLabel={t('camera.shot_of', { n: index + 1, total: queue.length })}>
        {queue.map((q, i) => <View key={`${q.key ?? 'free'}-${i}`} style={[s.step, i <= index && s.stepOn]} />)}
      </View>
      <Pressable onPress={close} style={[s.close, { top: insets.top + 28 }]} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('camera.close')}>
        <Feather name="x" size={20} color="#FFFFFF" />
      </Pressable>

      {/* Consigne */}
      <Animated.View style={[s.caption, { top: insets.top + 84 }, entrance.style]} key={`cap-${index}`}>
        <Text style={s.captionTitle} maxFontSizeMultiplier={1.2}>{label}</Text>
        <Text style={s.captionHint} numberOfLines={2} maxFontSizeMultiplier={1.3}>{hint}</Text>
      </Animated.View>

      {/* Cadre à guides */}
      {!preview ? (
        <View style={[s.frame, { top: insets.top + 170, bottom: insets.bottom + 150 }]} pointerEvents="none">
          <View style={[s.guide, s.guideTop]} />
          <View style={[s.guide, s.guideBottom]} />
        </View>
      ) : null}

      {/* Commandes */}
      <View style={[s.controls, { paddingBottom: insets.bottom + 28 }]}>
        {preview ? (
          <View style={s.previewBar}>
            <Btn label={t('camera.retake')} onPress={() => setPreview(null)} icon="rotate-ccw" />
            <Btn label={t('camera.keep')} onPress={keep} primary icon="check" />
          </View>
        ) : (
          <View style={s.shootRow}>
            <View style={s.side} />
            <Pressable onPress={shoot} disabled={busy || !permission?.granted} accessibilityRole="button" accessibilityLabel={label} style={[s.shutter, busy && { opacity: 0.5 }]}>
              <View style={s.shutterInner} />
            </Pressable>
            <View style={s.side}>
              {!item.required ? (
                <Pressable onPress={skip} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('camera.skip')}>
                  <Text style={s.skip}>{t('camera.skip')}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#000000' },
  steps:         { position: 'absolute', left: 24, right: 24, flexDirection: 'row', gap: 6 },
  step:          { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  stepOn:        { backgroundColor: '#FFFFFF' },
  close:         { position: 'absolute', left: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  caption:       { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  captionTitle:  { fontFamily: FONTS.bebas, fontSize: 28, letterSpacing: 0.5, color: '#FFFFFF', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  captionHint:   { fontFamily: FONTS.sans, fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 6, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  frame:         { position: 'absolute', left: 40, right: 40, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 18 },
  guide:         { position: 'absolute', left: -2, right: -2, height: 2, backgroundColor: COLORS.greenBrand, opacity: 0.9 },
  guideTop:      { top: -2 },
  guideBottom:   { bottom: -2 },
  controls:      { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24 },
  shootRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side:          { width: 88, alignItems: 'center' },
  shutter:       { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  shutterInner:  { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF' },
  skip:          { fontFamily: FONTS.sansMedium, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  previewBar:    { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  btn:           { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 20, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)' },
  btnPrimary:    { backgroundColor: '#FFFFFF' },
  btnText:       { fontFamily: FONTS.sansMedium, fontSize: 15, color: '#FFFFFF' },
  btnTextPrimary:{ color: '#0A0A0A' },
  denied:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  deniedTitle:   { fontFamily: FONTS.bebas, fontSize: 26, color: '#FFFFFF', letterSpacing: 0.5, includeFontPadding: false },
  deniedBody:    { fontFamily: FONTS.sans, fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 20 },
  deniedBtns:    { flexDirection: 'row', gap: 10, marginTop: 8 },
});
