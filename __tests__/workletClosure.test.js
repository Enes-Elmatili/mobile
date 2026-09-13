// Garde-fou de classe : un worklet ne doit jamais lire une valeur de sa
// fermeture dans la LISTE DES PARAMÈTRES (valeur par défaut). Sur le thread
// UI, le plugin worklets déballe `this.__closure` dans le corps de la
// fonction, donc après l'évaluation des paramètres → ReferenceError à chaque
// appel, alors que le jumeau côté JS (celui que jest exécute) fonctionne.
// C'est ce qui a rendu le curseur « glisser pour accepter » inerte (iOS) et
// planté l'app (Android) en 1.0.6 → 1.0.9.
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
