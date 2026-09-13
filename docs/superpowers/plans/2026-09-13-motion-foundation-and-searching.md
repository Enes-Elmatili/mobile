# Mouvement — Plan 1 : fondation, bibliothèque, « Trouver un prestataire »

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser la fondation « une physique, une disposition » (presets de ressorts, classe de disposition réactive, purge de `Dimensions.get`, lint), livrer les 11 hooks de mouvement testés, et appliquer les trois premiers moments (recherche qui respire, atterrissage + itinéraire, ETA en rouleau) sur tous les appareils.

**Architecture:** `lib/motion/` reste la seule source de physique : une table de presets (`springs.ts`) dérive chaque damping de ζ via `dampingFor` (existant). Les hooks retournent des shared values Reanimated + styles/props animés ; aucun `setState` par frame. `lib/layout/` expose la classe de disposition (`compact`/`regular`) calculée par une fonction pure depuis `useWindowDimensions` — c'est elle qui remplace les 18 `Dimensions.get` figés. Les écrans ne changent que là où un moment s'applique.

**Tech Stack:** Expo SDK 54, React Native 0.81, `react-native-reanimated` 4.1 (worklets, `useFrameCallback`, `useAnimatedProps`), `react-native-gesture-handler` 2.28, `react-native-svg` 15, `react-native-maps` 1.20, `react-native-safe-area-context` 5.6. Tests : `jest-expo` 54 + `@testing-library/react-native` 13. Lint : ESLint flat config (`eslint.config.js`).

**Spec:** `docs/superpowers/specs/2026-09-12-motion-and-adaptive-layout-design.md`

**Plans suivants (écrits après celui-ci, une fois l'API des hooks figée) :** Plan 2 « Devis, prix, engagement » · Plan 3 « Payer, clôturer, naviguer » · Plan 4 « Train 2 — écran déplié ».

**Conventions (obligatoires) :**
- Thème via `useAppTheme()` / `darkTokens` (`@/hooks/use-app-theme`), couleurs via `COLORS`. Zéro hex en composant.
- Polices via `FONTS` (`bebas`, `sans`, `sansMedium`, `mono`).
- Icônes Feather uniquement. Zéro emoji. Zéro `Alert.alert` (moteur `feedback.*`).
- **Reanimated uniquement.** `Animated` de `react-native` est banni (règle 1 CLAUDE.md). Le damping n'est **jamais** écrit en dur : toujours `spring(k, ζ)`.
- Haptique via `feedback.haptic(kind)`, jamais `expo-haptics` direct.
- Commits fréquents, message en français, sujet à l'impératif, corps qui explique le *pourquoi*.

---

## Structure des fichiers

| Fichier | Responsabilité | Statut |
|---|---|---|
| `lib/motion/springs.ts` | Table des presets `MOTION.*`, `spring(k, ζ)` | Créer |
| `lib/motion/haptics.ts` | `hapticOnFrame(kind)` — haptique déclenchée depuis un worklet, une fois | Créer |
| `lib/motion/gestures.ts` | Fonctions pures : `rubberBand`, `shouldConfirm`, `projectRelease` | Créer |
| `lib/motion/useCountingValue.ts` | Valeur numérique qui compte sur un ressort + `formatCount` | Créer |
| `lib/motion/useBreathe.ts` | Respiration 1,03 → 1 | Créer |
| `lib/motion/useTraceStroke.ts` | `strokeDashoffset` animé (svg `pathLength=1`) | Créer |
| `lib/motion/useTakeScale.ts` | Scale « qui prend » (sélection, atterrissage, icône) | Créer |
| `lib/motion/useDigitReel.ts` | Rouleau de chiffres + `splitDigits` | Créer |
| `lib/motion/usePresence.ts` | Entrée/sortie avec origine (`left`/`hinge`/`bottom`/`island`) | Créer |
| `lib/motion/useCascade.ts` | N styles décalés de `step` ms | Créer |
| `lib/motion/useSlideToConfirm.ts` | Curseur d'engagement (élastique + projection) | Créer |
| `lib/motion/useRubberPull.ts` | Pull-to-refresh élastique | Créer |
| `lib/motion/useRevealCount.ts` | Nombre d'éléments révélés (polyline `react-native-maps`, qui n'a pas de `dashoffset`) | Créer |
| `lib/motion/index.ts` | Barrel | Créer |
| `lib/layout/resolveLayoutClass.ts` | Pure : `(w, h) → 'compact' \| 'regular'` | Créer |
| `lib/layout/useLayoutClass.ts` | Hook : `useWindowDimensions` + insets → classe | Créer |
| `lib/layout/index.ts` | Barrel | Créer |
| `components/ui/ReText.tsx` | `TextInput` non éditable piloté par `useAnimatedProps` (texte animé sans re-render) | Créer |
| `components/ui/DigitReel.tsx` | Composant ETA en rouleau | Créer |
| `components/searching/BreathingRings.tsx` | Anneaux de recherche (remplace `RadarWaves` legacy + `Circle` interpolé) | Créer |
| `eslint.config.js` | Règles `no-restricted-syntax` (Dimensions.get, Animated legacy, Alert.alert) | Modifier |
| `app.json` | `ios.requireFullScreen: true` | Modifier |
| 15 fichiers listés en Tâche 4 | Remplacement de `Dimensions.get` | Modifier |
| `components/searching/LiveMapSearching.tsx` | Moment 1 | Modifier |
| `app/request/[id]/missionview.tsx` | Moments 1, 2, 3 ; migration `Animated` legacy | Modifier |
| `app/request/[id]/ongoing.tsx` | Moment 3 | Modifier |
| `__tests__/motionPresets.test.js`, `lib/__tests__/layoutClass.test.ts`, `lib/__tests__/motionPure.test.ts` | Tests | Créer |

---

### Tâche 1 : presets de ressorts — une table, une source

**Files:**
- Create: `lib/motion/springs.ts`
- Test: `__tests__/motionPresets.test.js`

- [ ] **Étape 1 : écrire le test qui verrouille ζ par preset**

```js
// __tests__/motionPresets.test.js
/**
 * Chaque preset de lib/motion/springs.ts déclare un ratio d'amortissement ζ.
 * Ce test le recalcule depuis (damping, stiffness, mass) : si quelqu'un écrit
 * un damping en dur, ζ dérive et le test tombe.
 */
const { MOTION, spring } = require('../lib/motion/springs');

const zeta = ({ damping, stiffness, mass }) => damping / (2 * Math.sqrt(stiffness * mass));

describe('presets de mouvement', () => {
  it.each([
    ['unfold', 1.0], ['pane', 1.0], ['recenter', 1.0], ['count', 1.0], ['trace', 1.0], ['tab', 1.0],
    ['take', 0.85], ['breathe', 0.9], ['land', 0.8], ['island', 0.9], ['pull', 0.8], ['tabIcon', 0.9],
  ])('%s → ζ = %s', (name, expected) => {
    expect(zeta(MOTION[name])).toBeCloseTo(expected, 5);
  });

  it('spring(k, ζ) dérive le damping, ne le devine pas', () => {
    const s = spring(200, 1.0);
    expect(s.stiffness).toBe(200);
    expect(s.mass).toBe(1);
    expect(s.damping).toBeCloseTo(28.284, 2);
  });

  it("aucun preset n'est sous-amorti au point de rebondir visiblement (ζ ≥ 0,7)", () => {
    for (const p of Object.values(MOTION)) expect(zeta(p)).toBeGreaterThanOrEqual(0.7);
  });
});
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

Run: `npx jest __tests__/motionPresets.test.js`
Expected: FAIL — `Cannot find module '../lib/motion/springs'`

- [ ] **Étape 3 : écrire `springs.ts`**

```ts
// lib/motion/springs.ts
// La table des ressorts de FIXED. Une seule règle : le damping est DÉRIVÉ du
// ratio d'amortissement ζ (dampingFor, lib/motion/sheet.ts), jamais écrit.
//
//   ζ = 1,0   critique — l'interface (aucun rebond)
//   ζ < 1,0   léger dépassement — réservé aux objets qui « prennent »
//             (sélection, atterrissage) et aux gestes avec élan
import { dampingFor, type SpringConfig } from './sheet';

export const spring = (stiffness: number, zeta: number, mass = 1): SpringConfig => ({
  damping: dampingFor(zeta, stiffness, mass),
  stiffness,
  mass,
});

