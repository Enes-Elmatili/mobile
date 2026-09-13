// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// ─── Allowlists de migration ─────────────────────────────────────────────────
// Chaque liste est un stock à écouler, jamais un droit acquis : on retire une
// entrée dans le commit qui migre le fichier, on n'en ajoute jamais.
// Inventaire du 13/09/2026 (plan 1 mouvement, Tâche 3).

// `Animated` de react-native (règle 1 CLAUDE.md : Reanimated uniquement).
// Plan 1 migre missionview ; plans 2-3 migrent le reste.
const LEGACY_ANIMATED_ALLOWLIST = [
  'app/(auth)/complete-profile.tsx',
  'app/(auth)/forgot-password.tsx',
  'app/(auth)/login.tsx',
  'app/(auth)/reset-password.tsx',
  'app/(auth)/role-select.tsx',
  'app/(auth)/signup.tsx',
  'app/(auth)/verify-email.tsx',
  'app/(auth)/welcome.tsx',
  'app/(tabs)/missions.tsx',
  'app/call/active.tsx',
  'app/formules.tsx',
  'app/onboarding/provider/pending.tsx',
  'app/onboarding/stripe.tsx',
  'app/request/NewRequestStepper.tsx',
  'app/request/[id]/earnings.tsx',
  'app/request/[id]/ongoing.tsx',
  'app/request/[id]/quote-pending.tsx',
  'app/request/[id]/quote-review.tsx',
  'app/request/[id]/rating.tsx',
  'app/request/[id]/scheduled.tsx',
  'app/request/[id]/send-quote.tsx',
  'app/support.tsx',
  'components/IncomingCallOverlay.tsx',
  'components/OfflineBanner.tsx',
  'components/SplashAnimation.tsx',
  'components/auth/AuthCTA.tsx',
  'components/onboarding/OnboardingLayout.tsx',
  'components/providers/ProviderMissionCard.tsx',
  'components/sheets/MissionRequestSheet.tsx',
  'components/ui/PulseDot.tsx',
  'components/ui/RaisedButton.tsx',
  'lib/components/XSpinner.tsx',
];

// `Alert.alert` (règle 7 : zéro alerte système). Trois survivants hors
// écrans : session expirée (api.ts), micro refusé et VoIP indisponible
// (CallContext). À migrer sur feedback.error / feedback.confirm.
const LEGACY_ALERT_ALLOWLIST = ['lib/api.ts', 'lib/webrtc/CallContext.tsx'];

// `expo-haptics` direct. SocketContext ne se modifie pas sans validation
// explicite (CLAUDE.md) ; lib/feedback est le seul appelant légitime.
const HAPTICS_ALLOWLIST = ['lib/feedback/**', 'lib/SocketContext.tsx'];

// ─── Sélecteurs ──────────────────────────────────────────────────────────────
const NO_DIMENSIONS_GET = {
  selector: "CallExpression[callee.object.name='Dimensions'][callee.property.name='get']",
  message: 'Dimensions.get est figé au chargement et ne suit pas le pliage. Utiliser useLayoutClass() (lib/layout).',
};
const NO_ALERT = {
  selector: "CallExpression[callee.object.name='Alert'][callee.property.name='alert']",
  message: 'Zéro alerte système (règle 7). Utiliser feedback.* (lib/feedback).',
};
const NO_LEGACY_ANIMATED = {
  selector: "ImportDeclaration[source.value='react-native'] ImportSpecifier[imported.name='Animated']",
  message: 'Animated legacy banni (règle 1 CLAUDE.md). Utiliser react-native-reanimated.',
};
const NO_EXPO_HAPTICS = ['error', { paths: [{ name: 'expo-haptics', message: 'Haptique via feedback.haptic() uniquement.' }] }];

const SOURCE = ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'];

// En flat config, une règle redéfinie REMPLACE la précédente (les sélecteurs
// ne se cumulent pas) : chaque bloc liste donc ses sélecteurs en entier.
const syntaxRules = (file) => {
  const s = [NO_DIMENSIONS_GET];
  if (!LEGACY_ALERT_ALLOWLIST.includes(file)) s.push(NO_ALERT);
  if (!LEGACY_ANIMATED_ALLOWLIST.includes(file)) s.push(NO_LEGACY_ANIMATED);
  return s;
};
// Les chemins Expo Router contiennent `[id]` : pour minimatch c'est une classe
// de caractères, pas un dossier. On échappe les crochets avant tout `files`.
const toGlob = (file) => file.replace(/[[\]]/g, (c) => '\\' + c);
const perFile = (file) => ({
  files: [toGlob(file)],
  rules: { 'no-restricted-syntax': ['error', ...syntaxRules(file)] },
});
const EXCEPTIONS = [...new Set([...LEGACY_ANIMATED_ALLOWLIST, ...LEGACY_ALERT_ALLOWLIST])];
const EXCEPTION_GLOBS = EXCEPTIONS.map(toGlob);

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: SOURCE,
    ignores: EXCEPTION_GLOBS,
    rules: {
      'no-restricted-syntax': ['error', NO_DIMENSIONS_GET, NO_ALERT, NO_LEGACY_ANIMATED],
    },
  },
  ...EXCEPTIONS.map(perFile),
  {
    files: SOURCE,
    ignores: HAPTICS_ALLOWLIST,
    rules: { 'no-restricted-imports': NO_EXPO_HAPTICS },
  },
]);
