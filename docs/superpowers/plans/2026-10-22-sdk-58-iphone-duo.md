# Expo SDK 58 + iPhone Duo — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Passer l'app mobile de SDK 54 / RN 0.81 à SDK 58 / RN 0.88 (build Xcode 27.1, SDK iOS 27.1) et la rendre correcte sur l'iPhone Duo, plié comme déplié.

**Architecture:** Une seule branche `feat/sdk-58`. Phase A : montée de version mécanique, avec le moins de code touché possible (les API dépréciées mais encore présentes restent en place). Phase B : audit Duo au simulateur, puis correctifs un par un. Les écrans à deux volets du « train 2 » feront l'objet d'un plan séparé, écrit après l'audit.

**Tech Stack:** Expo SDK 58.0.17, React Native 0.88.0, React 19.3.0, Reanimated 4.7.1 / Worklets 0.13.0, Gesture Handler 3.3, expo-router 58, EAS image `sdk-58` (= `macos-tahoe-26.6-xcode-27.1`).

---

## État d'avancement — 22/10/2026 (branche `feat/sdk-58`)

| Tâche | Statut | Commit |
|---|---|---|
| A1 Dépendances | ✅ expo-doctor 20/20 | `0081bba` |
| A2 Tests | ✅ 39 suites / 845 tests | `3b7716a` |
| A3 expo-audio | ✅ | `9b37871` |
| A4 Types onglets | ✅ | `263d7c7` |
| A5 Natif (prebuild) | ✅ SceneDelegate, manifeste de scènes, R8 | `82eb19a` |
| A6 tsc / lint | ✅ 0 / 0 | `bbfeb89`, `419cb6f` |
| B0 SplitPane (défaut trouvé à l'audit) | ✅ plus de remontage au pliage | `8ca42c8` |
| B1 Duo plié en paysage | ✅ | `fd05896` |
| A7 Recette appareil | ⏳ à toi : backend arrêté | — |
| A8 Paiements réels | ⛔ feu vert + TestFlight | — |
| A9 Publication | ⏳ après A7, A8 et B3 | — |
| B2, B3 Simulateur Duo | ⏳ Xcode 27.1 à installer | — |
| B4 App Store Connect | ⏳ après B3 | — |

**Écarts par rapport au plan, découverts pendant l'exécution :**
- `npx expo install --check` réclamait aussi **jest 30, @types/jest 30 et TypeScript 6.0**. Il a fallu ajouter `@react-native/jest-preset`, désormais séparé de react-native, et `expo-asset`, peer d'expo-audio.
- Après la montée, `@expo/config-plugins` n'était plus remonté à la racine de `node_modules` : `npm dedupe` a corrigé. Les plugins maison importent désormais `expo/config-plugins`.
- **Trois défauts d'exécution que tsc et Jest ne voyaient pas, corrigés :**
  - **appui sur un onglet** qui plantait : expo-router 58 passe `emitter` et `navigateToTab` à la tab bar, plus `navigation` ;
  - **`StyleSheet.absoluteFillObject`** retiré de RN 0.88, à l'exécution aussi : 14 occurrences ;
  - **`showsPointsOfInterest`** renommé `showsPointsOfInterests` dans react-native-maps 1.29 : sans renommage, les points d'intérêt seraient revenus sur toutes les cartes.
- **Garde `workletClosure` : elle passait à vide** avec le nouveau format de Worklets 0.13. Elle est adaptée, échoue désormais sur un format inconnu, et sa détection a été prouvée avec un worklet fautif temporaire.
- eslint-config-expo 58 active les **règles du React Compiler**, soit 141 erreurs, sans impact à l'exécution puisque le compilateur n'est pas activé. Elles sont mises en pause dans `eslint.config.js`, avec leur inventaire, et sont à écouler dans un chantier dédié.
- Les 5 `tabBarIcon` du layout des onglets étaient du code mort : `FixedTabBar` dessine ses propres icônes. Ils sont retirés.

---

## Ce que le SDK 58 change pour nous (vérifié le 22/10/2026)

Sources : [changelog SDK 58](https://expo.dev/changelog/sdk-58), [migration router 57→58](https://docs.expo.dev/router/migrate/sdk-57-to-58/), [Apple — iPhone Duo](https://developer.apple.com/iphone-duo/prepare/), [images EAS](https://docs.expo.dev/build-reference/infrastructure/). Les API ont été vérifiées directement dans les tarballs npm.

| Sujet | Impact chez nous | Où |
|---|---|---|
| `expo-av` retiré du SDK | 2 fichiers à migrer vers `expo-audio` | Tâche A3 |
| expo-router 58 ne dépend plus de `@react-navigation/*` | 2 imports de type `BottomTabBarProps` ; 4 dépendances à retirer | Tâche A4 |
| expo-router 58 exige `@testing-library/react-native` ≥ 14 ; `renderRouter` devient async | 3 appels dans `__tests__/fixedTabBar.router.test.js` | Tâche A2 |
| `@stripe/stripe-react-native` 0.50 → 0.81 ; nouvelle peer `react-native-webview` | Aucune signature appelée ne change (`initPaymentSheet` : mêmes champs, `paymentMethodOrder` toujours là). **Circuit de paiement : test obligatoire** | A1, A8 |
| `@sentry/react-native` 7 → 8 | `mobileReplayIntegration`, `feedbackIntegration` et `wrap` existent toujours | A1, A6 |
| Gesture Handler 2 → 3 : l'API `Gesture.*` est **dépréciée mais présente** ; gorhom 5.2.14 l'utilise encore | Rien à réécrire maintenant. `ReanimatedSwipeable` existe ; `dragOffsetFromRightEdge`, dont le signe a changé, n'est pas utilisé | Hors périmètre |
| `runOnJS` déprécié (→ `scheduleOnRN`) | 24 appels dans 9 fichiers, qui fonctionnent toujours | Hors périmètre |
| `InteractionManager` retiré | Déjà fait (`lib/idle.ts`) | — |
| Cycle de vie iOS en scènes (SceneDelegate généré au prebuild) | Pas d'`ios/` versionné ni de plugin AppDelegate maison. **Retours d'URL à tester** (Stripe, OAuth, notifications) | A5, A7 |
| `requireFullScreen` **n'empêche plus** le redimensionnement sur iOS 27 | L'app devient redimensionnable dès le premier build SDK 58 : la phase B n'est pas optionnelle | A5, Phase B |
| `isLiquidGlassAvailable()` renvoie `true` avec le SDK iOS 27 | `components/nav/GlassSurface.tsx` passe en vrai verre | A7 |
| R8 activé par défaut (`android.enableMinifyInReleaseBuilds`) | Notre `plugins/withR8.js` pose déjà la même clé ; on le garde pour `shrinkResources` et le fichier `-optimize` | A5 |
| Node ≥ 22.13 | Local : v22.23.2 ✓ | — |

**Comportement Duo selon le SDK (Apple) :**
- Build actuel (Xcode 26) : l'app tourne sur le Duo, centrée à sa taille habituelle, sans adaptation. Rien ne casse le 23/10.
- Build SDK iOS 27.1 : l'app occupe tout l'écran, plié comme déplié, et les barres système passent en rail vertical à gauche ou à droite.

Écran interne déplié : 951 × 669 pt (paysage naturel) → `regular`. Écran externe : 466 × 678 pt → `compact`. Ces cas sont déjà couverts par `lib/__tests__/layoutClass.test.ts`.

---

## Phase 0 — Préalables (bloquants)

### Tâche 0 : prérequis

- [ ] **Étape 1 : backend de prod en ligne.** `curl -s https://api.thefixed.app/api/health` doit renvoyer `200`. Au 22/10, il renvoie `404 Application not found` : Railway a arrêté Postgres et le backend le 12/10. Sans backend, aucun test de bout en bout de la phase A n'est possible.
- [ ] **Étape 2 : Xcode 27.1 en local**, nécessaire pour le simulateur iPhone Duo (Device Hub). macOS 26.6.2 suffit (minimum Tahoe 26.6). Après installation :

```bash
sudo xcode-select -s /Applications/Xcode.app
xcodebuild -version            # attendu : Xcode 27.1
xcrun simctl list devicetypes | grep -i duo   # attendu : une ligne « iPhone Duo »
```

- [ ] **Étape 3 : branche**

```bash
cd /Users/eneselmatili/Desktop/FIXED/mobile
git status --short            # attendu : vide
git checkout -b feat/sdk-58
```

---

## Phase A — SDK 58

### Tâche A1 : montée des dépendances

**Files:** Modify `mobile/package.json`, `mobile/package-lock.json`

⚠️ **Ne jamais lancer `npx expo install --fix`** : il corrompt le lockfile (babel-transformer manquant). On installe les versions exactes du `bundledNativeModules.json` d'expo 58.0.17 avec npm (`legacy-peer-deps` vient de `.npmrc`).

- [ ] **Étape 1 : retirer ce qui sort du SDK ou n'est plus utilisé**

```bash
npm uninstall expo-av @react-navigation/bottom-tabs @react-navigation/elements @react-navigation/native @react-navigation/stack react-test-renderer
```

- [ ] **Étape 2 : dépendances d'exécution**

```bash
npm install expo@~58.0.17 react@19.3.0 react-dom@19.3.0 react-native@0.88.0 \
  react-native-reanimated@4.7.1 react-native-worklets@0.13.0 react-native-gesture-handler@~3.3.0 \
  react-native-screens@~4.30.0 react-native-safe-area-context@~5.10.1 react-native-svg@15.16.0 \
  react-native-maps@1.29.11 react-native-web@~0.21.4 react-native-webview@14.0.1 \
  @react-native-community/netinfo@12.0.1 @react-native-community/slider@5.2.1 \
  @sentry/react-native@~8.28.0 @stripe/stripe-react-native@0.81.0 \
  @gorhom/bottom-sheet@^5.2.14 react-native-webrtc@^155.0.1 @config-plugins/react-native-webrtc@^15.0.2 \
  expo-audio@~58.0.10 expo-apple-authentication@~58.0.2 expo-auth-session@~58.0.14 expo-blur@~58.0.5 \
  expo-camera@~58.0.12 expo-constants@~58.0.13 expo-crypto@~58.0.7 expo-dev-client@~58.0.14 \
  expo-document-picker@~58.0.4 expo-file-system@~58.0.10 expo-font@~58.0.9 expo-glass-effect@~58.0.4 \
  expo-haptics@~58.0.7 expo-image@~58.0.16 expo-image-manipulator@~58.0.15 expo-image-picker@~58.0.10 \
  expo-linear-gradient@~58.0.3 expo-linking@~58.0.14 expo-localization@~58.0.5 expo-location@~58.0.18 \
  expo-notifications@~58.1.6 expo-router@~58.0.25 expo-secure-store@~58.0.2 expo-sharing@~58.0.20 \
  expo-splash-screen@~58.0.11 expo-status-bar@~58.0.4 expo-symbols@~58.0.4 expo-system-ui@~58.0.6 \
  expo-web-browser@~58.0.6
```

- [ ] **Étape 3 : dépendances de dev**

```bash
npm install -D jest-expo@~58.0.12 eslint-config-expo@~58.0.4 @types/react@~19.3.0 \
  @testing-library/react-native@^14.1.0 test-renderer@^1.3.1
```

- [ ] **Étape 4 : vérifier sans rien modifier**

```bash
npx expo install --check      # lecture seule ; attendu : « Dependencies are up to date »
npx expo-doctor@latest        # attendu : aucun échec. Les avertissements sur des paquets hors SDK (country-picker, maps-directions) sont tolérés
ls node_modules/@babel/core node_modules/babel-preset-expo >/dev/null && echo OK   # garde-fou lockfile
```

Si `expo install --check` liste un écart, installer **cette** version exacte avec `npm install <pkg>@<version>`, jamais avec `--fix`.

- [ ] **Étape 5 : commit**

```bash
git add package.json package-lock.json
git commit -m "chore(sdk): Expo SDK 58 — RN 0.88, React 19.3, versions du bundle 58.0.17"
```

### Tâche A2 : tests — Testing Library 14 et `renderRouter` async

**Files:** Modify `mobile/__tests__/fixedTabBar.router.test.js:60,66,72`, `mobile/jest.config.js`

- [ ] **Étape 1 : lancer la suite pour voir l'état de départ**

Run: `npx jest 2>&1 | tail -40`
Attendu : échecs dans `fixedTabBar.router.test.js` (`renderRouter` renvoie une promesse) et dans tout fichier qui importe `useSoundManager`/`IncomingCallOverlay` (`Cannot find module 'expo-av'`, traité en A3).

- [ ] **Étape 2 : rendre `renderRouter` async** (3 occurrences, même modification)

```js
// avant
const r = renderRouter(routes('client'), { initialUrl: '/dashboard' });
// après
const r = await renderRouter(routes('client'), { initialUrl: '/dashboard' });
```

Faire de même pour `routes('provider')` + `/dashboard` (l. 66) et `routes('provider')` + `/provider-dashboard` (l. 72).

- [ ] **Étape 3 : transformer les nouveaux paquets ESM.** Dans `jest.config.js`, ajouter `react-native-worklets|test-renderer` à la liste de `transformIgnorePatterns` :

```js
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@gorhom/.*|react-native-reanimated|react-native-worklets|test-renderer))',
  ],
```

- [ ] **Étape 4 : seulement si une erreur cite `RNGestureHandlerModule`**, ajouter en tête de `jest.setup.js` :

```js
require('react-native-gesture-handler/jestSetup');
```

- [ ] **Étape 5 : relancer**

Run: `npx jest --testPathIgnorePatterns soundManager 2>&1 | tail -15`
Attendu : tout passe, sauf les fichiers qui importent encore `expo-av`.

- [ ] **Étape 6 : commit**

```bash
git add __tests__/fixedTabBar.router.test.js jest.config.js jest.setup.js
git commit -m "test(sdk): Testing Library 14 — renderRouter async, worklets transformés"
```

### Tâche A3 : `expo-av` → `expo-audio`

**Files:**
- Create: `mobile/__tests__/soundManager.test.js`
- Modify: `mobile/hooks/useSoundManager.ts` (fichier entier)
- Modify: `mobile/components/IncomingCallOverlay.tsx:8` et le bloc sonnerie l. 44-75

- [ ] **Étape 1 : écrire le test qui échoue**

```js
// __tests__/soundManager.test.js
// Sons de l'app sur expo-audio (expo-av est retiré du SDK 58) : un lecteur
// préchargé par son, rembobiné avant chaque lecture, libéré au démontage.
jest.mock('expo-audio', () => {
  const players = [];
  return {
    __players: players,
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    createAudioPlayer: jest.fn(() => {
      const p = { play: jest.fn(), seekTo: jest.fn(() => Promise.resolve()), remove: jest.fn(), loop: false };
      players.push(p);
      return p;
    }),
  };
});

const { renderHook, act } = require('@testing-library/react-native');
const audio = require('expo-audio');
const { useSoundManager } = require('../hooks/useSoundManager');

describe('useSoundManager (expo-audio)', () => {
  beforeEach(() => {
    audio.__players.length = 0;
    jest.clearAllMocks();
  });

  it('précharge un lecteur par son, sans jouer', async () => {
    await renderHook(() => useSoundManager());
    expect(audio.createAudioPlayer).toHaveBeenCalledTimes(4);
    audio.__players.forEach((p) => expect(p.play).not.toHaveBeenCalled());
  });

  it('play() rembobine puis joue un seul lecteur', async () => {
    const { result } = await renderHook(() => useSoundManager());
    await act(async () => { await result.current.play('missionAccepted'); });
    const played = audio.__players.filter((p) => p.play.mock.calls.length > 0);
    expect(played).toHaveLength(1);
    expect(played[0].seekTo).toHaveBeenCalledWith(0);
  });

  it('libère les lecteurs au démontage', async () => {
    const { unmount } = await renderHook(() => useSoundManager());
    await act(async () => { unmount(); });
    audio.__players.forEach((p) => expect(p.remove).toHaveBeenCalled());
  });
});
```

- [ ] **Étape 2 : vérifier qu'il échoue**

Run: `npx jest __tests__/soundManager.test.js`
Attendu : FAIL avec « Cannot find module 'expo-av' from 'hooks/useSoundManager.ts' ».

- [ ] **Étape 3 : réécrire `hooks/useSoundManager.ts`**

```ts
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useEffect, useRef, useCallback } from 'react';

export type SoundKey = 'newMission' | 'missionAccepted' | 'paymentReceived' | 'providerFound';

const SOUND_FILES: Record<SoundKey, any> = {
  newMission:      require('../assets/sounds/new-mission.wav'),
  missionAccepted: require('../assets/sounds/mission-accepted.wav'),
  paymentReceived: require('../assets/sounds/payment-received.wav'),
  providerFound:   require('../assets/sounds/provider-found.wav'),
};

// Pas de vraie sonnerie dédiée dans les assets : new-mission.wav est le son
// existant le plus adapté — joué en boucle par IncomingCallOverlay pour les
// appels entrants (accompagné d'une vibration répétée).
export const RINGTONE_SOUND = SOUND_FILES.newMission;

export function useSoundManager() {
  const playersRef = useRef<Partial<Record<SoundKey, AudioPlayer>>>({});

  useEffect(() => {
    // Même intention qu'avec expo-av : silencieux si l'iPhone est en mode
    // silencieux, et on baisse la musique des autres apps sur Android.
    setAudioModeAsync({ playsInSilentMode: false, interruptionModeAndroid: 'duckOthers' }).catch(() => {});
    for (const [key, file] of Object.entries(SOUND_FILES)) {
      playersRef.current[key as SoundKey] = createAudioPlayer(file);
    }

    return () => {
      Object.values(playersRef.current).forEach(p => p?.remove());
      playersRef.current = {};
    };
  }, []);

  const play = useCallback(async (key: SoundKey) => {
    try {
      const player = playersRef.current[key];
      if (player) {
        await player.seekTo(0);
        player.play();
      }
    } catch {
      // Never block UX for a sound failure
    }
  }, []);

  return { play };
}
```

- [ ] **Étape 4 : `components/IncomingCallOverlay.tsx`.** Remplacer l'import ligne 8 :

```ts
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
```

Puis remplacer le bloc sonnerie (de `const ringtoneRef = …` jusqu'à la fin de cet effet) par :

```ts
  const ringtoneRef = useRef<AudioPlayer | null>(null);
  useEffect(() => {
    if (!incoming) return;

    Vibration.vibrate(RING_VIBRATION_PATTERN, true);

    if (useFeedbackPrefs.getState().sound) {
      try {
        // createAudioPlayer est synchrone : plus besoin du drapeau `cancelled`
        // d'expo-av pour un démontage pendant le chargement.
        const player = createAudioPlayer(RINGTONE_SOUND);
        player.loop = true;
        player.play();
        ringtoneRef.current = player;
      } catch {
        // Ne jamais bloquer l'UX pour un échec de son — la vibration suffit.
      }
    }

    return () => {
      Vibration.cancel();
      ringtoneRef.current?.remove();
      ringtoneRef.current = null;
    };
  }, [incoming]);
```

- [ ] **Étape 5 : vérifier que le test passe et qu'`expo-av` a disparu**

```bash
npx jest __tests__/soundManager.test.js     # attendu : 3 passed
grep -rn "expo-av" app components hooks lib contexts stores   # attendu : aucune ligne
```

- [ ] **Étape 6 : commit**

```bash
git add __tests__/soundManager.test.js hooks/useSoundManager.ts components/IncomingCallOverlay.tsx
git commit -m "feat(son): expo-av retiré du SDK 58 — sons et sonnerie sur expo-audio"
```

### Tâche A4 : types de la barre d'onglets sans `@react-navigation`

**Files:** Modify `mobile/app/(tabs)/_layout.tsx`, `mobile/components/ui/FixedTabBar.tsx`

expo-router 58 embarque sa propre copie de bottom-tabs et réexporte `BottomTabBarProps` depuis `expo-router/tabs`, ce qui a été vérifié dans `build/layouts/Tabs.d.ts`.

- [ ] **Étape 1 : dans les deux fichiers**

```ts
// avant
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
// après
import type { BottomTabBarProps } from 'expo-router/tabs';
```

- [ ] **Étape 2 : vérifier**

```bash
grep -rn "@react-navigation" app components lib hooks   # attendu : aucune ligne
npx jest __tests__/fixedTabBar.test.js __tests__/fixedTabBar.router.test.js   # attendu : PASS
```

- [ ] **Étape 3 : commit**

```bash
git add "app/(tabs)/_layout.tsx" components/ui/FixedTabBar.tsx
git commit -m "refactor(onglets): BottomTabBarProps depuis expo-router — plus de dépendance react-navigation"
```

### Tâche A5 : configuration native (scènes iOS, Duo, R8)

**Files:** Modify `mobile/app.json`

- [ ] **Étape 1 : retirer `requireFullScreen`.** Il ne protège plus de rien sur iOS 27 : sa présence ferait croire le contraire. Dans `expo.ios`, supprimer la ligne :

```json
      "requireFullScreen": true,
```

Garder `"orientation": "portrait"` (son effet sur iOS 27 est vérifié en B2).

- [ ] **Étape 2 : prebuild local (lecture du natif généré, jamais édité à la main)**

```bash
npx expo prebuild --clean --no-install
ls ios/*/SceneDelegate.swift                                          # attendu : 1 fichier
/usr/libexec/PlistBuddy -c "Print :UIApplicationSceneManifest" ios/*/Info.plist   # attendu : un dict, pas d'erreur
/usr/libexec/PlistBuddy -c "Print :UILaunchStoryboardName" ios/*/Info.plist       # attendu : SplashScreen (sinon rejet App Store Connect)
/usr/libexec/PlistBuddy -c "Print :UIRequiresFullScreen" ios/*/Info.plist 2>&1    # attendu : « Does Not Exist »
grep -n "proguard-android-optimize" android/app/build.gradle          # attendu : 1 ligne (withR8)
grep -n "enableMinifyInReleaseBuilds\|enableShrinkResourcesInReleaseBuilds" android/gradle.properties   # attendu : true / true
```

- [ ] **Étape 3 : commit** (`ios/` et `android/` sont gitignorés)

```bash
git add app.json
git commit -m "chore(ios): requireFullScreen retiré — sans effet sur iOS 27, l'app devient redimensionnable"
```

### Tâche A6 : vérifications statiques

- [ ] **Étape 1 : types.** Avec la Strict TypeScript API de RN 0.88, les refs prennent des types d'instance (`ViewInstance`…).

Run: `npx tsc --noEmit 2>&1 | tail -30`
Attendu : 0 erreur. Pour chaque erreur de ref (`View` utilisé comme type de ref), remplacer `useRef<View>(null)` par `useRef<React.ComponentRef<typeof View>>(null)`, fichier par fichier, avec un commit par famille d'erreurs.

- [ ] **Étape 2 : lint.** `npm run lint`. Attendu : 0 erreur (il y en avait 0 au 20/09).
- [ ] **Étape 3 : suite complète, garde worklet comprise.** `npx jest`. Attendu : toute la suite passe, `workletClosure.test.js` inclus.
- [ ] **Étape 4 : commit des corrections éventuelles**

```bash
git commit -am "fix(types): Strict TypeScript API de RN 0.88"
```

### Tâche A7 : recette sur simulateur et émulateur

À lancer **dans ton terminal** (pas par l'agent) : `npx expo run:ios -d "iPhone 17 Pro"` et `npx expo run:android`. Le backend de prod doit répondre (Tâche 0).

- [ ] **Connexion :** OTP email, Apple, Google. Le retour d'URL passe désormais par le SceneDelegate.
- [ ] **Deep link à froid et à chaud :** `xcrun simctl openurl booted "fixed://dashboard"`
- [ ] **Notification :** `xcrun simctl push booted app.thefixed.client <fichier.apns>`, puis toucher la notification, app fermée et app ouverte.
- [ ] **NewRequestStepper :** les 4 étapes ; contrôle du code postal 1000–1212.
- [ ] **Sheets gorhom :** glisser, flick, sur-traction élastique. RNGH 3 fait tourner l'API `Gesture.*` en mode déprécié.
- [ ] **Gestes :** SlideToConfirm, lignes balayables (MissionRow, agenda, notifications), BrandRefresh.
- [ ] **Sons :** son de nouvelle mission, sonnerie d'appel entrant en boucle puis arrêt à l'acceptation ou au refus.
- [ ] **Appel in-app :** client ↔ prestataire (WebRTC 124 → 155), deux appareils.
- [ ] **Facture :** téléchargement et partage du PDF (`expo-file-system/legacy`, toujours fourni dans la 58.0.10).
- [ ] **Carte, itinéraire, ETA ; caméra et galerie.**
- [ ] **`GlassSurface` :** le vrai verre Liquid Glass s'affiche maintenant ; à valider à l'œil, en clair et en sombre.
- [ ] **Réduire les animations activé :** fondus à la place des glissements.
- [ ] **Android :** build release local `npx expo run:android --variant release` ; vérifier que les notifications arrivent (R8 et expo-notifications, la seule faille connue des consumer rules).

### Tâche A8 : circuit de paiement — ⛔ feu vert explicite requis

La montée de Stripe 0.50 → 0.81 touche le circuit de paiement, gelé pendant la fenêtre de lancement. Rien ne part en production sans ce test, fait avec toi.

- [ ] Build TestFlight (`eas build -p ios --profile production`, clé `pk_live`, donc des paiements réels).
- [ ] Prix fixe : PaymentSheet par carte.
- [ ] Apple Pay.
- [ ] **Bancontact** : la redirection doit revenir dans l'app (URL rendue par le SceneDelegate).
- [ ] Frais de déplacement 29 € → `QUOTE_PENDING` (webhook `payment_intent.succeeded`).
- [ ] Acceptation d'un devis.
- [ ] Rembourser chaque paiement de test depuis l'admin ou Stripe, puis noter les ID de PaymentIntent ici.

### Tâche A9 : publication

- [ ] `eas.json` : ne pas fixer d'image. `auto` prend `sdk-58` = `macos-tahoe-26.6-xcode-27.1`.
- [ ] iOS : `npm run release`, qui bumpe `expo.version`, vérifie l'App Store, committe, pousse, builde et soumet. Le code de sortie 0 d'`eas submit` ne veut pas dire « accepté » : vérifier dans App Store Connect.
- [ ] Android : `eas build -p android --profile production`, puis la piste interne Play avant la production.
- [ ] Ne publier **qu'après** la phase B : sur le Duo, ce build s'affiche en plein écran, et il doit donc avoir été audité.

---

## Phase B — iPhone Duo

État de départ : `lib/layout` (`useLayoutClass`, `SplitPane`, `AdaptiveScroll`, `useAsymmetricInsets` + lint `no-symmetric-insets`), barre d'onglets qui devient une sidebar à gauche sur `regular`, missions en liste/détail. Seul `app/(tabs)/missions.tsx` utilise `SplitPane`.

### Tâche B1 : verrou du Duo plié en paysage

**Files:** Modify `mobile/lib/__tests__/layoutClass.test.ts`

Le Duo plié et tourné (678 × 466) doit rester `compact` : la hauteur est inférieure à 480. Ce test verrouille un comportement existant ; il passe d'emblée.

- [ ] **Étape 1 : ajouter la ligne au tableau `it.each`**, après `'iPhone Duo fermé'` :

```ts
    ['iPhone Duo fermé, paysage', 678, 466, 'compact'],
```

- [ ] **Étape 2 :** `npx jest lib/__tests__/layoutClass.test.ts`. Attendu : PASS (11 tests : 10 géométries + seuils inclusifs).
- [ ] **Étape 3 :** `git commit -am "test(layout): Duo fermé en paysage reste compact"`

### Tâche B2 : le verrou portrait tient-il sur iOS 27 ?

Une app redimensionnable peut voir son verrou d'orientation ignoré (`ScreenOrientation.lockAsync` « may have no effect », dit Expo).

- [ ] Sur le simulateur iPhone 17 Pro (iOS 27.1) et sur le Duo **plié**, tourner l'appareil (⌘→). Noter si l'app pivote.
- [ ] **Si l'app ne pivote pas :** rien à faire.
- [ ] **Si elle pivote :** chaque écran compact doit tenir en 678 × 466 et 956 × 440. On ouvre un chantier dédié (liste des écrans cassés + captures) avant toute publication, parce qu'il n'existe plus de moyen de refuser le redimensionnement sur iOS 27.

### Tâche B3 : audit au simulateur Duo

À lancer dans ton terminal : `npx expo run:ios -d "iPhone Duo"`. Captures : `xcrun simctl io booted screenshot docs/duo-audit/<écran>-<pose>.png`.

Poses à couvrir pour chaque écran : **plié**, **déplié**, **déplié tourné**, **pliage/dépliage en cours d'action**.

| Écran / moment | Points à contrôler |
|---|---|
| Accueil client + prestataire (cockpit GO) | Contenu sous le **rail vertical** des barres système (`insets.left`/`insets.right` asymétriques) ; la sidebar `FixedTabBar` ne doit pas passer sous le rail |
| Toast « depuis l'île », `IncomingCallOverlay` | L'île est **latérale** sur le Duo déplié : vérifier que l'ancrage centré en haut reste lisible |
| Sheets gorhom (devis, mission, filtres) | Sur 951 de large, une sheet pleine largeur s'étire trop : noter lesquelles |
| NewRequestStepper (clavier étape 2) | Clavier sur `regular` : ni le total ni le CTA de l'étape 4 ne doivent être masqués |
| Missions (seul `SplitPane` en place) | Ratio 0,42, séparateur hors de la charnière, sélection conservée au pliage |
| Mission en cours + carte | Recentrage au changement de taille ; ETA visible |
| Messages, profil, réglages, wallet | `AdaptiveScroll` (560 pt) appliqué ou à appliquer |
| Pliage pendant une animation | Les shared values survivent, aucun écran ne se remonte, le brouillon de message est conservé |

- [ ] Remplir le tableau des constats en annexe ci-dessous : écran, pose, capture, défaut.
- [ ] **Un chantier à la fois** (règle CLAUDE.md) : pour chaque défaut, montrer le composant et proposer l'approche **avant** de modifier, puis faire un commit par correctif.

### Tâche B4 : App Store Connect

- [ ] Captures iPhone Duo (format sur la page « screenshot specifications » d'App Store Connect) pour obtenir le badge sur la fiche.
- [ ] Vérifier le rendu avec l'outil d'aperçu d'App Store Connect.
- [ ] Nomination « optimized for iPhone Duo » (Helpful Details), seulement si l'audit B3 est vert dans toutes les poses.

---

## Hors périmètre (volontairement)

- **Écrans à deux volets du train 2** (devis, mission en cours, messages, stepper ; moments 4, 19 et 20 du spec `2026-09-12-motion-and-adaptive-layout-design.md`) : plan séparé, écrit à partir des captures de B3.
- **Poses « à moitié ouvert »** (`expo-hinge`, `status: 'partiallyOpen'`) : hors spec. L'API existe désormais (`useHinge()`, `useAnimatedHinge()`), à envisager plus tard pour un mode « sur table » de la carte.
- **Migration Gesture Handler 3** (`Gesture.Pan()` → `usePanGesture`) : dépréciée mais présente ; gorhom l'utilise encore. À faire quand gorhom passera aux hooks.
- **`runOnJS` → `scheduleOnRN`** (24 appels) : à faire dans un passage dédié avec la garde `workletClosure.test.js`. Une erreur de fermeture de worklet fait crasher le thread UI en release et jest ne la voit pas.

---

## Annexe — constats de l'audit Duo (B3)

**Pré-audit fait dans le code le 22/10 : les écrans à regarder en premier.** Sur iPhone en portrait, les marges de sécurité gauche et droite valent 0 ; sur le Duo déplié, le rail vertical des barres système les rend non nulles. Les écrans ci-dessous ne protègent pas les côtés :
- soit `SafeAreaView` limité à `top` ou `bottom` ;
- soit `insets.top` lu sans `insets.left`/`insets.right`.

Les 36 autres écrans utilisent `SafeAreaView` sur tous les bords. `FixedTabBar` gère déjà la gauche et la droite. La correction dépend de chaque écran : un **contenu** prend `horizontalPadding(insets, base)` ou les bords `left`/`right`, une **carte ou un fond plein écran** reste bord à bord.

| Fichier | Cause |
|---|---|
| `app/(tabs)/wallet.tsx` | SafeAreaView sans les côtés + insets.top seul |
| `app/call/active.tsx` | insets.top seul |
| `app/messages/[userId].tsx` | insets.top seul |
| `app/onboarding/provider/pending.tsx` | insets.top seul |
| `app/request/NewRequestStepper.tsx` | insets.top seul |
| `app/request/[id]/earnings.tsx` | SafeAreaView sans les côtés |
| `app/request/[id]/missionview.tsx` | SafeAreaView sans les côtés + insets.top seul (carte plein écran) |
| `app/request/[id]/quote-review.tsx` | SafeAreaView sans les côtés |
| `app/request/[id]/rating.tsx` | insets.top seul |
| `app/request/[id]/resume-payment.tsx` | insets.top seul |
| `app/request/[id]/send-quote.tsx` | SafeAreaView sans les côtés |
| `app/request/camera.tsx` | insets.top seul (plein écran) |
| `components/IncomingCallOverlay.tsx` | insets.top seul ; île latérale sur le Duo déplié |
| `components/OfflineBanner.tsx` | insets.top seul |
| `components/auth/AuthScreen.tsx` | SafeAreaView sans les côtés |
| `components/mission/photos.tsx` | insets.top seul |
| `components/onboarding/OnboardingLayout.tsx` | insets.top seul |
| `components/tracking/StageSheet.tsx` | insets.top seul |

| # | Écran | Pose | Capture | Défaut | Correctif proposé | Commit |
|---|---|---|---|---|---|---|
| | | | | | | |