export const MOTION = Object.freeze({
  /** Ouverture / fermeture d'un écran pliable : large, calme. */
  unfold: spring(180, 1.0),
  /** Entrée d'un volet ou d'une ligne (usePresence, useCascade). */
  pane: spring(240, 1.0),
  /** Recentrage d'une carte : un geste de la main, ~350 ms. */
  recenter: spring(220, 1.0),
  /** Un objet qui prend : marqueur sélectionné, étoile finale. */
  take: spring(400, 0.85),
  /** Une valeur qui compte (montant, total). */
  count: spring(120, 1.0),
  /** Respiration d'un bloc à la réception d'une valeur. */
  breathe: spring(300, 0.9),
  /** Un trait qui se dessine (coche, sceau, itinéraire). */
  trace: spring(200, 1.0),
  /** Atterrissage d'un prestataire sur la carte. */
  land: spring(320, 0.8),
  /** Indicateur d'onglet. */
  tab: spring(260, 1.0),
  /** Icône d'onglet qui se redresse. */
  tabIcon: spring(500, 0.9),
  /** Toast qui s'étend depuis l'île. */
  island: spring(220, 0.9),
  /** Retour du pull-to-refresh. */
  pull: spring(300, 0.8),
} satisfies Record<string, SpringConfig>);

export type MotionPreset = keyof typeof MOTION;
```

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

Run: `npx jest __tests__/motionPresets.test.js`
Expected: PASS (14 tests)

- [ ] **Étape 5 : commit**

```bash
git add lib/motion/springs.ts __tests__/motionPresets.test.js
git commit -m "motion: table des presets de ressorts, damping dérivé de ζ

Une seule source pour toute la physique à venir (21 moments du spec).
Le test recalcule ζ depuis chaque preset : un damping écrit en dur casse
la suite."
```

---

### Tâche 2 : classe de disposition — la seule source de vérité des dimensions

**Files:**
- Create: `lib/layout/resolveLayoutClass.ts`, `lib/layout/useLayoutClass.ts`, `lib/layout/index.ts`
- Test: `lib/__tests__/layoutClass.test.ts`

- [ ] **Étape 1 : écrire le test de la fonction pure**

```ts
// lib/__tests__/layoutClass.test.ts
/**
 * Classe de disposition : compact (une colonne) ou regular (deux volets).
 * Seuils du spec § 4.2 : regular ⇔ largeur ≥ 600 ET hauteur ≥ 480.
 */
import { resolveLayoutClass } from '../layout/resolveLayoutClass';

describe('resolveLayoutClass', () => {
  it.each([
    ['iPhone SE', 375, 667, 'compact'],
    ['iPhone 15 Pro', 393, 852, 'compact'],
    ['iPhone Duo fermé', 466, 678, 'compact'],
    ['iPhone Duo ouvert, paysage naturel', 951, 669, 'regular'],
    ['iPhone Duo ouvert, portrait', 669, 951, 'regular'],
    ['Galaxy Z Fold ouvert', 780, 860, 'regular'],
    ['Galaxy Z Fold ouvert, clavier réduit la hauteur', 780, 400, 'compact'],
    ['iPad 11" Split View 1/3', 320, 1194, 'compact'],
    ['iPad 11" plein', 834, 1194, 'regular'],
  ])('%s (%i × %i) → %s', (_, w, h, expected) => {
    expect(resolveLayoutClass(w, h)).toBe(expected);
  });

  it('les seuils sont inclusifs', () => {
    expect(resolveLayoutClass(600, 480)).toBe('regular');
    expect(resolveLayoutClass(599, 480)).toBe('compact');
    expect(resolveLayoutClass(600, 479)).toBe('compact');
  });
});
```

- [ ] **Étape 2 : lancer, vérifier l'échec**

Run: `npx jest lib/__tests__/layoutClass.test.ts`
Expected: FAIL — `Cannot find module '../layout/resolveLayoutClass'`

- [ ] **Étape 3 : écrire la fonction pure, le hook et le barrel**

```ts
// lib/layout/resolveLayoutClass.ts
// Une colonne ou deux volets ? Décidé par la géométrie, jamais par le modèle
// d'appareil : un Duo fermé est compact, un Fold ouvert est regular, un iPad
// en Split View 1/3 redevient compact.
export type LayoutClass = 'compact' | 'regular';

export const REGULAR_MIN_WIDTH = 600;
export const REGULAR_MIN_HEIGHT = 480;

export function resolveLayoutClass(width: number, height: number): LayoutClass {
  return width >= REGULAR_MIN_WIDTH && height >= REGULAR_MIN_HEIGHT ? 'regular' : 'compact';
}
```

```ts
// lib/layout/useLayoutClass.ts
// Remplace tout `Dimensions.get('window')` : réactif au pliage, à la rotation
// et au Split View. Les insets gauche/droite sont exposés SÉPARÉMENT — sur
// l'écran interne du Duo, la Dynamic Island est latérale et ils diffèrent.
import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveLayoutClass, type LayoutClass } from './resolveLayoutClass';

export interface Layout {
  width: number;
  height: number;
  cls: LayoutClass;
  isRegular: boolean;
  isLandscape: boolean;
  insets: { top: number; bottom: number; left: number; right: number };
}

export function useLayoutClass(): Layout {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return useMemo(() => {
    const cls = resolveLayoutClass(width, height);
    return {
      width,
      height,
      cls,
      isRegular: cls === 'regular',
      isLandscape: width > height,
      insets: { top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right },
    };
  }, [width, height, insets.top, insets.bottom, insets.left, insets.right]);
}
```

```ts
// lib/layout/index.ts
export { resolveLayoutClass, REGULAR_MIN_WIDTH, REGULAR_MIN_HEIGHT } from './resolveLayoutClass';
export type { LayoutClass } from './resolveLayoutClass';
export { useLayoutClass } from './useLayoutClass';
export type { Layout } from './useLayoutClass';
```

- [ ] **Étape 4 : lancer, vérifier que ça passe**

Run: `npx jest lib/__tests__/layoutClass.test.ts`
Expected: PASS (10 tests)

- [ ] **Étape 5 : commit**

```bash
git add lib/layout lib/__tests__/layoutClass.test.ts
git commit -m "layout: classe de disposition compact/regular, réactive au pliage

Fonction pure testée sur SE, 15 Pro, Duo fermé/ouvert, Fold, iPad Split
View. Le hook lit useWindowDimensions : il remplace les Dimensions.get
figés au chargement, qui ne suivaient ni le pliage ni la rotation."
```

---

### Tâche 3 : règles ESLint — interdire ce que le spec bannit

**Files:**
- Modify: `eslint.config.js`

- [ ] **Étape 1 : ajouter les règles**

```js
// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// Les deux fichiers ci-dessous portent encore `Animated` de react-native.
// Ils sont migrés par les plans 1 (missionview) et 2 (send-quote) ; retirer
// chaque entrée dans le commit qui migre le fichier. Ne rien ajouter ici.
const LEGACY_ANIMATED_ALLOWLIST = [
  'app/request/[id]/missionview.tsx',
  'app/request/[id]/send-quote.tsx',
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Dimensions'][callee.property.name='get']",
          message: "Dimensions.get est figé au chargement et ne suit pas le pliage. Utiliser useLayoutClass() (lib/layout).",
        },
        {
          selector: "CallExpression[callee.object.name='Alert'][callee.property.name='alert']",
          message: "Zéro alerte système (règle 7). Utiliser feedback.* (lib/feedback).",
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'expo-haptics', message: "Haptique via feedback.haptic() uniquement." }],
        },
      ],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
    ignores: LEGACY_ANIMATED_ALLOWLIST,
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "ImportDeclaration[source.value='react-native'] ImportSpecifier[imported.name='Animated']",
          message: "Animated legacy banni (règle 1 CLAUDE.md). Utiliser react-native-reanimated.",
        },
      ],
    },
  },
]);
```

- [ ] **Étape 2 : lancer le lint et lister ce qui tombe**

Run: `npx eslint app components lib 2>&1 | grep -E "Dimensions.get|Alert.alert|Animated legacy|expo-haptics" | wc -l`
Expected: **18** erreurs `Dimensions.get` (les 15 fichiers de la Tâche 4), 0 `Alert.alert`, 0 `Animated legacy` (allowlist), 0 `expo-haptics` hors `lib/feedback`. Si `lib/feedback/feedback.ts` remonte `expo-haptics`, ajouter `'lib/feedback/**'` aux `ignores` du premier bloc : c'est le seul endroit autorisé.

> **Constat à l'exécution (13/09)** : l'inventaire réel est de **33 fichiers** sur `Animated` legacy (pas 2), 3 `Alert.alert` dans `lib/api.ts` et `lib/webrtc/CallContext.tsx`, et `expo-haptics` dans `lib/SocketContext.tsx` (intouchable sans validation). Tous sont en allowlists explicites dans `eslint.config.js` ; les chemins `[id]` doivent être échappés pour minimatch (`toGlob`). Les plans 2-3 vident la liste `Animated` ; la migration des 3 `Alert.alert` est un item du plan 3.

- [ ] **Étape 3 : commit (le lint est rouge à dessein jusqu'à la Tâche 4)**

```bash
git add eslint.config.js
git commit -m "lint: interdire Dimensions.get, Alert.alert, expo-haptics direct, Animated legacy

