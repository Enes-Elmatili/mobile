# Mouvement — Plan 2 : devis, prix, engagement (moments 6-10)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Appliquer les hooks de `lib/motion` (plan 1) aux cinq moments du devis, du prix et de l'engagement : lignes de devis qui s'additionnent (8), sceau / pli (9), prix qui bouge dans le stepper (10), glisser pour accepter (6), passage en ligne qui se réchauffe (7) — et sortir quatre fichiers d'`Animated` legacy au passage.

**Architecture:** Aucun nouveau hook : tout vient de `lib/motion` (`useCountingValue`+`ReText`, `usePresence`, `useBreathe`, `useTraceStroke`, `useSlideToConfirm`, `MOTION`, `SHEET_SPRING`). Chaque écran ne change que là où le moment s'applique ; les fichiers qui portent encore d'autres animations legacy (NewRequestStepper, missions) gardent leur import `Animated` et importent Reanimated sous l'alias `Reanimated` — ils restent en allowlist. Les fichiers entièrement migrés (send-quote, quote-review, MissionRequestSheet) en sortent.

**Tech Stack:** identique au plan 1. Branche : `feat/motion-foundation` (empilé).

**Spec:** `docs/superpowers/specs/2026-09-12-motion-and-adaptive-layout-design.md` § 5, moments 6-10.

---

## Fichiers

| Fichier | Moment | Changement | Allowlist Animated |
|---|---|---|---|
| `app/request/[id]/send-quote.tsx` | 8 | bloc total : `usePresence` + `useCountingValue` (remplace `Animated.spring` tension/friction) | **retiré** |
| `app/request/[id]/quote-review.tsx` | 8, 9 | `Reveal` → `usePresence` avec délai (cascade) ; squelette → `withRepeat` ; scroll → `useAnimatedScrollHandler` ; sceau tracé + bordure ambre → vert à l'acceptation ; pli au refus | **retiré** |
| `app/request/NewRequestStepper.tsx` | 10 | `AmountCardB` : montant qui compte, respiration, delta | reste (autres anims legacy → plan 3) |
| `components/sheets/MissionRequestSheet.tsx` | 6 | sheet + backdrop + barre sur Reanimated ; bouton Accepter → curseur `useSlideToConfirm` | **retiré** |
| `app/(tabs)/missions.tsx` | 6 | `OpportunityDetail` : CTA Accepter → curseur | reste |
| `app/(tabs)/provider-dashboard.tsx` | 7 | section statut : couleur qui se réchauffe (`interpolateColor`, k 200 / k 600), point qui « prend », libellé après la couleur | — (déjà Reanimated) |
| `components/ui/SlideToConfirm.tsx` | 6 | composant partagé (piste, curseur, libellé) sur `useSlideToConfirm` | Créer |
| `locales/{fr,en,nl}.json` | 6 | `common.slide_to_accept`, `common.accepted` | Modifier |
| `eslint.config.js` | — | 3 entrées retirées | Modifier |

---

### Tâche 1 : `SlideToConfirm` — le composant partagé

**Files:** Create `components/ui/SlideToConfirm.tsx` ; Modify `locales/fr.json`, `locales/en.json`, `locales/nl.json`

- [ ] **Étape 1 : composant**

