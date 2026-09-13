// components/SplashAnimation.tsx
// Splash « v2 premium » — port React Native de la cinématique omelette (design
// Splash Screen v2 Premium). 3 scènes enchaînées :
//   1. Ouverture  — hairline + le point vert entre en scale (overshoot), onde
//   2. Le mot     — le point glisse à sa place pendant que « fixed » monte par
//                   tranches (f | i | xe | d)
//   3. Signature  — tagline mono (tracking qui se resserre) + barre de chargement
// Respecte le thème (dark/clair via useAppTheme) et l'i18n (tagline + labels).
// 100 % Reanimated : la chorégraphie tourne sur le thread UI, le JS reste libre
// de charger l'app pendant ce temps. Aucun module natif supplémentaire.
import React, { useEffect, useRef } from 'react';
import {
  View, Image, Pressable, StyleSheet,
  useWindowDimensions, AccessibilityInfo,
  type ImageSourcePropType,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useAppTheme, FONTS, COLORS, alpha } from '@/hooks/use-app-theme';
import { useTranslation } from 'react-i18next';

// Géométrie mesurée sur le wordmark (2334×634 ; point cx .9632 cy .8486 ⌀ .0724).
const WM_W = 2334, WM_H = 634;
const ASPECT = WM_H / WM_W;
const DOT_CX = 2248 / WM_W;   // centre X final du point (fraction de la largeur)
const DOT_CY = 538 / WM_H;    // centre Y du point (dans la bande lockup)
const DOT_DF = 169 / WM_W;    // ⌀ point / largeur
const LETTERS_END = 0.915;    // coupe qui masque le point du PNG (on dessine le nôtre)
// Coupes des tranches montantes (blancs du wordmark) : f | i | xe | d
const CUTS = [0, 332 / WM_W, 530 / WM_W, 1595 / WM_W, LETTERS_END];

// Timings (ms) — durées exactes des 3 scènes du design :
// Ouverture 1,4 s · Le mot 2,6 s · Signature 1,8 s (5,8 s au total).
const S1 = 1400, S2 = 2600;         // durées scènes 1 et 2
const P2_START = S1;                 // 1400
const P3_START = S1 + S2;            // 4000
// Tranches montantes : chaque coupe monte sur ~1048 ms, décalées de 206 ms.
const RISE_DUR = 1048, RISE_STAGGER = 206, RISE_BASE = 1816;
const HOLD = 450, FADE = 420;

/** Une tranche du wordmark qui monte depuis sous le lockup. */
function RiseSlice({ progress, x0, width, W, H, wordmark }: {
  progress: SharedValue<number>; x0: number; width: number; W: number; H: number; wordmark: ImageSourcePropType;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [H + 8, 0]) }],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', left: x0, top: 0, width, height: H, overflow: 'hidden' }, style]}>
      <Image source={wordmark} style={{ position: 'absolute', left: -x0, top: 0, width: W, height: H }} resizeMode="stretch" />
    </Animated.View>
  );
}

