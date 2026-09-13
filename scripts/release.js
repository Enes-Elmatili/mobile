#!/usr/bin/env node
// scripts/release.js — une seule commande pour livrer aux stores.
//
//   npm run release                      → patch (1.0.4 → 1.0.5), iOS + Android, build + soumission
//   npm run release -- --minor           → 1.0.4 → 1.1.0
//   npm run release -- --version 2.0.0   → version imposée
//   npm run release -- --platform ios    → une seule plateforme
//   npm run release -- --no-submit       → build sans soumission
//   npm run release -- --dry-run         → montre tout, ne touche à rien
//
// Pourquoi : EAS (`appVersionSource: remote`, `autoIncrement`) n'incrémente que
// le buildNumber / versionCode. La version marketing (`expo.version`) ne bouge
// jamais seule, et Apple refuse un build dont la version est déjà approuvée
// (ITMS-90186 / ITMS-90062, vécu le 24/08/2026 puis le 13/09/2026). Ce script :
//   1. exige un arbre git propre sur `main` ;
//   2. calcule la prochaine version à partir d'app.json, puis vérifie qu'elle
//      est strictement supérieure à la version EN VENTE sur l'App Store ;
//   3. écrit app.json, committe, pousse ;
//   4. lance `eas build --profile production --auto-submit`.
// Aucune dépendance : Node ≥ 18 (fetch global).

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const APP_JSON = path.join(ROOT, 'app.json');
const ASC_APP_ID = '6760902496';
const STORE_COUNTRY = 'be';

// ─── Arguments ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const dryRun = has('--dry-run');
const submit = !has('--no-submit');
const platform = valueOf('--platform') || 'all';
if (!['ios', 'android', 'all'].includes(platform)) fail(`--platform doit valoir ios, android ou all (reçu : ${platform})`);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}
function sh(cmd, opts = {}) {
  const out = execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: opts.inherit ? 'inherit' : 'pipe' });
  // stdio: 'inherit' → execSync renvoie null (la sortie est allée au terminal).
  return out == null ? '' : String(out).trim();
}
function parseVersion(v) {
  const parts = String(v).split('.').map((n) => parseInt(n, 10));
  while (parts.length < 3) parts.push(0);
  if (parts.some((n) => Number.isNaN(n))) fail(`Version illisible : ${v}`);
  return parts;
}
function compare(a, b) {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}
function bump(v, kind) {
  const [major, minor, patch] = parseVersion(v);
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}
async function liveStoreVersion() {
  try {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${ASC_APP_ID}&country=${STORE_COUNTRY}`);
    const json = await res.json();
    return json.results?.[0]?.version || null;
  } catch {
    return null;
  }
}

// ─── 1. Garde-fous git ───────────────────────────────────────────────────────
(async () => {
  const branch = sh('git rev-parse --abbrev-ref HEAD');
  if (branch !== 'main' && !has('--any-branch')) fail(`On livre depuis main (branche courante : ${branch}). Ajoutez --any-branch pour forcer.`);
  const dirty = sh('git status --porcelain');
  if (dirty) fail(`Arbre de travail non propre — committez ou remisez d'abord :\n${dirty}`);
  sh('git fetch origin main');
  const behind = sh('git rev-list --count HEAD..origin/main');
  if (behind !== '0') fail(`main local est en retard de ${behind} commit(s) sur origin/main : git pull d'abord.`);

  // ─── 2. Version ──────────────────────────────────────────────────────────
  const appJsonRaw = fs.readFileSync(APP_JSON, 'utf8');
  const current = JSON.parse(appJsonRaw).expo.version;
  const forced = valueOf('--version');
  let next = forced || bump(current, has('--major') ? 'major' : has('--minor') ? 'minor' : 'patch');
  if (forced && compare(forced, current) <= 0) fail(`--version ${forced} n'est pas supérieure à la version actuelle ${current}.`);

  const live = await liveStoreVersion();
  if (live) {
    if (compare(next, live) <= 0) {
      const corrected = bump(live, 'patch');
      console.log(`⚠ ${next} n'est pas supérieure à la version en vente (${live}) : on passe à ${corrected}.`);
      next = corrected;
    }
  } else {
    console.log('⚠ Version App Store injoignable : on se fie à app.json seulement.');
  }

  console.log(`\nVersion : ${current} → ${next}${live ? `   (en vente : ${live})` : ''}`);
  console.log(`Plateforme : ${platform}   Soumission : ${submit ? 'oui' : 'non'}${dryRun ? '   [dry-run]' : ''}\n`);

  // ─── 3. Écrire, committer, pousser ───────────────────────────────────────
  const needle = `"version": "${current}"`;
  if (appJsonRaw.split(needle).length !== 2) fail(`app.json : impossible de trouver exactement une fois ${needle}.`);
  const updated = appJsonRaw.replace(needle, `"version": "${next}"`);
  const commitMessage = `chore: version ${next}`;
  const easCmd = `npx eas-cli@latest build --platform ${platform} --profile production${submit ? ' --auto-submit' : ''} --non-interactive --no-wait`;

  if (dryRun) {
    console.log(`[dry-run] écrirait app.json (${needle} → "version": "${next}")`);
    console.log(`[dry-run] git commit -m "${commitMessage}" && git push origin main`);
    console.log(`[dry-run] ${easCmd}`);
    return;
  }

  fs.writeFileSync(APP_JSON, updated);
  sh('git add app.json');
  sh(`git commit -m "${commitMessage}"`);
  sh('git push origin main', { inherit: true });
  console.log(`\n✔ ${commitMessage} poussé sur main\n`);

  // ─── 4. Build + soumission ───────────────────────────────────────────────
  sh(easCmd, { inherit: true });
  console.log(`
Rappel : « Scheduled submission » signifie uploadé, pas accepté. Le verdict
d'Apple arrive par e-mail ; le passage en review se fait dans App Store
Connect en choisissant ce build. Android : piste internal (eas.json).`);
})().catch((e) => fail(e.message || String(e)));
