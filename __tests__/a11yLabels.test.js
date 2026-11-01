// Garde-fou d'accessibilité : un libellé de lecteur d'écran écrit en dur
// (accessibilityLabel="Retour") est lu en français à un utilisateur polonais,
// néerlandais ou anglais. Tout libellé passe par t(), sauf la marque.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ALLOWED = new Set(['FIXED']);

function sources() {
  const out = [];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
      const p = path.join(rel, e.name);
      if (e.isDirectory()) { if (e.name !== '__tests__') walk(p); }
      else if (p.endsWith('.tsx')) out.push(p);
    }
  };
  ['app', 'components'].forEach(walk);
  return out;
}

describe('libellés d’accessibilité traduits', () => {
  it('aucun accessibilityLabel en dur (hors marque)', () => {
    const found = [];
    for (const f of sources()) {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      for (const m of src.matchAll(/accessibilityLabel="([^"]+)"/g)) {
        if (!ALLOWED.has(m[1]) && !m[1].startsWith('FIXED')) found.push(`${f}: "${m[1]}"`);
      }
    }
    expect(found).toEqual([]);
  });
});
