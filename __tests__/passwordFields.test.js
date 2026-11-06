// Garde-fou de classe : un champ mot de passe ne doit jamais laisser iOS mettre
// une majuscule à la première lettre. Par défaut React Native applique
// autoCapitalize="sentences" ; dès qu'on affiche le mot de passe (l'œil),
// le champ n'est plus masqué et « motdepasse » part en « Motdepasse » →
// « Invalid credentials » à la connexion, ou un mot de passe enregistré avec
// une majuscule jamais voulue à l'inscription / la réinitialisation.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['app', 'components'];

function sources() {
  const out = [];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
      const p = path.join(rel, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '__tests__') walk(p); }
      else if (/\.tsx$/.test(e.name)) out.push(p);
    }
  };
  for (const d of DIRS) if (fs.existsSync(path.join(ROOT, d))) walk(d);
  return out;
}

/** Les éléments JSX qui portent secureTextEntry, du `<` ouvrant au `/>`. */
function secureFields(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const fields = [];
  let i = src.indexOf('secureTextEntry');
  while (i !== -1) {
    const start = src.lastIndexOf('<', i);
    const end = src.indexOf('/>', i);
    fields.push({ line: src.slice(0, i).split('\n').length, jsx: src.slice(start, end) });
    i = src.indexOf('secureTextEntry', i + 1);
  }
  return fields;
}

const fields = sources().flatMap((file) => secureFields(file).map((f) => ({ file, ...f })));

describe('champs mot de passe : jamais de majuscule automatique', () => {
  it('trouve les champs mot de passe (la garde ne tourne pas à vide)', () => {
    expect(fields.length).toBeGreaterThanOrEqual(5);
  });

  it.each(fields.map((f) => [`${f.file}:${f.line}`, f]))('%s', (_, f) => {
    expect(/autoCapitalize=\{?[^}]*["']none["']/.test(f.jsx)).toBe(true);
  });
});
