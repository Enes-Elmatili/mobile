/**
 * Où reprendre l'onboarding prestataire. Le garde d'activation exige métiers,
 * BCE vérifié par VIES, IBAN, pièces approuvées et Stripe : l'app doit
 * renvoyer vers la PREMIÈRE étape manquante, dans cet ordre.
 */
import { firstIncompleteStep, STEP_ROUTES } from '../onboardingSteps';

const trades = { names: ['Plomberie'], city: 'Ixelles', known: true };
const company = { vatPresent: true, vatVerified: true, ibanPresent: true };
const docs = ['BCE_CERTIFICATE', 'ID_FRONT', 'ID_BACK', 'INSURANCE_RC_PRO', 'TRADE_LICENSE', 'CRIMINAL_RECORD', 'IBAN_PROOF']
  .map((docKey) => ({ docKey, status: 'PENDING' }));

describe('firstIncompleteStep', () => {
  it('métiers absents → activity, avant tout le reste', () => {
    expect(firstIncompleteStep({ trades: { names: [], city: null, known: true }, company: { vatPresent: false, vatVerified: false, ibanPresent: false }, docs: [], stripeReady: false })).toBe('activity');
  });

  it('BCE absent → company', () => {
    expect(firstIncompleteStep({ trades, company: { vatPresent: false, vatVerified: false, ibanPresent: true }, docs, stripeReady: true })).toBe('company');
  });

  it('BCE enregistré mais pas encore confirmé par VIES → on ne bloque PAS sur company', () => {
    expect(firstIncompleteStep({ trades, company: { vatPresent: true, vatVerified: false, ibanPresent: true }, docs, stripeReady: true })).toBe('review');
  });

  it('IBAN absent → company', () => {
    expect(firstIncompleteStep({ trades, company: { vatPresent: true, vatVerified: true, ibanPresent: false }, docs, stripeReady: true })).toBe('company');
  });

  it('entreprise ok, pièce manquante → documents', () => {
    expect(firstIncompleteStep({ trades, company, docs: docs.slice(1), stripeReady: true })).toBe('documents');
  });

  it('tout déposé, Stripe absent → stripe', () => {
    expect(firstIncompleteStep({ trades, company, docs, stripeReady: false })).toBe('stripe');
  });

  it('tout fourni → review (validation humaine)', () => {
    expect(firstIncompleteStep({ trades, company, docs, stripeReady: true })).toBe('review');
  });

  it('chaque étape a une route', () => {
    for (const step of ['activity', 'company', 'documents', 'stripe', 'review'] as const) {
      expect(STEP_ROUTES[step]).toMatch(/^\/onboarding\//);
    }
    expect(STEP_ROUTES.company).toBe('/onboarding/company');
  });
});
