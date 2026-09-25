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
    expect(classifyNotification({ event: 'request.new', audience: 'provider', requestId: 47, screen: 'Dashboard' })).toEqual({ kind: 'opportunity', home: true, requestId: '47' });
    expect(classifyNotification({ event: 'request.quote_wanted', audience: 'provider', requestId: 47, screen: 'Missions' })).toEqual({ kind: 'opportunity', home: false, requestId: '47' });
    // Préférée mais planifiée : l'agenda, pas l'accueil.
    expect(classifyNotification({ event: 'request.preferred', type: 'preferred_opportunity', requestId: 47, screen: 'Dashboard' })).toEqual({ kind: 'opportunity', home: false, requestId: '47' });
    expect(classifyNotification({ event: 'refund.issued', audience: 'client', requestId: 47, screen: 'Documents' })).toEqual({ kind: 'refund', requestId: '47' });
    expect(classifyNotification({ event: 'quote.expired_refunded', audience: 'client', requestId: 47, screen: 'Documents' })).toEqual({ kind: 'refund', requestId: '47' });
  });
  it('une mission se re-résout avec le rôle déclaré', () => {
    expect(classifyNotification({ event: 'mission.arrived', audience: 'client', requestId: 47, screen: 'MissionView' })).toEqual({ kind: 'client-request', requestId: '47' });
    expect(classifyNotification({ event: 'dispute.opened', audience: 'provider', requestId: 47, screen: 'MissionView' })).toEqual({ kind: 'provider-request', requestId: '47' });
    expect(classifyNotification({ event: 'quote.accepted', audience: 'provider', requestId: 47, screen: 'Ongoing' })).toEqual({ kind: 'provider-request', requestId: '47' });
    expect(classifyNotification({ event: 'mission.done_provider', audience: 'provider', requestId: 47, screen: 'Earnings' })).toEqual({ kind: 'provider-request', requestId: '47' });
    expect(classifyNotification({ event: 'quote.refused', audience: 'provider', requestId: 47, screen: 'Missions' })).toEqual({ kind: 'provider-request', requestId: '47' });
    // Sans audience (litiges, support) : le rôle de celui qui tape décide — un prestataire ne va pas sur le suivi client.
    expect(classifyNotification({ event: 'dispute.resolved', requestId: 47, screen: 'MissionView' }, { isProvider: true })).toEqual({ kind: 'provider-request', requestId: '47' });
    expect(classifyNotification({ event: 'dispute.resolved', requestId: 47, screen: 'MissionView' }, { isProvider: false }).dest.params).toEqual({ openRequestId: '47' });
  });
  it('sans mission : l’écran déclaré, le support, ou l’espace', () => {
    expect(classifyNotification({ event: 'account.bank_ready', audience: 'provider', screen: 'Wallet' })).toEqual({ kind: 'screen' });
    expect(classifyNotification({ event: 'support.report_received', audience: 'client', screen: 'Support' })).toEqual({ kind: 'support' });
    expect(classifyNotification({ event: 'message.received', screen: 'Messages' })).toEqual({ kind: 'screen' });
  });
  it('les anciennes notifications continuent de se classer', () => {
    expect(classifyNotification({ category: 'refund', requestId: 12 })).toEqual({ kind: 'refund', requestId: '12' });
    expect(classifyNotification({ type: 'quote_accepted', requestId: 12 })).toEqual({ kind: 'provider-request', requestId: '12' });
    expect(classifyNotification({ type: 'new_request', requestId: 12 })).toEqual({ kind: 'opportunity', home: true, requestId: '12' });
    expect(classifyNotification({ type: 'new_opportunity', requestId: 12 })).toEqual({ kind: 'opportunity', home: false, requestId: '12' });
    expect(classifyNotification({ type: 'support_escalation', ticketId: 't9' }).dest.pathname).toBe('/tickets/[id]');
  });
});

