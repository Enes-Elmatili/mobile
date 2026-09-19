// Le routage par statut : le devis en préparation mène au suivi.
process.env.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost/api';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }));
const { resolveRequestDestination } = require('@/lib/requestDestination');

describe('resolveRequestDestination', () => {
  it('QUOTE_PENDING → missionview', () => {
    expect(resolveRequestDestination({ id: 7, status: 'QUOTE_PENDING' }).pathname).toBe('/request/[id]/missionview');
  });
  it('QUOTE_SENT → quote-review, PUBLISHED → missionview, DONE sans avis → rating', () => {
    expect(resolveRequestDestination({ id: 7, status: 'QUOTE_SENT' }).pathname).toBe('/request/[id]/quote-review');
    expect(resolveRequestDestination({ id: 7, status: 'PUBLISHED' }).pathname).toBe('/request/[id]/missionview');
    expect(resolveRequestDestination({ id: 7, status: 'DONE', reviewExists: false }).pathname).toBe('/request/[id]/rating');
  });
});

describe('classifyNotification — catalogue serveur (data.event / audience)', () => {
  const { classifyNotification } = require('@/lib/requestDestination');
  it('les demandes vont aux opportunités, les remboursements à la preuve', () => {
    expect(classifyNotification({ event: 'request.new', audience: 'provider', requestId: 47, screen: 'Dashboard' })).toEqual({ kind: 'opportunity' });
    expect(classifyNotification({ event: 'refund.issued', audience: 'client', requestId: 47, screen: 'Documents' })).toEqual({ kind: 'refund', requestId: '47' });
    expect(classifyNotification({ event: 'quote.expired_refunded', audience: 'client', requestId: 47, screen: 'Documents' })).toEqual({ kind: 'refund', requestId: '47' });
  });
  it('une mission se re-résout avec le rôle déclaré', () => {
    expect(classifyNotification({ event: 'mission.arrived', audience: 'client', requestId: 47, screen: 'MissionView' })).toEqual({ kind: 'client-request', requestId: '47' });
    expect(classifyNotification({ event: 'dispute.opened', audience: 'provider', requestId: 47, screen: 'MissionView' })).toEqual({ kind: 'provider-request', requestId: '47' });
    expect(classifyNotification({ event: 'quote.accepted', audience: 'provider', requestId: 47, screen: 'Ongoing' })).toEqual({ kind: 'provider-request', requestId: '47' });
    expect(classifyNotification({ event: 'mission.done_provider', audience: 'provider', requestId: 47, screen: 'Earnings' })).toEqual({ kind: 'provider-request', requestId: '47' });
    expect(classifyNotification({ event: 'mission.cancelled_by_client', audience: 'provider', requestId: 47, screen: 'Dashboard' })).toEqual({ kind: 'provider-request', requestId: '47' });
  });
  it('sans mission : l’écran déclaré, le support, ou l’espace', () => {
    expect(classifyNotification({ event: 'account.bank_ready', audience: 'provider', screen: 'Wallet' })).toEqual({ kind: 'screen' });
    expect(classifyNotification({ event: 'support.report_received', audience: 'client', screen: 'Support' })).toEqual({ kind: 'support' });
    expect(classifyNotification({ event: 'message.received', screen: 'Messages', senderId: 'u1' })).toEqual({ kind: 'screen' });
  });
  it('les anciennes notifications continuent de se classer', () => {
    expect(classifyNotification({ category: 'refund', requestId: 12 })).toEqual({ kind: 'refund', requestId: '12' });
    expect(classifyNotification({ type: 'quote_accepted', requestId: 12 })).toEqual({ kind: 'provider-request', requestId: '12' });
  });
});
