// Catalogue et adresses enregistrées du stepper (lib/request/catalog.ts).
const {
  extractArrayPayload, filterLaunchCategories, pickInitialCategory, toFeatherName, savedAddressIcon, canSaveAddress,
} = require('@/lib/request/catalog');

describe('extractArrayPayload', () => {
  it('tableau brut, { data: [] }, sinon vide', () => {
    expect(extractArrayPayload([1, 2])).toEqual([1, 2]);
    expect(extractArrayPayload({ data: [3] })).toEqual([3]);
    expect(extractArrayPayload({ data: 'x' })).toEqual([]);
    expect(extractArrayPayload(null)).toEqual([]);
  });
});

describe('filterLaunchCategories — Plomberie et Serrurerie au lancement', () => {
  const all = [
    { id: 1, name: 'Plomberie', slug: 'plomberie' },
    { id: 2, name: 'Électricité', slug: 'electricite' },
    { id: 3, name: 'Serrurerie express', slug: null },
  ];
  it('garde les catégories ouvertes (slug ou nom)', () => {
    expect(filterLaunchCategories(all).map((c) => c.id)).toEqual([1, 3]);
  });
  it('aucune ouverte → tout le catalogue', () => {
    const other = [{ id: 9, name: 'Jardin', slug: 'jardin' }];
    expect(filterLaunchCategories(other)).toBe(other);
  });
});

describe('pickInitialCategory', () => {
  const cats = [{ id: 1, name: 'Plomberie', slug: 'plomberie' }, { id: 2, name: 'Serrurerie', slug: 'serrurerie' }];
  it('paramètre « selectedCategory » : nom contenu ou slug exact, insensible à la casse', () => {
    expect(pickInitialCategory(cats, 'SERRU').id).toBe(2);
    expect(pickInitialCategory(cats, 'serrurerie').id).toBe(2);
  });
  it('sans paramètre ou sans correspondance → la première', () => {
    expect(pickInitialCategory(cats, undefined).id).toBe(1);
    expect(pickInitialCategory(cats, 'jardin').id).toBe(1);
  });
});

describe('toFeatherName', () => {
  it('pont Ionicons → Feather, repli sinon', () => {
    expect(toFeatherName('water-outline')).toBe('droplet');
    expect(toFeatherName('inconnu')).toBe('tool');
    expect(toFeatherName(null, 'home')).toBe('home');
  });
});

describe('savedAddressIcon / canSaveAddress', () => {
  it('icône devinée du libellé', () => {
    expect(savedAddressIcon('Domicile')).toBe('home');
    expect(savedAddressIcon('Mon bureau')).toBe('briefcase');
    expect(savedAddressIcon('Chez maman')).toBe('map-pin');
    expect(savedAddressIcon(null)).toBe('map-pin');
  });
  const loc = { address: 'Rue Haute 12, Bruxelles', lat: 50.8, lng: 4.3 };
  const addr = (i, address = `Rue ${i}`) => ({ id: i, label: 'x', address, lat: 0, lng: 0 });
  it('enregistrable : adresse choisie, nouvelle, moins de 10', () => {
    expect(canSaveAddress([], loc)).toBe(true);
    expect(canSaveAddress([], null)).toBe(false);
    expect(canSaveAddress([addr(1, loc.address)], loc)).toBe(false);
    expect(canSaveAddress(Array.from({ length: 10 }, (_, i) => addr(i)), loc)).toBe(false);
    expect(canSaveAddress(Array.from({ length: 9 }, (_, i) => addr(i)), loc)).toBe(true);
  });
});
