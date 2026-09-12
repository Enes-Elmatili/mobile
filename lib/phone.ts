// lib/phone.ts
// Normalisation E.164 des numéros saisis dans l'app. Miroir de
// backend/services/phone.js : même règle des deux côtés, le serveur ne fait
// confiance à aucun client.
//
// Le piège : un Belge tape « 0470 12 34 56 » — le 0 est le préfixe national,
// il disparaît en international. Concaténer « +32 » + les chiffres tapés donne
// +320470123456, un faux numéro. Idem si l'utilisateur (ou l'autofill iOS)
// tape « +32 470… » ou « 0032 470… » : on ne double pas l'indicatif.

/** Indicatifs internationaux (ITU E.164), sans le « + ». */
const CALLING_CODES: readonly string[] = [
  '1', '7', '20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46', '47',
  '48', '49', '51', '52', '53', '54', '55', '56', '57', '58', '60', '61', '62', '63', '64', '65', '66',
  '81', '82', '84', '86', '90', '91', '92', '93', '94', '95', '98',
  '211', '212', '213', '216', '218', '220', '221', '222', '223', '224', '225', '226', '227', '228', '229',
  '230', '231', '232', '233', '234', '235', '236', '237', '238', '239', '240', '241', '242', '243', '244',
  '245', '246', '248', '249', '250', '251', '252', '253', '254', '255', '256', '257', '258', '260', '261',
  '262', '263', '264', '265', '266', '267', '268', '269', '290', '291', '297', '298', '299',
  '350', '351', '352', '353', '354', '355', '356', '357', '358', '359', '370', '371', '372', '373', '374',
  '375', '376', '377', '378', '380', '381', '382', '383', '385', '386', '387', '389',
  '420', '421', '423', '500', '501', '502', '503', '504', '505', '506', '507', '508', '509',
  '590', '591', '592', '593', '594', '595', '596', '597', '598', '599',
  '670', '672', '673', '674', '675', '676', '677', '678', '679', '680', '681', '682', '683', '685', '686',
  '687', '688', '689', '690', '691', '692',
  '850', '852', '853', '855', '856', '880', '886',
  '960', '961', '962', '963', '964', '965', '966', '967', '968', '970', '971', '972', '973', '974', '975',
  '976', '977', '992', '993', '994', '995', '996', '998',
];

/**
 * Pays où le 0 de tête fait partie du numéro national (pas un préfixe qu'on
 * retire en international) : Italie, Saint-Marin, Vatican. Partout ailleurs
 * en Europe, le 0 est un préfixe de sortie et disparaît après l'indicatif.
 */
const KEEP_LEADING_ZERO: ReadonlySet<string> = new Set(['39', '378', '379']);

/** Le 0 de tête fait-il partie du numéro pour cet indicatif ? */
export function keepsLeadingZero(callingCode: string): boolean {
  return KEEP_LEADING_ZERO.has(callingCode);
}

function digitsOnly(s: string): string {
  return String(s ?? '').replace(/\D/g, '');
}

/** Indicatif reconnu en tête de `digits` (le plus long d'abord), sinon null. */
function matchCallingCode(digits: string): string | null {
  for (const len of [3, 2, 1]) {
    const candidate = digits.slice(0, len);
    if (candidate.length === len && CALLING_CODES.includes(candidate)) return candidate;
  }
  return null;
}

/** Retire le préfixe national (0) quand le pays l'exige. */
function stripTrunkPrefix(callingCode: string, national: string): string {
  if (KEEP_LEADING_ZERO.has(callingCode)) return national;
  return national.replace(/^0+/, '');
}

/**
 * Sépare une saisie en { indicatif, partie locale } — ce que le champ doit
 * afficher. Une saisie en international (+33… / 0033…) bascule l'indicatif ;
 * une saisie locale garde celui du chip. Le 0 national est retiré.
 */
export function splitInternational(
  currentCallingCode: string,
  raw: string,
): { callingCode: string; local: string } {
  const trimmed = String(raw ?? '').trim();
  const digits = digitsOnly(trimmed);

  const isInternational = trimmed.startsWith('+') || digits.startsWith('00');
  if (isInternational) {
    const body = trimmed.startsWith('+') ? digits : digits.slice(2);
    const code = matchCallingCode(body);
    if (code) {
      return { callingCode: code, local: stripTrunkPrefix(code, body.slice(code.length)) };
    }
    // « + » seul, ou indicatif inconnu : on garde le chip, rien à afficher de sûr.
    return { callingCode: currentCallingCode, local: stripTrunkPrefix(currentCallingCode, body) };
  }

  return { callingCode: currentCallingCode, local: stripTrunkPrefix(currentCallingCode, digits) };
}

/**
 * Numéro E.164 (« +32470123456 ») à partir de l'indicatif du chip et de la
 * saisie brute. Chaîne vide si rien n'est saisi.
 */
export function toE164(currentCallingCode: string, raw: string): string {
  const { callingCode, local } = splitInternational(currentCallingCode, raw);
  return local ? `+${callingCode}${local}` : '';
}
