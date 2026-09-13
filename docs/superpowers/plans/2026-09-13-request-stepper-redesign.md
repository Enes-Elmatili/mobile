# Refonte du stepper de demande — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'en-tête, la transition, l'étape Service, l'étape Planning et le bouton principal de `app/request/NewRequestStepper.tsx` par dix composants extraits, conformes à la spec `docs/superpowers/specs/2026-09-13-request-stepper-redesign-design.md` (planches 1A, 2A, 3A, 4A ; aucun montant à l'étape Service).

**Architecture:** Les composants vivent dans `components/request/` (plus `components/ui/SegmentedControl.tsx`), reçoivent des props et rendent des callbacks, sans accès aux states du stepper. Les helpers purs (`lib/scheduling/weeks.ts`, `lib/request/crumbs.ts`) sont testés avec jest. Le stepper garde ses states, ses appels API et son paiement ; il perd ~700 lignes de composants internes et de styles morts.

**Tech Stack:** Expo SDK 54, React Native 0.81, Reanimated 4.1 (animations de layout `SlideInRight`/`SlideOutLeft`, `withSpring`), `lib/motion` (`MOTION.pane`, `MOTION.tab`, `MOTION.take`, `usePressScale`, `useReduceMotion`), `lib/layout` (`AdaptiveScroll`), `feedback.haptic`, i18n `react-i18next` (fr/nl/en), jest (`jest-expo`).

**Conventions du dépôt à respecter :** icônes Feather uniquement ; couleurs via `useAppTheme()` (jamais de hex en dur hors `COLORS`) ; jamais `Animated` de react-native, `Dimensions.get`, `Alert.alert`, `expo-haptics` direct (ESLint bloque) ; retour tactile à l'appui via `usePressScale` ; reduce-motion → fondu. Vérifications à chaque tâche : `npx tsc --noEmit`, `npx eslint app components lib hooks` (0 erreur), `npx jest`. Commits avec `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

## Fichiers

- Créer `components/request/StepCTA.tsx` — bouton principal plat, indication quand désactivé, montant à droite.
- Créer `components/request/StepHeader.tsx` — retour, titre Bebas + compteur, ligne de progression, puces.
- Créer `components/request/StepCrumbs.tsx` — rangée de puces touchables.
- Créer `components/request/StepPager.tsx` — conteneur à animation de layout (poussée gauche/droite), réutilisé pour la liste de prestations et la semaine.
- Créer `components/request/CategoryRail.tsx` — pilules de catégories (segmenté ≤ 3, défilant au-delà).
- Créer `components/request/ServiceRow.tsx` — ligne de prestation : nom, description, pastille, radio.
- Créer `components/request/WeekStrip.tsx` — semaine lundi → dimanche, en-tête et chevrons.
- Créer `components/request/SlotGrid.tsx` — tableau moments × 4 colonnes.
- Créer `components/request/SettingRow.tsx` — ligne standard icône / titre / sous-titre / accessoire, contenu dépliable.
- Créer `components/ui/SegmentedControl.tsx` — contrôle segmenté générique.
- Créer `lib/request/crumbs.ts` — `deriveCrumbs`.
- Créer `lib/scheduling/weeks.ts` — `buildWeeks`, `findDay`, `isSlotDisabled`.
- Créer `__tests__/crumbs.test.js`, `__tests__/weeks.test.js`, `__tests__/slots.test.js`.
- Modifier `app/request/NewRequestStepper.tsx` — brancher les composants, supprimer les internes.
- Modifier `locales/fr.json`, `locales/nl.json`, `locales/en.json` — section `stepper`.

---

### Tâche 1 : `StepCTA` branché sur les quatre étapes

**Files:**
- Create: `components/request/StepCTA.tsx`
- Modify: `app/request/NewRequestStepper.tsx` (4 usages de `BottomCTA`, suppression de `BottomCTA`, `BrandSheen`, styles `cta`)
- Modify: `locales/fr.json`, `locales/nl.json`, `locales/en.json`

- [ ] **Étape 1 : ajouter les clés d'indication**

Script (exécuter depuis `mobile/`) — il insère trois clés à la fin de la section `stepper` de chaque locale :

```bash
python3 - <<'EOF'
import json, collections
KEYS = {
  'fr': {'hint_choose_mode': 'Maintenant ou à planifier ?', 'hint_choose_day': 'Choisissez un jour', 'hint_choose_slot': 'Choisissez un créneau'},
  'nl': {'hint_choose_mode': 'Nu of later plannen?', 'hint_choose_day': 'Kies een dag', 'hint_choose_slot': 'Kies een tijdslot'},
  'en': {'hint_choose_mode': 'Now or scheduled?', 'hint_choose_day': 'Choose a day', 'hint_choose_slot': 'Choose a time slot'},
}
for lang, add in KEYS.items():
    p = f'locales/{lang}.json'
    d = json.load(open(p), object_pairs_hook=collections.OrderedDict)
    d['stepper'].update(add)
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=2); open(p, 'a').write('\n')
    print(lang, 'ok')
EOF
git diff --stat locales/
```

Attendu : `3 files changed, 9 insertions(+)` (3 lignes par fichier). Si le diff est bien plus large, le fichier n'était pas en indentation 2 espaces : `git checkout locales/` et ajouter les trois lignes à la main avant `"step_counter"` dans chaque fichier.

- [ ] **Étape 2 : écrire `components/request/StepCTA.tsx`**

```tsx
// components/request/StepCTA.tsx
// Bouton principal du stepper (planche 4A) : une pilule plate de 52 pt, le
// libellé à gauche, une flèche ou le montant à droite. Désactivé : le bouton
// reste visible à 35 % et une ligne au-dessus dit ce qui manque.
// Retour à l'appui (usePressScale, règle 4), haptique medium au onPress.
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Ligne d'indication affichée au-dessus quand le bouton est désactivé. */
  hint?: string;
  /** Montant à droite (étape 4). Sans montant : une flèche. */
  amount?: string;
  /** Étape 4 : libellé en Bebas 24. */
  emphasis?: boolean;
  /** Bouton posé sur un dégradé (étape 1) : ni fond ni bordure haute. */
  floating?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function StepCTA({ label, onPress, disabled, loading, hint, amount, emphasis, floating, style }: Props) {
  const theme = useAppTheme();
  const press = usePressScale();
  const inert = !!disabled || !!loading;

  const handlePress = () => {
    if (inert) return;
    feedback.haptic('medium');
    onPress();
  };

  return (
    <View style={[s.wrap, !floating && { backgroundColor: theme.bg, borderTopColor: theme.borderLight, borderTopWidth: 1 }, style]}>
      {disabled && !loading && hint ? (
        <Text style={[s.hint, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{hint}</Text>
      ) : null}
      <Animated.View style={[press.style, disabled && s.dimmed]}>
        <Pressable
          onPress={handlePress}
          onPressIn={inert ? undefined : press.onPressIn}
          onPressOut={inert ? undefined : press.onPressOut}
          disabled={inert}
          accessibilityRole="button"
          accessibilityLabel={amount ? `${label} ${amount}` : label}
          accessibilityState={{ disabled: inert, busy: !!loading }}
          style={[s.btn, { backgroundColor: theme.accent }]}
        >
          {loading ? (
            <ActivityIndicator color={theme.accentText as string} />
          ) : (
            <>
              <Text
                style={[s.label, emphasis && s.labelEmphasis, { color: theme.accentText }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
              >
                {label}
              </Text>
              {amount ? (
                <View style={[s.amount, { backgroundColor: theme.isDark ? 'rgba(10,10,10,0.08)' : 'rgba(255,255,255,0.14)' }]}>
                  <Text style={[s.amountText, { color: theme.accentText }]}>{amount}</Text>
                </View>
              ) : (
                <View style={s.arrow}>
                  <Feather name="arrow-right" size={20} color={theme.accentText as string} />
                </View>
              )}
            </>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:          { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  hint:          { fontFamily: FONTS.sans, fontSize: 12.5, textAlign: 'center', marginBottom: 10 },
  dimmed:        { opacity: 0.35 },
  btn:           { height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 22, paddingRight: 8 },
  label:         { flex: 1, fontFamily: FONTS.sansMedium, fontSize: 17 },
  labelEmphasis: { fontFamily: FONTS.bebas, fontSize: 24, letterSpacing: 0.5, includeFontPadding: false },
  arrow:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  amount:        { height: 36, paddingHorizontal: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  amountText:    { fontFamily: FONTS.bebas, fontSize: 20, letterSpacing: 0.3, includeFontPadding: false, fontVariant: ['tabular-nums'] },
});
```

