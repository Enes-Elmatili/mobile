// constants/kycRequirements.ts — Mapping métier → documents requis pour le KYC prestataire
//
// Source de vérité canonique : backend/services/documentTypes.js PROVIDER_DOC_TYPES.
// Toute modification ici DOIT être répercutée côté backend (et inversement).

export type DocumentType =
  | 'BCE_CERTIFICATE'
  | 'ID_FRONT'
  | 'ID_BACK'
  | 'INSURANCE_RC_PRO'
  | 'TRADE_LICENSE'
  | 'CRIMINAL_RECORD'
  | 'IBAN_PROOF';

export interface DocumentRequirement {
  type: DocumentType;
  label: string;
  description: string;
  required: boolean;
  accept: string[];
  maxSizeMB: number;
}

// Les 7 documents canoniques (BE / Model C DGEF). Les six premiers sont exigés de tous
// les métiers ; TRADE_LICENSE ne l'est que des métiers réglementés — voir
// `getRequiredDocuments()` plus bas, et `backend/services/documentTypes.js` qui fait foi.
// Le backend (admin.providers.js) bloque l'activation tant que les documents réellement
// exigés de ce prestataire ne sont pas APPROVED.
export const BASE_REQUIREMENTS: DocumentRequirement[] = [
  {
    type: 'ID_FRONT',
    label: "Carte d'identité — recto",
    description: 'Face avant de votre carte d\'identité belge ou titre de séjour valide.',
    required: true,
    accept: ['jpg', 'jpeg', 'png', 'pdf'],
    maxSizeMB: 10,
  },
  {
    type: 'ID_BACK',
    label: "Carte d'identité — verso",
    description: 'Face arrière de votre carte d\'identité belge ou titre de séjour.',
    required: true,
    accept: ['jpg', 'jpeg', 'png', 'pdf'],
    maxSizeMB: 10,
  },
  {
    type: 'BCE_CERTIFICATE',
    label: 'Attestation BCE',
    description: 'Extrait BCE de moins de 3 mois (Banque-Carrefour des Entreprises).',
    required: true,
    accept: ['jpg', 'jpeg', 'png', 'pdf'],
    maxSizeMB: 10,
  },
  {
    type: 'INSURANCE_RC_PRO',
    label: 'Assurance RC professionnelle',
    description: 'Attestation d\'assurance responsabilité civile professionnelle en cours de validité.',
    required: true,
    accept: ['pdf', 'jpg', 'jpeg', 'png'],
    maxSizeMB: 10,
  },
  {
    type: 'TRADE_LICENSE',
    label: 'Accès à la profession',
    description: 'Diplôme, titre professionnel ou attestation d\'accès à la profession.',
    required: true,
    accept: ['pdf', 'jpg', 'jpeg', 'png'],
    maxSizeMB: 10,
  },
  {
    type: 'CRIMINAL_RECORD',
    label: 'Extrait de casier judiciaire',
    description: 'Modèle 596.1 (ou équivalent) de moins de 3 mois.',
    required: true,
    accept: ['pdf', 'jpg', 'jpeg', 'png'],
    maxSizeMB: 10,
  },
  {
    type: 'IBAN_PROOF',
    label: 'Justificatif IBAN',
    description: 'Capture / PDF de votre RIB ou attestation bancaire avec votre IBAN belge.',
    required: true,
    accept: ['pdf', 'jpg', 'jpeg', 'png'],
    maxSizeMB: 10,
  },
];

// Documents spécifiques par métier (au-delà des 7 canoniques).
// Pour le catalogue actuel (plomberie + serrurerie), aucune exigence additionnelle.
// Les certifications optionnelles (AREI, CERGA, etc.) seront ajoutées à l'ouverture
// de nouveaux métiers,
// via la config backend (categoryDocs.js) une fois le whitelist backend étendu.
export const SKILL_REQUIREMENTS: Record<string, DocumentRequirement[]> = {
  Plomberie: [],
  Serrurerie: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Accès à la profession — miroir de backend/services/documentTypes.js
//
// `TRADE_LICENSE` n'existe que pour les métiers réglementés en Région de
// Bruxelles-Capitale. Le demander à un métier non réglementé, c'est afficher au
// prestataire un document que l'administration ne lui délivrera jamais : il
// reste bloqué à 6/7 sans comprendre pourquoi, et l'admin ne peut pas l'activer.
//
// C'est une liste d'EXEMPTIONS : un métier n'en sort allégé que s'il y figure
// nommément. Slug inconnu, nouvelle catégorie, faute de frappe → les 7.
//
// ⚠️ Toute modification DOIT être répercutée dans `TRADE_LICENSE_EXEMPT_SLUGS`
// côté backend, et inversement. Désynchronisées, les deux listes produisent le
// pire cas : un document affiché ici et pas exigé là — ou l'inverse, un
// prestataire qui ne voit jamais le document qui bloque son activation.
// ─────────────────────────────────────────────────────────────────────────────
export const TRADE_LICENSE_EXEMPT_SLUGS = [
  'serrurerie',
  'menage',
  'bricolage',
  'informatique',
  'pet-sitting',
];

const toSlug = (s: string): string =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Retourne la liste dédupliquée de documents requis pour les métiers sélectionnés.
 *
 * Les 6 documents de base sont toujours inclus. L'attestation d'accès à la
 * profession n'est retirée que si TOUS les métiers sélectionnés sont exemptés —
 * un serrurier-plombier la fournit, on ne descend jamais au plus permissif.
 *
 * Aucun métier sélectionné, ou slug inconnu → les 7, comme le backend : le
 * repli est strict, on n'allège jamais par défaut.
 */
export function getRequiredDocuments(selectedSkills: string[]): DocumentRequirement[] {
  const skillDocs = selectedSkills.flatMap((skill) => SKILL_REQUIREMENTS[skill] ?? []);

  const slugs = (selectedSkills ?? []).map(toSlug);
  const exempte =
    slugs.length > 0 &&
    slugs.every((s) => !!s && TRADE_LICENSE_EXEMPT_SLUGS.includes(s));

  const base = exempte
    ? BASE_REQUIREMENTS.filter((d) => d.type !== 'TRADE_LICENSE')
    : BASE_REQUIREMENTS;

  const allDocs = [...base, ...skillDocs];
  const seen = new Map<DocumentType, DocumentRequirement>();

  for (const doc of allDocs) {
    if (!seen.has(doc.type) || doc.required) {
      seen.set(doc.type, doc);
    }
  }

  return Array.from(seen.values()).sort((a, b) =>
    Number(b.required) - Number(a.required)
  );
}
