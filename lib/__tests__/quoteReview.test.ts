// Revue de devis côté client (lib/quote/quoteReview.ts) : montant héros en
// CENTIMES, badge/CTA dérivés du statut, compte à rebours, PaymentSheet Stripe
// et confirmation avec retry. Le client paie sur cet écran — on fige tout.
import {
  QUOTE_REVIEW_STATUSES, isQuoteReviewStatus, splitAmount, isSealed, isFolded, quoteReviewState,
  timeLeftParts, timeLeftLabel, quotePaymentSheetParams, confirmPaymentWithRetry,
} from '../quote/quoteReview';

// ICU : espace fine insécable (milliers) et insécable avant « € ».
const plain = (s: string) => s.replace(/[  ]/g, ' ');

const NOW = Date.parse('2026-09-14T10:00:00Z');
const HOUR = 3600_000;
const iso = (ms: number) => new Date(ms).toISOString();

describe('splitAmount — montant héros en deux tailles (centimes)', () => {
  it('87100 centimes → « 871,00 » + « € »', () => {
    const { value, cur } = splitAmount(87100);
    expect(plain(value)).toBe('871,00');
    expect(cur).toBe('€');
  });
  it('milliers groupés, pas d’espace résiduelle avant la devise', () => {
    const { value, cur } = splitAmount(123456);
    expect(plain(value)).toBe('1 234,56');
    expect(value.endsWith(' ')).toBe(false);
    expect(cur).toBe('€');
  });
  it('zéro centime → « 0,00 »', () => {
    expect(plain(splitAmount(0).value)).toBe('0,00');
  });
});

describe('statuts de demande admis sur l’écran', () => {
  it('les quatre statuts devis, rien d’autre', () => {
    expect([...QUOTE_REVIEW_STATUSES]).toEqual(['QUOTE_SENT', 'QUOTE_ACCEPTED', 'QUOTE_REFUSED', 'QUOTE_EXPIRED']);
    expect(isQuoteReviewStatus('QUOTE_SENT')).toBe(true);
    expect(isQuoteReviewStatus('ONGOING')).toBe(false);
    expect(isQuoteReviewStatus('quote_sent')).toBe(false);
  });
});

describe('sceau et pliage (moment 9)', () => {
  it('sceau : devis ACCEPTED, demande QUOTE_ACCEPTED ou ONGOING', () => {
    expect(isSealed('ACCEPTED', '')).toBe(true);
    expect(isSealed('', 'QUOTE_ACCEPTED')).toBe(true);
    expect(isSealed('', 'ONGOING')).toBe(true);
    expect(isSealed('SENT', 'QUOTE_SENT')).toBe(false);
  });
  it('pliage : devis REFUSED ou demande QUOTE_REFUSED', () => {
    expect(isFolded('REFUSED', '')).toBe(true);
    expect(isFolded('', 'QUOTE_REFUSED')).toBe(true);
    expect(isFolded('SENT', 'QUOTE_SENT')).toBe(false);
  });
});

describe('quoteReviewState — badge et CTA', () => {
  const base = { quoteStatus: 'sent', requestStatus: 'QUOTE_SENT', validUntil: iso(NOW + 48 * HOUR), now: NOW };

  it('devis envoyé et valide : en attente, action possible, pas urgent', () => {
    const st = quoteReviewState(base);
    expect(st).toMatchObject({
      qStatus: 'SENT', expired: false, accepted: false, refused: false, badgeDanger: false,
      badgeKey: 'quote.awaiting_response', terminal: false, canAct: true, urgent: false,
    });
    expect(st.msLeft).toBe(48 * HOUR);
  });

  it('sous 6 h de validité : urgent', () => {
    expect(quoteReviewState({ ...base, validUntil: iso(NOW + 5 * HOUR) }).urgent).toBe(true);
    expect(quoteReviewState({ ...base, validUntil: iso(NOW + 6 * HOUR) }).urgent).toBe(false);
  });

  it('validité dépassée pendant que la page est ouverte : expiré, plus d’action', () => {
    const st = quoteReviewState({ ...base, validUntil: iso(NOW - 1) });
    expect(st).toMatchObject({ expired: true, badgeDanger: true, badgeKey: 'quote.expired', terminal: true, canAct: false, urgent: false });
  });

  it('accepté prime sur expiré pour le badge (devis payé)', () => {
    const st = quoteReviewState({ ...base, requestStatus: 'ONGOING', validUntil: iso(NOW - HOUR) });
    expect(st.accepted).toBe(true);
    expect(st.badgeKey).toBe('quote.badge_accepted');
    expect(st.canAct).toBe(false);
  });

  it('refusé : badge danger, libellé refus', () => {
    const st = quoteReviewState({ ...base, quoteStatus: 'REFUSED' });
    expect(st).toMatchObject({ refused: true, badgeDanger: true, badgeKey: 'quote.badge_refused', terminal: true, canAct: false });
  });

  it('statut devis inconnu mais non clos : pas d’action (seul SENT ouvre le paiement)', () => {
    const st = quoteReviewState({ ...base, quoteStatus: null });
    expect(st.terminal).toBe(false);
    expect(st.canAct).toBe(false);
  });
});

