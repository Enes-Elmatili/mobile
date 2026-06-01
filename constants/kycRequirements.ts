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

// Les 7 documents canoniques exigés pour l'activation prestataire (BE / Model C DGEF).
// Tous obligatoires : le backend (admin.providers.js) bloque l'activation tant que les 7
// ne sont pas APPROVED.
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
// Pour la beta Ixelles (plomberie + serrurerie), aucune exigence additionnelle.
// Les certifications optionnelles (AREI, CERGA, etc.) seront ajoutées hors-beta
// via la config backend (categoryDocs.js) une fois le whitelist backend étendu.
export const SKILL_REQUIREMENTS: Record<string, DocumentRequirement[]> = {
  Plomberie: [],
  Serrurerie: [],
};

/**
 * Retourne la liste dédupliquée de documents requis pour les métiers sélectionnés.
 * Inclut toujours les 7 documents canoniques.
 */
export function getRequiredDocuments(selectedSkills: string[]): DocumentRequirement[] {
  const skillDocs = selectedSkills.flatMap((skill) => SKILL_REQUIREMENTS[skill] ?? []);

  const allDocs = [...BASE_REQUIREMENTS, ...skillDocs];
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
