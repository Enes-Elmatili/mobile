// lib/company.ts
// BCE et IBAN : validation locale (mod-97) et mise en forme, miroir de
// backend/services/bceValidator.js et ibanValidator.js. Le serveur reste le
// juge (VIES pour le BCE) ; ici on évite un aller-retour pour une faute de
// frappe et on affiche le numéro sous sa forme canonique.

function parseBce(raw: string): string | null {
  const cleaned = String(raw ?? '').replace(/[\s.\-]/g, '').toUpperCase();
  const stripped = cleaned.startsWith('BE') ? cleaned.slice(2) : cleaned;
  return /^\d{10}$/.test(stripped) ? stripped : null;
}

export function isValidBce(raw: string): boolean {
  const number = parseBce(raw);
  if (!number) return false;
  const first8 = parseInt(number.slice(0, 8), 10);
  const last2 = parseInt(number.slice(8), 10);
  return 97 - (first8 % 97) === last2;
}

/** « BE 1037.044.717 » — même forme que le serveur. */
export function formatBce(raw: string): string {
  const number = parseBce(raw);
  if (!number) return raw;
  return `BE ${number.slice(0, 4)}.${number.slice(4, 7)}.${number.slice(7)}`;
}

function parseIban(raw: string): string | null {
  const cleaned = String(raw ?? '').replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned)) return null;
  if (cleaned.length < 15 || cleaned.length > 34) return null;
  return cleaned;
}

export function isValidIban(raw: string): boolean {
  const iban = parseIban(raw);
  if (!iban) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => (ch.charCodeAt(0) - 55).toString());
  // mod-97 par tranches : pas de BigInt côté Hermes.
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    remainder = parseInt(String(remainder) + numeric.slice(i, i + 7), 10) % 97;
  }
  return remainder === 1;
}

/** Groupes de 4 : « BE68 5390 0754 7034 ». */
export function formatIban(raw: string): string {
  const iban = parseIban(raw);
  if (!iban) return raw;
  return iban.match(/.{1,4}/g)!.join(' ');
}