Deux fichiers restent en allowlist Animated le temps de leur migration
(missionview : plan 1, send-quote : plan 2). La liste ne doit que
décroître."
```

---

### Tâche 4 : purger `Dimensions.get` — 18 usages, 3 formes

**Files (Modify):**
- Forme A, constantes de module : `components/onboarding/OnboardingLayout.tsx:18`, `app/onboarding/provider/pending.tsx:41`, `app/request/[id]/quote-pending.tsx:20`, `app/request/[id]/resume-payment.tsx:23`, `app/request/[id]/missionview.tsx:31`, `app/(auth)/signup.tsx:52`, `app/(tabs)/missions.tsx:35`
- Forme B, lecture inline dans le rendu : `app/(tabs)/dashboard.tsx:1477`, `app/(tabs)/dashboard.tsx:1770`
- Forme C, `maxDynamicContentSize` des sheets : `app/(tabs)/dashboard.tsx:1545`, `app/(tabs)/profile.tsx:1376`, `components/sheets/InvoiceSheet.tsx:596`, `components/sheets/QuoteSheet.tsx:101`, `components/sheets/TicketDetailSheet.tsx:382`, `components/sheets/NotificationDetailSheet.tsx:122`, `components/feedback/ActionSheet.tsx:38`, `components/feedback/ConfirmSheet.tsx:43`

- [ ] **Étape 1 : Forme A — la grille décorative (4 fichiers : OnboardingLayout, pending, quote-pending, resume-payment)**

Ces quatre fichiers contiennent le même composant `GridBackground` construit sur `SCREEN_W`/`SCREEN_H` de module. Dans chacun, supprimer la ligne `const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");` et l'import `Dimensions`, puis remplacer le composant par :

```tsx
import { useLayoutClass } from "@/lib/layout";

function GridBackground({ stroke }: { stroke: string }) {
  // Réactif : au dépliage, la grille couvre le nouvel écran au lieu de la
  // moitié gauche (Dimensions.get était lu une fois au chargement).
  const { width: SCREEN_W, height: SCREEN_H } = useLayoutClass();
  const cols = Math.ceil(SCREEN_W / GRID_SIZE) + 1;
  const rows = Math.ceil(SCREEN_H / GRID_SIZE) + 1;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={SCREEN_W} height={SCREEN_H} style={StyleSheet.absoluteFill}>
        {Array.from({ length: cols }).map((_, i) => (
          <Line key={`v${i}`} x1={i * GRID_SIZE} y1={0} x2={i * GRID_SIZE} y2={SCREEN_H} stroke={stroke} strokeWidth={1} />
        ))}
        {Array.from({ length: rows }).map((_, i) => (
          <Line key={`h${i}`} x1={0} y1={i * GRID_SIZE} x2={SCREEN_W} y2={i * GRID_SIZE} stroke={stroke} strokeWidth={1} />
        ))}
      </Svg>
    </View>
  );
}
```

Le halo `left: (SCREEN_W - 420) / 2` dans les `StyleSheet.create` de `pending.tsx:821`, `quote-pending.tsx:367`, `OnboardingLayout.tsx:250` devient un style inline dans le rendu : `style={[s.glow, { left: (width - 420) / 2 }]}` avec `const { width } = useLayoutClass();` dans le composant, et la clé `left` retirée de la feuille de style.

- [ ] **Étape 2 : Forme A — `signup.tsx:52` et `missions.tsx:35`**

Dans `signup.tsx`, chercher chaque usage de `SCREEN_H` (`grep -n SCREEN_H`) ; ils sont dans le composant. Supprimer la constante de module et écrire en tête du composant `const { height: SCREEN_H } = useLayoutClass();`. Dans `missions.tsx`, idem avec `const { width } = useLayoutClass();` — si `width` est utilisé dans un `StyleSheet.create` de module, passer la propriété concernée en style inline comme à l'étape 1.

Pour `missionview.tsx:31`, ne rien faire ici : `WAVE_SIZE` disparaît avec `RadarWaves` en Tâche 17.

- [ ] **Étape 3 : Forme B — `dashboard.tsx:1477` et `:1770`**

Ajouter dans le composant qui rend ces tuiles : `const { width } = useLayoutClass();` puis remplacer `(Dimensions.get('window').width - 42) / 2` par `(width - 42) / 2` aux deux endroits. La ligne 1770 est dans un `StyleSheet.create` : sortir `width` de la feuille et le passer inline `style={[s.tile, { width: (width - 42) / 2 }]}`.

- [ ] **Étape 4 : Forme C — les 8 `maxDynamicContentSize`**

