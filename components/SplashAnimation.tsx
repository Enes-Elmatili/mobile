// components/SplashAnimation.tsx
// Splash « v2 premium » — port React Native de la cinématique omelette (design
// Splash Screen v2 Premium). 3 scènes enchaînées :
//   1. Ouverture  — hairline + le point vert entre en scale (overshoot), onde
//   2. Le mot     — le point glisse à sa place pendant que « fixed » monte par
//                   tranches (f | i | xe | d)
//   3. Signature  — tagline mono (tracking qui se resserre) + barre de chargement
// Respecte le thème (dark/clair via useAppTheme) et l'i18n (tagline + labels).
// 100 % JS + Animated (native driver pour transforms/opacité), aucun module natif.
import React, { useEffect, useRef } from 'react';
import {
  Animated, Easing, View, Image, Pressable, StyleSheet,
  useWindowDimensions, AccessibilityInfo,
} from 'react-native';
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

  const green = COLORS.greenBrand;
  const wordmark = theme.isDark
    ? require('@/assets/logo-variants/logo-transparent-white.png')
    : require('@/assets/logo-variants/logo-transparent-black.png');
  const inkFaint = alpha(theme.text, 0.16);
  const inkSoft = alpha(theme.text, theme.isDark ? 0.58 : 0.62);

  // ── Valeurs animées ──────────────────────────────────────────────────────
  const dotScale = useRef(new Animated.Value(0)).current;
  const dotSlide = useRef(new Animated.Value(0)).current; // 0 = centre, 1 = final
  const dotBreath = useRef(new Animated.Value(1)).current;
  const hairline = useRef(new Animated.Value(0)).current; // scaleX
  const hairlineOp = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const cols = useRef(CUTS.slice(0, 4).map(() => new Animated.Value(0))).current;
  const tagOp = useRef(new Animated.Value(0)).current;
  const tagY = useRef(new Animated.Value(12)).current;
  const rootOp = useRef(new Animated.Value(1)).current;

  const finishedRef = useRef(false);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    Animated.timing(rootOp, {
      toValue: 0, duration: FADE, easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(() => onDone());
  };

  useEffect(() => {
    let cancelled = false;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        // Accessibilité : pas d'animation, état final direct.
        dotScale.setValue(1); dotSlide.setValue(1); hairlineOp.setValue(0);
        cols.forEach((c) => c.setValue(1));
        tagOp.setValue(1); tagY.setValue(0);
        holdTimer = setTimeout(finish, 1100);
        return;
      }
      runSequence();
    });
    return () => { cancelled = true; if (holdTimer) clearTimeout(holdTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSequence = () => {
    // Scène 1 — Ouverture (0 → 1400)
    Animated.timing(hairlineOp, { toValue: 1, duration: 308, delay: 112, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(hairline,   { toValue: 1, duration: 658, delay: 112, easing: Easing.inOut(Easing.poly(4)), useNativeDriver: true }).start();
    Animated.timing(dotScale,   { toValue: 1, duration: 504, delay: 364, easing: Easing.out(Easing.exp), useNativeDriver: true }).start();
    Animated.timing(ring,       { toValue: 1, duration: 476, delay: 868, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

    // Scène 2 — Le mot (1400 → 4000)
    Animated.timing(hairlineOp, { toValue: 0, duration: 572,  delay: P2_START,       easing: Easing.in(Easing.quad),      useNativeDriver: true }).start();
    Animated.timing(dotSlide,   { toValue: 1, duration: 1456, delay: P2_START + 156, easing: Easing.inOut(Easing.poly(4)), useNativeDriver: true }).start();
    cols.forEach((c, i) => {
      Animated.timing(c, { toValue: 1, duration: RISE_DUR, delay: RISE_BASE + i * RISE_STAGGER, easing: Easing.out(Easing.poly(4)), useNativeDriver: true }).start();
    });

    // Scène 3 — Signature (4000 → 5800)
    Animated.timing(tagOp, { toValue: 1, duration: 676, delay: P3_START + 72, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(tagY,  { toValue: 0, duration: 780, delay: P3_START + 72, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    // Respiration du point pendant la signature ; sa fin pilote le retrait.
    Animated.sequence([
      Animated.delay(P3_START + 450),
      Animated.timing(dotBreath, { toValue: 1.035, duration: 620, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(dotBreath, { toValue: 1,     duration: 550, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished && !finishedRef.current) setTimeout(finish, HOLD);
    });
  };

  const dotTranslateX = dotSlide.interpolate({ inputRange: [0, 1], outputRange: [0, dotFinalX - centerX] });
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.9] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg, opacity: rootOp }]}>
      {/* Hairline (scène 1) */}
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', left: centerX - SW * 0.15, top: dotCY - 0.75, width: SW * 0.3, height: 1.5,
        backgroundColor: inkFaint, opacity: hairlineOp, transform: [{ scaleX: hairline }],
      }} />

      {/* Onde (fin scène 1) */}
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', left: centerX - DOT_D / 2, top: dotCY - DOT_D / 2, width: DOT_D, height: DOT_D,
        borderRadius: DOT_D / 2, borderWidth: 1.5, borderColor: green, opacity: ringOpacity, transform: [{ scale: ringScale }],
      }} />

      {/* « fixed » — tranches montantes. Coupes arrondies au pixel (colonnes
          exactement jointives) + 1px de chevauchement pour masquer les coutures ;
          le point du PNG est hors zone (dernière coupe à .915), jamais dessiné. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: lockLeft, top: lockTop, width: W, height: H, overflow: 'hidden' }}>
        {cols.map((c, i) => {
          const x0 = Math.round(CUTS[i] * W);
          const x1 = Math.round(CUTS[i + 1] * W);
          const bleed = i < cols.length - 1 ? 1 : 0; // pas de chevauchement sur la dernière (n'empiète pas sur le point)
          const ty = c.interpolate({ inputRange: [0, 1], outputRange: [H + 8, 0] });
          return (
            <Animated.View key={i} style={{ position: 'absolute', left: x0, top: 0, width: (x1 - x0) + bleed, height: H, overflow: 'hidden', transform: [{ translateY: ty }] }}>
              <Image source={wordmark} style={{ position: 'absolute', left: -x0, top: 0, width: W, height: H }} resizeMode="stretch" />
            </Animated.View>
          );
        })}
      </View>

      {/* Le point vert (dessiné) */}
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', left: centerX - DOT_D / 2, top: dotCY - DOT_D / 2, width: DOT_D, height: DOT_D,
        borderRadius: DOT_D / 2, backgroundColor: green,
        transform: [{ translateX: dotTranslateX }, { scale: dotScale }, { scale: dotBreath }],
      }} />

      {/* Signature (scène 3) */}
      <Animated.Text pointerEvents="none" numberOfLines={1} style={{
        position: 'absolute', top: lockTop + H + Math.max(22, H * 0.42), left: 0, right: 0, textAlign: 'center',
        fontFamily: FONTS.mono, fontSize: 12, color: inkSoft, textTransform: 'uppercase',
        letterSpacing: 3, opacity: tagOp, transform: [{ translateY: tagY }],
      }}>
        {t('splash.tagline')}
      </Animated.Text>

      {/* Tap pour passer (au-dessus, transparent) */}
      <Pressable style={StyleSheet.absoluteFill} onPress={finish} accessibilityRole="button" accessibilityLabel="FIXED" />
    </Animated.View>
  );
}
