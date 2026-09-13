# Mouvement — Plan 5 : sortie d'`Animated` legacy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**État : livré le 13/09/2026 sur `feat/motion-foundation` (4 lots, 27 fichiers, 261 appels legacy).** Vérifié à chaque lot : jest 161/161, eslint 0 erreur, tsc OK. `LEGACY_ANIMATED_ALLOWLIST` est supprimée d'`eslint.config.js` : la règle `NO_LEGACY_ANIMATED` s'applique partout. Reste : la vérification visuelle (Tâche 6) et les 3 `Alert.alert` de `lib/` (hors périmètre, allowlist conservée).

**Goal:** Plus une ligne d'`Animated` de react-native dans `app/`, `components/`, `lib/` (règle 1 de la charte). Chaque animation migrée repart de sa valeur courante, respecte reduce-motion et s'exprime avec les presets de `lib/motion` — pas une transcription mécanique timing pour timing.

**Architecture:** Deux nouveaux hooks factorisent ce qui était copié d'écran en écran. `useEntrance(distance, preset)` (fondu + glissé sur `MOTION.pane`, `fade` pour les blocs secondaires, `replay()` pour les formulaires à phases) remplace huit `Animated.parallel([timing(fade), timing(slide)])`. `useLoops` regroupe `usePulse`, `useGlow`, `useBlink` et `useShake` (impulsion sur ressort sous-amorti ζ = 0,18 plutôt que cinq keyframes). Les pressions passent par `usePressScale` (retour à l'appui, règle 4) et non plus par une séquence jouée au relâchement.

**Tech Stack:** Reanimated 4.1 (`withRepeat`, `withSequence`, `withDelay`, `interpolateColor`, `runOnJS`), `lib/motion` (springs, press, sheet, useBreathe).

**Spec:** § 2 (doctrine), § 5 (lint) du document de design du 12/09.

---

### Tâche 1 : `useEntrance` + lot 1 (12 petits fichiers) — livrée `da75d71`
stripe, OfflineBanner (SHEET_SPRING), XSpinner, PulseDot, complete-profile, forgot-password, reset-password, welcome, ongoing (ActionCard), scheduled (`spring(220, 0.7)` puis fondu), AuthCTA (flèche en `withRepeat`), ProviderMissionCard (entrée `MOTION.pane`, barre de temps en `interpolateColor`).

### Tâche 2 : lot 2 (9 fichiers) — livrée `4a4124c`
login, signup (`entrance.replay()` par phase), role-select (`usePressScale` + point radio sur `MOTION.take`), call/active (onde), support (`StepLine` sur `spring(140, 1)`), rating (puces à l'appui, `entrance.fade`), OnboardingLayout (halo), earnings (`land` → `take` + `pane`), IncomingCallOverlay (`MOTION.island`).

### Tâche 3 : `useLoops` + lot 3 (4 écrans) — livrée `cd06ef2`
verify-email (`useShake`, `usePulse`, `useBlink`), pending et quote-pending (`useGlow`, `usePulse`, coche `MOTION.land`), missions (feuille de confirmation sur `SHEET_SPRING`, carte d'opportunité `useBreathe(0.97)`, indicateur d'onglets `MOTION.tab`). OnboardingLayout rebranché sur `useGlow`.

### Tâche 4 : lot 4 — NewRequestStepper et SplashAnimation — livrée
- NewRequestStepper : `StepSegment` (une progression, segments qui se remplissent l'un après l'autre), CategoryCard / sous-catégorie / TimeSlot en `usePressScale`, DayChip sur `MOTION.tab`, CTA (échelle + voile 12 %), `BrandSheen` en `withRepeat`, transition d'étape en `withSequence`.
- SplashAnimation : même chorégraphie (3 scènes, 5,8 s, mêmes easings et délais), sur le thread UI ; `RiseSlice` par tranche ; la fin de la respiration du point pilote le retrait via `runOnJS`. Reduce-motion : état final direct, comme avant.

### Tâche 5 : lint — livrée
`LEGACY_ANIMATED_ALLOWLIST` supprimée ; `NO_LEGACY_ANIMATED` dans tous les blocs. `LEGACY_ALERT_ALLOWLIST` (api.ts, CallContext) reste, hors périmètre de ce plan.

### Tâche 6 : vérification visuelle (manuelle)
- [ ] Splash : les trois scènes, tap pour passer, Reduce Motion → état final puis retrait à 1,1 s.
- [ ] verify-email : code faux → secousse ; curseur qui clignote ; point qui pulse jusqu'à validation.
- [ ] NewRequestStepper : segments qui se remplissent au pas suivant et se vident au retour ; reflet du CTA ; cartes qui répondent à l'appui.
- [ ] missions : feuille de confirmation, onglets, acceptation d'une opportunité.
- [ ] Appel entrant (deux comptes) : carte qui descend, avatar qui pulse, retrait au refus.

### Reste après ce plan
Moments 4 et 20 sur Duo réel (SDK 27.1) ; retrait de `requireFullScreen` ; moment 12 quand une UI de remboursement existera ; les 3 `Alert.alert` de `lib/`.