```tsx
// components/ui/SlideToConfirm.tsx
// Un engagement mérite un geste : accepter une mission se fait en glissant.
// Élastique si on lâche tôt, projection de l'élan si on flick (lib/motion).
import React, { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS, alpha } from '@/hooks/use-app-theme';
import { useSlideToConfirm } from '@/lib/motion/useSlideToConfirm';

const KNOB = 52;
const HEIGHT = 58;

type Props = {
  label?: string;
  doneLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  /** Après confirmation, le curseur reste au bout et le libellé passe à `doneLabel`. */
  done?: boolean;
};

export function SlideToConfirm({ label, doneLabel, onConfirm, disabled = false, done = false }: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const { gesture, knobStyle, fillStyle, labelStyle } = useSlideToConfirm({ trackWidth, knobSize: KNOB, onConfirm });
  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      style={[s.track, { backgroundColor: theme.surface, borderColor: done ? COLORS.green : theme.border, opacity: disabled ? 0.5 : 1 }]}
      accessibilityRole="adjustable"
      accessibilityLabel={label ?? t('common.slide_to_accept')}
      accessibilityHint={t('common.slide_to_accept_hint')}
    >
      <Animated.View style={[s.fill, { backgroundColor: alpha(COLORS.greenBrand, 0.16) }, fillStyle]} />
      <Animated.View style={[s.labelWrap, labelStyle]} pointerEvents="none">
        <Text style={[s.label, { color: done ? COLORS.green : theme.textSub }]}>{done ? (doneLabel ?? t('common.accepted')) : (label ?? t('common.slide_to_accept'))}</Text>
      </Animated.View>
      <GestureDetector gesture={disabled || done ? gesture.enabled(false) : gesture}>
        <Animated.View style={[s.knob, { backgroundColor: done ? COLORS.green : theme.accent }, knobStyle]}>
          <Feather name={done ? 'check' : 'arrow-right'} size={20} color={theme.accentText as string} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const s = StyleSheet.create({
  track: { height: HEIGHT, borderRadius: HEIGHT / 2, borderWidth: 1, overflow: 'hidden', justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 0 },
  labelWrap: { position: 'absolute', left: KNOB + 6, right: 16, alignItems: 'center' },
  label: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 16, letterSpacing: 1.2 },
  knob: { position: 'absolute', left: 3, top: 3, width: KNOB, height: KNOB, borderRadius: KNOB / 2, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Étape 2 : clés i18n** — ajouter dans `common` de chaque locale : fr `slide_to_accept: "Glisser pour accepter"`, `slide_to_accept_hint: "Faites glisser le curseur vers la droite pour accepter"`, `accepted: "Acceptée"` ; en `Slide to accept` / `Slide the knob to the right to accept` / `Accepted` ; nl `Schuif om te accepteren` / `Schuif de knop naar rechts om te accepteren` / `Geaccepteerd`.
- [ ] **Étape 3 :** `npx tsc --noEmit` → OK ; commit `motion: SlideToConfirm — le curseur d'engagement partagé`.

### Tâche 2 : moment 8 — `send-quote.tsx`, le total qui compte

- [ ] Remplacer l'import `Animated, Easing` de react-native par `import Animated from 'react-native-reanimated'` ; importer `usePresence`, `useCountingValue`, `MOTION` depuis `@/lib/motion`, `ReText` depuis `@/components/ui/ReText`.
- [ ] Remplacer le bloc `totalAnim` (useRef + useEffect Animated.spring) par :

```tsx
  // Le bloc total apparaît par le bas (usePresence) et son montant COMPTE
  // (useCountingValue) au lieu de sauter. Décimales et devise restent fixes.
  const totalPresence = usePresence(totalCents > 0, { from: 'bottom', preset: MOTION.pane });
  const totalCounter = useCountingValue(Math.floor(totalCents / 100), { preset: MOTION.count });
```

- [ ] Dans le JSX du bloc total : `style={[s.totalBlock, {...}, totalPresence.style]}` et `<Text style={[s.totalInt,…]}>{totalInt}</Text>` → `<ReText animatedProps={totalCounter.animatedProps} style={[s.totalInt, { color: theme.text }]} accessibilityLabel={fmtEur(totalCents)} />`. `totalInt` (toLocaleString) devient inutile : supprimer sa ligne.
- [ ] Retirer `'app/request/[id]/send-quote.tsx'` de l'allowlist. `npx eslint "app/request/[id]/send-quote.tsx"` → 0 erreur ; tsc OK ; commit.

### Tâche 3 : moments 8 + 9 — `quote-review.tsx`

- [ ] Imports : retirer `Animated, Easing` de react-native ; `import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, interpolate, interpolateColor, withSpring, Easing } from 'react-native-reanimated'` ; `import Svg, { Path } from 'react-native-svg'` ; `usePresence, useTraceStroke, MOTION` depuis `@/lib/motion`. `EASE_OUT` devient `Easing.bezier(0.22, 1, 0.36, 1)` de Reanimated.
- [ ] `Reveal` → 

```tsx
function Reveal({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { style } = usePresence(mounted, { from: 'bottom', preset: MOTION.pane, delayMs: delay });
  return <Animated.View style={style}>{children}</Animated.View>;
}
```

- [ ] `QuoteSkeleton` : `pulse` → `useSharedValue(0.45)` + `withRepeat(withSequence(withTiming(1, {duration: 900, easing: Easing.inOut(Easing.ease)}), withTiming(0.45, …)), -1, false)` ; `Block` rend `<Animated.View style={[…, pulseStyle]}>` avec `pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }))`.
- [ ] Scroll : `scrollY = useSharedValue(0)` ; `const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; })` ; `headerLineStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, 28], [0, 1], 'clamp') }))` ; `<Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16}>` ; ligne d'en-tête `style={[{ height: hairline, backgroundColor: theme.border }, headerLineStyle]}`.
- [ ] Sceau (moment 9) : remplacer le filigrane `FIXED` du héro par

