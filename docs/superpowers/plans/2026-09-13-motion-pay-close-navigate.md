# Mouvement — Plan 3 : payer, clôturer, naviguer (moments 11, 13-18, 21)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Appliquer `lib/motion` aux moments de paiement, de clôture et de navigation : coche tracée + reçu (11), photos déposées (13), étoiles en vague (14), icônes d'onglet qui se redressent (15), toast depuis l'île (16), pull-to-refresh « fixed. » (17), squelettes qui respirent puis contenu en cascade (18), appui généralisé (21) — et supprimer les confettis, que le spec interdit.

**Architecture:** Même règle que les plans 1-2 : aucun nouveau hook, tout vient de `lib/motion`. Le moteur `feedback.*` reste la seule porte d'entrée des célébrations : c'est `CelebrationOverlay` qui change de nature (sceau au lieu de confettis), pas ses appelants. Le pull-to-refresh garde le `RefreshControl` natif pour le déclenchement (fiable, élastique natif) et n'ajoute qu'un en-tête visuel piloté par le scroll : zéro conflit de gestes.

**Tech Stack:** identique. Branche : `feat/motion-foundation` (empilé).

**Spec:** § 5, moments 11-18, 21.

**Écarts assumés :** moment 12 (remboursement qui redescend) — aucun écran n'affiche aujourd'hui un montant remboursé ; à brancher quand l'UI existera. Moment 15 — icône et libellé seulement ; l'indicateur qui glisse demande une tab bar entièrement custom (`tabBar` prop), reporté au plan 4 avec la sidebar « regular ». Moment 17 — pilote sur le dashboard et le wallet ; les 8 autres écrans à `RefreshControl` suivent au plan 4.

---

## Fichiers

| Fichier | Moment | Changement | Allowlist |
|---|---|---|---|
| `components/feedback/CelebrationOverlay.tsx` | 11 | confettis → anneau + coche tracée + titre qui respire ; auto-clear 1 600 ms | — |
| `components/feedback/Toast.tsx` | 16 | entrée depuis l'île (`MOTION.island`), retrait ressort k 300 | — |
| `app/request/[id]/rating.tsx` | 14 | `Star` : vague 25 ms, dépassement sur la dernière | reste (autres anims) |
| `app/request/[id]/ongoing.tsx` | 13 | vignettes déposées (1,1 → 1) + haptique light à l'upload | reste |
| `components/ui/RaisedButton.tsx` | 21 | `usePressScale` + assombrissement sur shared value | **retiré** |
| `components/ui/TabIcon.tsx` + `app/(tabs)/_layout.tsx` | 15 | icône qui se redresse (0,9 → 1) au focus | — |
| `components/ui/Skeleton.tsx` + `app/(tabs)/dashboard.tsx` + `app/formules.tsx` | 18 | bloc qui respire partagé ; contenu du dashboard en cascade | — |
| `components/ui/BrandRefresh.tsx` + `dashboard.tsx` + `wallet.tsx` | 17 | en-tête « fixed. » qui s'étire avec le scroll négatif | — |

---

### Tâche 1 : moment 11 — le sceau remplace les confettis

**Files:** Rewrite `components/feedback/CelebrationOverlay.tsx`

