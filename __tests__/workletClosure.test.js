// Garde-fou de classe : un worklet ne doit jamais lire une valeur de sa
// fermeture dans la LISTE DES PARAMÈTRES (valeur par défaut). Sur le thread
// UI, le plugin worklets déballe `this.__closure` dans le corps de la
// fonction, donc après l'évaluation des paramètres → ReferenceError à chaque
// appel, alors que le jumeau côté JS (celui que jest exécute) fonctionne.
// C'est ce qui a rendu le curseur « glisser pour accepter » inerte (iOS) et
// planté l'app (Android) en 1.0.6 → 1.0.9.
process.env.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost/api';
const babel = require('@babel/core');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['app', 'components', 'lib', 'hooks', 'constants'];

// Tout le code applicatif, récursivement : un worklet peut vivre n'importe où.
function sources() {
  const out = [];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
      const p = path.join(rel, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '__tests__') walk(p); }
      else if (/\.(tsx?|jsx?)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
    }
  };
  for (const d of DIRS) if (fs.existsSync(path.join(ROOT, d))) walk(d);
  return out;
}

function emittedWorklets(file) {
  const { code } = babel.transformFileSync(path.join(ROOT, file), {
    cwd: ROOT, filename: file, envName: 'production',
    caller: { name: 'metro', platform: 'ios', bundler: 'metro', supportsStaticESM: false },
  });
  const re = /_worklet_\d+_init_data=\{code:"((?:[^"\\]|\\.)*)"/g;
  const found = []; let m;
  while ((m = re.exec(code))) found.push(JSON.parse(`"${m[1]}"`));
  return found;
}

function closureRefsInDefaults(code) {
  const head = code.match(/^function\s+\w*\(([^)]*)\)/);
  if (!head) return [];
  const closure = (code.match(/const\{([^}]*)\}=this\.__closure/) || [, ''])[1].split(',').map((s) => s.trim()).filter(Boolean);
  const defaults = [...head[1].matchAll(/=\s*([A-Za-z_$][\w$]*)/g)].map((x) => x[1]);
  return defaults.filter((d) => closure.includes(d));
}

describe('worklets : aucune valeur par défaut lue depuis la fermeture', () => {
  const files = sources();
  it('balaye au moins les fichiers de lib/motion', () => {
    expect(files.some((f) => f.startsWith('lib/motion/'))).toBe(true);
  });
  it.each(files)('%s', (file) => {
    for (const code of emittedWorklets(file)) {
      expect({ file, worklet: code.slice(0, 120), closureRefsInDefaults: closureRefsInDefaults(code) }).toEqual(
        { file, worklet: code.slice(0, 120), closureRefsInDefaults: [] },
      );
    }
  });
});

// ── Classe 2 : un worklet qui APPELLE une fonction de sa fermeture qui n'est
// pas un worklet (ex. `alpha(...)` dans useAnimatedStyle). Sur le thread UI,
// l'appel jette « Tried to synchronously call a non-worklet function » ; en
// release c'est un plantage natif (l'app se fermait à la réception du devis).
// On résout chaque identifiant appelé : import → module chargé, fonction sans
// __workletHash = faute ; local → doit porter 'worklet' dans le fichier.
const KNOWN_WORKLET_MODULES = /^(react-native-reanimated|react-native-worklets|react-native-gesture-handler)/;
function importMapOf(src) {
  const map = {};
  for (const m of src.matchAll(/import\s+(?:type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g)) {
    const [, def, named, mod] = m;
    if (def) map[def] = { mod, name: 'default' };
    for (const part of (named || '').split(',')) {
      const seg = part.trim().replace(/^type\s+/, '');
      if (!seg) continue;
      const [orig, alias] = seg.split(/\s+as\s+/).map((x) => x.trim());
      map[alias || orig] = { mod, name: orig };
    }
  }
  return map;
}
function localWorkletNames(src) {
  const names = new Set();
  for (const m of src.matchAll(/(?:function\s+(\w+)\s*\([^)]*\)\s*(?::[^{]+)?\{|(?:const|let)\s+(\w+)\s*=\s*(?:\([^)]*\)|\w+)\s*(?::[^=]+)?=>\s*\{)\s*['"]worklet['"]/g)) names.add(m[1] || m[2]);
  return names;
}
function calledNonWorklets(code, file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const closure = (code.match(/const\{([^}]*)\}=this\.__closure/) || [, ''])[1].split(',').map((s) => s.trim()).filter(Boolean);
  const body = code.replace(/const\{[^}]*\}=this\.__closure;?/, '');
  const imports = importMapOf(src);
  const locals = localWorkletNames(src);
  const bad = [];
  for (const name of closure) {
    if (!new RegExp(`(^|[^.\\w$])${name}\\s*\\(`).test(body)) continue; // pas appelé
    const imp = imports[name];
    if (imp) {
      if (KNOWN_WORKLET_MODULES.test(imp.mod)) continue;
      let mod;
      try { mod = require(imp.mod.startsWith('@/') ? path.join(ROOT, imp.mod.slice(2)) : imp.mod.startsWith('.') ? path.join(ROOT, path.dirname(file), imp.mod) : imp.mod); } catch { continue; }
      const v = imp.name === 'default' ? (mod && mod.default) : (mod && mod[imp.name]);
      if (typeof v === 'function' && !v.__workletHash) bad.push(`${name} (import ${imp.mod})`);
    } else if (/^[a-z]/.test(name) && new RegExp(`(function\\s+${name}\\b|(?:const|let)\\s+${name}\\s*=)`).test(src) && !locals.has(name)) {
      // Fonction locale au fichier, sans directive 'worklet' (les valeurs non
      // fonctions — nombres, objets — ne matchent pas `nom(`).
      if (new RegExp(`(function\\s+${name}\\s*\\(|(?:const|let)\\s+${name}\\s*=\\s*(?:\\([^)]*\\)|\\w+)\\s*(?::[^=]+)?=>|(?:const|let)\\s+${name}\\s*=\\s*function)`).test(src)) bad.push(`${name} (local, sans 'worklet')`);
    }
  }
  return bad;
}

describe('worklets : aucun appel à une fonction non-worklet de la fermeture', () => {
  it.each(sources())('%s', (file) => {
    for (const code of emittedWorklets(file)) {
      expect({ file, worklet: code.slice(0, 120), calledNonWorklets: calledNonWorklets(code, file) }).toEqual(
        { file, worklet: code.slice(0, 120), calledNonWorklets: [] },
      );
    }
  });
});

describe('rubberBand sur le thread UI', () => {
  it('le code émis pour le thread UI accepte 3 arguments', () => {
    const code = emittedWorklets('lib/motion/gestures.ts').find((c) => /^function rubberBand/.test(c));
    expect(code).toBeDefined();
    // Le runtime UI reconstruit le worklet depuis la chaîne et le lie à son
    // objet fermeture (react-native-worklets, valueUnpacker.ts).
    const ui = eval(`(${code})`).bind({ __closure: { SHEET_OVER_DRAG_RESISTANCE: 3.5 } });
    expect(ui(150, 0, 300)).toBe(150);
    expect(ui(400, 0, 300)).toBeCloseTo(300 + 100 / 3.5, 5);
    expect(ui(-70, 0, 300)).toBeCloseTo(-20, 5);
  });
});
