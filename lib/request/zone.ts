// lib/request/zone.ts
// Zone de service de l'étape 1 (Région de Bruxelles-Capitale) et contrôle du
// numéro de rue. Pur : testé dans __tests__/stepperZone.test.js.

/** Composant d'adresse Google Places (champs lus ici seulement). */
export type AddressComponentLike = { types: readonly string[]; short_name?: string; long_name?: string };

// ── Zone de service : Région de Bruxelles-Capitale (19 communes) ─────────
// Les codes postaux de la RBC vont de 1000 (Bruxelles) à 1210 (Saint-Josse),
// codes institutionnels 1005-1049 inclus. Le code suivant est 1300 (Wavre,
// Brabant wallon) : la plage 1000-1212 est donc sûre et exhaustive.
export const BRUSSELS_POSTAL_MIN = 1000;
export const BRUSSELS_POSTAL_MAX = 1212;
// Fallback quand aucun code postal n'est disponible (adresse enregistrée :
// on ne dispose que de la chaîne). Noms des 19 communes en FR et NL, plus
// les anciennes communes de Bruxelles-Ville. 'molenbeek' couvre les deux
// formes, 'woluwe' couvre les quatre.
export const BRUSSELS_COMMUNES = [
  'anderlecht',
  'auderghem', 'oudergem',
  'berchem-sainte-agathe', 'sint-agatha-berchem',
  'bruxelles', 'brussel',
  'laeken', 'laken', 'neder-over-heembeek', 'haren',
  'etterbeek',
  'evere',
  'forest', 'vorst',
  'ganshoren',
  'ixelles', 'elsene',
  'jette',
  'koekelberg',
  'molenbeek',
  'saint-gilles', 'sint-gillis',
  'saint-josse', 'sint-joost',
  'schaerbeek', 'schaarbeek',
  'uccle', 'ukkel',
  'watermael-boitsfort', 'watermaal-bosvoorde',
  'woluwe',
];

export function checkLocation(description: string, addressComponents?: readonly AddressComponentLike[]): boolean {
  // 1. Le code postal Google fait autorité dès qu'il est présent.
  const postalComp = addressComponents?.find((c) => c.types.includes('postal_code'));
  const postal = parseInt(postalComp?.short_name || postalComp?.long_name || '', 10);
  if (Number.isFinite(postal)) {
    return postal >= BRUSSELS_POSTAL_MIN && postal <= BRUSSELS_POSTAL_MAX;
  }
  // 2. Sinon, match sur le nom de commune — mais en ignorant le premier
  //    segment (la rue), sans quoi « Chaussée de Bruxelles » à Waterloo
  //    passerait pour une adresse bruxelloise.
  const parts = description.split(',');
  const locality = (parts.length > 1 ? parts.slice(1).join(',') : description).toLowerCase();
  return BRUSSELS_COMMUNES.some(c => locality.includes(c));
}

/** L'adresse Google porte-t-elle un numéro de rue ? `undefined` sans composants. */
export function addressHasStreetNumber(addressComponents?: readonly AddressComponentLike[]): boolean | undefined {
  return addressComponents?.some((c) => c.types.includes('street_number'));
}