```tsx
// components/feedback/CelebrationOverlay.tsx
// Célébration = un sceau, pas une pluie. Anneau qui se ferme (600 ms), coche
// qui se trace (ressort), titre qui respire, puis tout s'efface. Une seule
// haptique, émise par le moteur feedback en amont (règle 6). Zéro confetti :
// le spec l'interdit — rien ne bouge sans dire quelque chose.
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { darkTokens, FONTS, COLORS } from '@/hooks/use-app-theme';
import { CelebrationItem, useFeedbackStore } from '@/lib/feedback/store';
import { MOTION, useReduceMotion, useTraceStroke } from '@/lib/motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const R = 34;
const RING_LENGTH = 2 * Math.PI * R;
const CHECK_LENGTH = 21; // « M22 37 L32 47 L51 27 » ≈ 14,1 + 27,6 → mis à l'échelle 24 : voir viewBox
const LIFE_MS = 1600;

export function CelebrationOverlay({ item }: { item: CelebrationItem }) {
  const clear = useFeedbackStore((s) => s.clearCelebration);
  const reduced = useReduceMotion();
  const [checkDrawn, setCheckDrawn] = useState(false);
  const ring = useSharedValue(reduced ? 0 : RING_LENGTH);
  const title = useSharedValue(0);
  const out = useSharedValue(1);

  useEffect(() => {
    if (reduced) { setCheckDrawn(true); title.value = withTiming(1, { duration: 200 }); }
    else {
      ring.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });
      const t1 = setTimeout(() => setCheckDrawn(true), 420);
      title.value = withDelay(500, withSpring(1, MOTION.pane));
      return () => clearTimeout(t1);
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { out.value = withTiming(0, { duration: 220 }); }, LIFE_MS - 220);
    const c = setTimeout(clear, LIFE_MS);
    return () => { clearTimeout(t); clearTimeout(c); };
  }, [clear, out]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: ring.value }));
  const { animatedProps: checkProps } = useTraceStroke(checkDrawn, { length: CHECK_LENGTH });
  const wrapStyle = useAnimatedStyle(() => ({ opacity: out.value }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: title.value, transform: [{ translateY: 8 * (1 - title.value) }, { scale: 0.96 + 0.04 * title.value }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.center, wrapStyle]} pointerEvents="none">
      <View style={s.badge}>
        <Svg width={84} height={84} viewBox="0 0 84 84">
          <Circle cx={42} cy={42} r={R} fill="none" stroke={darkTokens.border} strokeWidth={2} />
          <AnimatedCircle cx={42} cy={42} r={R} fill="none" stroke={COLORS.greenBrand} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={RING_LENGTH} animatedProps={ringProps} transform="rotate(-90 42 42)" />
          <AnimatedPath d="M30 43 L38.5 51.5 L55 34" fill="none" stroke={COLORS.greenBrand} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={CHECK_LENGTH * 1.7} animatedProps={checkProps} />
        </Svg>
      </View>
      <Animated.Text style={[s.title, titleStyle]}>{item.title}</Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 18 },
  badge: { width: 84, height: 84, borderRadius: 42, backgroundColor: darkTokens.cardBg, alignItems: 'center', justifyContent: 'center' },
  title: { color: darkTokens.text, fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 34, letterSpacing: 1, textAlign: 'center', paddingHorizontal: 24 },
});
```

> Longueurs : la coche « M30 43 L38.5 51.5 L55 34 » mesure √(8,5²+8,5²) + √(16,5²+17,5²) ≈ 12,0 + 24,0 = 36 → `strokeDasharray` et `length` valent 36 (ajuster la constante au lieu de l'approximation ci-dessus lors de l'écriture).

- [ ] tsc, lint, commit `feedback: la célébration est un sceau — anneau, coche tracée, titre ; plus de confettis`.

### Tâche 2 : moment 16 — le toast s'étend depuis l'île

Dans `Toast.tsx`, remplacer la timeline par :

```tsx
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withSpring(1, MOTION.island);
    const t = setTimeout(() => { progress.value = withSpring(0, spring(300, 1.0), (f) => { if (f) runOnJS(dismiss)(item.id); }); }, 2500);
    return () => clearTimeout(t);
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: -8 * (1 - progress.value) }, { scaleX: 0.6 + 0.4 * progress.value }],
  }));
```

- [ ] tsc, lint, commit.

### Tâche 3 : moment 14 — les étoiles en vague (`rating.tsx`)

`Star` reçoit `index` et `total` ; le parent passe `rating`. Le composant (Reanimated sous alias, le fichier reste en allowlist) :

```tsx
function Star({ index, rating, onPress, accessibilityLabel, textMuted }: { index: number; rating: number; onPress: () => void; accessibilityLabel?: string; textMuted: string }) {
  const filled = rating >= index;
  const isLast = rating === index;
  const scale = useSharedValue(1);
  const prev = useRef(rating);
  useEffect(() => {
    const up = rating > prev.current;
    const from = Math.min(prev.current, rating), to = Math.max(prev.current, rating);
    prev.current = rating;
    if (index <= from || index > to) return; // pas concernée par ce changement
    const order = up ? index - from - 1 : to - index; // position dans la vague
    scale.value = 1.25;
    scale.value = withDelay(order * 25, withSpring(1, isLast && up ? spring(500, 0.7) : spring(500, 1.0)));
    if (up) setTimeout(() => feedback.haptic(isLast ? 'selection' : 'light'), order * 25);
  }, [rating]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={1} accessibilityLabel={accessibilityLabel} accessibilityRole="button">
      <Reanimated.View style={style}><Feather name="star" size={44} color={filled ? COLORS.amber : textMuted} /></Reanimated.View>
    </TouchableOpacity>
  );
}
```