```tsx
{accepted ? <SealCheck color={COLORS.green} /> : <Text style={[s.heroWatermark, { color: theme.heroSubFaint }]}>FIXED</Text>}
```

avec, au niveau module :

```tsx
const AnimatedPath = Animated.createAnimatedComponent(Path);
function SealCheck({ color }: { color: string }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { setDrawn(true); }, []);
  const { animatedProps } = useTraceStroke(drawn);
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <AnimatedPath d="M5 12.5 L10 17.5 L19 7" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={1} pathLength={1} animatedProps={animatedProps} />
    </Svg>
  );
}
```

et la bordure du héro passe d'ambre à vert : `heroBorderStyle = useAnimatedStyle(() => ({ borderColor: interpolateColor(seal.value, [0, 1], [alpha(COLORS.amber, 0.45), alpha(COLORS.greenBrand, 0.6)]) }))` avec `seal = useSharedValue(accepted ? 1 : 0)` et `useEffect(() => { seal.value = withSpring(accepted ? 1 : 0, MOTION.trace); }, [accepted])`. Le `View` `s.heroBorder` devient `Animated.View` et perd sa `borderColor` statique.
- [ ] Pli (moment 9) : `fold = useSharedValue(0)` ; `useEffect(() => { fold.value = withSpring(refused ? 1 : 0, MOTION.pane); }, [refused])` ; `foldStyle = useAnimatedStyle(() => ({ transform: [{ perspective: 600 }, { rotateX: `${-12 * fold.value}deg` }, { scale: 1 - 0.04 * fold.value }], opacity: 1 - 0.35 * fold.value }))` sur le conteneur du héro.
- [ ] Retirer de l'allowlist ; lint 0 erreur ; tsc ; commit.

### Tâche 4 : moment 10 — `AmountCardB` dans `NewRequestStepper.tsx`

- [ ] Imports (le fichier garde `Animated` legacy) : `import Reanimated from 'react-native-reanimated'` ; `useCountingValue, useBreathe, usePresence, MOTION` depuis `@/lib/motion` ; `ReText`.
- [ ] Dans `AmountCardB`, dériver le montant numérique de `euros` (chaîne « 89,00 » ou « 89.00ᵉ ») :

```tsx
  const amount = useMemo(() => {
    const n = parseFloat(String(euros).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }, [euros]);
  const counter = useCountingValue(amount, { decimals: 2, preset: MOTION.count });
  const breathe = useBreathe();
  const prevRef = useRef(amount);
  const [delta, setDelta] = useState<number | null>(null);
  const deltaPresence = usePresence(delta !== null, { from: 'bottom', preset: MOTION.pane });
  useEffect(() => {
    if (prevRef.current === amount) return;
    const d = amount - prevRef.current; prevRef.current = amount;
    breathe.pulse();
    setDelta(d);
    const id = setTimeout(() => setDelta(null), 1200);
    return () => clearTimeout(id);
  }, [amount]);
```

- [ ] JSX : le `<Text …fontSize 54>{euros}<Text> €</Text></Text>` devient

```tsx
        <Reanimated.View style={[{ flexDirection: 'row', alignItems: 'baseline' }, breathe.style]}>
          <ReText animatedProps={counter.animatedProps} style={{ fontFamily: FONTS.bebas, fontSize: 54, letterSpacing: 0.5, lineHeight: 56, color: theme.heroText }} accessibilityLabel={`${euros} €`} />
          <Text style={{ fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 26, color: theme.heroSub }}> €</Text>
        </Reanimated.View>
        <Reanimated.View style={[{ position: 'absolute', right: 22, top: 58 }, deltaPresence.style]} pointerEvents="none">
          {delta !== null && (
            <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: delta > 0 ? COLORS.amber : COLORS.green }}>{delta > 0 ? '+' : '−'} {Math.abs(delta).toFixed(2).replace('.', ',')} €</Text>
          )}
        </Reanimated.View>
```

- [ ] tsc ; lint 0 erreur (fichier toujours en allowlist) ; commit.

### Tâche 5 : moment 6 — `MissionRequestSheet.tsx` sur Reanimated + curseur

