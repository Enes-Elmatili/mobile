const { translateSubcategoryDescription } = require('../lib/categoryLabel');

const t = (key, opts) => {
  const table = { 'services.fuite-eau.desc': 'Repair of a visible, located leak' };
  return table[key] ?? opts?.defaultValue ?? key;
};

describe('translateSubcategoryDescription — description de prestation dans la langue courante', () => {
  const sub = { slug: 'fuite-eau', description: "Réparation d'une fuite visible et localisée" };
  it('en français : le texte du serveur (éditable dans l’admin)', () => {
    expect(translateSubcategoryDescription('fr-BE', sub, t)).toBe("Réparation d'une fuite visible et localisée");
  });
  it('en anglais : la traduction de l’app quand elle existe', () => {
    expect(translateSubcategoryDescription('en', sub, t)).toBe('Repair of a visible, located leak');
  });
  it('sans traduction : retombe sur le texte du serveur', () => {
    expect(translateSubcategoryDescription('nl', { slug: 'inconnue', description: 'Texte serveur' }, t)).toBe('Texte serveur');
    expect(translateSubcategoryDescription('en', { slug: null, description: 'Texte serveur' }, t)).toBe('Texte serveur');
    expect(translateSubcategoryDescription('en', null, t)).toBe('');
  });
});
