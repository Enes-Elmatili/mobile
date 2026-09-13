// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// ─── Allowlists de migration ─────────────────────────────────────────────────
// Chaque liste est un stock à écouler, jamais un droit acquis : on retire une
// entrée dans le commit qui migre le fichier, on n'en ajoute jamais.
// Inventaire du 13/09/2026 (plan 1 mouvement, Tâche 3).
// `Animated` de react-native (règle 1) : stock écoulé le 13/09/2026 (plan 5,
// 33 fichiers migrés) — la règle NO_LEGACY_ANIMATED s'applique désormais
// partout, sans exception.

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
// Sur l'écran interne du Duo, insets gauche et droit diffèrent (Dynamic Island
// latérale) : jamais `paddingHorizontal: insets.left`.
const NO_SYMMETRIC_INSETS = {
  selector: "Property[key.name=/^(paddingHorizontal|marginHorizontal)$/] > MemberExpression[object.name='insets'][property.name=/^(left|right)$/]",
  message: 'Insets gauche et droit diffèrent sur un écran déplié : utiliser horizontalPadding(insets, base) (lib/layout).',
};
const NO_EXPO_HAPTICS = ['error', { paths: [{ name: 'expo-haptics', message: 'Haptique via feedback.haptic() uniquement.' }] }];

const SOURCE = ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'];

// En flat config, une règle redéfinie REMPLACE la précédente (les sélecteurs
// ne se cumulent pas) : chaque bloc liste donc ses sélecteurs en entier.
const syntaxRules = (file) => {
  const s = [NO_DIMENSIONS_GET, NO_SYMMETRIC_INSETS];
  s.push(NO_LEGACY_ANIMATED);
  if (!LEGACY_ALERT_ALLOWLIST.includes(file)) s.push(NO_ALERT);
  return s;
};
// Les chemins Expo Router contiennent `[id]` : pour minimatch c'est une classe
// de caractères, pas un dossier. On échappe les crochets avant tout `files`.
const toGlob = (file) => file.replace(/[[\]]/g, (c) => '\\' + c);
const perFile = (file) => ({
  files: [toGlob(file)],
  rules: { 'no-restricted-syntax': ['error', ...syntaxRules(file)] },
});
const EXCEPTIONS = [...new Set(LEGACY_ALERT_ALLOWLIST)];
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
      'no-restricted-syntax': ['error', NO_DIMENSIONS_GET, NO_SYMMETRIC_INSETS, NO_ALERT, NO_LEGACY_ANIMATED],
    },
  },
  ...EXCEPTIONS.map(perFile),
  {
    files: SOURCE,
    ignores: HAPTICS_ALLOWLIST,
    rules: { 'no-restricted-imports': NO_EXPO_HAPTICS },
  },
]);