- [ ] Imports : retirer `Animated, Easing` de react-native ; `import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing, runOnJS } from 'react-native-reanimated'` ; `SHEET_SPRING` depuis `@/lib/motion` ; `SlideToConfirm`.
- [ ] Shared values : `translateY = useSharedValue(SHEET_HEIGHT + 60)`, `backdrop = useSharedValue(0)`, `progress = useSharedValue(1)` ; supprimer `pulseAnim`, `pulseLoop`, `progressTimer`.
- [ ] `hide(cb)` : `translateY.value = withTiming(SHEET_HEIGHT + 60, { duration: 320, easing: Easing.in(Easing.quad) }); backdrop.value = withTiming(0, { duration: 280 }, (f) => { if (f) runOnJS(finishHide)(); })` où `finishHide` fait `setIsVisible(false); isHiding.current = false; cb?.()` (cb stocké dans une ref).
- [ ] `show()` : `translateY.value = withSpring(0, SHEET_SPRING, (f) => { if (f) runOnJS(triggerArrivalHaptic)(); }); backdrop.value = withTiming(1, { duration: 360 }); progress.value = 1; progress.value = withTiming(0, { duration: COUNTDOWN_SECONDS * 1000, easing: Easing.linear }, (f) => { if (f) runOnJS(onTimeout)(); })` avec `onTimeout = () => hide(() => onDecline())`.
- [ ] Styles : `backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }))`, `sheetStyle = (…transform translateY)`, `progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }))`. Remplacer `backdropOpacity`, `translateY`, `progressWidth` dans le JSX.
- [ ] Le bloc Actions : garder le bouton Refuser ; remplacer le `<Animated.View style={[styles.acceptWrap, { transform: [{ scale: pulseAnim }] }]}>…</Animated.View>` par `<View style={styles.acceptWrap}><SlideToConfirm label={t('mission_sheet.accept')} onConfirm={handleAccept} /></View>`.
- [ ] Retirer de l'allowlist ; lint ; tsc ; commit.

### Tâche 6 : moment 6 — `OpportunityDetail` dans `missions.tsx`

- [ ] Importer `SlideToConfirm`. Remplacer le `<TouchableOpacity style={[opp.acceptBtn, …]} onPress={onAccept} …>` (bloc CTA Refuser / Accepter, l. ~1278-1290) par `<View style={{ flex: 2 }}><SlideToConfirm label={tr('provider.accept')} onConfirm={onAccept} disabled={accepting} /></View>`. `ActivityIndicator` reste importé ailleurs ; sinon retirer l'import.
- [ ] tsc ; lint (fichier en allowlist) ; commit.

### Tâche 7 : moment 7 — `provider-dashboard.tsx`, le passage en ligne se réchauffe

- [ ] Dans le composant de la section statut (l. ~420) : `online01 = useSharedValue(isOnline ? 1 : 0)` ; `useEffect(() => { online01.value = withSpring(isOnline ? 1 : 0, spring(isOnline ? 200 : 600, 1.0), (f) => { if (f) runOnJS(setLabelOnline)(isOnline); }); }, [isOnline])` avec `const [labelOnline, setLabelOnline] = useState(isOnline)`.
- [ ] `sectionStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(online01.value, [0, 1], [offBg, theme.cardBg]) }))` (offBg = `theme.isDark ? 'rgba(255,255,255,0.08)' : theme.surface`), `textStyle = useAnimatedStyle(() => ({ color: interpolateColor(online01.value, [0, 1], [theme.textMuted, theme.text]) }))`, `dotTake = useTakeScale(isOnline, { on: 1.25, off: 1, preset: MOTION.take })` — puis retour à 1 : utiliser `useBreathe(1.25)` déclenché à la mise en ligne (`pulse()` dans le même effet quand `isOnline`).
- [ ] JSX : `<Pressable style={[ci.statusSection]}>` → `<Reanimated.View style={[ci.statusSection, sectionStyle]}>` autour du Pressable (ou `Animated.createAnimatedComponent(Pressable)`), texte → `<Reanimated.Text style={[ci.statusText, textStyle]}>{labelOnline ? t('provider.online') : t('provider.offline')}</Reanimated.Text>`, point → `<Reanimated.View style={[ci.dot, dotStyle, …]} />`.
- [ ] tsc ; lint ; commit.

### Tâche 8 : vérification

- [ ] `npx jest` verts, `npx eslint app components lib` 0 erreur, `npx tsc --noEmit` OK ; allowlist réduite de 3 (32 → 29).
- [ ] Manuel (dev client) : envoyer un devis (total qui compte), le recevoir (cascade + sceau à l'acceptation, pli au refus), stepper étape 3-4 (cocher urgent → montant qui compte + delta), nouvelle mission entrante (curseur : lâcher tôt, flick), passage en ligne / hors ligne. Reduce Motion ON pour chacun.