Dans chaque composant, ajouter `const { height } = useLayoutClass();` et remplacer `Dimensions.get('window').height * X` par `height * X` (même ratio X qu'avant). Supprimer l'import `Dimensions` devenu inutile. Ces valeurs deviennent réactives : un sheet ouvert pendant un pliage se recale.

- [ ] **Étape 5 : lint + typecheck + suite**

Run: `npx eslint app components lib 2>&1 | grep -c "Dimensions.get"` → Expected: `0`
Run: `npx tsc --noEmit` → Expected: exit 0
Run: `npx jest` → Expected: tous verts (119 + 24 nouveaux)

- [ ] **Étape 6 : commit**

```bash
git add -A
git commit -m "layout: plus aucun Dimensions.get — 18 usages passent par useLayoutClass()

Figées au chargement du module, ces valeurs ne suivaient ni le pliage ni
la rotation : grille décorative sur la moitié de l'écran, halo décentré,
tuiles à une colonne, sheets trop bas après dépliage. Le lint interdit
désormais toute réintroduction."
```

---

### Tâche 5 : `requireFullScreen` — le Duo ouvert reste propre en attendant le train 2

**Files:**
- Modify: `app.json:21-27`

- [ ] **Étape 1 : ajouter la clé dans le bloc `ios`**

```json
    "ios": {
      "supportsTablet": false,
      "requireFullScreen": true,
      "bundleIdentifier": "app.thefixed.client",
```

- [ ] **Étape 2 : vérifier la génération native**

Run: `npx expo config --type introspect 2>/dev/null | grep -A1 UIRequiresFullScreen`
Expected: `"UIRequiresFullScreen": true`

- [ ] **Étape 3 : commit**

```bash
git add app.json
git commit -m "ios: UIRequiresFullScreen pour l'iPhone Duo (train 1)

Sans cette clé, l'écran interne ignore le verrouillage portrait et
l'app se retrouve en 951 × 669 paysage sur des écrans jamais dessinés
pour ça. Avec elle, iOS la met à l'échelle proprement. À retirer au
train 2, avec le SDK 27.1 et SplitPane."
```

---

### Tâche 6 : `hapticOnFrame` — l'haptique sur la frame du visuel

**Files:**
- Create: `lib/motion/haptics.ts`

- [ ] **Étape 1 : écrire le helper**

```ts
// lib/motion/haptics.ts
// Règle 6 : l'haptique tombe sur la même frame que le visuel, une seule fois
// par événement. Appelé DEPUIS un worklet (callback de withSpring, frame
// callback) — runOnJS ramène l'appel sur le thread JS où vit feedback.*.
import { runOnJS } from 'react-native-reanimated';
import { feedback } from '@/lib/feedback/feedback';

export type HapticKind = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'error';

function fire(kind: HapticKind) {
  feedback.haptic(kind);
}

/** À utiliser dans un worklet : `hapticOnFrame('success')`. */
export function hapticOnFrame(kind: HapticKind) {
  'worklet';
  runOnJS(fire)(kind);
}
```

- [ ] **Étape 2 : typecheck**

Run: `npx tsc --noEmit` → Expected: exit 0 (si `feedback.haptic` n'accepte pas l'un des `HapticKind`, aligner le type sur la signature réelle dans `lib/feedback/feedback.ts` — ne pas élargir `feedback`).

- [ ] **Étape 3 : commit**

```bash
git add lib/motion/haptics.ts
git commit -m "motion: hapticOnFrame — haptique déclenchée depuis un worklet, une fois"
```

---

### Tâche 7 : `useCountingValue` + `ReText` — une valeur qui compte

**Files:**
- Create: `lib/motion/useCountingValue.ts`, `components/ui/ReText.tsx`
- Test: `lib/__tests__/motionPure.test.ts` (créé ici, enrichi par les tâches suivantes)

- [ ] **Étape 1 : test de `formatCount`**

```ts
// lib/__tests__/motionPure.test.ts
/** Fonctions pures de lib/motion : formatage, gestes, découpage. */
import { formatCount } from '../motion/useCountingValue';

describe('formatCount', () => {
  it('arrondit à l\'entier et ajoute le suffixe', () => {
    expect(formatCount(88.6, ' €')).toBe('89 €');
    expect(formatCount(109.2, ' €')).toBe('109 €');
  });
  it('supporte les décimales demandées', () => {
    expect(formatCount(88.649, ' €', 2)).toBe('88,65 €');
  });
  it('ne renvoie jamais -0', () => {
    expect(formatCount(-0.2, ' €')).toBe('0 €');
  });
});
```

- [ ] **Étape 2 : lancer, vérifier l'échec**

Run: `npx jest lib/__tests__/motionPure.test.ts` → Expected: FAIL — module introuvable

- [ ] **Étape 3 : écrire le hook et `ReText`**

```ts
// lib/motion/useCountingValue.ts
// Un montant, un total, un ETA : la valeur COMPTE vers sa cible sur un ressort
// au lieu de sauter. Pas de setState par frame : le texte est poussé dans un
// TextInput via useAnimatedProps (composant ReText).
import { useEffect } from 'react';
import { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import { MOTION } from './springs';
import { useReduceMotion, type SpringConfig } from './sheet';

export function formatCount(value: number, suffix = '', decimals = 0): string {
  const rounded = Math.round(value * 10 ** decimals) / 10 ** decimals;
  const safe = Object.is(rounded, -0) ? 0 : rounded;
  const text = decimals > 0 ? safe.toFixed(decimals).replace('.', ',') : String(safe);
  return `${text}${suffix}`;
}

export function useCountingValue(target: number, opts: { suffix?: string; decimals?: number; preset?: SpringConfig } = {}) {
  const { suffix = '', decimals = 0, preset = MOTION.count } = opts;
  const reduced = useReduceMotion();
  const value = useSharedValue(target);

  useEffect(() => {
    // Règle 1 : on repart de la valeur courante. Décocher pendant que ça
    // compte redescend d'où c'est.
    value.value = reduced ? target : withSpring(target, preset);
  }, [target, reduced, preset, value]);

  const animatedProps = useAnimatedProps(() => ({
    text: formatCount(value.value, suffix, decimals),
    defaultValue: formatCount(value.value, suffix, decimals),
  }));

  return { value, animatedProps };
}
```

```tsx
// components/ui/ReText.tsx
// Texte animé sans re-render React : un TextInput non éditable dont la prop
// `text` est écrite depuis le thread UI (useAnimatedProps).
import React from 'react';
import { TextInput, type TextInputProps, type TextStyle } from 'react-native';
import Animated, { type AnimatedProps } from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type Props = {
  animatedProps: AnimatedProps<TextInputProps>;
  style?: TextStyle | TextStyle[];
  accessibilityLabel?: string;
};

export function ReText({ animatedProps, style, accessibilityLabel }: Props) {
  return (
    <AnimatedTextInput
      underlineColorAndroid="transparent"
      editable={false}
      caretHidden
      pointerEvents="none"
      animatedProps={animatedProps}
      accessibilityLabel={accessibilityLabel}
      style={[{ padding: 0, margin: 0, includeFontPadding: false, fontVariant: ['tabular-nums'] }, style]}
    />
  );
}
```

- [ ] **Étape 4 : lancer les tests**

Run: `npx jest lib/__tests__/motionPure.test.ts` → Expected: PASS (3 tests)
Run: `npx tsc --noEmit` → Expected: exit 0

- [ ] **Étape 5 : commit**

```bash
git add lib/motion/useCountingValue.ts components/ui/ReText.tsx lib/__tests__/motionPure.test.ts
git commit -m "motion: useCountingValue + ReText — une valeur qui compte, sans re-render"
```

---

### Tâche 8 : `useBreathe`, `useTakeScale`, `usePresence`, `useCascade` — les quatre hooks de style

**Files:**
- Create: `lib/motion/useBreathe.ts`, `lib/motion/useTakeScale.ts`, `lib/motion/usePresence.ts`, `lib/motion/useCascade.ts`

- [ ] **Étape 1 : `useBreathe`**

```ts
// lib/motion/useBreathe.ts
// Un bloc qui « respire » une fois à la réception d'une valeur (1,03 → 1).
// Dit « ça vient de changer » sans toast.
import { useCallback } from 'react';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { MOTION } from './springs';
import { useReduceMotion } from './sheet';

export function useBreathe(amplitude = 1.03) {
  const reduced = useReduceMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pulse = useCallback(() => {
    if (reduced) return;
    scale.value = amplitude;
    scale.value = withSpring(1, MOTION.breathe);
  }, [reduced, amplitude, scale]);
  return { style, pulse };
}
```

- [ ] **Étape 2 : `useTakeScale`**

```ts
// lib/motion/useTakeScale.ts
// Un objet qui « prend » : marqueur sélectionné (1 → 1,35), étoile finale,
// icône d'onglet (0,9 → 1), atterrissage (0 → 1). Léger dépassement voulu.
import { useEffect } from 'react';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { MOTION } from './springs';
import { useReduceMotion, type SpringConfig } from './sheet';

export function useTakeScale(active: boolean, opts: { on?: number; off?: number; preset?: SpringConfig; onSettle?: () => void } = {}) {
  const { on = 1.35, off = 1, preset = MOTION.take, onSettle } = opts;
  const reduced = useReduceMotion();
  const scale = useSharedValue(active ? on : off);
  useEffect(() => {
    const target = active ? on : off;
    if (reduced) { scale.value = target; onSettle?.(); return; }
    scale.value = withSpring(target, preset, (finished) => {
      'worklet';
      if (finished && onSettle) { /* onSettle est JS : passer par runOnJS côté appelant si besoin */ }
    });
  }, [active, on, off, preset, reduced, scale, onSettle]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return { style, scale };
}
```

- [ ] **Étape 3 : `usePresence`**

```ts
// lib/motion/usePresence.ts
// Entrée / sortie avec ORIGINE. Sur un écran déplié, ce qui apparaît à droite
// part de la charnière, ce qui apparaît à gauche part du bord : l'utilisateur
// comprend la géographie de l'écran sans y penser (spec, moment 19).
import { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { MOTION } from './springs';
import { useReduceMotion, type SpringConfig } from './sheet';

export type PresenceOrigin = 'left' | 'hinge' | 'right' | 'bottom' | 'island' | 'none';

const OFFSET: Record<PresenceOrigin, { x: number; y: number }> = {
  left: { x: -28, y: 0 },
  hinge: { x: -40, y: 0 },
  right: { x: 28, y: 0 },
  bottom: { x: 0, y: 12 },
  island: { x: 0, y: -8 },
  none: { x: 0, y: 0 },
};

export function usePresence(visible: boolean, opts: { from?: PresenceOrigin; preset?: SpringConfig; delayMs?: number } = {}) {
  const { from = 'bottom', preset = MOTION.pane, delayMs = 0 } = opts;
  const reduced = useReduceMotion();
  const p = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    const target = visible ? 1 : 0;
    if (reduced) { p.value = withTiming(target, { duration: 200 }); return; }
    const go = () => { p.value = withSpring(target, preset); };
    if (delayMs > 0 && visible) { const t = setTimeout(go, delayMs); return () => clearTimeout(t); }
    go();
  }, [visible, reduced, preset, delayMs, p]);

  const style = useAnimatedStyle(() => {
    const off = OFFSET[from];
    return {
      opacity: p.value,
      transform: reduced
        ? []
        : [{ translateX: off.x * (1 - p.value) }, { translateY: off.y * (1 - p.value) }],
    };
  });

  return { style, progress: p };
}
```

- [ ] **Étape 4 : `useCascade`**

```ts
// lib/motion/useCascade.ts
// N éléments qui apparaissent l'un après l'autre (lignes de devis, contenu
// après squelettes, volets). Le décalage guide le regard ; il ne décore pas.
import { useEffect, useMemo } from 'react';
import { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { MOTION } from './springs';
import { useReduceMotion, type SpringConfig } from './sheet';

export function useCascade(count: number, opts: { stepMs?: number; dx?: number; dy?: number; preset?: SpringConfig; play?: boolean } = {}) {
  const { stepMs = 40, dx = 0, dy = 10, preset = MOTION.pane, play = true } = opts;
  const reduced = useReduceMotion();
  // Un seul shared value par élément — count est borné par l'appelant (≤ 20).
  const values = useSharedValue<number[]>(Array.from({ length: count }, () => 0));

  useEffect(() => {
    if (!play) return;
    const next = Array.from({ length: count }, () => 0);
    values.value = next;
    for (let i = 0; i < count; i++) {
      const anim = reduced ? withTiming(1, { duration: 200 }) : withDelay(i * stepMs, withSpring(1, preset));
      // Écriture par index via une copie : Reanimated ne suit pas les mutations in-place.
      values.modify((arr) => { 'worklet'; arr[i] = 0; return arr; });
      // Chaque index anime séparément :
      values.modify((arr) => { 'worklet'; arr[i] = anim as unknown as number; return arr; });
    }
  }, [count, play, reduced, stepMs, preset, values]);

  const styleFor = useMemo(
    () => (i: number) =>
      // eslint-disable-next-line react-hooks/rules-of-hooks -- appelé un nombre constant de fois par rendu
      useAnimatedStyle(() => {
        const v = values.value[i] ?? 1;
        return {
          opacity: v,
          transform: reduced ? [] : [{ translateX: dx * (1 - v) }, { translateY: dy * (1 - v) }],
        };
      }),
    [values, dx, dy, reduced],
  );

  return { styleFor };
}
```

> Note d'implémentation : si `values.modify` avec une valeur `withDelay` par index se révèle non supporté par Reanimated 4.1 à l'exécution (les animations sur un tableau partagé ne sont pas garanties), remplacer par un composant `<CascadeItem index delayMs>` qui possède son propre `useSharedValue` + `usePresence(true, { delayMs: index * stepMs })`. C'est la forme sûre ; `useCascade` devient alors un simple calcul de `delayMs`.

- [ ] **Étape 5 : typecheck, commit**

Run: `npx tsc --noEmit` → Expected: exit 0

```bash
git add lib/motion/useBreathe.ts lib/motion/useTakeScale.ts lib/motion/usePresence.ts lib/motion/useCascade.ts
git commit -m "motion: useBreathe, useTakeScale, usePresence (origine), useCascade"
```

---

### Tâche 9 : `useTraceStroke` et `useRevealCount` — un trait qui se dessine

**Files:**
- Create: `lib/motion/useTraceStroke.ts`, `lib/motion/useRevealCount.ts`
- Test: `lib/__tests__/motionPure.test.ts` (ajout)

- [ ] **Étape 1 : test de `revealIndex`**

```ts
// ajout dans lib/__tests__/motionPure.test.ts
import { revealIndex } from '../motion/useRevealCount';

describe('revealIndex', () => {
  it('0 → 0 éléments, 1 → tous', () => {
    expect(revealIndex(0, 40)).toBe(0);
    expect(revealIndex(1, 40)).toBe(40);
  });
  it('arrondit vers le haut pour ne jamais casser un segment déjà entamé', () => {
    expect(revealIndex(0.5, 41)).toBe(21);
    expect(revealIndex(0.01, 40)).toBe(1);
  });
  it('borné', () => {
    expect(revealIndex(1.4, 40)).toBe(40);
    expect(revealIndex(-1, 40)).toBe(0);
  });
});
```

- [ ] **Étape 2 : lancer, vérifier l'échec** — Run: `npx jest lib/__tests__/motionPure.test.ts` → FAIL, `revealIndex` introuvable

- [ ] **Étape 3 : écrire les deux hooks**

```ts
// lib/motion/useTraceStroke.ts
// Un trait SVG qui se dessine : coche de paiement, sceau de devis. Le path
// porte pathLength="1" ; on anime strokeDashoffset de 1 (invisible) à 0.
import { useEffect } from 'react';
import { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import { MOTION } from './springs';
import { useReduceMotion, type SpringConfig } from './sheet';

export function useTraceStroke(drawn: boolean, opts: { preset?: SpringConfig; onDone?: () => void } = {}) {
  const { preset = MOTION.trace } = opts;
  const reduced = useReduceMotion();
  const offset = useSharedValue(drawn ? 0 : 1);
  useEffect(() => {
    const target = drawn ? 0 : 1;
    offset.value = reduced ? target : withSpring(target, preset);
  }, [drawn, reduced, preset, offset]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  return { animatedProps, offset };
}
```

```ts
// lib/motion/useRevealCount.ts
// react-native-maps <Polyline> n'a pas de dashoffset : on révèle les points
// progressivement. La progression est un ressort sur le thread UI ; le nombre
// de points visibles ne redescend en JS qu'au plus 30 fois par seconde.
import { useEffect, useState } from 'react';
import { runOnJS, useAnimatedReaction, useSharedValue, withSpring } from 'react-native-reanimated';
import { MOTION } from './springs';
import { useReduceMotion, type SpringConfig } from './sheet';

export function revealIndex(progress: number, total: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.min(total, Math.ceil(p * total));
}

export function useRevealCount(total: number, revealed: boolean, opts: { preset?: SpringConfig } = {}) {
  const { preset = MOTION.trace } = opts;
  const reduced = useReduceMotion();
  const progress = useSharedValue(revealed ? 1 : 0);
  const [count, setCount] = useState(revealed ? total : 0);

  useEffect(() => {
    const target = revealed ? 1 : 0;
    progress.value = reduced ? target : withSpring(target, preset);
  }, [revealed, reduced, preset, progress]);

  useAnimatedReaction(
    () => revealIndex(progress.value, total),
    (next, prev) => {
      if (next !== prev) runOnJS(setCount)(next);
    },
    [total],
  );

  return count;
}
```

- [ ] **Étape 4 : tests + typecheck** — Run: `npx jest lib/__tests__/motionPure.test.ts` → PASS (6) ; `npx tsc --noEmit` → exit 0

- [ ] **Étape 5 : commit**

```bash
git add lib/motion/useTraceStroke.ts lib/motion/useRevealCount.ts lib/__tests__/motionPure.test.ts
git commit -m "motion: useTraceStroke (svg) et useRevealCount (polyline maps) — un trait qui se dessine"
```

---

### Tâche 10 : `useDigitReel` + `DigitReel` — l'ETA en rouleau

**Files:**
- Create: `lib/motion/useDigitReel.ts`, `components/ui/DigitReel.tsx`
- Test: `lib/__tests__/motionPure.test.ts` (ajout)

- [ ] **Étape 1 : test de `splitDigits`**

```ts
import { splitDigits } from '../motion/useDigitReel';

describe('splitDigits', () => {
  it('découpe un entier en chiffres', () => { expect(splitDigits(6)).toEqual([6]); expect(splitDigits(21)).toEqual([2, 1]); });
  it('tolère une chaîne avec du texte ("21 min" → [2,1])', () => { expect(splitDigits('21 min')).toEqual([2, 1]); });
  it('vide ou non numérique → []', () => { expect(splitDigits('')).toEqual([]); expect(splitDigits('—')).toEqual([]); });
});
```

- [ ] **Étape 2 : échec attendu** — Run: `npx jest lib/__tests__/motionPure.test.ts` → FAIL

- [ ] **Étape 3 : écrire le hook et le composant**

```ts
// lib/motion/useDigitReel.ts
// Chaque chiffre est un rouleau vertical 0-9 ; un changement de valeur fait
// tourner le rouleau sur un ressort. Un changement du NOMBRE de chiffres
// (9 → 10) reconstruit sans animer : le mouvement doit rester lisible.
import { useEffect } from 'react';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { spring } from './springs';
import { useReduceMotion } from './sheet';

export const REEL_SPRING = spring(200, 1.0);

export function splitDigits(value: number | string): number[] {
  const m = String(value).match(/\d+/);
  if (!m) return [];
  return [...m[0]].map((c) => parseInt(c, 10));
}

export function useDigitReel(digit: number, lineHeight: number) {
  const reduced = useReduceMotion();
  const pos = useSharedValue(digit);
  useEffect(() => {
    pos.value = reduced ? digit : withSpring(digit, REEL_SPRING);
  }, [digit, reduced, pos]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -pos.value * lineHeight }] }));
  return style;
}
```

```tsx
// components/ui/DigitReel.tsx
import React from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { splitDigits, useDigitReel } from '@/lib/motion/useDigitReel';

function Reel({ digit, lineHeight, textStyle }: { digit: number; lineHeight: number; textStyle: TextStyle }) {
  const style = useDigitReel(digit, lineHeight);
  return (
    <View style={{ height: lineHeight, overflow: 'hidden' }}>
      <Animated.View style={style}>
        {Array.from({ length: 10 }, (_, i) => (
          <Text key={i} style={[textStyle, { height: lineHeight, lineHeight, includeFontPadding: false }]}>{i}</Text>
        ))}
      </Animated.View>
    </View>
  );
}

/** Affiche `value` (ex. 21) chiffre par chiffre, chaque chiffre roulant vers sa cible. */
export function DigitReel({ value, textStyle, lineHeight, accessibilityLabel }: { value: number | string; textStyle: TextStyle; lineHeight: number; accessibilityLabel?: string }) {
  const digits = splitDigits(value);
  return (
    <View style={s.row} accessible accessibilityRole="text" accessibilityLabel={accessibilityLabel ?? String(value)}>
      {digits.map((d, i) => (
        // La clé inclut le nombre de chiffres : passer de 10 à 9 reconstruit sans animer.
        <Reel key={`${digits.length}-${i}`} digit={d} lineHeight={lineHeight} textStyle={textStyle} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({ row: { flexDirection: 'row' } });
```

- [ ] **Étape 4 : tests + typecheck** — Run: `npx jest lib/__tests__/motionPure.test.ts` → PASS (9) ; `npx tsc --noEmit` → exit 0

- [ ] **Étape 5 : commit**

```bash
git add lib/motion/useDigitReel.ts components/ui/DigitReel.tsx lib/__tests__/motionPure.test.ts
git commit -m "motion: DigitReel — l'ETA roule chiffre par chiffre au lieu de sauter"
```

---

### Tâche 11 : gestes purs — `rubberBand`, `projectRelease`, `shouldConfirm`

**Files:**
- Create: `lib/motion/gestures.ts`
- Test: `lib/__tests__/motionPure.test.ts` (ajout)

- [ ] **Étape 1 : tests**

```ts
import { rubberBand, projectRelease, shouldConfirm } from '../motion/gestures';

describe('rubberBand', () => {
  it('identité dans la piste', () => { expect(rubberBand(50, 0, 100)).toBe(50); });
  it('résistance 3,5 au-delà des bornes', () => {
    expect(rubberBand(135, 0, 100)).toBeCloseTo(110, 5);
    expect(rubberBand(-35, 0, 100)).toBeCloseTo(-10, 5);
  });
});

describe('projectRelease', () => {
  it('projette la position avec 200 ms d\'élan', () => { expect(projectRelease(40, 500)).toBe(140); });
  it('un élan négatif recule', () => { expect(projectRelease(40, -300)).toBe(-20); });
});

describe('shouldConfirm', () => {
  const track = 260;
  it('position ≥ 95 % → confirme même sans élan', () => { expect(shouldConfirm(250, 0, track)).toBe(true); });
  it('position à mi-course sans élan → non', () => { expect(shouldConfirm(130, 0, track)).toBe(false); });
  it('position à mi-course avec un flick → oui (projection ≥ 90 %)', () => { expect(shouldConfirm(130, 600, track)).toBe(true); });
  it('flick vers l\'arrière → non', () => { expect(shouldConfirm(200, -900, track)).toBe(false); });
});
```

- [ ] **Étape 2 : échec attendu** — Run: `npx jest lib/__tests__/motionPure.test.ts` → FAIL

- [ ] **Étape 3 : écrire `gestures.ts`**

```ts
// lib/motion/gestures.ts
// Fonctions pures des gestes — testables sans Reanimated. Marquées 'worklet'
// pour être appelables depuis le thread UI.
import { SHEET_OVER_DRAG_RESISTANCE } from './sheet';

/** Règle 5 : élastique aux bords, jamais d'arrêt sec. */
export function rubberBand(x: number, min: number, max: number, resistance = SHEET_OVER_DRAG_RESISTANCE): number {
  'worklet';
  if (x < min) return min + (x - min) / resistance;
  if (x > max) return max + (x - max) / resistance;
  return x;
}

/** Règle 3 : le point d'arrivée est projeté depuis la vitesse, pas lu à la position. */
export function projectRelease(x: number, velocity: number, horizonSec = 0.2): number {
  'worklet';
  return x + velocity * horizonSec;
}

/** Curseur d'engagement : confirme si on est au bout, ou si l'élan y mène. */
export function shouldConfirm(x: number, velocity: number, track: number): boolean {
  'worklet';
  if (x >= track * 0.95) return true;
  if (velocity <= 0) return false;
  return projectRelease(x, velocity) >= track * 0.9;
}
```

- [ ] **Étape 4 : tests** — Run: `npx jest lib/__tests__/motionPure.test.ts` → PASS (17)

- [ ] **Étape 5 : commit**

```bash
git add lib/motion/gestures.ts lib/__tests__/motionPure.test.ts
git commit -m "motion: gestes purs — rubberBand, projectRelease, shouldConfirm (testés)"
```

---

### Tâche 12 : `useSlideToConfirm` et `useRubberPull`

**Files:**
- Create: `lib/motion/useSlideToConfirm.ts`, `lib/motion/useRubberPull.ts`, `lib/motion/index.ts`

- [ ] **Étape 1 : `useSlideToConfirm`**

```ts
// lib/motion/useSlideToConfirm.ts
// Accepter une mission mérite un geste. Lâcher tôt : élastique. Flick : la
// vitesse est projetée et confirme avant le bout. Haptique light à 50 %,
// success au déclenchement — une fois chacune.
import { useCallback, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { rubberBand, shouldConfirm } from './gestures';
import { hapticOnFrame } from './haptics';
import { spring } from './springs';
import { SHEET_SPRING_MOMENTUM, useReduceMotion } from './sheet';

const SETTLE_SPRING = spring(300, 1.0);

export function useSlideToConfirm(opts: { trackWidth: number; knobSize: number; onConfirm: () => void }) {
  const { trackWidth, knobSize, onConfirm } = opts;
  const track = Math.max(0, trackWidth - knobSize);
  const reduced = useReduceMotion();
  const x = useSharedValue(0);
  const done = useSharedValue(0);
  const halfwayFired = useSharedValue(0);

  const confirm = useCallback(() => onConfirm(), [onConfirm]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => { halfwayFired.value = 0; })
        .onUpdate((e) => {
          if (done.value) return;
          x.value = reduced ? Math.min(track, Math.max(0, e.translationX)) : rubberBand(e.translationX, 0, track);
          if (!halfwayFired.value && x.value >= track * 0.5) { halfwayFired.value = 1; hapticOnFrame('light'); }
        })
        .onEnd((e) => {
          if (done.value) return;
          const ok = reduced ? x.value >= track * 0.9 : shouldConfirm(x.value, e.velocityX, track);
          if (ok) {
            done.value = 1;
            x.value = withSpring(track, SETTLE_SPRING);
            hapticOnFrame('success');
            runOnJS(confirm)();
          } else {
            x.value = withSpring(0, { ...SHEET_SPRING_MOMENTUM, velocity: e.velocityX });
          }
        }),
    [track, reduced, x, done, halfwayFired, confirm],
  );

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ width: x.value + knobSize }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - (x.value / Math.max(1, track)) * 1.4) }));

  const reset = useCallback(() => { done.value = 0; x.value = withSpring(0, SETTLE_SPRING); }, [done, x]);

  return { gesture, knobStyle, fillStyle, labelStyle, reset };
}
```

- [ ] **Étape 2 : `useRubberPull`**

```ts
// lib/motion/useRubberPull.ts
// Pull-to-refresh : le logo s'étire avec le tirage (élastique), claque en
// place au relâchement pendant que la liste se rafraîchit.
import { useCallback, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { hapticOnFrame } from './haptics';
import { MOTION } from './springs';
import { useReduceMotion } from './sheet';

export function useRubberPull(opts: { threshold?: number; holdAt?: number; onRefresh: () => Promise<void> | void }) {
  const { threshold = 64, holdAt = 56, onRefresh } = opts;
  const reduced = useReduceMotion();
  const y = useSharedValue(0);
  const armed = useSharedValue(0);

  const refresh = useCallback(async () => {
    try { await onRefresh(); } finally { y.value = withSpring(0, MOTION.pull); }
  }, [onRefresh, y]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .onBegin(() => { armed.value = 0; })
        .onUpdate((e) => {
          const d = Math.max(0, e.translationY);
          // Résistance croissante : 80 pt de tirage réel ≈ 60 pt affichés.
          y.value = reduced ? Math.min(d, threshold) : 80 * (1 - Math.exp(-d / 96)) * 1.6;
          if (!armed.value && y.value >= threshold) { armed.value = 1; hapticOnFrame('light'); }
        })
        .onEnd((e) => {
          if (armed.value) { y.value = withSpring(holdAt, { ...MOTION.pull, velocity: e.velocityY }); runOnJS(refresh)(); }
          else y.value = withSpring(0, { ...MOTION.pull, velocity: e.velocityY });
        }),
    [reduced, threshold, holdAt, y, armed, refresh],
  );

  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const logoStyle = useAnimatedStyle(() => {
    const p = Math.min(1, y.value / 80);
    return {
      opacity: Math.min(1, y.value / 30),
      transform: [{ translateY: y.value * 0.9 }, { scaleY: 1 + p * 0.35 }, { scaleX: 1 - p * 0.08 }],
    };
  });

  return { gesture, contentStyle, logoStyle };
}
```

- [ ] **Étape 3 : barrel**

```ts
// lib/motion/index.ts
export * from './sheet';
export * from './press';
export * from './springs';
export * from './haptics';
export * from './gestures';
export * from './useCountingValue';
export * from './useBreathe';
export * from './useTakeScale';
export * from './usePresence';
export * from './useCascade';
export * from './useTraceStroke';
export * from './useRevealCount';
export * from './useDigitReel';
export * from './useSlideToConfirm';
export * from './useRubberPull';
```

- [ ] **Étape 4 : typecheck + suite** — Run: `npx tsc --noEmit` → exit 0 ; `npx jest` → tous verts

- [ ] **Étape 5 : commit**

```bash
git add lib/motion
git commit -m "motion: useSlideToConfirm (élastique + projection) et useRubberPull ; barrel lib/motion"
```

---

### Tâche 13 : `BreathingRings` — la recherche qui respire (moment 1)

**Files:**
- Create: `components/searching/BreathingRings.tsx`

- [ ] **Étape 1 : écrire le composant**

```tsx
// components/searching/BreathingRings.tsx
// Anneaux de recherche. Pas une boucle mécanique : la période s'allonge avec
// le temps (1,6 s → 2,8 s sur 90 s) et l'amplitude grandit. Le mouvement dit
// « on cherche encore, c'est normal ». Une seule instance à l'écran.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { useLayoutClass } from '@/lib/layout';
import { useReduceMotion } from '@/lib/motion/sheet';

const RING_COUNT = 4;
const PHASES = [0, 0.25, 0.5, 0.75];

function periodAt(elapsedSec: number) {
  'worklet';
  return 1.6 + Math.min(1.2, (elapsedSec / 90) * 1.2);
}

function Ring({ index, elapsed, size, color, reduced }: { index: number; elapsed: Animated.SharedValue<number>; size: number; color: string; reduced: boolean }) {
  const style = useAnimatedStyle(() => {
    const t = elapsed.value;
    const p = ((t / periodAt(t)) + PHASES[index]) % 1;
    const eased = 1 - Math.pow(1 - p, 2);
    const grow = 1 + Math.min(0.6, (t / 90) * 0.6);
    return {
      opacity: reduced ? 0.35 * (1 - p) : (1 - p) * 0.9,
      transform: [{ scale: 0.15 + eased * 0.85 * grow }],
    };
  });
  return <Animated.View style={[s.ring, { width: size, height: size, borderRadius: size / 2, borderColor: color }, style]} />;
}

export function BreathingRings({ color, active = true }: { color: string; active?: boolean }) {
  const { width } = useLayoutClass();
  const reduced = useReduceMotion();
  const size = Math.min(width * 0.85, 480);
  const elapsed = useSharedValue(0);

  useFrameCallback((frame) => {
    if (!active) return;
    elapsed.value += (frame.timeSincePreviousFrame ?? 16) / 1000;
  }, active);

  return (
    <View pointerEvents="none" style={s.wrap}>
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <Ring key={i} index={i} elapsed={elapsed} size={size} color={color} reduced={reduced} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 1.5 },
});
```

- [ ] **Étape 2 : typecheck** — Run: `npx tsc --noEmit` → exit 0 (si `Animated.SharedValue` n'est pas exporté sous ce nom en 4.1, importer `type SharedValue` depuis `react-native-reanimated`).

- [ ] **Étape 3 : commit**

```bash
git add components/searching/BreathingRings.tsx
git commit -m "searching: BreathingRings — des anneaux dont la période s'allonge avec l'attente"
```

---

### Tâche 14 : moment 1 dans `LiveMapSearching.tsx` — le cercle et les anneaux

**Files:**
- Modify: `components/searching/LiveMapSearching.tsx:331-346` (rayon du `Circle` par `setInterval`), rendu du `Circle`

- [ ] **Étape 1 : remplacer l'interpolation du rayon par un ressort**

Supprimer le `useEffect` des lignes 331-346 (`setInterval` à 50 ms) et le `useState(2000)` de `circleRadius`. Ajouter :

```tsx
import { runOnJS, useAnimatedReaction, useSharedValue, withSpring } from 'react-native-reanimated';
import { MOTION } from '@/lib/motion/springs';
import { BreathingRings } from './BreathingRings';

// Rayon du cercle de recherche : un ressort, relayé à react-native-maps au
// plus 30 fois par seconde (le Circle n'accepte pas de prop animée).
const radiusSv = useSharedValue(2000);
const [circleRadius, setCircleRadius] = useState(2000);
useEffect(() => {
  radiusSv.value = withSpring(phase === 'searching' ? 2000 : 3500, MOTION.recenter);
}, [phase, radiusSv]);
useAnimatedReaction(
  () => Math.round(radiusSv.value / 10) * 10,
  (next, prev) => { if (next !== prev) runOnJS(setCircleRadius)(next); },
);
```

- [ ] **Étape 2 : poser les anneaux au-dessus de la carte**

Juste après le `<MapView … />` (même parent, positionnement absolu), ajouter :

```tsx
<BreathingRings color={theme.textMuted} active={phase !== 'widened' || !isScheduled} />
```

- [ ] **Étape 3 : vérifier et commit**

Run: `npx tsc --noEmit` → exit 0 ; `npx eslint components/searching` → 0 erreur.
Vérification manuelle (dev client) : lancer une demande, observer que les anneaux ralentissent après ~60 s ; activer Reduce Motion → anneaux quasi statiques, cercle qui saute à sa taille.

```bash
git add components/searching/LiveMapSearching.tsx
git commit -m "searching: le cercle respire sur un ressort, les anneaux s'espacent avec l'attente

Le rayon était interpolé par setInterval à 50 ms (setState par tick)."
```

---

### Tâche 15 : moment 3 — l'ETA en rouleau (`missionview.tsx`, `ongoing.tsx`)

**Files:**
- Modify: `app/request/[id]/missionview.tsx:1190-1193`, `app/request/[id]/ongoing.tsx:863-864`

- [ ] **Étape 1 : missionview**

Remplacer le `<Text …>{etaNum}</Text>` (l. 1191-1193) par :

```tsx
<DigitReel
  value={etaNum ?? ''}
  lineHeight={60}
  textStyle={{ fontFamily: FONTS.bebas, fontSize: 60, color: theme.text, letterSpacing: -1 }}
  accessibilityLabel={`${etaNum} ${t('mission_view.min_away')}`}
/>
```

et ajouter `import { DigitReel } from '@/components/ui/DigitReel';`.

- [ ] **Étape 2 : ongoing**

Remplacer le `<Text …>{etaMin}</Text>` (l. 864) par :

```tsx
<DigitReel
  value={etaMin}
  lineHeight={52}
  textStyle={{ fontFamily: FONTS.bebas, fontSize: 52, color: theme.text, letterSpacing: -1 }}
  accessibilityLabel={`${etaMin} ${t('mission_view.min_away')}`}
/>
```

et l'import.

- [ ] **Étape 3 : vérifier et commit**

Run: `npx tsc --noEmit` → exit 0.
Manuel : en phase TRACKING, forcer une mise à jour d'ETA (socket `provider:location_update`) et voir le chiffre rouler.

```bash
git add "app/request/[id]/missionview.tsx" "app/request/[id]/ongoing.tsx"
git commit -m "mission: l'ETA roule chiffre par chiffre (client et prestataire)"
```

---

### Tâche 16 : moment 2 — atterrissage du prestataire et itinéraire qui se dessine

**Files:**
- Modify: `app/request/[id]/missionview.tsx:404-414` (`ProviderMarker`), `:1102-1115` (Polyline + Marker)

- [ ] **Étape 1 : `ProviderMarker` atterrit**

```tsx
function ProviderMarker({ landed }: { landed: boolean }) {
  const theme = useAppTheme();
  // Atterrissage : 0 → 1 avec un léger dépassement (ζ 0,8). Haptique success
  // sur la frame d'impact, une fois.
  const { style } = useTakeScale(landed, { on: 1, off: 0, preset: MOTION.land });
  const fired = useRef(false);
  useEffect(() => {
    if (landed && !fired.current) { fired.current = true; feedback.haptic('success'); }
  }, [landed]);
  return (
    <Animated.View style={[pm.wrap, style]}>
      <View style={[pm.pin, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
        <Feather name="navigation" size={14} color={theme.text} />
      </View>
      <View style={[pm.stem, { backgroundColor: theme.cardBg }]} />
    </Animated.View>
  );
}
```

Imports à ajouter : `import Reanimated, { … } from 'react-native-reanimated';` — **attention** : ce fichier importe encore `Animated` de `react-native` (allowlist). Importer Reanimated sous le nom `Reanimated` (`import Reanimated from 'react-native-reanimated'`) et écrire `<Reanimated.View>` ici pour éviter la collision, jusqu'à la Tâche 17 qui supprime le legacy. `useTakeScale` et `MOTION` depuis `@/lib/motion`.

- [ ] **Étape 2 : l'itinéraire se révèle**

Dans le composant principal, après le calcul de `routeCoords` :

```tsx
const visibleCount = useRevealCount(routeCoords.length, phase === 'TRACKING' && routeCoords.length > 0);
const visibleRoute = useMemo(() => routeCoords.slice(0, visibleCount), [routeCoords, visibleCount]);
```

et dans le rendu (l. 1102-1108) remplacer `coordinates={routeCoords}` par `coordinates={visibleRoute}`. Passer `landed={phase === 'TRACKING'}` au `<ProviderMarker />` (l. 1114). Imports : `useRevealCount` depuis `@/lib/motion`, `useMemo` depuis react.

- [ ] **Étape 3 : vérifier et commit**

Run: `npx tsc --noEmit` → exit 0.
Manuel : acceptation d'une mission → le marqueur atterrit, l'itinéraire se dessine de Karim vers le client en ~600 ms, une seule vibration.

```bash
git add "app/request/[id]/missionview.tsx"
git commit -m "mission: le prestataire atterrit sur la carte, l'itinéraire se dessine vers le client"
```

---

### Tâche 17 : migrer `missionview.tsx` hors d'`Animated` legacy (51 usages)

**Files:**
- Modify: `app/request/[id]/missionview.tsx` (import l. 5-10, `RadarWaves` l. 230-267, `fadeIn`/`slideUp` l. 521-527, et chaque `Animated.*` restant), `eslint.config.js` (retirer l'entrée d'allowlist)

- [ ] **Étape 1 : inventaire**

Run: `grep -n "Animated\." "app/request/[id]/missionview.tsx" | grep -v Reanimated`
Noter chaque site. Trois familles attendues : `RadarWaves` (boucle), entrée de page (`fadeIn`/`slideUp` + `Animated.parallel`), et des `Animated.View`/`Animated.Text` qui consomment ces valeurs.

- [ ] **Étape 2 : `RadarWaves` → `BreathingRings`**

Supprimer `WAVE_COUNT`, `WAVE_SIZE`, `RadarWaves`, la feuille `rw` (l. 230-267). Remplacer chaque `<RadarWaves />` par `<BreathingRings color={theme.textMuted} />` (import depuis `@/components/searching/BreathingRings`). Supprimer `const { width, height } = Dimensions.get('window');` (l. 31) et l'import `Dimensions` si plus utilisé ; si `height` sert ailleurs, `const { height } = useLayoutClass();` dans le composant.

- [ ] **Étape 3 : entrée de page → `usePresence`**

Supprimer `fadeIn`, `slideUp` (leurs `useRef(new Animated.Value(…))`) et le `useEffect` `Animated.parallel` (l. 521-527). Ajouter :

```tsx
const entrance = usePresence(true, { from: 'bottom', preset: MOTION.pane });
```

et remplacer les `<Animated.View style={[…, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>` par `<Reanimated.View style={[…, entrance.style]}>`.

- [ ] **Étape 4 : le reste**

Pour chaque `Animated.Value` restant : `useSharedValue` ; pour chaque `Animated.timing(v, {toValue, duration})` : `v.value = withTiming(toValue, { duration })` (ou `withSpring(target, MOTION.pane)` si c'est un déplacement) ; chaque `interpolate` : `interpolate(v.value, input, output)` dans un `useAnimatedStyle`. Une fois `Animated` de `react-native` sans usage, le retirer de l'import (l. 6) et renommer `Reanimated` en `Animated` dans le fichier (`import Animated from 'react-native-reanimated'`).

- [ ] **Étape 5 : retirer l'allowlist**

Dans `eslint.config.js`, supprimer la ligne `'app/request/[id]/missionview.tsx',` de `LEGACY_ANIMATED_ALLOWLIST`.

- [ ] **Étape 6 : vérifier**

Run: `npx eslint "app/request/[id]/missionview.tsx"` → 0 erreur ; `npx tsc --noEmit` → exit 0 ; `npx jest` → verts.
Manuel : phase SEARCHING (anneaux), passage TRACKING (atterrissage + trait), entrée de page en fondu + glissé, Reduce Motion → fondu seul.

- [ ] **Étape 7 : commit**

```bash
git add "app/request/[id]/missionview.tsx" eslint.config.js
git commit -m "mission: missionview passe entièrement sur Reanimated

RadarWaves (boucle legacy) → BreathingRings ; entrée de page → usePresence.
Plus d'Animated de react-native dans ce fichier : retiré de l'allowlist."
```

---

### Tâche 18 : vérification finale du plan

- [ ] **Étape 1 : suite, lint, typecheck**

Run: `npx jest` → Expected: tous verts (119 existants + ~40 nouveaux)
Run: `npx eslint app components lib` → Expected: 0 erreur (warnings préexistants tolérés)
Run: `npx tsc --noEmit` → Expected: exit 0

- [ ] **Étape 2 : matrice manuelle (dev client)**

| Appareil | Vérifier |
|---|---|
| iPhone 15 Pro (simulateur) | recherche → anneaux ; acceptation → atterrissage + trait + une vibration ; ETA roule ; sheets ouvrent à la bonne hauteur |
| iPhone SE | grille décorative pleine, halo centré (onboarding, pending, quote-pending, resume-payment) |
| iPad 11" (simulateur, tient lieu de Duo ouvert) | rotation en cours de recherche : anneaux et grille suivent ; sheets se recalent |
| Android « Foldable » 7,6" (émulateur, profil pliable) | plier/déplier sur missionview : rien ne recharge, dimensions suivent |
| Reduce Motion ON | anneaux quasi fixes, ETA saute, entrée de page en fondu seul, pas de vibration supplémentaire |

- [ ] **Étape 3 : mise à jour du graphe et de la mémoire projet**

Run: `cd .. && $(cat graphify-out/.graphify_python) -m graphify update .`
Ajouter dans `docs/superpowers/plans/` une ligne d'état en tête de ce fichier : `**État : livré le JJ/MM — commits a1b2c3..d4e5f6**`.

---

## Auto-revue (faite à l'écriture)

**Couverture du spec** — § 4.1 hooks : 11 hooks (Tâches 6-12) + `useRevealCount` ajouté parce que `react-native-maps` n'a pas de `dashoffset` (écart documenté, § 5 moment 2). § 4.2 layout : Tâche 2 ; `SplitPane`, `AdaptiveScroll`, `useAsymmetricInsets` → **Plan 4** (train 2), non nécessaires aux moments 1-3. § 4.3 continuité : hors périmètre de ce plan (aucun deux-volets encore). § 5 moments 1-3 : Tâches 13-17. Lint : Tâche 3. `requireFullScreen` : Tâche 5. § 7 tests : purs (T1, T2, T7, T9, T10, T11), manuels (T18). Non couvert ici et reporté explicitement : moments 4-21 (Plans 2-4), règle ESLint `no-symmetric-insets` (Plan 4 avec `useAsymmetricInsets`).

**Placeholders** — aucun « TBD ». La Tâche 17 étape 4 décrit une transformation mécanique sans lister les 51 sites : l'étape 1 impose l'inventaire par `grep` avant toute modification.

**Cohérence des types** — `useTakeScale(active, {on, off, preset})` : même signature en T8 et T16. `usePresence(visible, {from, preset, delayMs})` : T8 et T17. `useRevealCount(total, revealed)` : T9 et T16. `DigitReel({value, textStyle, lineHeight, accessibilityLabel})` : T10 et T15. `MOTION.land`, `MOTION.pane`, `MOTION.recenter`, `MOTION.trace`, `MOTION.count`, `MOTION.pull` : tous définis en T1.