export function SplashAnimation({ onDone }: { onDone: () => void }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { width: SW, height: SH } = useWindowDimensions();

  const W = Math.min(224, SW * 0.58);
  const H = W * ASPECT;
  const lockLeft = (SW - W) / 2;
  const centerX = SW / 2;
  const lockTop = SH * 0.45 - H / 2;
  const DOT_D = W * DOT_DF;
  const dotFinalX = lockLeft + W * DOT_CX;
  const dotCY = lockTop + H * DOT_CY;
  const dotShift = dotFinalX - centerX;

  const green = COLORS.greenBrand;
  const wordmark = theme.isDark
    ? require('@/assets/logo-variants/logo-transparent-white.png')
    : require('@/assets/logo-variants/logo-transparent-black.png');
  const inkFaint = alpha(theme.text, 0.16);
  const inkSoft = alpha(theme.text, theme.isDark ? 0.58 : 0.62);

  // ── Valeurs animées ──────────────────────────────────────────────────────
  const dotScale = useSharedValue(0);
  const dotSlide = useSharedValue(0); // 0 = centre, 1 = final
  const dotBreath = useSharedValue(1);
  const hairline = useSharedValue(0); // scaleX
  const hairlineOp = useSharedValue(0);
  const ring = useSharedValue(0);
  const col0 = useSharedValue(0);
  const col1 = useSharedValue(0);
  const col2 = useSharedValue(0);
  const col3 = useSharedValue(0);
  const cols = [col0, col1, col2, col3];
  const tagOp = useSharedValue(0);
  const tagY = useSharedValue(12);
  const rootOp = useSharedValue(1);

  const finishedRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const done = () => onDoneRef.current();
  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    rootOp.value = withTiming(0, { duration: FADE, easing: Easing.in(Easing.cubic) }, () => {
      runOnJS(done)();
    });
  };
  // Appelé depuis le thread UI à la fin de la respiration du point.
  const scheduleFinish = () => {
    if (!finishedRef.current) setTimeout(finish, HOLD);
  };

  useEffect(() => {
    let cancelled = false;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        // Accessibilité : pas d'animation, état final direct.
        dotScale.value = 1; dotSlide.value = 1; hairlineOp.value = 0;
        cols.forEach((c) => { c.value = 1; });
        tagOp.value = 1; tagY.value = 0;
        holdTimer = setTimeout(finish, 1100);
        return;
      }
      runSequence();
    });
    return () => { cancelled = true; if (holdTimer) clearTimeout(holdTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSequence = () => {
    // Scène 1 — Ouverture (0 → 1400). La hairline apparaît (308 ms dès 112 ms)
    // puis s'efface à l'ouverture de la scène 2 : une seule séquence par valeur.
    hairlineOp.value = withSequence(
      withDelay(112, withTiming(1, { duration: 308, easing: Easing.out(Easing.cubic) })),
      withDelay(P2_START - (112 + 308), withTiming(0, { duration: 572, easing: Easing.in(Easing.quad) })),
    );
    hairline.value = withDelay(112, withTiming(1, { duration: 658, easing: Easing.inOut(Easing.poly(4)) }));
    dotScale.value = withDelay(364, withTiming(1, { duration: 504, easing: Easing.out(Easing.exp) }));
    ring.value = withDelay(868, withTiming(1, { duration: 476, easing: Easing.out(Easing.cubic) }));

    // Scène 2 — Le mot (1400 → 4000)
    dotSlide.value = withDelay(P2_START + 156, withTiming(1, { duration: 1456, easing: Easing.inOut(Easing.poly(4)) }));
    cols.forEach((c, i) => {
      c.value = withDelay(RISE_BASE + i * RISE_STAGGER, withTiming(1, { duration: RISE_DUR, easing: Easing.out(Easing.poly(4)) }));
    });

    // Scène 3 — Signature (4000 → 5800)
    tagOp.value = withDelay(P3_START + 72, withTiming(1, { duration: 676, easing: Easing.out(Easing.cubic) }));
    tagY.value = withDelay(P3_START + 72, withTiming(0, { duration: 780, easing: Easing.out(Easing.cubic) }));
    // Respiration du point pendant la signature ; sa fin pilote le retrait.
    dotBreath.value = withDelay(
      P3_START + 450,
      withSequence(
        withTiming(1.035, { duration: 620, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 550, easing: Easing.inOut(Easing.sin) }, (finished) => {
          if (finished) runOnJS(scheduleFinish)();
        }),
      ),
    );
  };

  // ── Styles ───────────────────────────────────────────────────────────────
  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOp.value }));
  const hairlineStyle = useAnimatedStyle(() => ({
    opacity: hairlineOp.value,
    transform: [{ scaleX: hairline.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 1], [0.3, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [1, 2.9]) }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dotSlide.value * dotShift }, { scale: dotScale.value * dotBreath.value }],
  }));
  const tagStyle = useAnimatedStyle(() => ({
    opacity: tagOp.value,
    transform: [{ translateY: tagY.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }, rootStyle]}>
      {/* Hairline (scène 1) */}
      <Animated.View pointerEvents="none" style={[{
        position: 'absolute', left: centerX - SW * 0.15, top: dotCY - 0.75, width: SW * 0.3, height: 1.5,
        backgroundColor: inkFaint,
      }, hairlineStyle]} />

      {/* Onde (fin scène 1) */}
      <Animated.View pointerEvents="none" style={[{
        position: 'absolute', left: centerX - DOT_D / 2, top: dotCY - DOT_D / 2, width: DOT_D, height: DOT_D,
        borderRadius: DOT_D / 2, borderWidth: 1.5, borderColor: green,
      }, ringStyle]} />

      {/* « fixed » — tranches montantes. Coupes arrondies au pixel (colonnes
          exactement jointives) + 1px de chevauchement pour masquer les coutures ;
          le point du PNG est hors zone (dernière coupe à .915), jamais dessiné. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: lockLeft, top: lockTop, width: W, height: H, overflow: 'hidden' }}>
        {cols.map((c, i) => {
          const x0 = Math.round(CUTS[i] * W);
          const x1 = Math.round(CUTS[i + 1] * W);
          const bleed = i < cols.length - 1 ? 1 : 0; // pas de chevauchement sur la dernière (n'empiète pas sur le point)
          return <RiseSlice key={i} progress={c} x0={x0} width={(x1 - x0) + bleed} W={W} H={H} wordmark={wordmark} />;
        })}
      </View>

      {/* Le point vert (dessiné) */}
      <Animated.View pointerEvents="none" style={[{
        position: 'absolute', left: centerX - DOT_D / 2, top: dotCY - DOT_D / 2, width: DOT_D, height: DOT_D,
        borderRadius: DOT_D / 2, backgroundColor: green,
      }, dotStyle]} />

      {/* Signature (scène 3) */}
      <Animated.Text pointerEvents="none" numberOfLines={1} style={[{
        position: 'absolute', top: lockTop + H + Math.max(22, H * 0.42), left: 0, right: 0, textAlign: 'center',
        fontFamily: FONTS.mono, fontSize: 12, color: inkSoft, textTransform: 'uppercase',
        letterSpacing: 3,
      }, tagStyle]}>
        {t('splash.tagline')}
      </Animated.Text>

      {/* Tap pour passer (au-dessus, transparent) */}
      <Pressable style={StyleSheet.absoluteFill} onPress={finish} accessibilityRole="button" accessibilityLabel="FIXED" />
    </Animated.View>
  );
}
