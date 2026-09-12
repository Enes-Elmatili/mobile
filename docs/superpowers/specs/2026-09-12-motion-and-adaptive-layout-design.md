# Mouvement et disposition adaptative — iPhone, iPhone Duo, pliables

**Date** : 12/09/2026 · **Statut** : validé en brainstorming (prototype : artifact « FIXED en mouvement », 21 moments)

## 1. Thèse

Une seule expérience FIXED, dont le Duo et les pliables sont la version dépliée.

- **La physique est une.** Tout mouvement vient de `lib/motion` : ressorts dont le damping est dérivé de ζ, jamais écrit en dur ; haptique sur la frame du visuel ; reduce-motion respecté.
- **La disposition est un choix par écran, pas une version par appareil.** Un écran lit sa *classe de disposition* (`compact` ou `regular`) et arrange les *mêmes* composants en une ou deux colonnes. Aucun fichier « Duo ».
- **Chaque animation dit quelque chose** : où est allée l'information, ce qui vient de changer, ce qui attend. Rien ne joue en boucle sans raison. Pas de confettis, pas de parallax, pas de logo animé au-delà d'un fondu.

## 2. Périmètre

### Train 1 — tous les appareils (iPhone, Android, pliables, Duo fermé)
Les 17 moments universels + la fondation « dimensions réactives ». Aucune dépendance au SDK iOS 27.1. Cible : release 1.1.

### Train 2 — écran déplié (Duo ouvert, Fold ouvert, iPad-like)
Les 4 moments Duo + le conteneur deux volets sur 5 écrans. Dépend d'EAS + Xcode 27.1 pour le rendu bord à bord natif sur Duo (fin octobre). Sur les pliables Android, fonctionne dès le train 1 côté layout.

