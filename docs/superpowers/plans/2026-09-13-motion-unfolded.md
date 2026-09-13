# Mouvement — Plan 4 : l'écran déplié (train 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire de FIXED une app à deux volets quand l'écran le permet (Duo ouvert, Fold ouvert, iPad) sans une ligne de code « par appareil » : primitives de disposition, tab bar qui devient sidebar, missions en liste/détail, pull « fixed. » partout, insets asymétriques — et préparer le passage au SDK iOS 27.1.

**Architecture:** `lib/layout` décide (classe compact/regular via `useLayoutClass`), `lib/motion` anime (le volet droit entre depuis la charnière). `SplitPane` re-parente le détail sans le démonter : au pliage, l'état, le scroll et le brouillon survivent (spec § 4.3). La tab bar custom (`FixedTabBar`) rend une barre en bas ou une sidebar à gauche selon la classe ; les écrans compensent via `useTabBarPadding()` et `contentStyle.paddingLeft`.

**Tech Stack:** identique + `@react-navigation/bottom-tabs` (types `BottomTabBarProps`, fourni par expo-router).

**Spec:** § 3 (plateformes), § 4.2, § 4.3, moments 4, 15 (indicateur), 17 (8 écrans), 19, 20.

**Ce qui attend le SDK 27.1 (EAS + Xcode 27.1, fin octobre) :** retirer `ios.requireFullScreen` d'`app.json`, recompiler, vérifier dans le simulateur Duo (ouvrir / fermer / pivoter). Tout le reste se teste dès maintenant sur simulateur iPad 11" et émulateur Android « Foldable ».

---

### Tâche 1 : primitives `lib/layout` — livrée
`SplitPane` (+ `useSplitPane`, `HINGE_GUTTER`), `AdaptiveScroll` (560 pt), `useAsymmetricInsets` / `horizontalPadding`, barrel. Commit `be8fa6c`.

### Tâche 2 : moment 17 — les 8 écrans restants en pull « fixed. » — livrée
notifications, factures (SectionList animée à la main), messages, prestataires, demandes, profil, documents, opportunités. Commit `be8fa6c`.

### Tâche 3 : `FixedTabBar` branchée (moment 15 : indicateur qui glisse ; sidebar sur regular)
- `app/(tabs)/_layout.tsx` : `tabBar={renderTabBar}` (`useCallback`, `<FixedTabBar {...props} />`), `contentStyle.paddingLeft = isRegular ? SIDEBAR_WIDTH : 0`, `useTabBarPadding()` renvoie `extra` seul sur regular (plus de barre en bas). `TAB_BAR_HEIGHT` ré-exporté depuis `FixedTabBar` pour ne pas casser les imports existants.
- Vérifier : 5 onglets client/presta, `href: null` toujours caché, indicateur sous l'onglet actif, haptique `selection` au changement.

### Tâche 4 : missions en liste / détail (moment 19 en pratique)
- `MissionDetail` et `OpportunityDetail` acceptent `inPane` : `ScrollView` au lieu de `BottomSheetScrollView` (hors contexte gorhom).
- `Missions` : `const isSplit = useSplitPane()` ; le contenu est le `master` d'un `SplitPane` ; `detail` = le même détail que le sheet, rendu dans le volet droit ; le `BottomSheet` ne s'ouvre que sur compact (`!isSplit`). Accepter / refuser / terminer ferment le détail (`setDetailSheetOpen(false)`) dans les deux dispositions.
- Placeholder du volet droit : « Sélectionnez une mission » en mono, centré.

### Tâche 5 : `no-symmetric-insets` (lint)
Règle `no-restricted-syntax` : `Property[key.name='paddingHorizontal'] > MemberExpression[object.name='insets'][property.name=/^(left|right)$/]` → « Insets gauche et droit diffèrent sur un écran déplié : utiliser horizontalPadding(insets, base) ». Corriger les occurrences existantes.

### Tâche 6 : formulaires en largeur de lecture
`AdaptiveScroll` sur : complete-profile, onboarding/company, onboarding/documents, send-quote, quote-review. Aucun changement visuel sur compact.

### Tâche 7 : vérification
jest, eslint 0 erreur, tsc ; simulateur iPad 11" (regular) : sidebar, missions en deux volets, largeur de lecture ; iPhone : strictement inchangé ; émulateur Foldable : plier pendant une sélection, le détail reste.

### Reste après ce plan (plan 5)
Moments 4 et 20 (continuité à l'ouverture, bulle qui se range) — ils demandent le SDK 27.1 pour être vus sur Duo ; sur Fold ils découlent de `SplitPane`. Migration des 27 fichiers `Animated` legacy restants. Moment 12 quand une UI de remboursement existera.
