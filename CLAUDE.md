# FIXED — application mobile

Mise en relation instantanée entre clients et prestataires (plomberie,
serrurerie, ménage…) à Bruxelles, façon Uber. Expo SDK 58 (React Native 0.88,
React 19), Expo Router, Reanimated 4, Socket.io, Stripe. Le backend (Node.js,
Socket.io) n'est pas dans ce dépôt.

## Commandes

- `npm run check` — lint + TypeScript + jest, les mêmes contrôles que la CI. À lancer avant tout push.
- `npm run lint` (`eslint .`, tout le projet), `npm run typecheck`, `npx jest`.
- `npm run release -- --platform ios` — version suivante, commit sur `main`, build EAS de production et envoi TestFlight (aussi : workflow GitHub **Release**).
- Tests de bout en bout : `.maestro/` (voir son README) ; workflow **E2E**.

## Charte

- Monochrome strict : fond blanc pour le client, sombre pour le prestataire.
- Icônes : contour au repos, plein pour l'état actif.
- Détails, factures, missions : en bottom sheet plutôt qu'en nouvel écran.
- Aérer : pas de bordures inutiles, des marges généreuses ; transitions plutôt qu'alertes.

## Interfaces fluides — les 8 règles du mouvement

Tout mouvement passe par `lib/motion` (ressorts dérivés de ζ, jamais de durée écrite en dur).

1. Une animation repart de sa **position courante**, jamais d'une valeur de départ fixe.
2. **Ressorts, pas de durées** ; amortissement critique par défaut (ça se pose, ça ne rebondit pas).
3. Après un geste, le point d'arrivée est **projeté depuis la vitesse** du doigt.
4. Le retour tactile part **à l'appui** (`usePressScale`), jamais au relâchement.
5. **Élastique aux bords**, jamais d'arrêt sec.
6. L'**haptique tombe sur la frame du visuel**, une seule fois (`feedback.haptic`, jamais `expo-haptics` en direct).
7. **Zéro alerte système** : `feedback.*` (`lib/feedback`), jamais `Alert.alert`.
8. **Réduire les animations** respecté : fondu ou état final posé, rien ne court.

Pas d'`Animated` de react-native (Reanimated uniquement). Le lint fait respecter 1, 6, 7 et cette interdiction.

## Disposition (iPhone, iPhone Duo, pliables)

- Une classe de disposition par écran (`useLayoutClass` : compact / regular), jamais un fichier « Duo ». Jamais `Dimensions.get` (interdit par le lint).
- Deux volets : `SplitPane` (`lib/layout`) ; au pliage, rien ne se démonte ni ne se recharge.
- Insets gauche et droit différents sur un écran déplié : `horizontalPadding(insets, base)`, jamais `paddingHorizontal: insets.left`.
- Charnière iOS 27.1 / Android : `modules/fixed-hinge` (module natif local) + `lib/layout/hinge` (optionnel : sans le module, rien ne change). Posture et pli pour la disposition, l'angle pour les effets seulement.

## Règles du code

- **`lib/SocketContext.tsx` ne se modifie pas sans validation explicite du propriétaire.** Il est couvert par `__tests__/socketContext.test.js` : y ajouter le test d'abord.
- Rappels temps réel : ne jamais figer une socket dans un `useCallback`/`useEffect` à dépendances vides — lire la valeur courante via une ref (bug GPS corrigé dans `useCockpitGeo`).
- Erreurs : un échec serveur qui change ce que voit l'utilisateur → `reportError(e, 'contexte')` (Sentry en production). `.catch(() => {})` seulement pour le cosmétique ou le local. Règle détaillée en tête de `lib/logger.ts`.
- Argent : les montants gardent leur unité (centimes vs euros, voir `lib/types/`) ; formatage via `lib/format` (`formatEUR`, `formatEURCents`), jamais `toFixed`.
- Types : le contrat serveur vit dans `lib/types/` ; `api.get<T>(…)` sans T rend `unknown`. Pas de nouveau `any`.
- Logique pure (prix, payloads, stades, dates) extraite dans `lib/**` et testée ; les écrans assemblent.
- Langues fr / nl / en / pl : tout texte et tout `accessibilityLabel` passe par `t()` (un test interdit les libellés en dur). Formats de date : `localeFor` (`lib/format`).
- E2E : les éléments visés par Maestro portent un `testID` (`dashboard-order`, `stepper-*`, `mission-<stade>`…) — ne pas les renommer sans mettre à jour `.maestro/`.
- Worklets : `__tests__/workletClosure.test.js` vérifie tout le code ; garder les directives `'worklet'` en déplaçant du code.

## Pièges connus

- Build iOS : Xcode 27.1 requis (symboles `UIHinge` de `modules/fixed-hinge`). Si l'image EAS ne l'a pas, retirer ce dossier pour la version : l'app fonctionne sans.
- Clés : `preview` / `production` portent la clé Stripe **live** ; les tests E2E passent par le profil EAS `e2e` (environnement de test). Restreindre les clés Google : `docs/securite-cles.md`.
- Revue Apple : comptes de démo et contournement du paiement dans `docs/APP_STORE_REVIEW_NOTES.md`.
- Expo Go ne suffit pas (modules natifs) : build de développement EAS.

## Compétences

`.claude/skills/` : Clean Code, Refactoring, Release It! (voir son README). Ces règles maison priment sur elles.