Usage : `<Star key={star} index={star} rating={rating} onPress={() => setRating(star)} … />`.

- [ ] tsc, lint, commit.

### Tâche 4 : moment 13 — les photos se déposent (`ongoing.tsx`)

Composant local `PhotoThumb({ uri, borderColor })` : `const [in, setIn] = useState(false); useEffect(() => setIn(true), []); const { style } = useTakeScale(in, { on: 1, off: 1.1, preset: MOTION.take });` rend `<Reanimated.Image source={{ uri }} style={[s.photoThumb, { borderColor }, style]} />` (`Reanimated.createAnimatedComponent(Image)`). Remplacer les deux `<Image … photoThumb …/>`. Après `setBeforePhotoUri(uri)` / `setAfterPhotoUri(uri)` (l. 407-408) : `feedback.haptic('light')`.

- [ ] tsc, lint, commit.

### Tâche 5 : moment 21 — `RaisedButton` sur `usePressScale`

Remplacer `scale`/`pressDim` legacy : `const press = usePressScale();` + `const dim = useSharedValue(0)` ; `onPressIn = () => { press.onPressIn(); dim.value = withTiming(1, { duration: 80 }); }`, `onPressOut` inverse (140 ms) ; `dimStyle = useAnimatedStyle(() => ({ opacity: dim.value * (theme.isDark ? 0.18 : 0.08) }))` ; l'outer `Animated.View` prend `press.style`, l'overlay prend `dimStyle`. Import `Animated` depuis Reanimated. Retirer de l'allowlist.

- [ ] tsc, lint, commit.

### Tâche 6 : moment 15 — l'icône d'onglet se redresse

`components/ui/TabIcon.tsx` : `export function TabIcon({ name, color, focused }) { const { style } = useTakeScale(focused, { on: 1, off: 0.9, preset: MOTION.tabIcon }); return <Animated.View style={style}><Feather name={name} size={22} color={color} /></Animated.View>; }`. Dans `_layout.tsx`, chaque `tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />` (objets toujours mémoïsés).

- [ ] tsc, lint, commit.

### Tâche 7 : moment 18 — `Skeleton` partagé + cascade du dashboard

`components/ui/Skeleton.tsx` : `export function Skeleton({ w, h, r = 8, style })` — respiration 0,4 ↔ 0,7 / 1,2 s (`withRepeat(withSequence(withTiming(0.7, 600), withTiming(0.4, 600)), -1)`), figé à 0,55 sous reduce-motion ; fond `theme.surface`. `DashboardSkeleton` et `formules.tsx` l'utilisent (leurs `Block` locaux disparaissent). Dans le dashboard, les trois premières sections du contenu (héro, île mission, grille services) sont enveloppées dans `<CascadeItem index={0|1|2} stepMs={50}>`.

- [ ] tsc, lint, commit.

### Tâche 8 : moment 17 — `BrandRefresh` (pilote dashboard + wallet)

`components/ui/BrandRefresh.tsx` : `useBrandRefresh()` → `{ onScroll, headerStyle }` : `scrollY` via `useAnimatedScrollHandler` ; `headerStyle` : `const pull = Math.max(0, -scrollY.value); opacity: min(1, pull/30); transform: [{ translateY: pull*0.5 }, { scaleY: 1 + min(1, pull/80)*0.35 }, { scaleX: 1 - min(1, pull/80)*0.08 }]`. Composant `<BrandRefreshHeader style={headerStyle} />` : « fixed<span vert>.</span> » en Bebas 34, absolu en haut, `pointerEvents="none"`. Dashboard : `ScrollView` → `Animated.ScrollView` avec `onScroll` + `scrollEventThrottle={16}`, `RefreshControl tintColor="transparent" colors={['transparent']}` (le natif garde le déclenchement, notre en-tête porte le visuel). Wallet : `FlatList` → `Animated.FlatList`, idem.

- [ ] tsc, lint, commit.

### Tâche 9 : vérification

- [ ] jest, eslint 0 erreur, tsc ; allowlist 29 → 28 ; note d'état en tête du plan ; mémoire projet.