describe('resolveProviderDestination — la mission vit sur l’accueil', () => {
  const { resolveProviderDestination } = require('@/lib/requestDestination');
  it('ACCEPTED / ONGOING / QUOTE_SENT / QUOTE_ACCEPTED → l’accueil, la mission devant', () => {
    for (const status of ['ACCEPTED', 'ONGOING', 'QUOTE_SENT', 'QUOTE_ACCEPTED']) {
      const d = resolveProviderDestination({ id: 7, status });
      expect(d.pathname).toBe('/(tabs)/dashboard');
      expect(d.params).toEqual({ mission: '7' });
    }
  });
  it('DONE → le bilan ; pas encore prise ou perdue → « à prendre » ; annulée → l’agenda', () => {
    expect(resolveProviderDestination({ id: 7, status: 'DONE' }).pathname).toBe('/request/[id]/earnings');
    expect(resolveProviderDestination({ id: 7, status: 'QUOTE_PENDING' }).pathname).toBe('/(tabs)/missions');
    expect(resolveProviderDestination({ id: 7, status: 'PUBLISHED' }).pathname).toBe('/(tabs)/missions');
    expect(resolveProviderDestination({ id: 7, status: 'CANCELLED' }).pathname).toBe('/(tabs)/missions');
    expect(resolveProviderDestination(null).pathname).toBe('/(tabs)/missions');
  });
});

describe('classifyNotification — chaque événement mène à ce qu’il annonce (audit 2026-09-25)', () => {
  const { classifyNotification } = require('@/lib/requestDestination');
  const dest = (data, opts) => classifyNotification(data, opts).dest;
  it('devis expiré sans remboursement : l’accueil, pas une preuve de remboursement', () => {
    expect(dest({ event: 'quote.expired', audience: 'client', requestId: 47, screen: 'Dashboard' }).pathname).toBe('/(tabs)/dashboard');
  });
  it('reçu de paiement : la facture de la mission', () => {
    const d = dest({ event: 'payment.receipt', audience: 'client', requestId: 47, screen: 'Documents' });
    expect(d.pathname).toBe('/(tabs)/documents');
    expect(d.params).toEqual({ openRequestId: '47' });
  });
  it('facture de commission : les factures du prestataire', () => {
    expect(dest({ event: 'payment.commission_invoice', audience: 'provider', requestId: 47, screen: 'Wallet' }).pathname).toBe('/invoices');
  });
  it('litige côté client : la facture, jamais la page de notation', () => {
    for (const event of ['dispute.registered', 'dispute.resolved_client_wins', 'dispute.resolved']) {
      expect(dest({ event, audience: 'client', requestId: 47, screen: 'MissionView' }).params).toEqual({ openRequestId: '47' });
    }
  });
  it('signalement reçu : le ticket ouvert, pas un formulaire vierge', () => {
    const d = dest({ event: 'support.report_received', audience: 'client', ticketId: 'tk1', category: 'support', screen: 'Support' });
    expect(d.pathname).toBe('/tickets/[id]');
    expect(d.params).toEqual({ id: 'tk1' });
  });
  it('signalement d’un client : la mission du prestataire, pas le formulaire client', () => {
    expect(classifyNotification({ event: 'support.client_report', audience: 'provider', type: 'support_escalation', requestId: 47, screen: 'MissionView' })).toEqual({ kind: 'provider-request', requestId: '47' });
  });
  it('mission retirée au prestataire : pas de re-résolution sur une mission qui n’est plus la sienne', () => {
    for (const event of ['mission.cancelled_by_client', 'mission.reassigned', 'mission.abandoned']) {
      expect(dest({ event, audience: 'provider', requestId: 47, screen: 'Dashboard' }).pathname).toBe('/(tabs)/missions');
    }
    expect(dest({ event: 'mission.reassigned_in_progress', audience: 'provider', requestId: 47 }).pathname).toBe('/(tabs)/dashboard');
  });
  it('compte validé ou réactivé : l’accueil ; refusé / suspendu : le dossier', () => {
    expect(dest({ event: 'account.approved', audience: 'provider', type: 'kyc_status', status: 'ACTIVE' }).pathname).toBe('/(tabs)/dashboard');
    expect(dest({ event: 'account.reactivated', audience: 'provider', type: 'kyc_status' }).pathname).toBe('/(tabs)/dashboard');
    expect(classifyNotification({ event: 'account.suspended', audience: 'provider', type: 'kyc_status' })).toEqual({ kind: 'kyc' });
  });
  it('avis reçu : le bilan de la mission notée', () => {
    const d = dest({ event: 'review.received', audience: 'provider', requestId: 47, screen: 'Profile' });
    expect(d.pathname).toBe('/request/[id]/earnings');
  });
  it('message : la conversation, avec la mission si connue', () => {
    const d = dest({ event: 'message.received', screen: 'Messages', senderId: 'u1', requestId: 47 });
    expect(d.pathname).toBe('/messages/[userId]');
    expect(d.params).toEqual({ userId: 'u1', requestId: '47' });
  });
});