describe('compte à rebours', () => {
  const t = (key: string, { n }: { n: number }) => `${key.split('_').pop()}:${n}`;

  it('décompose en jours / heures / minutes, planché à zéro', () => {
    expect(timeLeftParts((2 * 1440 + 3 * 60 + 12) * 60_000)).toEqual({ d: 2, h: 3, m: 12 });
    expect(timeLeftParts(59_999)).toEqual({ d: 0, h: 0, m: 0 });
    expect(timeLeftParts(-HOUR)).toEqual({ d: 0, h: 0, m: 0 });
  });

  it('libellé : jours + heures, sinon heures + minutes, sinon minutes', () => {
    expect(timeLeftLabel((2 * 1440 + 3 * 60 + 12) * 60_000, t)).toBe('day:2 hour:3');
    expect(timeLeftLabel((3 * 60 + 12) * 60_000, t)).toBe('hour:3 min:12');
    expect(timeLeftLabel(12 * 60_000, t)).toBe('min:12');
    expect(timeLeftLabel(-1, t)).toBe('min:0');
  });
});

describe('PaymentSheet Stripe', () => {
  it('paramètres exacts : Fixed, BE, Google Pay en prod, ordre des moyens', () => {
    expect(quotePaymentSheetParams('pi_123_secret_abc')).toEqual({
      merchantDisplayName: 'Fixed',
      paymentIntentClientSecret: 'pi_123_secret_abc',
      applePay: { merchantCountryCode: 'BE' },
      googlePay: { merchantCountryCode: 'BE', testEnv: false },
      paymentMethodOrder: ['card', 'klarna', 'revolut_pay', 'bancontact'],
    });
  });
});

describe('confirmPaymentWithRetry — client déjà débité', () => {
  const wait = jest.fn(async (_ms: number) => {});
  beforeEach(() => wait.mockClear());

  it('succès du premier coup : un appel, aucun délai', async () => {
    const confirm = jest.fn(async () => ({ ok: true }));
    await expect(confirmPaymentWithRetry(confirm, 42, 'pi_1', wait)).resolves.toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith(42, 'pi_1');
    expect(wait).not.toHaveBeenCalled();
  });

  it('deux échecs réseau puis succès : backoff 1 s puis 2 s', async () => {
    const confirm = jest.fn()
      .mockRejectedValueOnce(new Error('réseau'))
      .mockRejectedValueOnce(new Error('réseau'))
      .mockResolvedValueOnce({ ok: true });
    await expect(confirmPaymentWithRetry(confirm, 42, 'pi_1', wait)).resolves.toBe(true);
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
  });

  it('trois échecs : false, pas de délai après la dernière tentative', async () => {
    const confirm = jest.fn().mockRejectedValue(new Error('réseau'));
    await expect(confirmPaymentWithRetry(confirm, 42, 'pi_1', wait)).resolves.toBe(false);
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
  });

  it('401 / 403 : abandon immédiat', async () => {
    for (const status of [401, 403]) {
      const confirm = jest.fn().mockRejectedValue({ status });
      await expect(confirmPaymentWithRetry(confirm, 42, 'pi_1', wait)).resolves.toBe(false);
      expect(confirm).toHaveBeenCalledTimes(1);
    }
    expect(wait).not.toHaveBeenCalled();
  });

  it('erreur nulle : traitée comme un échec réseau', async () => {
    const confirm = jest.fn().mockRejectedValueOnce(null).mockResolvedValueOnce(undefined);
    await expect(confirmPaymentWithRetry(confirm, 7, 'pi_2', wait)).resolves.toBe(true);
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});
