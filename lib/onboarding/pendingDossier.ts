// lib/onboarding/pendingDossier.ts
// Logique pure de l'écran d'attente prestataire (app/onboarding/provider/pending.tsx) :
// statut de validation → état d'écran, état réel du dossier, timeline, motif
// d'incomplétude et contenu des écrans de sortie. Testée dans
// __tests__/pendingDossier.test.js.
import { BASE_REQUIREMENTS } from '@/constants/kycRequirements';
import { firstIncompleteStep, STEP_ROUTES } from '@/lib/onboardingSteps';
import { missingDocKeys, requiredDocKeys, type ProviderTrades } from '@/lib/providerOnboarding';
import { cleanName } from '@/lib/displayName';
import type { AuthUser } from '@/lib/types';

export type PendingStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'banned';

export interface PendingDoc {
  id: string;
  docKey: string;
  status: string;
  rejectionReason?: string | null;
}

/** Entreprise : BCE confirmé VIES + IBAN. null = pas encore lu. */
export interface CompanyFlags {
  vatPresent: boolean;
  vatVerified: boolean;
  ibanPresent: boolean;
}

/** Statut serveur (validationStatus / providerStatus) → état d'écran ; null si inconnu. */
export function statusFromValidation(raw: string | null | undefined): PendingStatus | null {
  switch (raw) {
    case 'ACTIVE': return 'approved';
    case 'REJECTED': return 'rejected';
    case 'SUSPENDED': return 'suspended';
    case 'BANNED': return 'banned';
    case 'PENDING': return 'pending';
    default: return null;
  }
}

export function companyFlagsFromProvider(p: {
  vatNumber?: string | null;
  vatVerifiedAt?: string | null;
  bankIban?: string | null;
}): CompanyFlags {
  return { vatPresent: !!p.vatNumber, vatVerified: !!p.vatVerifiedAt, ibanPresent: !!p.bankIban };
}

// ── Libellés ────────────────────────────────────────────────────────────────
// Libellés des documents (au lieu de la clé technique « id_front »)
const DOC_LABELS: Record<string, string> = Object.fromEntries(
  BASE_REQUIREMENTS.map((d) => [d.type, d.label])
);

/** Libellé de repli d'une pièce, si la clé i18n `kyc.<clé>_label` manque. */
export function docLabelFallback(docKey: string): string {
  return DOC_LABELS[docKey] ?? docKey.replace(/_/g, ' ');
}

export function pendingFirstName(user: Partial<AuthUser> | null | undefined): string {
  const u = user ?? {};
  return cleanName(u?.name, { email: u?.email, fallback: '' }).trim().split(/\s+/)[0] || '';
}

export function hasBioText(bio: unknown): boolean {
  return !!(bio && String(bio).trim().length > 0);
}

export const BIO_MIN_LENGTH = 10;

// ── État réel du dossier ────────────────────────────────────────────────────
// `validationStatus` vaut PENDING dès la création de la fiche : il ne dit RIEN
// de ce qui a été déposé. Tant qu'on ne l'a pas vérifié, on considère le
// dossier incomplet — l'erreur sûre est de renvoyer vers les documents, jamais
// d'annoncer « dossier reçu » sur un dossier vide.
export interface DossierState {
  requiredKeys: string[];
  missingKeys: string[];
  /** Incomplet AVÉRÉ — pas « pas encore vérifié ». C'est lui qui pilote l'alerte. */
  docsIncomplete: boolean;
  submittedCount: number;
  /** Profil métier vide → c'est là qu'il faut renvoyer, pas sur les documents. */
  tradesMissing: boolean;
  /** Entreprise incomplète AVÉRÉE (BCE ou IBAN absent). Un BCE enregistré mais
   *  pas encore confirmé par VIES n'est pas un manque : le serveur rejoue la
   *  vérification, l'admin peut la relancer ; on l'affiche « en cours ». */
  companyIncomplete: boolean;
  vatPendingVies: boolean;
  /** Le dossier est incomplet dès qu'une étape en amont de la validation manque. */
  fileIncomplete: boolean;
}

export function deriveDossier(input: {
  trades: ProviderTrades | null;
  documents: PendingDoc[];
  company: CompanyFlags | null;
}): DossierState {
  const { trades, documents, company } = input;
  const tradeNames = trades?.names ?? [];
  const requiredKeys = requiredDocKeys(tradeNames);
  const missingKeys = missingDocKeys(documents, tradeNames);
  const stateKnown = trades !== null;
  const docsComplete = stateKnown && missingKeys.length === 0;
  const docsIncomplete = stateKnown && !docsComplete;
  const submittedCount = Math.max(0, requiredKeys.length - missingKeys.length);
  const tradesMissing = !!trades?.known && tradeNames.length === 0;
  const companyIncomplete = company !== null && (!company.vatPresent || !company.ibanPresent);
  const vatPendingVies = company !== null && company.vatPresent && !company.vatVerified;
  const fileIncomplete = docsIncomplete || companyIncomplete;
  return {
    requiredKeys, missingKeys, docsIncomplete, submittedCount, tradesMissing,
    companyIncomplete, vatPendingVies, fileIncomplete,
  };
}