### Hors périmètre (v2)
Poses « à moitié ouvert » (angle d'ouverture : API iOS 27.1 non exposée par Expo, pont natif Swift). Orientation paysage sur écrans compacts (reste verrouillée portrait). Split View multi-fenêtres.

## 3. Plateformes — faits qui contraignent la conception

| | Écran | Points | Size classes | Notes |
|---|---|---|---|---|
| iPhone classique | — | 375–440 × 812–956 | compact / regular | Portrait verrouillé (inchangé) |
| iPhone Duo fermé | externe 5,4" | 466 × 678 | compact / regular | Un iPhone |
| iPhone Duo ouvert | interne 7,6" | 669 × 951 (ratio 1,42) | **regular / regular** | Orientation naturelle paysage 951 × 669 ; insets asymétriques (Dynamic Island latérale, barre système, pli via `reservedRegions`) ; **ignore les orientations supportées** sauf `UIRequiresFullScreen` |
| Galaxy Z Fold / Pixel Fold | interne | ≈ 780 × 820–900 dp | — | `configChanges` déjà posé (pas de restart) ; `Dimensions` change à chaud |
| Galaxy Z Flip | externe | petit, ≈ 3,4" | — | L'app n'y tourne pas (cover apps Samsung uniquement) |

Décisions :
- **Train 1** : `ios.requireFullScreen: true` dans `app.json`. Sur Duo ouvert, l'app reste en portrait et est **mise à l'échelle** proprement (comme une app iPhone sur iPad). Zéro écran cassé le 23 octobre.
- **Train 2** : `requireFullScreen` retiré, build SDK 27.1, `SplitPane` gère 951 × 669. Portrait reste verrouillé sur les écrans compacts via `UISupportedInterfaceOrientations` (l'écran interne du Duo l'ignore de toute façon).
- Android : rien à changer dans le manifeste ; `resizeableActivity` par défaut true.

## 4. Architecture

### 4.1 `lib/motion/` — la physique (extension de l'existant)

Existant : `sheet.ts` (`dampingFor`, `SHEET_SPRING` ζ 1,0 k 200, `SHEET_SPRING_MOMENTUM` ζ 0,85, `useReduceMotion`, `useSheetMotion`), `press.ts` (`usePressScale`, k 900 / 500).

Ajouts, tous construits sur `dampingFor` et `useReduceMotion` :

| Fichier | Export | Rôle | Paramètres |
|---|---|---|---|
| `springs.ts` | `spring(k, ζ)` → `{damping, stiffness, mass}` ; presets `MOTION.unfold` (180, 1), `MOTION.pane` (240, 1), `MOTION.recenter` (220, 1), `MOTION.take` (400, 0,85), `MOTION.count` (120, 1), `MOTION.breathe` (300, 0,9), `MOTION.trace` (200, 1), `MOTION.land` (320, 0,8), `MOTION.tab` (260, 1), `MOTION.island` (220, 0,9), `MOTION.pull` (300, 0,8) | Une table, une source | tous dérivés |
| `useCountingValue.ts` | `useCountingValue(target, preset=count)` → `SharedValue<number>` + `useAnimatedProps` pour `TextInput` (Reanimated `ReText`) | Montants, totaux, ETA | arrondi à l'affichage seulement ; `tabular-nums` |
| `useBreathe.ts` | `useBreathe()` → `{style, pulse()}` | Respiration 1,03 → 1 à la réception d'une valeur | preset breathe |
| `useTraceStroke.ts` | `useTraceStroke(progress)` → `animatedProps` pour `strokeDashoffset` (`react-native-svg` `pathLength=1`) | Coche paiement, sceau devis, itinéraire | preset trace |
| `useCascade.ts` | `useCascade(count, {step=40, dx?, dy?})` → tableau de styles | Lignes de devis, squelettes → contenu, entrée des volets | translate + opacité, preset pane |
| `useSlideToConfirm.ts` | `useSlideToConfirm({onConfirm, trackWidth})` → `{gesture, knobStyle, fillStyle, labelStyle, reset}` | Accepter une mission | rubber-band 3,5 hors piste, projection `x + v·0,2 s ≥ 0,9·track` → confirme ; haptique light à 50 %, success au déclenchement |
| `useTakeScale.ts` | `useTakeScale(selected)` | Point de carte, étoile finale, icône d'onglet | preset take (ζ 0,85) / tab-icon (500, 0,9) |
| `useDigitReel.ts` | `useDigitReel(value)` | ETA en rouleau, un chiffre à la fois | k 200, ζ 1 ; changement de nombre de chiffres = rebuild sans animation |
| `useRubberPull.ts` | `useRubberPull({threshold=64, onRefresh})` | Pull-to-refresh « fixed. » | résistance 3,5, retour preset pull, haptique light au seuil |
| `usePresence.ts` | `usePresence(visible, {from: 'left' \| 'hinge' \| 'bottom' \| 'island'})` | Entrée/sortie avec origine | preset pane ; `from` choisi par la classe de disposition |
| `haptics.ts` | `hapticOnFrame(kind)` : programme l'haptique via `runOnJS` depuis le worklet, une seule fois par événement | Règle 6 | — |

Reduce-motion : chaque hook lit `useReduceMotion()` et remplace translation/scale par un cross-fade 200 ms (opacité seule). Les compteurs sautent à la valeur. Les traits se dessinent en 0 ms.

### 4.2 `lib/layout/` — la disposition (nouveau)

| Fichier | Export | Rôle |
|---|---|---|
| `useLayoutClass.ts` | `useLayoutClass()` → `{ width, height, cls: 'compact' \| 'regular', isLandscape, insets }` | Seule source de vérité. `regular` ⇔ `width ≥ 600` **et** `height ≥ 480`. Basé sur `useWindowDimensions` + `useSafeAreaInsets` ; recalculé à chaque changement (pliage, Split View). `resolveLayoutClass(w, h)` est une fonction pure testée. |
| `SplitPane.tsx` | `<SplitPane master detail ratio=0.42 origin="hinge" />` | Deux volets sur `regular`, une colonne (master seul, detail en route) sur `compact`. Volet droit monté avec `usePresence(from:'hinge')`. Séparateur = ligne 1 px à `ratio`, jamais sous le pli (le pli est à 50 % : ratio 0,42 garde la charnière dans le volet droit, dans une gouttière de 24 pt). |
| `AdaptiveScroll.tsx` | `<AdaptiveScroll maxWidth=560>` | Sur `regular`, limite la largeur de lecture des formulaires et les centre. |
| `insets.ts` | `useAsymmetricInsets()` | Expose `left`/`right` séparément ; interdit `paddingHorizontal: insets.left`. Lint : règle ESLint custom `no-symmetric-insets`. |

Règle : **plus aucun `Dimensions.get`** dans `app/` et `components/` (règle ESLint `no-restricted-syntax` sur `Dimensions.get`). Les 18 usages passent par `useLayoutClass()` ; les `maxDynamicContentSize` des sheets par `height * ratio` réactif.

### 4.3 Continuité d'état (règle « rien ne se recharge »)

L'état d'un écran vit dans un store (zustand, déjà utilisé par le feedback) ou dans les params de route, **jamais** dans un `useState` local qui mourrait si le composant se remontait au changement de classe. `SplitPane` ne démonte pas le master quand la classe change : il **re-parente** le détail (même clé React). Le brouillon de message, la position de scroll (`useScrollPosition` persisté par route) et la sélection survivent au pliage.

## 5. Les moments — spécification

Colonne « compact » = iPhone classique / Duo fermé ; « regular » = déplié.

| # | Moment | Écran(s) | Hook | compact | regular | Haptique |
|---|---|---|---|---|---|---|
| 1 | Recherche qui respire | `components/searching/LiveMapSearching.tsx` | anneaux : `withRepeat` remplacé par un cycle à période `1,6 s → 2,8 s` sur 90 s (worklet, `useFrameCallback`) | plein écran | volet gauche (carte) | — |
| 2 | Atterrissage + itinéraire | `LiveMapSearching.tsx`, `app/request/[id]/missionview.tsx` | `useTakeScale` (preset land) + `useTraceStroke` sur la polyline | idem | idem | success à l'impact |
| 3 | ETA en rouleau | `missionview.tsx`, `ongoing.tsx` | `useDigitReel` | — | — | — |
| 4 | Ouvrir / fermer s'élargit | `SplitPane` | `usePresence(from:'hinge')` + largeur master sur `MOTION.unfold` | n/a | **Train 2** | — |
| 5 | Liste ↔ carte | `app/(tabs)/missions.tsx` (opportunités), `app/explore.tsx` | recentrage carte sur `MOTION.recenter` (animateCamera piloté par shared value), `useTakeScale` sur le marqueur, `usePressScale` sur la ligne | sheet gorhom **configuré** (`animationConfigs=SHEET_SPRING`, `overDragResistanceFactor=3.5`) sur la carte | `SplitPane` carte / liste (ratio 0,56) | selection à l'appui |
| 6 | Glisser pour accepter | `missions.tsx` (`onAccept`), `components/sheets/MissionRequestSheet.tsx` | `useSlideToConfirm` | remplace le bouton Accepter | idem, dans le volet droit | light 50 %, success |
| 7 | Passage en ligne | `app/(tabs)/provider-dashboard.tsx` (switch, l. ~658) | interpolation de couleur de bordure (`interpolateColor`) sur k 200 ; halo `useTakeScale` ; libellé changé au `onSettle` ; hors ligne k 600 | — | — | selection (mise en ligne seulement) |
| 8 | Lignes de devis | `app/request/[id]/send-quote.tsx` (**remplace `Animated.spring` legacy l. ~90**), `quote-review.tsx`, `components/sheets/QuoteSheet.tsx` | `useCascade` + `useCountingValue` | une colonne | `SplitPane` problème / devis (0,42) | — |
| 9 | Sceau / pli | `quote-review.tsx` | `useTraceStroke` (coche) + `interpolateColor` ambre → vert ; refus `rotateX −12°` + translateY | — | — | success / light |
| 10 | Prix qui bouge | `app/request/NewRequestStepper.tsx` (bloc MONTANT) | `useCountingValue` + `useBreathe` + delta `usePresence(from:'bottom')` 1 200 ms | pied de page étape 4 (inchangé visuellement) | volet droit récap vivant à toutes les étapes | — |
| 11 | Coche + reçu | `app/request/[id]/resume-payment.tsx`, `/payments/success` (NewRequestStepper) | anneau k 60 → `useTraceStroke` → `useBreathe` → reçu `usePresence(from:'bottom')` | — | — | success sur la coche, unique |
| 12 | Remboursement | `missionview.tsx` (statut remboursé), `wallet.tsx` | `useCountingValue` k 90 vers 0 | — | — | — |
| 13 | Photos déposées + balayage | `app/request/[id]/ongoing.tsx` (before/after) | `useTakeScale` (1,1 → 1) ; balayage `clip` piloté par shared value, geste pan réversible | — | — | light au dépôt |
| 14 | Étoiles en vague | `app/request/[id]/rating.tsx` | `useTakeScale` par étoile, décalage 25 ms, ζ 0,7 sur la dernière | — | — | light/étoile, selection dernière |
| 15 | Onglets | `app/(tabs)/_layout.tsx` (`tabBar` custom) | indicateur `MOTION.tab`, icône (500, 0,9) ; contenu cross-fade 120 ms | — | barre d'onglets → **sidebar** sur regular (Apple : tab bar devient sidebar en regular) | — |
| 16 | Toast depuis l'île | `components/feedback/Toast.tsx` | `usePresence(from:'island')` : largeur sur `MOTION.island`, texte +120 ms, retrait k 300 | ancré haut | ancré à l'écran actif (haut du volet où est le focus) | déjà géré par `feedback.*` |
| 17 | Pull-to-refresh | 10 écrans avec `RefreshControl` → composant `components/ui/BrandRefresh.tsx` | `useRubberPull` | — | — | light au seuil |
| 18 | Squelettes | nouveau `components/ui/Skeleton.tsx` ; `dashboard.tsx`, `missions.tsx`, `documents.tsx`, `wallet.tsx` | respiration opacité 0,4 ↔ 0,7 / 1,2 s ; contenu `useCascade(step 50)` dans la même géométrie | — | — | — |
| 19 | Charnière comme origine | `SplitPane`, `usePresence` | `from` = `'left'` pour le master, `'hinge'` pour le détail | n/a | **Train 2** | — |
| 20 | Fermer : la bulle se range | `missionview.tsx` (chat) → carte de mission | `usePresence` + transition vers la cible (mesure `measure()` worklet), `useBreathe` sur la cible | n/a | **Train 2** | — |
| 21 | Appui | déjà `usePressScale` — généralisation : `components/ui/RaisedButton.tsx`, `Card.tsx` | — | — | — | light |

Interdit dans le cadre de ce chantier : `Animated` legacy (2 restes : `send-quote.tsx`, `LiveMapSearching.tsx` partiel), `setTimeout` pour séquencer une animation (utiliser `withDelay`/`onSettle`), `Alert.alert`.

## 6. Gestion des erreurs et des cas limites

- **Changement de classe pendant une animation** : les shared values sont conservées (elles vivent dans les hooks, pas dans le layout) ; `SplitPane` re-parente sans démonter ; l'animation en cours continue vers sa cible dans la nouvelle géométrie.
- **Clavier** : sur `regular`, le clavier ne recouvre jamais la carte ni le total — `KeyboardAvoidingView` n'est appliqué qu'au volet qui a le focus.
- **Reduce motion** : cross-fade partout ; les gestes (glisser pour accepter, pull) restent fonctionnels mais sans élastique ni projection (déclenchement au seuil).
- **Performances** : tout en worklets ; `useFrameCallback` uniquement pour la recherche qui respire (une seule instance) ; pas de `setState` par frame. Budget : 60 fps sur iPhone 12, 120 fps sur ProMotion sans jank mesurable (Perf Monitor).
- **Duo sans SDK 27.1** (train 1) : `requireFullScreen` → mise à l'échelle système ; les dimensions rapportées sont celles du canvas iPhone, `cls` reste `compact`. Rien à gérer.

## 7. Tests

- Unitaires (jest, purs) : `resolveLayoutClass`, `dampingFor` par preset (verrouille ζ), projection de `useSlideToConfirm` (fonction pure `shouldConfirm(x, v, track)`), rubber-band, `useDigitReel` (découpage en chiffres), formats de `useCountingValue`.
- Composants (`@testing-library/react-native`) : `SplitPane` rend master seul en compact, master + détail en regular, conserve la clé du détail au changement de classe.
- Lint : `no-restricted-syntax` sur `Dimensions.get`, sur `Animated` legacy, sur `Alert.alert` ; règle `no-symmetric-insets`.
- Manuel, par release : iPhone SE (petit), iPhone 15 Pro (Dynamic Island), simulateur iPad 11" (regular, remplace le Duo tant que Xcode 27.1 n'est pas sur EAS), simulateur Duo (Xcode 27.1 : ouvrir/fermer/pivoter), émulateur Android « Foldable » 7,6" + Fold externe ; Reduce Motion on/off ; ralenti ×4 via le réglage développeur pour vérifier les décélérations.

## 8. Ordre de livraison

1. **Fondation** (train 1) : `lib/layout`, purge `Dimensions.get`, `requireFullScreen`, lint, presets `springs.ts`. Sans ça, rien d'autre ne tient.
2. **Trouver un prestataire** (moments 1-3) — le plus anxiogène, le plus visible.
3. **Devis et prix** (8-10) — le plus utile aux prestataires, le plus lié au chiffre d'affaires.
4. **S'engager** (6-7), **Payer et clôturer** (11-14), **Naviguer** (15-18, 21).
5. **Train 2** : `SplitPane` sur missions/opportunités, devis, mission en cours, conversations, stepper ; moments 4, 19, 20 ; build SDK 27.1.

Chaque étape est livrable seule et laisse l'app dans un état cohérent.
