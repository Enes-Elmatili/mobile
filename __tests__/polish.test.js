// Le polonais : une langue de plus, sans trous. Les placeholders restent ceux
// de l'anglais (sinon une valeur ne s'affiche pas), chaque pluriel a ses
// quatre formes (1 zlecenie · 2 zlecenia · 5 zleceń), et les noms de services
// se replient proprement tant que le serveur n'a pas `nameI18n.pl`.
const en = require('../locales/en.json');
const pl = require('../locales/pl.json');
const i18n = require('../lib/i18n').default;
const { translateSubcategory } = require('../lib/categoryLabel');
const { localeFor } = require('../lib/format');

const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
const EN = Object.fromEntries(flat(en));
const PL = Object.fromEntries(flat(pl));
const placeholders = (s) => (String(s).match(/\{\{\s*[\w.]+\s*\}\}/g) || []).map((x) => x.replace(/\s+/g, '')).sort();
const pluralBases = Object.keys(EN).filter((k) => /_one$/.test(k) && EN[k.replace(/_one$/, '_other')] != null).map((k) => k.replace(/_one$/, ''));

describe('locales/pl.json', () => {
  it('reprend les placeholders de l’anglais', () => {
    const broken = Object.keys(PL)
      .filter((k) => EN[k] != null && !pluralBases.some((b) => k.startsWith(`${b}_`)))
      .filter((k) => k !== 'ext.missions_to_come_upper') // {{plural}} anglais (« S ») : rien en polonais
      .filter((k) => placeholders(EN[k]).join() !== placeholders(PL[k]).join());
    expect(broken).toEqual([]);
  });

  it('chaque pluriel a ses quatre formes, non vides', () => {
    const incomplete = pluralBases.filter((b) => ['one', 'few', 'many', 'other'].some((f) => !String(PL[`${b}_${f}`] ?? '').trim()));
    expect(incomplete).toEqual([]);
  });

  it('i18next choisit la bonne forme (Intl.PluralRules polonais)', () => {
    const t = i18n.getFixedT('pl');
    expect(t('quote.jobs_count', { count: 1 })).toBe('1 zlecenie');
    expect(t('quote.jobs_count', { count: 3 })).toBe('3 zlecenia');
    expect(t('quote.jobs_count', { count: 5 })).toBe('5 zleceń');
    expect(t('quote.jobs_count', { count: 22 })).toBe('22 zlecenia');
  });

  it('une clé absente en polonais retombe sur l’anglais', () => {
    const t = i18n.getFixedT('pl');
    expect(t('__absente__.cle', { defaultValue: 'x' })).toBe('x');
    expect(i18n.options.fallbackLng).toEqual(['en']);
  });
});

describe('noms de services en polonais', () => {
  const sub = { slug: 'fuite-eau', name: "Fuite d'eau", nameI18n: { fr: "Fuite d'eau", en: 'Water leak', nl: 'Waterlek' } };
  it('le nom de l’app tant que le serveur n’a pas `pl`', () => {
    expect(translateSubcategory('pl', sub)).toBe(pl.services['fuite-eau'].name);
  });
  it('le serveur gagne dès qu’il porte `nameI18n.pl`', () => {
    expect(translateSubcategory('pl', { ...sub, nameI18n: { ...sub.nameI18n, pl: 'Wyciek (serwer)' } })).toBe('Wyciek (serwer)');
  });
  it('service inconnu de l’app : l’anglais, puis le français', () => {
    expect(translateSubcategory('pl', { slug: 'inconnu', name: 'Nom FR', nameI18n: { fr: 'Nom FR', en: 'EN name' } })).toBe('EN name');
    expect(translateSubcategory('pl', { slug: 'inconnu', name: 'Nom FR', nameI18n: { fr: 'Nom FR' } })).toBe('Nom FR');
  });
  it('les autres langues ne changent pas', () => {
    expect(translateSubcategory('nl', sub)).toBe('Waterlek');
    expect(translateSubcategory('de', sub)).toBe("Fuite d'eau");
  });
});

describe('formats de date', () => {
  it('pl → pl-PL, le reste inchangé', () => {
    expect(localeFor('pl')).toBe('pl-PL');
    expect(localeFor('pl-PL')).toBe('pl-PL');
    expect(localeFor('nl')).toBe('nl-BE');
    expect(localeFor(undefined)).toBe('fr-BE');
  });
});
