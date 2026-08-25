// plugins/withR8.js
// ─────────────────────────────────────────────────────────────────────────────
// Active l'optimisation R8 sur les builds Android release.
//
// Le template Expo SDK 54 livre le projet natif SANS optimisation :
//   - `android.enableMinifyInReleaseBuilds` absent           → minifyEnabled false
//   - `android.enableShrinkResourcesInReleaseBuilds` absent  → shrinkResources false
//   - proguardFiles pointe sur `proguard-android.txt`, qui contient `-dontoptimize`
//     → même minify activé, aucune optimisation (inlining, class merging) ne tourne.
//
// Résultat : l'AAB embarque tout le bytecode Java/Kotlin de RN, Expo, Stripe,
// Maps, WebRTC et Sentry, arbre mort compris. On le paie en taille de DEX, en
// démarrage à froid et en pression mémoire — donc en ANR.
//
// Ce plugin corrige les trois points. R8 full mode est déjà actif : c'est le
// défaut depuis AGP 8.0 et rien dans le projet ne pose `enableR8.fullMode=false`.
//
// ⚠️ `android/` est régénéré par prebuild à chaque build : ne jamais corriger
// gradle.properties / build.gradle / proguard-rules.pro à la main, la
// modification serait écrasée. C'est la raison d'être de ce plugin.
//
// Interaction avec Sentry : le plugin Gradle Sentry n'est PAS appliqué ici,
// seul `sentry.gradle` de @sentry/react-native l'est (source maps JS). La
// désobfuscation des traces Java/Kotlin passe donc par Play Console, qui lit le
// `mapping.txt` embarqué automatiquement dans l'AAB. Les traces JS (Hermes) ne
// sont pas concernées par R8.
//
// Rollback : passer ENABLED à false ci-dessous, ou retirer le plugin d'app.json.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const {
  withGradleProperties,
  withAppBuildGradle,
  withDangerousMod,
} = require('@expo/config-plugins');

/** Interrupteur unique. false → le plugin devient un no-op, build non optimisé. */
const ENABLED = true;

/**
 * Clés lues par le template Expo SDK 54 (android/app/build.gradle).
 * ⚠️ `enableMinifyInReleaseBuilds` — PAS l'ancien `enableProguardInReleaseBuilds`.
 * Une clé obsolète serait un no-op silencieux : le build se croirait optimisé.
 */
const GRADLE_PROPERTIES = {
  'android.enableMinifyInReleaseBuilds': 'true',
  'android.enableShrinkResourcesInReleaseBuilds': 'true',
};

const MARKER_START = '# >>> FIXED R8 — généré par plugins/withR8.js, ne pas éditer à la main';
const MARKER_END = '# <<< FIXED R8';

const KEEP_RULES = `${MARKER_START}

# expo-notifications embarque bien un proguard-rules.pro mais ne le déclare
# JAMAIS en consumerProguardFiles → la règle n'atteint pas l'app. On la reprend.
-keep class expo.modules.notifications.** { *; }

# Stripe Push Provisioning (ajout d'une carte émise par Stripe à Google Wallet).
# @stripe/stripe-react-native déclare ce SDK en \`compileOnly\` : il compile
# contre, mais ne le package jamais. FIXED n'utilise pas cette fonctionnalité —
# aucune référence côté JS — donc les classes sont légitimement absentes et R8
# échoue sur « Missing class com.stripe.android.pushProvisioning.* ».
# \`-dontwarn\` ne change rien à l'exécution (ces classes ne sont pas dans l'APK
# avec ou sans R8) : ça lève seulement le contrôle de build sur du code mort.
# ⚠️ Si un jour on active le push provisioning, retirer cette ligne ET ajouter
# la vraie dépendance com.stripe:stripe-android-issuing-push-provisioning.
-dontwarn com.stripe.android.pushProvisioning.**

# Attributs nécessaires à la réflexion Kotlin (records / enums / SharedObject
# d'expo-modules-core) et à des stack traces exploitables côté Play Console.
-keepattributes Signature,InnerClasses,EnclosingMethod,*Annotation*
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

${MARKER_END}`;

/** a. gradle.properties — active minify + réduction des ressources. */
function withR8GradleProperties(config) {
  return withGradleProperties(config, (cfg) => {
    const keys = Object.keys(GRADLE_PROPERTIES);

    // Idempotence : purge des entrées existantes avant réécriture, sinon un
    // prebuild sur un android/ déjà généré empilerait les doublons.
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && keys.includes(item.key)),
    );

    for (const key of keys) {
      cfg.modResults.push({ type: 'property', key, value: GRADLE_PROPERTIES[key] });
    }

    return cfg;
  });
}

/** b. app/build.gradle — bascule sur le fichier ProGuard qui optimise vraiment. */
function withOptimizedProguardFile(config) {
  return withAppBuildGradle(config, (cfg) => {
    const before = cfg.modResults.contents;

    if (before.includes('proguard-android-optimize.txt')) {
      return cfg; // déjà basculé (prebuild sans --clean)
    }

    const after = before.replace(
      /getDefaultProguardFile\((["'])proguard-android\.txt\1\)/,
      'getDefaultProguardFile("proguard-android-optimize.txt")',
    );

    if (after === before) {
      // Fail loud : si le template Expo change de forme, on veut le savoir au
      // prebuild plutôt que d'expédier un build qui se croit optimisé.
      throw new Error(
        '[withR8] getDefaultProguardFile("proguard-android.txt") introuvable dans ' +
          'app/build.gradle — le template Expo a probablement changé, adapter la regex.',
      );
    }

    cfg.modResults.contents = after;
    return cfg;
  });
}

/**
 * c. app/proguard-rules.pro — injecte les keep rules que les dépendances ne
 * fournissent pas elles-mêmes via consumerProguardFiles.
 * @expo/config-plugins@54 n'expose pas de mod dédié, d'où le dangerous mod.
 */
function withR8KeepRules(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const file = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro',
      );

      if (!fs.existsSync(file)) {
        throw new Error(`[withR8] ${file} introuvable — projet Android non généré ?`);
      }

      const before = fs.readFileSync(file, 'utf8');
      const blockPattern = new RegExp(
        `${escapeRegExp(MARKER_START)}[\\s\\S]*?${escapeRegExp(MARKER_END)}`,
      );

      // Idempotence : on remplace le bloc s'il existe, on l'ajoute sinon.
      const after = blockPattern.test(before)
        ? before.replace(blockPattern, KEEP_RULES)
        : `${before.trimEnd()}\n\n${KEEP_RULES}\n`;

      if (after !== before) {
        fs.writeFileSync(file, after, 'utf8');
      }

      return cfg;
    },
  ]);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = function withR8(config) {
  if (!ENABLED) return config;

  let cfg = withR8GradleProperties(config);
  cfg = withOptimizedProguardFile(cfg);
  cfg = withR8KeepRules(cfg);
  return cfg;
};