- [ ] **Étape 3 : brancher les quatre usages dans `NewRequestStepper.tsx`**

Ajouter l'import après celui de `ReText` :

```ts
import { StepCTA } from '@/components/request/StepCTA';
```

Étape 1 (dans le `LinearGradient` `s.ctaFloating`) — remplacer le bloc `<BottomCTA ... wrapStyle={{ ... }} />` par :

```tsx
              <StepCTA
                floating
                label={t('stepper.confirm_address')}
                onPress={goNext}
                disabled={!location || !locationAllowed || addressMissingNumber}
                hint={!location ? t('stepper.select_address') : undefined}
                style={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}
              />
```

Étape 2 — remplacer :

```tsx
            <StepCTA
              label={isQuoteFlow ? t('stepper.request_quote_cta') : t('stepper.continue')}
              onPress={goNext}
              disabled={!serviceChosen}
              hint={t('stepper.select_service_type')}
            />
```

Étape 3 — remplacer (le libellé reste calculé comme aujourd'hui ; `days` sera remplacé en tâche 4) :

```tsx
              <StepCTA
                label={
                  scheduleMode === 'now'
                    ? t('stepper.confirm_now')
                    : (selectedDayIso && selectedTime
                      ? t('stepper.confirm_at', { day: days.find(d => d.iso === selectedDayIso)?.day, date: days.find(d => d.iso === selectedDayIso)?.date, time: selectedTime })
                      : t('stepper.confirm_slot'))
                }
                onPress={goNext}
                disabled={!step3Ready}
                hint={
                  scheduleMode === null
                    ? t('stepper.hint_choose_mode')
                    : !selectedDayIso ? t('stepper.hint_choose_day') : t('stepper.hint_choose_slot')
                }
              />
```

Étape 4 — remplacer le bloc `{/* Footer CTA */} <BottomCTA ... sheen />` par :

```tsx
            {/* Footer CTA — libellé à gauche, montant à droite (planche 4A) */}
            <StepCTA
              emphasis
              label={isFreeService ? t('stepper.confirm_free') : isQuoteFlow ? t('stepper.reserve') : t('stepper.confirm_mission')}
              amount={
                isFreeService
                  ? undefined
                  : isQuoteFlow
                    ? (confirmedCalloutCents != null ? formatEURCents(confirmedCalloutCents) : calloutFee > 0 ? formatEUR(calloutFee) : undefined)
                    : formatEURCents(discountedCentsFixed)
              }
              onPress={handlePay}
              disabled={loading || !paymentReady || !!pricingError || confirmRetryNeeded}
              loading={loading}
            />
```

- [ ] **Étape 4 : supprimer `BottomCTA`, `BrandSheen` et le style `cta`**

Dans `NewRequestStepper.tsx`, supprimer intégralement :
- la fonction `BottomCTA` (de `// ─── Bottom CTA ───` jusqu'au `const cta = StyleSheet.create({ ... });` inclus) ;
- la fonction `BrandSheen` (du commentaire `/** Reflet animé qui balaie une surface ...` à la fin de la fonction).

Vérifier qu'il ne reste aucune référence : `grep -n "BottomCTA\|BrandSheen\|cta\." app/request/NewRequestStepper.tsx` → aucune ligne.

- [ ] **Étape 5 : vérifier et committer**

```bash
npx tsc --noEmit && npx eslint app/request/NewRequestStepper.tsx components/request/StepCTA.tsx && npx jest 2>&1 | tail -4
```

Attendu : tsc silencieux, eslint 0 erreur (des avertissements `no-unused-vars` sur les imports Reanimated devenus inutiles sont possibles : retirer les symboles signalés de la ligne `import Reanimated, { ... } from 'react-native-reanimated'` et de `import { MOTION, ... } from '@/lib/motion'`), jest 161/161.

```bash
git add components/request/StepCTA.tsx app/request/NewRequestStepper.tsx locales/
git commit -m "stepper: StepCTA plat avec indication et montant (planche 4A) ; BottomCTA et BrandSheen supprimés

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tâche 2 : `StepHeader`, `StepCrumbs`, `StepPager`

**Files:**
- Create: `lib/request/crumbs.ts`, `__tests__/crumbs.test.js`
- Create: `components/request/StepCrumbs.tsx`, `components/request/StepHeader.tsx`, `components/request/StepPager.tsx`
- Modify: `app/request/NewRequestStepper.tsx` (en-tête, `StepIndicator`, `LiveSummary`, `animateStep`, `Reanimated.View` du contenu)

- [ ] **Étape 1 : test de `deriveCrumbs`**

`__tests__/crumbs.test.js` :

```js
const { deriveCrumbs } = require('../lib/request/crumbs');

describe('deriveCrumbs — puces des décisions prises (StepHeader)', () => {
  it('rien à l’étape 1 ni à l’étape 4', () => {
    expect(deriveCrumbs({ step: 1, address: 'Avenue Louise 143, 1050 Ixelles', serviceName: 'Débouchage' })).toEqual([]);
    expect(deriveCrumbs({ step: 4, address: 'Avenue Louise 143, 1050 Ixelles', serviceName: 'Débouchage' })).toEqual([]);
  });
  it('étape 2 : l’adresse seule, tronquée à la première virgule', () => {
    expect(deriveCrumbs({ step: 2, address: 'Avenue Louise 143, 1050 Ixelles', serviceName: 'Débouchage' }))
      .toEqual([{ step: 1, label: 'Avenue Louise 143' }]);
  });
  it('étape 3 : adresse puis prestation', () => {
    expect(deriveCrumbs({ step: 3, address: 'Rue Haute 12, 1000 Bruxelles', serviceName: 'Fuite d’eau' }))
      .toEqual([{ step: 1, label: 'Rue Haute 12' }, { step: 2, label: 'Fuite d’eau' }]);
  });
  it('ignore les valeurs absentes', () => {
    expect(deriveCrumbs({ step: 3, address: null, serviceName: null })).toEqual([]);
  });
});
```

- [ ] **Étape 2 : lancer le test, il doit échouer**

Run : `npx jest __tests__/crumbs.test.js`
Attendu : FAIL, `Cannot find module '../lib/request/crumbs'`.

- [ ] **Étape 3 : écrire `lib/request/crumbs.ts`**

```ts
// lib/request/crumbs.ts
// Les décisions déjà prises dans le stepper, sous forme de puces touchables
// (StepHeader). Rien à l'étape 1 (rien de décidé) ni à l'étape 4 (le récap
// prend le relais). Pur : testé dans __tests__/crumbs.test.js.
export type Crumb = { step: 1 | 2; label: string };

export function deriveCrumbs(input: { step: number; address: string | null; serviceName: string | null }): Crumb[] {
  const { step, address, serviceName } = input;
  if (step < 2 || step > 3) return [];
  const out: Crumb[] = [];
  if (address) out.push({ step: 1, label: address.split(',')[0].trim() });
  if (step >= 3 && serviceName) out.push({ step: 2, label: serviceName });
  return out;
}
```

- [ ] **Étape 4 : le test passe**

Run : `npx jest __tests__/crumbs.test.js` → PASS (4 tests).

- [ ] **Étape 5 : écrire `components/request/StepCrumbs.tsx`**

```tsx
// components/request/StepCrumbs.tsx
// Rangée de puces : ce qui est déjà décidé (adresse, prestation). Une puce
// ramène à son étape, en arrière seulement.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';
import type { Crumb } from '@/lib/request/crumbs';

function Chip({ crumb, onJump }: { crumb: Crumb; onJump: (step: number) => void }) {
  const theme = useAppTheme();
  const press = usePressScale();
  return (
    <Pressable
      onPress={() => { feedback.haptic('light'); onJump(crumb.step); }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={crumb.label}
    >
      <Animated.View style={[s.chip, { backgroundColor: theme.surface }, press.style]}>
        <Feather name="check" size={12} color={COLORS.greenBrand} />
        <Text style={[s.text, { color: theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{crumb.label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function StepCrumbs({ crumbs, onJump }: { crumbs: Crumb[]; onJump: (step: number) => void }) {
  if (crumbs.length === 0) return null;
  return (
    <View style={s.row}>
      {crumbs.map((c) => <Chip key={c.step} crumb={c} onJump={onJump} />)}
    </View>
  );
}

const s = StyleSheet.create({
  row:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 24, paddingTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingLeft: 8, paddingRight: 10, borderRadius: 999, maxWidth: 220 },
  text: { fontFamily: FONTS.sans, fontSize: 12, flexShrink: 1 },
});
```

- [ ] **Étape 6 : écrire `components/request/StepHeader.tsx`**

```tsx
// components/request/StepHeader.tsx
// En-tête du stepper (planche 1A) : bouton retour, titre de l'étape en Bebas
// avec le compteur, une seule ligne de progression (2 pt) qui avance sur
// MOTION.pane depuis sa valeur courante, puis les puces des décisions prises.
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';
import { StepCrumbs } from './StepCrumbs';
import type { Crumb } from '@/lib/request/crumbs';

type Props = {
  step: number;
  total: number;
  title: string;
  onBack: () => void;
  backLabel: string;
  crumbs?: Crumb[];
  onJump?: (step: number) => void;
};

export function StepHeader({ step, total, title, onBack, backLabel, crumbs = [], onJump }: Props) {
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const progress = useSharedValue(step / total);

  useEffect(() => {
    const target = step / total;
    progress.value = reduced ? withTiming(target, { duration: 120 }) : withSpring(target, MOTION.pane);
  }, [step, total, reduced, progress]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View>
      <View style={s.backRow}>
        <Pressable
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={backLabel}
          accessibilityRole="button"
          style={[s.backBtn, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
        >
          <Feather name="arrow-left" size={18} color={theme.text as string} />
        </Pressable>
      </View>
      <View style={s.titleRow}>
        <Text style={[s.title, { color: theme.text }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{title}</Text>
        <Text style={[s.counter, { color: theme.textMuted }]} maxFontSizeMultiplier={1.3}>{step} / {total}</Text>
      </View>
      <View style={[s.track, { backgroundColor: theme.border }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: step }}>
        <Animated.View style={[s.fill, { backgroundColor: theme.accent }, fill]} />
      </View>
      {onJump ? <StepCrumbs crumbs={crumbs} onJump={onJump} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  backRow:  { paddingHorizontal: 16, paddingVertical: 6 },
  backBtn:  { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 6 },
  title:    { fontFamily: FONTS.bebas, fontSize: 34, letterSpacing: 0.5, includeFontPadding: false, flexShrink: 1 },
  counter:  { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 1.5 },
  track:    { height: 2, marginTop: 12 },
  fill:     { height: '100%' },
});
```

- [ ] **Étape 7 : écrire `components/request/StepPager.tsx`**

```tsx
// components/request/StepPager.tsx
// Conteneur dont le contenu est POUSSÉ latéralement quand `page` change :
// en avant (direction 1) le nouveau contenu entre par la droite et l'ancien
// sort par la gauche ; en arrière, l'inverse. Animations de layout Reanimated
// sur les constantes de MOTION.pane ; reduce-motion : fondu 150 ms.
// Utilisé pour les étapes du stepper, la liste de prestations (par catégorie)
// et la semaine (WeekStrip).
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';

export type PagerDirection = 1 | -1;

type Props = {
  page: number | string;
  direction: PagerDirection;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

const { damping, stiffness, mass } = MOTION.pane;

export function StepPager({ page, direction, children, style }: Props) {
  const reduced = useReduceMotion();
  const entering = reduced
    ? FadeIn.duration(150)
    : (direction > 0 ? SlideInRight : SlideInLeft).springify().damping(damping).stiffness(stiffness).mass(mass);
  const exiting = reduced
    ? FadeOut.duration(150)
    : (direction > 0 ? SlideOutLeft : SlideOutRight).springify().damping(damping).stiffness(stiffness).mass(mass);
  return (
    <Animated.View key={String(page)} entering={entering} exiting={exiting} style={[{ flex: 1 }, style]}>
      {children}
    </Animated.View>
  );
}
```

- [ ] **Étape 8 : brancher dans `NewRequestStepper.tsx`**

Imports à ajouter :

```ts
import { StepHeader } from '@/components/request/StepHeader';
import { StepPager, type PagerDirection } from '@/components/request/StepPager';
import { deriveCrumbs } from '@/lib/request/crumbs';
```

Dans le composant, remplacer

```ts
  const stepFade = useSharedValue(1);
  const stepFadeStyle = useAnimatedStyle(() => ({ opacity: stepFade.value }));
```

par

```ts
  // Sens de la prochaine transition d'étape (StepPager) : 1 en avant, -1 en arrière.
  const dirRef = useRef<PagerDirection>(1);
```

Remplacer `animateStep`, `goNext` et `goBack` par :

```ts
  const goNext = () => {
    feedback.haptic('medium');
    // Save access info to user profile when leaving Step 3.
    // ⚠️ accessNotes EXCLU volontairement : c'est une info per-mission (digicode,
    // instructions ponctuelles) qui n'a pas vocation à devenir un défaut profil.
    // Le snapshot per-mission est géré via accessSnapshot dans le payload de création.
    if (step === 3) {
      const profileUpdate: Record<string, unknown> = {};
      if (buildingType)                         profileUpdate.buildingType = buildingType;
      if (floorNum.trim())                      profileUpdate.floor        = parseInt(floorNum, 10) || null;
      if (hasElevator !== null)                  profileUpdate.hasElevator  = hasElevator;
      if (clientLanguage)                        profileUpdate.language     = clientLanguage;
      if (Object.keys(profileUpdate).length > 0) {
        api.patch('/me', profileUpdate).catch(() => {});
      }
    }
    dirRef.current = 1;
    setStep((p) => Math.min(p + 1, TOTAL_STEPS));
  };
  const goBack = () => {
    feedback.haptic('light');
    if (step === 1) {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/dashboard');
    } else {
      dirRef.current = -1;
      setStep((p) => p - 1);
    }
  };
  /** Puce de l'en-tête : revenir à une étape déjà franchie. */
  const goTo = (target: number) => {
    if (target >= step) return;
    dirRef.current = -1;
    setStep(target);
  };
```

Remplacer tout le bloc de rendu entre `{/* ── Header ── */}` et `<Reanimated.View style={[s.flex, stepFadeStyle]}>` inclus (en-tête, `<StepIndicator step={step} />`, bannière préférence, `LiveSummary`, ouverture du conteneur animé) par :

```tsx
      {/* ── En-tête : retour, titre, ligne de progression, puces (planche 1A) ── */}
      <StepHeader
        step={step}
        total={TOTAL_STEPS}
        title={currentStep.label}
        onBack={goBack}
        backLabel={t('common.back')}
        crumbs={deriveCrumbs({ step, address: location?.address ?? null, serviceName })}
        onJump={goTo}
      />
      {/* ── Préférence prestataire (CTA "Demander X" depuis fiche) ── */}
      {preferred && (
        <View style={[s.preferredBanner, { backgroundColor: theme.surface, borderColor: theme.sep }]}>
          <Feather name="user-check" size={14} color={theme.text as string} />
          <Text style={[s.preferredBannerText, { color: theme.text, fontFamily: FONTS.sans }]}>
            {t('stepper.request_priority_prefix')}<Text style={{ fontFamily: FONTS.sansMedium }}>{preferred.name}</Text>
          </Text>
          <TouchableOpacity
            onPress={() => setPreferred(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('stepper.remove_preference_a11y')}
          >
            <Feather name="x" size={16} color={theme.textMuted as string} />
          </TouchableOpacity>
        </View>
      )}
      {/* ── Contenu de l'étape, poussé latéralement à chaque changement ── */}
      <StepPager page={step} direction={dirRef.current} style={s.flex}>
```

Et la fermeture `</Reanimated.View>` juste avant `<DevisInfoModal` devient `</StepPager>`.

Supprimer : `STEP_ICONS`, `StepSegment`, `StepIndicator`, `si`, `LiveSummary`, `ls`, et les styles `s.header`, `s.headerSide`, `s.headerCenter`, `s.stepCounter`, `s.stepCount`, `s.stepName`, `s.stepSublabel`, `s.backBtn` (vérifier avec `grep -n "s\.header\b\|s\.backBtn\|s\.stepName" app/request/NewRequestStepper.tsx` qu'ils ne sont plus référencés avant de les retirer).

- [ ] **Étape 9 : vérifier et committer**

```bash
npx tsc --noEmit && npx eslint app/request/NewRequestStepper.tsx components/request lib/request && npx jest 2>&1 | tail -4
```

Attendu : 0 erreur, 165 tests (161 + 4). Retirer les imports Reanimated devenus inutiles si eslint les signale.

```bash
git add lib/request/crumbs.ts __tests__/crumbs.test.js components/request/StepCrumbs.tsx components/request/StepHeader.tsx components/request/StepPager.tsx app/request/NewRequestStepper.tsx
git commit -m "stepper: en-tête à ligne de progression, puces des décisions, étapes poussées latéralement (planche 1A)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tâche 3 : étape Service — `CategoryRail` et `ServiceRow`

**Files:**
- Create: `components/request/CategoryRail.tsx`, `components/request/ServiceRow.tsx`
- Modify: `app/request/NewRequestStepper.tsx` (bloc `{step === 2 && (...)}`, `CategoryCard`, `SubChip`, refs de scroll, styles)

- [ ] **Étape 1 : écrire `components/request/CategoryRail.tsx`**

```tsx
// components/request/CategoryRail.tsx
// Rangée de pilules de catégories (planche 2A). Jusqu'à trois catégories les
// pilules se partagent la largeur (aspect segmenté) ; au-delà elles prennent
// la largeur de leur libellé et la rangée défile, avec un fondu à droite.
// Prêt pour les services qui s'ouvriront plus tard : aucune limite codée.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';

export type RailItem = { id: number; label: string };

type Props = { items: RailItem[]; selectedId: number | null; onSelect: (id: number) => void };

function Pill({ label, active, fill, onPress }: { label: string; active: boolean; fill: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  const press = usePressScale();
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={fill && s.fillItem}
    >
      <Animated.View style={[s.pill, { backgroundColor: active ? theme.accent : theme.surface }, press.style]}>
        <Text style={[s.label, { color: active ? theme.accentText : theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function CategoryRail({ items, selectedId, onSelect }: Props) {
  const theme = useAppTheme();
  const fill = items.length <= 3;
  const select = (id: number) => {
    if (id === selectedId) return;
    feedback.haptic('selection');
    onSelect(id);
  };
  if (fill) {
    return (
      <View style={s.rowFill}>
        {items.map((it) => <Pill key={it.id} label={it.label} active={it.id === selectedId} fill onPress={() => select(it.id)} />)}
      </View>
    );
  }
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rowScroll}>
        {items.map((it) => <Pill key={it.id} label={it.label} active={it.id === selectedId} fill={false} onPress={() => select(it.id)} />)}
      </ScrollView>
      <LinearGradient
        colors={[`${theme.bg}00`, theme.bg as string]}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={s.fade}
        pointerEvents="none"
      />
    </View>
  );
}

const s = StyleSheet.create({
  rowFill:   { flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingTop: 12 },
  rowScroll: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingTop: 12, paddingRight: 48 },
  fillItem:  { flex: 1 },
  pill:      { height: 40, borderRadius: 20, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  label:     { fontFamily: FONTS.sansMedium, fontSize: 14 },
  fade:      { position: 'absolute', right: 0, top: 0, bottom: 0, width: 40 },
});
```

- [ ] **Étape 2 : écrire `components/request/ServiceRow.tsx`**

```tsx
// components/request/ServiceRow.tsx
// Une prestation (planche 2A, sans montant) : nom, description sur une ligne,
// pastille « Prix fixe » / « Sur devis », radio qui « prend » sur MOTION.take.
// Aucune ligne n'est estompée : la sélection se lit sur le fond et le radio.
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';

type Props = {
  label: string;
  description?: string | null;
  /** "fixed_forfait" | "estimate" | "diagnostic" (Subcategory.pricingMode) */
  pricingMode?: string | null;
  selected: boolean;
  onPress: () => void;
  fixedLabel: string;
  quoteLabel: string;
};

export function ServiceRow({ label, description, pricingMode, selected, onPress, fixedLabel, quoteLabel }: Props) {
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const press = usePressScale(0.98);
  const isQuote = pricingMode === 'estimate' || pricingMode === 'diagnostic';

  const check = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    const target = selected ? 1 : 0;
    check.value = reduced ? withTiming(target, { duration: 100 }) : withSpring(target, MOTION.take);
  }, [selected, reduced, check]);
  const checkStyle = useAnimatedStyle(() => ({ opacity: check.value, transform: [{ scale: check.value }] }));

  return (
    <Pressable
      onPress={() => { feedback.haptic('selection'); onPress(); }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={`${label}, ${isQuote ? quoteLabel : fixedLabel}`}
    >
      <Animated.View style={[s.row, { borderBottomColor: theme.borderLight }, selected && { backgroundColor: theme.surfaceAlt, borderBottomColor: 'transparent' }, press.style]}>
        <View style={s.main}>
          <Text style={[s.name, { color: theme.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{label}</Text>
          {description ? (
            <Text style={[s.desc, { color: theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{description}</Text>
          ) : null}
        </View>
        <View style={[s.pill, { backgroundColor: isQuote ? 'rgba(200,130,10,0.15)' : 'rgba(21,193,110,0.15)' }]}>
          <Text style={[s.pillText, { color: isQuote ? COLORS.amber : theme.greenText }]} maxFontSizeMultiplier={1.2}>{isQuote ? quoteLabel : fixedLabel}</Text>
        </View>
        <View style={[s.radio, { borderColor: selected ? theme.accent : theme.border, backgroundColor: selected ? theme.accent : 'transparent' }]}>
          <Animated.View style={checkStyle}>
            <Feather name="check" size={13} color={theme.accentText as string} />
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, marginHorizontal: 8, borderRadius: 14, borderBottomWidth: 1 },
  main:     { flex: 1, minWidth: 0 },
  name:     { fontFamily: FONTS.sansMedium, fontSize: 15 },
  desc:     { fontFamily: FONTS.sans, fontSize: 12.5, marginTop: 2 },
  pill:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, minWidth: 70, alignItems: 'center' },
  pillText: { fontFamily: FONTS.sansMedium, fontSize: 11 },
  radio:    { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Étape 3 : réécrire le bloc de l'étape 2 dans `NewRequestStepper.tsx`**

Imports :

```ts
import { CategoryRail } from '@/components/request/CategoryRail';
import { ServiceRow } from '@/components/request/ServiceRow';
import { Skeleton } from '@/components/ui/Skeleton';
import { AdaptiveScroll } from '@/lib/layout';
```

Supprimer `step2ScrollRef` et `catLayoutsRef` (déclarations en tête du composant). Remplacer l'effet « Auto-sélection catégorie depuis param » par un effet qui pose toujours le rail sur une catégorie : celle du paramètre si elle existe, sinon la première (le bouton reste désactivé tant qu'aucune prestation n'est choisie) :

```ts
  // Le rail est toujours posé sur une catégorie : celle demandée par le
  // paramètre `selectedCategory` (CTA « Demander » depuis une fiche), sinon la première.
  useEffect(() => {
    if (categories.length === 0 || categoryId !== null) return;
    const wanted = preselectedCategory?.toLowerCase();
    const match = wanted
      ? categories.find((c) => c.name?.toLowerCase().includes(wanted) || c.slug?.toLowerCase() === wanted)
      : null;
    setCategoryId((match ?? categories[0]).id);
  }, [categories, categoryId, preselectedCategory]);
```

Ajouter, sous les dérivés `selectedCategory` / `selectedSubcategory`, la direction de la poussée du rail :

```ts
  // Sens de la poussée de la liste quand on change de catégorie (ordre des pilules).
  const prevCategoryIndexRef = useRef(0);
  const categoryIndex = Math.max(0, categories.findIndex((c) => c.id === categoryId));
  const railDirection: PagerDirection = categoryIndex >= prevCategoryIndexRef.current ? 1 : -1;
  useEffect(() => { prevCategoryIndexRef.current = categoryIndex; }, [categoryIndex]);
```

Remplacer tout le bloc `{step === 2 && ( ... )}` par :

```tsx
        {/* ══ ÉTAPE 2 — Service (planche 2A : rail de catégories, lignes sans montant) ══ */}
        {step === 2 && (
          <KeyboardAvoidingView style={s.flex} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
            <View style={s.flex}>
              {categories.length === 0 ? (
                <View style={s.skeletons}>
                  <Skeleton h={40} r={20} />
                  <Skeleton h={62} r={14} />
                  <Skeleton h={62} r={14} />
                  <Skeleton h={62} r={14} />
                </View>
              ) : (
                <>
                  <CategoryRail
                    items={categories.map((c) => ({ id: c.id, label: translateCategory(t, c) }))}
                    selectedId={categoryId}
                    onSelect={(id) => { setCategoryId(id); setSubcategoryId(null); }}
                  />
                  <StepPager page={categoryId ?? 'none'} direction={railDirection} style={s.flex}>
                    <AdaptiveScroll style={s.flex} contentContainerStyle={s.step2Pad} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                      {(selectedCategory?.subcategories ?? []).map((sub: any) => (
                        <ServiceRow
                          key={sub.id}
                          label={translateSubcategory(i18nInstance.language, sub)}
                          description={sub.description}
                          pricingMode={sub.pricingMode}
                          selected={subcategoryId === sub.id}
                          onPress={() => setSubcategoryId(sub.id)}
                          fixedLabel={t('stepper.pricing_fixed')}
                          quoteLabel={t('stepper.pricing_quote')}
                        />
                      ))}
                      {/* Catégorie sans prestation ET sans prix : non réservable (aucun prix à
                          verrouiller). On l'annonce au lieu de laisser le parcours mener à une
                          erreur de paiement à l'étape 4. */}
                      {categoryUnavailable && (
                        <Text style={[s.unavailable, { color: theme.textSub }]}>{t('stepper.service_unavailable')}</Text>
                      )}

                      <TouchableOpacity style={s.noteToggle} onPress={() => setNoteOpen(p => !p)} activeOpacity={0.7} accessibilityRole="button">
                        <Feather name={noteOpen ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSub as string} />
                        <Text style={[s.noteToggleText, { color: theme.textSub }]}>{t('stepper.add_note')}</Text>
                      </TouchableOpacity>

                      {noteOpen && (
                        <TextInput
                          style={[s.noteInput, { backgroundColor: theme.noteInputBg, borderColor: theme.noteInputBorder, color: theme.text as string }]}
                          placeholder={t('stepper.note_placeholder')}
                          placeholderTextColor={theme.textPlaceholder as string}
                          value={description}
                          onChangeText={setDescription}
                          multiline
                          numberOfLines={3}
                          textAlignVertical="top"
                          autoFocus
                          accessibilityLabel={t('stepper.add_note')}
                        />
                      )}

                      <View style={{ height: 100 }} />
                    </AdaptiveScroll>
                  </StepPager>
                </>
              )}
            </View>

            <StepCTA
              label={isQuoteFlow ? t('stepper.request_quote_cta') : t('stepper.continue')}
              onPress={goNext}
              disabled={!serviceChosen}
              hint={t('stepper.select_service_type')}
            />
          </KeyboardAvoidingView>
        )}
```

Styles : dans `s`, remplacer `step2Pad` et ajouter `skeletons`, `unavailable` ; `noteToggle`/`noteToggleText`/`noteInput` reçoivent une marge horizontale (ils vivaient dans un padding de 12) :

```ts
  step2Pad:    { paddingTop: 12, paddingBottom: 8 },
  skeletons:   { paddingHorizontal: 24, paddingTop: 12, gap: 10 },
  unavailable: { fontFamily: FONTS.sans, fontSize: 13, paddingHorizontal: 24, paddingVertical: 12 },
  noteToggle:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, marginHorizontal: 24, paddingVertical: 4 },
  noteToggleText: { fontSize: 13, fontFamily: FONTS.sans },
  noteInput:      { borderRadius: 16, padding: 16, fontSize: 15, minHeight: 90, borderWidth: 1.5, fontFamily: FONTS.sans, marginHorizontal: 24 },
```

Supprimer : `CategoryCard`, `cc`, `SubChip`, `sc`, et les styles `s.step2Title`, `s.catList`, `s.grid`, `s.inlineSubs`, `s.subSection`, `s.subHeader`, `s.subTitle`, `s.priceInline`, `s.chips`, `s.subList`, `s.loadWrap`, `s.loadText` (vérifier chaque nom au `grep` avant suppression ; `s.priceRow*` reste utilisé ailleurs ? vérifier aussi).

- [ ] **Étape 4 : vérifier et committer**

```bash
npx tsc --noEmit && npx eslint app/request/NewRequestStepper.tsx components/request && npx jest 2>&1 | tail -4
```

Attendu : 0 erreur, 165 tests.

```bash
git add components/request/CategoryRail.tsx components/request/ServiceRow.tsx app/request/NewRequestStepper.tsx
git commit -m "stepper: étape Service — rail de catégories, lignes de prestation avec pastille et radio (planche 2A, sans montant)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tâche 4 : étape Planning — `SegmentedControl`, `WeekStrip`, `SlotGrid`, `SettingRow`

**Files:**
- Create: `lib/scheduling/weeks.ts`, `__tests__/weeks.test.js`, `__tests__/slots.test.js`
- Create: `components/ui/SegmentedControl.tsx`, `components/request/WeekStrip.tsx`, `components/request/SlotGrid.tsx`, `components/request/SettingRow.tsx`
- Modify: `app/request/NewRequestStepper.tsx` (bloc `{step === 3 && (...)}`, `days`, `buildNextDays`, `TimeSlot`, `DayChip`, styles)
- Modify: `locales/fr.json`, `locales/nl.json`, `locales/en.json` (mois en toutes lettres)

- [ ] **Étape 1 : tests des helpers**

`__tests__/weeks.test.js` :

```js
const { buildWeeks, findDay } = require('../lib/scheduling/weeks');

// Samedi 13 septembre 2026, 15:00 (heure locale).
const NOW = new Date(2026, 8, 13, 15, 0, 0);

describe('buildWeeks — semaines du planning (WeekStrip)', () => {
  it('commence le lundi de la semaine courante et fait 7 jours par semaine', () => {
    const weeks = buildWeeks(NOW, 5);
    expect(weeks).toHaveLength(5);
    expect(weeks[0].days).toHaveLength(7);
    expect(weeks[0].from.iso).toBe('2026-09-07');
    expect(weeks[0].to.iso).toBe('2026-09-13');
    expect(weeks[0].days[0].dayIndex).toBe(1); // lundi
    expect(weeks[0].days[6].dayIndex).toBe(0); // dimanche
  });
  it('enchaîne les semaines sans trou', () => {
    const weeks = buildWeeks(NOW, 3);
    expect(weeks[1].from.iso).toBe('2026-09-14');
    expect(weeks[2].to.iso).toBe('2026-09-27');
  });
  it('marque les jours passés et aujourd’hui', () => {
    const [w0, w1] = buildWeeks(NOW, 2);
    expect(w0.days.slice(0, 6).every((d) => d.isPast)).toBe(true);
    expect(w0.days[6].isPast).toBe(false);
    expect(w0.days[6].isToday).toBe(true);
    expect(w1.days.some((d) => d.isPast || d.isToday)).toBe(false);
  });
  it('passe le changement de mois', () => {
    const weeks = buildWeeks(new Date(2026, 8, 28, 9, 0, 0), 1);
    expect(weeks[0].from.iso).toBe('2026-09-28');
    expect(weeks[0].to.iso).toBe('2026-10-04');
    expect(weeks[0].to.month).toBe(9);
  });
  it('findDay retrouve un jour par iso', () => {
    const weeks = buildWeeks(NOW, 2);
    expect(findDay(weeks, '2026-09-16')?.date).toBe(16);
    expect(findDay(weeks, '2027-01-01')).toBeNull();
    expect(findDay(weeks, null)).toBeNull();
  });
});
```

`__tests__/slots.test.js` :

```js
const { isSlotDisabled } = require('../lib/scheduling/weeks');

const NOW = new Date(2026, 8, 13, 15, 0, 0); // 13/09/2026 15:00

describe('isSlotDisabled — créneaux inertes (SlotGrid)', () => {
  it('hier : tout est inerte', () => {
    expect(isSlotDisabled('2026-09-12', '19:00', NOW)).toBe(true);
  });
  it('aujourd’hui : passé ou à moins d’une heure → inerte', () => {
    expect(isSlotDisabled('2026-09-13', '14:00', NOW)).toBe(true);
    expect(isSlotDisabled('2026-09-13', '15:30', NOW)).toBe(true);
    expect(isSlotDisabled('2026-09-13', '16:00', NOW)).toBe(false);
    expect(isSlotDisabled('2026-09-13', '17:00', NOW)).toBe(false);
  });
  it('demain : tout est ouvert', () => {
    expect(isSlotDisabled('2026-09-14', '08:00', NOW)).toBe(false);
  });
});
```

- [ ] **Étape 2 : lancer, ça échoue**

Run : `npx jest __tests__/weeks.test.js __tests__/slots.test.js` → FAIL, module introuvable.

- [ ] **Étape 3 : écrire `lib/scheduling/weeks.ts`**

```ts
// lib/scheduling/weeks.ts
// Semaines du planning (WeekStrip) et créneaux inertes (SlotGrid). Tout est
// calculé en heure LOCALE de l'appareil ; `iso` est un YYYY-MM-DD local, le
// même format que `selectedDayIso` dans NewRequestStepper. Pur : testé dans
// __tests__/weeks.test.js et __tests__/slots.test.js.
export type WeekDay = {
  iso: string;
  /** 0 = dimanche … 6 = samedi (Date#getDay) */
  dayIndex: number;
  date: number;
  /** 0 = janvier … 11 = décembre */
  month: number;
  year: number;
  isPast: boolean;
  isToday: boolean;
};

export type Week = { days: WeekDay[]; from: WeekDay; to: WeekDay };

function localIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Le lundi de la semaine qui contient `d`. */
function mondayOf(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function buildWeeks(now: Date, count = 5): Week[] {
  const today = startOfDay(now);
  const todayIso = localIso(today);
  const first = mondayOf(today);
  const weeks: Week[] = [];
  for (let w = 0; w < count; w++) {
    const days: WeekDay[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(first);
      d.setDate(first.getDate() + w * 7 + i);
      const iso = localIso(d);
      days.push({
        iso,
        dayIndex: d.getDay(),
        date: d.getDate(),
        month: d.getMonth(),
        year: d.getFullYear(),
        isPast: d.getTime() < today.getTime(),
        isToday: iso === todayIso,
      });
    }
    weeks.push({ days, from: days[0], to: days[6] });
  }
  return weeks;
}

export function findDay(weeks: Week[], iso: string | null): WeekDay | null {
  if (!iso) return null;
  for (const w of weeks) {
    for (const d of w.days) if (d.iso === iso) return d;
  }
  return null;
}

/** Un créneau « HH:MM » est inerte s'il est passé ou commence dans moins de `leadMinutes`. */
export function isSlotDisabled(dayIso: string, slot: string, now: Date, leadMinutes = 60): boolean {
  const [h, m] = slot.split(':').map(Number);
  const [y, mo, d] = dayIso.split('-').map(Number);
  const start = new Date(y, mo - 1, d, h, m, 0, 0);
  return start.getTime() < now.getTime() + leadMinutes * 60_000;
}
```

- [ ] **Étape 4 : les tests passent**

Run : `npx jest __tests__/weeks.test.js __tests__/slots.test.js` → PASS (8 tests).

- [ ] **Étape 5 : clés des mois en toutes lettres**

```bash
python3 - <<'EOF'
import json, collections
M = {
  'fr': ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'],
  'nl': ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'],
  'en': ['January','February','March','April','May','June','July','August','September','October','November','December'],
}
for lang, months in M.items():
    p = f'locales/{lang}.json'
    d = json.load(open(p), object_pairs_hook=collections.OrderedDict)
    for i, name in enumerate(months): d['stepper'][f'month_long_{i}'] = name
    d['stepper']['prev_week'], d['stepper']['next_week'] = WEEK[lang]
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=2); open(p, 'a').write('\n')
EOF
git diff --stat locales/
```

(avec, en tête du script, `WEEK = {'fr': ('Semaine précédente', 'Semaine suivante'), 'nl': ('Vorige week', 'Volgende week'), 'en': ('Previous week', 'Next week')}`.)

Attendu : `3 files changed, 42 insertions(+)`.

- [ ] **Étape 6 : écrire `components/ui/SegmentedControl.tsx`**

```tsx
// components/ui/SegmentedControl.tsx
// Contrôle segmenté (2 à 3 options) : piste `surface`, indicateur `accent` qui
// glisse sous l'option active sur MOTION.tab depuis sa position courante.
// `value` peut être null : l'indicateur est alors invisible.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';
import { feedback } from '@/lib/feedback/feedback';

export type SegmentOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
};

const PAD = 3;

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const [width, setWidth] = useState(0);
  const index = options.findIndex((o) => o.value === value);
  const slot = width > 0 ? (width - PAD * 2) / options.length : 0;

  const x = useSharedValue(Math.max(0, index) * slot);
  const visible = useSharedValue(index >= 0 ? 1 : 0);
  useEffect(() => {
    const target = Math.max(0, index) * slot;
    x.value = reduced ? withTiming(target, { duration: 120 }) : withSpring(target, MOTION.tab);
    visible.value = withTiming(index >= 0 ? 1 : 0, { duration: 120 });
  }, [index, slot, reduced, x, visible]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], opacity: visible.value, width: slot }));

  return (
    <View
      style={[s.track, { backgroundColor: theme.surface }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      <Animated.View pointerEvents="none" style={[s.indicator, { backgroundColor: theme.accent }, indicator]} />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={s.item}
            onPress={() => { if (!active) { feedback.haptic('selection'); onChange(o.value); } }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
          >
            <Text style={[s.label, { color: active ? theme.accentText : theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  track:     { flexDirection: 'row', borderRadius: 12, padding: PAD, position: 'relative' },
  indicator: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: 9 },
  item:      { flex: 1, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  label:     { fontFamily: FONTS.sansMedium, fontSize: 14 },
});
```

- [ ] **Étape 7 : écrire `components/request/WeekStrip.tsx`**

```tsx
// components/request/WeekStrip.tsx
// Une semaine entière, lundi → dimanche, sept colonnes égales (planche 3A).
// En-tête « 15 – 21 septembre » et chevrons ; changer de semaine pousse la
// rangée latéralement (StepPager). Jours passés grisés et inertes, aujourd'hui
// porte un point. Sélection : fond accent, haptique selection.
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { feedback } from '@/lib/feedback/feedback';
import { StepPager, type PagerDirection } from './StepPager';
import type { Week, WeekDay } from '@/lib/scheduling/weeks';

type Props = {
  weeks: Week[];
  selectedIso: string | null;
  onSelect: (iso: string) => void;
  /** Abréviation du jour (« Lun », ou « Auj. » pour aujourd'hui). */
  dayLabel: (d: WeekDay) => string;
  /** Mois en toutes lettres. */
  monthLabel: (month: number) => string;
  prevLabel: string;
  nextLabel: string;
};

function rangeLabel(w: Week, monthLabel: (m: number) => string): string {
  return w.from.month === w.to.month
    ? `${w.from.date} – ${w.to.date} ${monthLabel(w.from.month)}`
    : `${w.from.date} ${monthLabel(w.from.month)} – ${w.to.date} ${monthLabel(w.to.month)}`;
}

export function WeekStrip({ weeks, selectedIso, onSelect, dayLabel, monthLabel, prevLabel, nextLabel }: Props) {
  const theme = useAppTheme();
  const initial = Math.max(0, weeks.findIndex((w) => w.days.some((d) => d.iso === selectedIso)));
  const [index, setIndex] = useState(initial);
  const dirRef = useRef<PagerDirection>(1);
  const week = weeks[index];
  const canPrev = index > 0;
  const canNext = index < weeks.length - 1;

  const go = (delta: 1 | -1) => {
    feedback.haptic('light');
    dirRef.current = delta;
    setIndex((i) => Math.min(weeks.length - 1, Math.max(0, i + delta)));
  };

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={[s.range, { color: theme.text }]} maxFontSizeMultiplier={1.3}>{rangeLabel(week, monthLabel)}</Text>
        <View style={s.arrows}>
          <Pressable onPress={() => go(-1)} disabled={!canPrev} hitSlop={8} accessibilityRole="button" accessibilityLabel={prevLabel} style={!canPrev && s.arrowOff}>
            <Feather name="chevron-left" size={20} color={theme.textSub as string} />
          </Pressable>
          <Pressable onPress={() => go(1)} disabled={!canNext} hitSlop={8} accessibilityRole="button" accessibilityLabel={nextLabel} style={!canNext && s.arrowOff}>
            <Feather name="chevron-right" size={20} color={theme.textSub as string} />
          </Pressable>
        </View>
      </View>
      <StepPager page={index} direction={dirRef.current} style={s.pager}>
        <View style={s.days}>
          {week.days.map((d) => {
            const selected = d.iso === selectedIso;
            return (
              <Pressable
                key={d.iso}
                disabled={d.isPast}
                onPress={() => { if (!selected) { feedback.haptic('selection'); onSelect(d.iso); } }}
                accessibilityRole="button"
                accessibilityLabel={`${dayLabel(d)} ${d.date} ${monthLabel(d.month)}`}
                accessibilityState={{ selected, disabled: d.isPast }}
                style={[s.day, selected && { backgroundColor: theme.accent }]}
              >
                <Text style={[s.dayName, { color: selected ? theme.accentText : theme.textMuted }]} maxFontSizeMultiplier={1.2}>{dayLabel(d).toUpperCase()}</Text>
                <Text style={[s.dayNum, { color: selected ? theme.accentText : d.isPast ? theme.textMuted : theme.text }]} maxFontSizeMultiplier={1.2}>{d.date}</Text>
                <View style={[s.todayDot, d.isToday && { backgroundColor: selected ? theme.accentText : theme.text }]} />
              </Pressable>
            );
          })}
        </View>
      </StepPager>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:     { paddingTop: 16 },
  head:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  range:    { fontFamily: FONTS.sansMedium, fontSize: 13 },
  arrows:   { flexDirection: 'row', gap: 18 },
  arrowOff: { opacity: 0.3 },
  pager:    { flex: 0 },
  days:     { flexDirection: 'row', gap: 4 },
  day:      { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 8, borderRadius: 12 },
  dayName:  { fontFamily: FONTS.sansMedium, fontSize: 10, letterSpacing: 0.5 },
  dayNum:   { fontFamily: FONTS.bebas, fontSize: 20, includeFontPadding: false, fontVariant: ['tabular-nums'] },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
});
```

- [ ] **Étape 8 : écrire `components/request/SlotGrid.tsx`**

```tsx
// components/request/SlotGrid.tsx
// Tableau des créneaux (planche 3A) : une ligne par moment de la journée,
// quatre colonnes égales, l'étiquette en première colonne. Les cases
// manquantes restent vides. Les créneaux inertes (passés) sont grisés.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { feedback } from '@/lib/feedback/feedback';

type Group = { label: string; slots: string[] };
type Props = {
  groups: Group[];
  selected: string | null;
  onSelect: (slot: string) => void;
  isDisabled: (slot: string) => boolean;
  columns?: number;
};

export function SlotGrid({ groups, selected, onSelect, isDisabled, columns = 4 }: Props) {
  const theme = useAppTheme();
  return (
    <View style={s.grid}>
      {groups.map((g) => (
        <View key={g.label} style={s.row}>
          <Text style={[s.rowLabel, { color: theme.textMuted }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{g.label.toUpperCase()}</Text>
          {Array.from({ length: columns }, (_, i) => {
            const slot = g.slots[i];
            if (!slot) return <View key={`empty-${i}`} style={s.cell} />;
            const active = slot === selected;
            const off = isDisabled(slot);
            return (
              <Pressable
                key={slot}
                disabled={off}
                onPress={() => { if (!active) { feedback.haptic('selection'); onSelect(slot); } }}
                accessibilityRole="button"
                accessibilityLabel={`${g.label} ${slot}`}
                accessibilityState={{ selected: active, disabled: off }}
                style={[s.cell, s.cellFilled, { backgroundColor: theme.surface }, active && { backgroundColor: theme.accent }, off && s.cellOff]}
              >
                <Text style={[s.time, { color: active ? theme.accentText : off ? theme.textMuted : theme.textSub }]} maxFontSizeMultiplier={1.2}>{slot}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid:       { paddingTop: 18, gap: 8 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel:   { width: 64, fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 0.8 },
  cell:       { flex: 1, height: 40 },
  cellFilled: { borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cellOff:    { opacity: 0.4 },
  time:       { fontFamily: FONTS.sansMedium, fontSize: 13, fontVariant: ['tabular-nums'] },
});
```

- [ ] **Étape 9 : écrire `components/request/SettingRow.tsx`**

```tsx
// components/request/SettingRow.tsx
// Ligne standard de l'étape Planning : icône 36 pt sur `surface`, titre,
// sous-titre, accessoire à droite (Switch, chevron) ; le contenu dépliable
// se rend sous la ligne, dans le même bloc.
import React from 'react';
import { Pressable, StyleSheet, Text, View, type AccessibilityRole, type AccessibilityState } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

type Props = {
  icon: FeatherName;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  children?: React.ReactNode;
};

export function SettingRow({ icon, title, subtitle, right, onPress, accessibilityRole = 'button', accessibilityState, children }: Props) {
  const theme = useAppTheme();
  const row = (
    <View style={s.row}>
      <View style={[s.icon, { backgroundColor: theme.surface }]}>
        <Feather name={icon} size={16} color={theme.textSub as string} />
      </View>
      <View style={s.texts}>
        <Text style={[s.title, { color: theme.text }]} maxFontSizeMultiplier={1.3}>{title}</Text>
        {subtitle ? <Text style={[s.sub, { color: theme.textMuted }]} maxFontSizeMultiplier={1.3}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
  return (
    <View style={[s.block, { borderTopColor: theme.borderLight }]}>
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole={accessibilityRole} accessibilityState={accessibilityState} accessibilityLabel={title}>
          {row}
        </Pressable>
      ) : row}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  block: { marginTop: 18, borderTopWidth: 1, paddingTop: 6 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  icon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1 },
  title: { fontFamily: FONTS.sansMedium, fontSize: 15 },
  sub:   { fontFamily: FONTS.sans, fontSize: 11, marginTop: 1 },
});
```

- [ ] **Étape 10 : brancher l'étape 3 dans `NewRequestStepper.tsx`**

Imports :

```ts
import { Switch } from 'react-native'; // à ajouter dans l'import react-native existant
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { WeekStrip } from '@/components/request/WeekStrip';
import { SlotGrid } from '@/components/request/SlotGrid';
import { SettingRow } from '@/components/request/SettingRow';
import { buildWeeks, findDay, isSlotDisabled, type WeekDay } from '@/lib/scheduling/weeks';
```

Remplacer `const days = useMemo(() => buildNextDays(t, 10), [t]);` par :

```ts
  // Semaines du planning (5 semaines à partir du lundi courant) — lib/scheduling/weeks.
  const weeks = useMemo(() => buildWeeks(new Date(), 5), []);
  const DAY_KEYS = ['day_sun', 'day_mon', 'day_tue', 'day_wed', 'day_thu', 'day_fri', 'day_sat'] as const;
  const dayLabel = (d: WeekDay) => (d.isToday ? t('stepper.today') : t(`stepper.${DAY_KEYS[d.dayIndex]}`));
  const monthLabel = (m: number) => t(`stepper.month_long_${m}`);
  const selectedDay = findDay(weeks, selectedDayIso);
```

Remplacer, dans `scheduledLabel`, l'expression `${days.find(d => d.iso === selectedDayIso)?.day} ${days.find(d => d.iso === selectedDayIso)?.date} à ${selectedTime}` par `${selectedDay ? dayLabel(selectedDay) : ''} ${selectedDay?.date ?? ''} à ${selectedTime}`.

Dans le `StepCTA` de l'étape 3, remplacer les deux `days.find(...)` par `day: selectedDay ? dayLabel(selectedDay) : '', date: selectedDay?.date ?? ''`.

Remplacer tout le bloc `{step === 3 && (...)}` par le suivant. Le contenu des sections TVA et Infos d'accès (puces, champs, langue) est **repris tel quel** depuis le bloc actuel, seulement déplacé dans les `SettingRow` — copier-coller les JSX existants aux endroits marqués :

```tsx
        {/* ══ ÉTAPE 3 — Planning (planche 3A : segmenté, semaine, grille horaire) ══ */}
        {step === 3 && (
          <View style={s.flex}>
            <AdaptiveScroll style={s.flex} contentContainerStyle={s.step3Pad} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
              <SegmentedControl
                options={[{ value: 'now', label: t('stepper.now') }, { value: 'later', label: t('stepper.schedule') }]}
                value={scheduleMode}
                onChange={(mode) => {
                  if (mode === 'now') { setScheduleMode('now'); setSelectedDayIso(null); setSelectedTime(null); }
                  else { setScheduleMode('later'); setIsUrgent(false); }
                }}
              />

              {scheduleMode === 'later' && (
                <>
                  <WeekStrip
                    weeks={weeks}
                    selectedIso={selectedDayIso}
                    onSelect={(iso) => { setSelectedDayIso(iso); setSelectedTime(null); }}
                    dayLabel={dayLabel}
                    monthLabel={monthLabel}
                    prevLabel={t('stepper.prev_week')}
                    nextLabel={t('stepper.next_week')}
                  />
                  {selectedDayIso && (
                    <SlotGrid
                      groups={TIME_GROUPS}
                      selected={selectedTime}
                      onSelect={setSelectedTime}
                      isDisabled={(slot) => isSlotDisabled(selectedDayIso, slot, new Date())}
                    />
                  )}
                </>
              )}

              {/* ── Urgence (mode maintenant) — câblée sur isUrgent : majoration et
                     callout urgent calculés côté serveur ── */}
              {scheduleMode === 'now' && (
                <SettingRow
                  icon="zap"
                  title={t('stepper.urgency_label')}
                  subtitle={isQuoteFlow ? t('stepper.urgency_desc_callout') : t('stepper.urgency_desc_surcharge')}
                  onPress={() => { feedback.haptic('medium'); setIsUrgent(prev => !prev); }}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: isUrgent }}
                  right={(
                    <Switch
                      value={isUrgent}
                      onValueChange={(v) => { feedback.haptic('medium'); setIsUrgent(v); }}
                      trackColor={{ true: COLORS.greenBrand, false: theme.surfaceBorder as string }}
                      thumbColor="#FFFFFF"
                      ios_backgroundColor={theme.surfaceBorder as string}
                    />
                  )}
                />
              )}

              {/* ── TVA : âge du logement (détermine 6% vs 21%) ── */}
              {vatEligible && (
                <SettingRow
                  icon="percent"
                  title={t('stepper.vat_dwelling_title')}
                  subtitle={vatRate === 0.06 ? t('stepper.vat_reduced_hint') : t('stepper.vat_standard_hint')}
                >
                  <View style={[ai.chipRow, { marginTop: 6 }]}>
                    {/* ← coller ici le `.map` des deux puces vat_over10 / vat_under10 existant, inchangé */}
                  </View>
                </SettingRow>
              )}

              {/* ── Infos d'accès (dépliable) ── */}
              <SettingRow
                icon="home"
                title={t('stepper.access_info_title')}
                subtitle={t('stepper.access_info_sub')}
                onPress={() => setAccessExpanded(prev => !prev)}
                accessibilityState={{ expanded: accessExpanded }}
                right={<Feather name={accessExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textMuted as string} />}
              >
                {accessExpanded && (
                  <View style={ai.body}>
                    {/* ← coller ici le contenu existant : type de bâtiment, étage + ascenseur,
                          notes d'accès, langue — inchangé */}
                  </View>
                )}
              </SettingRow>

              <View style={{ height: 120 }} />
            </AdaptiveScroll>

            <View style={s.floatingCTA}>
              <StepCTA
                label={
                  scheduleMode === 'now'
                    ? t('stepper.confirm_now')
                    : (selectedDayIso && selectedTime
                      ? t('stepper.confirm_at', { day: selectedDay ? dayLabel(selectedDay) : '', date: selectedDay?.date ?? '', time: selectedTime })
                      : t('stepper.confirm_slot'))
                }
                onPress={goNext}
                disabled={!step3Ready}
                hint={
                  scheduleMode === null
                    ? t('stepper.hint_choose_mode')
                    : !selectedDayIso ? t('stepper.hint_choose_day') : t('stepper.hint_choose_slot')
                }
              />
            </View>
          </View>
        )}
```

Supprimer : `buildNextDays`, `TimeSlot`, `tslot`, `DayChip`, `dc`, et les styles `s.step3Sep`, `s.step3Hint`, `s.modeGrid`, `s.modeCard`, `s.modeCardLabel`, `s.modeCardSub`, `s.nowConfirm`, `s.nowTitle`, `s.nowSub`, `s.dayScroll`, `s.slotGroup`, `s.slotGroupLabel`, `s.slotsRow`, `s.urgency*`, `ai.sep`, `ai.header`, `ai.headerIcon`, `ai.headerTitle`, `ai.headerSub` (grep chaque nom avant).

- [ ] **Étape 11 : vérifier et committer**

```bash
npx tsc --noEmit && npx eslint app/request/NewRequestStepper.tsx components/request components/ui/SegmentedControl.tsx lib/scheduling && npx jest 2>&1 | tail -4
```

Attendu : 0 erreur, 173 tests (165 + 8).

```bash
git add lib/scheduling/weeks.ts __tests__/weeks.test.js __tests__/slots.test.js components/ui/SegmentedControl.tsx components/request/WeekStrip.tsx components/request/SlotGrid.tsx components/request/SettingRow.tsx app/request/NewRequestStepper.tsx locales/
git commit -m "stepper: étape Planning — segmenté, semaine entière, grille horaire, Switch natif (planche 3A)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tâche 5 : nettoyage, largeur de lecture, vérification, build 87

**Files:**
- Modify: `app/request/NewRequestStepper.tsx`
- Modify: `docs/superpowers/plans/2026-09-13-request-stepper-redesign.md` (état livré)

- [ ] **Étape 1 : imports et styles morts**

```bash
npx eslint app/request/NewRequestStepper.tsx 2>&1 | grep -E "no-unused-vars"
```

Retirer chaque symbole listé (imports Reanimated, `spring`, `usePressScale`, `LinearGradient` si plus utilisé, `ScrollView` si plus utilisé, etc.). Puis les styles : pour chaque clé de `s` et `ai`, `grep -c "s\.<clé>\b"` ; supprimer celles à 0. Vérifier aussi `Skeleton`/`AdaptiveScroll` bien importés depuis `@/components/ui/Skeleton` et `@/lib/layout`.

- [ ] **Étape 2 : vérification complète**

```bash
npx tsc --noEmit && npx eslint app components lib hooks eslint.config.js 2>&1 | grep -E " error |✖" && npx jest 2>&1 | tail -4
wc -l app/request/NewRequestStepper.tsx
```

Attendu : 0 erreur ; 173 tests ; le fichier a perdu au moins 600 lignes (≈ 2 300 lignes ou moins).

- [ ] **Étape 3 : passe manuelle** (à faire par Enès sur appareil ou simulateur ; non automatisable ici)

- Étapes 1 → 4 puis retour 4 → 1 : contenu poussé dans le bon sens, ligne de progression qui suit, puces qui ramènent en arrière.
- Étape 2 : deux pilules pleine largeur ; bascule Plomberie ↔ Serrurerie (liste poussée) ; ligne sélectionnée sur fond `surfaceAlt`, radio coché ; bouton grisé avec « Choisissez une prestation » puis « Continuer » / « Demander un devis ».
- Étape 3 : segmenté ; semaine courante, jours passés grisés, point sous aujourd'hui ; semaine suivante ; grille avec cases vides en soirée ; créneaux de moins d'une heure grisés ; mode Maintenant → ligne Urgence avec Switch.
- Étape 4 : bouton « Confirmer la mission » avec le montant à droite ; sur devis « Réserver · 29 € ».
- Reduce Motion activé : fondus, pas de poussée.
- Simulateur iPad : listes des étapes 2 et 3 centrées à 560 pt.

- [ ] **Étape 4 : noter l'état dans le plan et committer**

Ajouter sous le titre du plan : `**État : livré le <date> sur main (tâches 1-5). Vérifié : tsc, eslint 0 erreur, jest 173/173. Reste : passe manuelle (Tâche 5, étape 3).**`

```bash
git add app/request/NewRequestStepper.tsx docs/superpowers/plans/2026-09-13-request-stepper-redesign.md
git commit -m "stepper: nettoyage des composants et styles internes remplacés ; plan livré

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Étape 5 : build 87 iOS + Android avec soumission** (après accord d'Enès, `main` poussé)

```bash
git push origin main
npx eas-cli@latest build --platform all --profile production --auto-submit --non-interactive --no-wait
```

Rappel (mémoire projet) : `eas submit` sort en 0 dès l'upload ; le verdict d'Apple arrive par e-mail. Le build iOS 86 déjà sur App Store Connect porte la tab bar fautive : ne pas le soumettre en review.
