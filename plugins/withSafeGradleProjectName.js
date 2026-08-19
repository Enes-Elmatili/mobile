// plugins/withSafeGradleProjectName.js
// ─────────────────────────────────────────────────────────────────────────────
// Expo dérive `rootProject.name` de `expo.name` dans app.json. Depuis le rebrand,
// ce nom est « fixed. » — avec le point final du wordmark.
//
// Gradle 8.14+ REFUSE un nom de projet qui commence ou finit par un point :
//
//   Settings file 'android/settings.gradle' line: 34
//   > The project name 'fixed.' must not start or end with a '.'
//
// Le build Android échouait donc dès l'évaluation des settings, avant même de
// compiler quoi que ce soit. Symptôme trompeur côté EAS :
// « Gradle build failed with unknown error ».
//
// Ce plugin ne touche QUE le nom interne du projet Gradle. Le libellé affiché
// sur l'écran d'accueil vient de `app_name` (strings.xml), lui aussi dérivé de
// `expo.name` — il reste « fixed. », wordmark intact.
//
// ⚠️ `android/` est régénéré par prebuild à chaque build : ne jamais corriger
// settings.gradle à la main, la modification serait écrasée. C'est la raison
// d'être de ce plugin.
// ─────────────────────────────────────────────────────────────────────────────

const { withSettingsGradle } = require('@expo/config-plugins');

/** Nom sûr pour Gradle : pas de point en tête ni en fin. */
const SAFE_NAME = 'fixed';

module.exports = function withSafeGradleProjectName(config) {
  return withSettingsGradle(config, (cfg) => {
    const before = cfg.modResults.contents;
    const after = before.replace(
      /rootProject\.name\s*=\s*(['"])[\s\S]*?\1/,
      `rootProject.name = '${SAFE_NAME}'`,
    );

    if (after === before) {
      // Fail loud : si le template Expo change de forme, on veut le savoir au
      // prebuild plutôt que de redécouvrir l'échec 8 minutes plus tard sur EAS.
      throw new Error(
        "[withSafeGradleProjectName] rootProject.name introuvable dans settings.gradle — " +
          'le template Expo a probablement changé, adapter la regex.',
      );
    }

    cfg.modResults.contents = after;
    return cfg;
  });
};