/** Route de reprise de l'onboarding (l'étape « review » renvoie aux documents). */
export function resumeRoute(input: {
  trades: ProviderTrades | null;
  company: CompanyFlags | null;
  documents: PendingDoc[];
  stripeConnected: boolean;
}): string {
  const step = firstIncompleteStep({
    trades: input.trades ?? { names: [], city: null, known: false },
    company: input.company ?? { vatPresent: true, vatVerified: true, ibanPresent: true },
    docs: input.documents,
    stripeReady: input.stripeConnected,
  });
  return STEP_ROUTES[step === 'review' ? 'documents' : step];
}

// ── Timeline ────────────────────────────────────────────────────────────────
export type TimelineState = 'done' | 'active' | 'idle';

/** Clé i18n + paramètres éventuels. */
export interface I18nRef {
  key: string;
  params?: Record<string, string | number>;
}

export interface TimelineRowSpec {
  id: 'company' | 'received' | 'stripe' | 'verifying' | 'activated';
  labelKey: string;
  state: TimelineState;
  eta?: I18nRef;
  last?: boolean;
}

export function timelineRows(d: DossierState, stripeConnected: boolean): TimelineRowSpec[] {
  return [
    {
      id: 'company',
      labelKey: 'onboarding.pending_step_company',
      state: d.companyIncomplete ? 'active' : 'done',
      eta: d.companyIncomplete
        ? { key: 'onboarding.pending_company_missing' }
        : d.vatPendingVies ? { key: 'onboarding.pending_company_vies_pending' } : undefined,
    },
    {
      id: 'received',
      labelKey: 'onboarding.pending_step_received',
      state: d.docsIncomplete ? 'active' : d.companyIncomplete ? 'idle' : 'done',
      eta: d.docsIncomplete
        ? { key: 'onboarding.pending_docs_progress', params: { sent: d.submittedCount, total: d.requiredKeys.length } }
        : undefined,
    },
    {
      id: 'stripe',
      labelKey: 'onboarding.pending_step_stripe',
      state: stripeConnected ? 'done' : d.fileIncomplete ? 'idle' : 'active',
      eta: !stripeConnected && !d.fileIncomplete ? { key: 'onboarding.pending_stripe_missing' } : undefined,
    },
    {
      id: 'verifying',
      labelKey: 'onboarding.pending_step_verifying',
      state: stripeConnected && !d.fileIncomplete ? 'active' : 'idle',
      eta: { key: 'onboarding.pending_verifying_eta' },
    },
    { id: 'activated', labelKey: 'onboarding.pending_step_activated', state: 'idle', last: true },
  ];
}

/**
 * Motif affiché dans la carte « dossier incomplet ». Pour les pièces, la liste
 * est à composer par l'appelant (libellés traduits) à partir de `missingKeys`.
 */
export function incompleteReason(
  d: DossierState,
  company: CompanyFlags | null,
): { key: string; missingKeys?: string[] } {
  if (d.tradesMissing) return { key: 'onboarding.pending_incomplete_trades' };
  if (d.companyIncomplete) {
    return { key: company?.vatPresent ? 'onboarding.pending_incomplete_iban' : 'onboarding.pending_incomplete_bce' };
  }
  return { key: 'onboarding.pending_incomplete_docs', missingKeys: d.missingKeys };
}

// ── Écrans de sortie (refusé / suspendu / banni) ────────────────────────────
export interface OutcomeContent {
  icon: 'x' | 'slash';
  tone: 'red' | 'white';
  titleL1: string;
  titleL2: string;
  sub: string;
  reasonLabel: string;
  cta: string;
  route: '/onboarding/documents' | '/support';
}

export function outcomeContent(status: 'rejected' | 'suspended' | 'banned'): OutcomeContent {
  switch (status) {
    case 'rejected':
      return {
        icon: 'x', tone: 'red',
        titleL1: 'onboarding.rejected_title_l1', titleL2: 'onboarding.rejected_title_l2',
        sub: 'onboarding.rejected_sub', reasonLabel: 'onboarding.rejected_reason_label',
        cta: 'onboarding.rejected_cta', route: '/onboarding/documents',
      };
    case 'suspended':
      return {
        icon: 'slash', tone: 'white',
        titleL1: 'onboarding.suspended_title_l1', titleL2: 'onboarding.suspended_title_l2',
        sub: 'onboarding.suspended_sub', reasonLabel: 'onboarding.status_reason_label',
        cta: 'onboarding.suspended_cta', route: '/support',
      };
    case 'banned':
      return {
        icon: 'slash', tone: 'red',
        titleL1: 'onboarding.banned_title_l1', titleL2: 'onboarding.banned_title_l2',
        sub: 'onboarding.banned_sub', reasonLabel: 'onboarding.status_reason_label',
        cta: 'onboarding.banned_cta', route: '/support',
      };
  }
}
