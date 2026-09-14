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
