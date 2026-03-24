// constants/kycRequirements.ts — Mapping métier → documents requis pour le KYC prestataire

export type DocumentType =
  | 'identity_card'
  | 'bce'
  | 'professional_cert'
  | 'liability_insurance'
  | 'vat_number'
  | 'electrical_cert';

export interface DocumentRequirement {
  type: DocumentType;
  label: string;
  description: string;
  required: boolean;
  accept: string[];
  maxSizeMB: number;
}

// Documents communs à TOUS les prestataires
// Note GDPR : justificatif de domicile supprimé — non conforme pour travailleur indépendant belge
export const BASE_REQUIREMENTS: DocumentRequirement[] = [
  {
    type: 'identity_card',
    label: 'Carte d\'identité',
    description: 'Recto-verso de votre carte d\'identité belge ou titre de séjour valide.',
    required: true,
    accept: ['jpg', 'jpeg', 'png', 'pdf'],
    maxSizeMB: 10,
  },
  {
    type: 'bce',
    label: 'Numéro BCE / Extrait BCE',
    description: 'Numéro d\'entreprise à la Banque-Carrefour des Entreprises ou extrait BCE de moins de 3 mois.',
    required: true,
    accept: ['jpg', 'jpeg', 'png', 'pdf'],
    maxSizeMB: 10,
  },
  {
    type: 'liability_insurance',
    label: 'Assurance RC professionnelle',
    description: 'Attestation d\'assurance responsabilité civile professionnelle en cours de validité.',
    required: true,
    accept: ['pdf', 'jpg', 'jpeg', 'png'],
    maxSizeMB: 10,
  },
];

// Documents spécifiques par métier (BCE + RC Pro déjà dans BASE_REQUIREMENTS)
export const SKILL_REQUIREMENTS: Record<string, DocumentRequirement[]> = {
  'Bricolage': [
    {
      type: 'professional_cert',
      label: 'Certificat de qualification',
      description: 'Diplôme ou certificat de formation professionnelle (recommandé).',
      required: false,
      accept: ['pdf', 'jpg', 'jpeg', 'png'],
      maxSizeMB: 10,
    },
  ],
  'Urgences techniques': [
    {
      type: 'electrical_cert',
      label: 'Certification AREI / BA4-BA5',
      description: 'Requis pour les interventions électriques en Belgique.',
      required: true,
      accept: ['pdf', 'jpg', 'jpeg', 'png'],
      maxSizeMB: 10,
    },
  ],
  'Ménage': [],
};

/**
 * Retourne la liste dédupliquée de documents requis pour les métiers sélectionnés.
 * Inclut toujours les documents de base (carte d'identité, justificatif de domicile).
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
