// Le portefeuille prestataire (walletService) et l'instance axios qui le porte
// (apiClient) : solde et historiques doivent toujours rendre un tableau, quel
// que soit l'emballage du serveur, et une erreur HTTP doit ressortir
// normalisée { message, status, data } — un 401 efface la session.
process.env.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost/api';

jest.mock('../../logger', () => ({ devLog: jest.fn(), devWarn: jest.fn(), devError: jest.fn() }));

const mockGetToken = jest.fn();
const mockRemoveToken = jest.fn();
jest.mock('../../storage', () => ({
  tokenStorage: {
    getToken: () => mockGetToken(),
    removeToken: () => mockRemoveToken(),
  },
}));

// require (et non import) : l'URL d'API doit exister avant le chargement du module.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const apiClient = require('../apiClient').default;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { walletService } = require('../walletService');

type Reply = { status: number; data: any };
let calls: { url?: string; method?: string; headers: Record<string, any> }[] = [];
let reply: Reply | Error = { status: 200, data: {} };

beforeEach(() => {
  calls = [];
  reply = { status: 200, data: {} };
  mockGetToken.mockReset().mockResolvedValue('tok-123');
  mockRemoveToken.mockReset().mockResolvedValue(undefined);
  // Adaptateur de test : aucune requête réseau, on répond à la main.
  apiClient.defaults.adapter = async (config: any) => {
    calls.push({ url: config.url, method: config.method, headers: { ...config.headers } });
    if (reply instanceof Error) throw reply;
    const response = { data: reply.data, status: reply.status, statusText: '', headers: {}, config, request: {} };
    if (reply.status >= 400) {
      const err: any = new Error(`Request failed with status code ${reply.status}`);
      err.isAxiosError = true;
      err.config = config;
      err.response = response;
      throw err;
    }
    return response;
  };
});

describe('walletService', () => {
  it('getBalance : GET /wallet, renvoie le corps tel quel (centimes)', async () => {
    reply = { status: 200, data: { balance: 24545, currency: 'EUR' } };
    await expect(walletService.getBalance()).resolves.toEqual({ balance: 24545, currency: 'EUR' });
    expect(calls[0].url).toBe('/wallet');
    expect(calls[0].method).toBe('get');
  });

  it('getTransactions : limite 50 par défaut, ou celle demandée', async () => {
    reply = { status: 200, data: [] };
    await walletService.getTransactions();
    await walletService.getTransactions(5);
    expect(calls.map((c) => c.url)).toEqual(['/wallet/txs?limit=50', '/wallet/txs?limit=5']);
  });

  it('getTransactions : tableau nu, enveloppe { transactions } ou rien → toujours un tableau', async () => {
    const txs = [{ id: 't1', amount: 100 }];
    reply = { status: 200, data: txs };
    await expect(walletService.getTransactions()).resolves.toEqual(txs);
    reply = { status: 200, data: { transactions: txs } };
    await expect(walletService.getTransactions()).resolves.toEqual(txs);
    reply = { status: 200, data: {} };
    await expect(walletService.getTransactions()).resolves.toEqual([]);
    reply = { status: 200, data: null };
    await expect(walletService.getTransactions()).resolves.toEqual([]);
  });

  it('getWithdrawHistory : tableau nu, enveloppe { withdraws } ou rien', async () => {
    const w = [{ id: 1, amount: 5000 }];
    reply = { status: 200, data: w };
    await expect(walletService.getWithdrawHistory()).resolves.toEqual(w);
    reply = { status: 200, data: { withdraws: w } };
    await expect(walletService.getWithdrawHistory()).resolves.toEqual(w);
    reply = { status: 200, data: { other: 1 } };
    await expect(walletService.getWithdrawHistory()).resolves.toEqual([]);
    expect(calls[0].url).toBe('/wallet/withdraws');
  });
});

describe('apiClient (axios)', () => {
  it('injecte le Bearer quand un token existe, rien sinon', async () => {
    await walletService.getBalance();
    expect(calls[0].headers.Authorization).toBe('Bearer tok-123');
    mockGetToken.mockResolvedValue(null);
    await walletService.getBalance();
    expect(calls[1].headers.Authorization).toBeUndefined();
  });

  it('erreur HTTP : message du serveur (error, sinon message), status et data conservés', async () => {
    reply = { status: 422, data: { error: 'Montant invalide', code: 'BAD_AMOUNT' } };
    await expect(walletService.getBalance()).rejects.toMatchObject({
      message: 'Montant invalide', status: 422, data: { error: 'Montant invalide', code: 'BAD_AMOUNT' },
    });
    reply = { status: 500, data: { message: 'Boom' } };
    await expect(walletService.getBalance()).rejects.toMatchObject({ message: 'Boom', status: 500 });
    expect(mockRemoveToken).not.toHaveBeenCalled();
  });

  it('401 : le token est effacé (AuthContext renverra au login)', async () => {
    reply = { status: 401, data: { error: 'AUTH_INVALID' } };
    await expect(walletService.getBalance()).rejects.toMatchObject({ status: 401, message: 'AUTH_INVALID' });
    expect(mockRemoveToken).toHaveBeenCalledTimes(1);
  });

  it('410 sur l’ancien retrait : erreur normalisée, la session reste', async () => {
    reply = { status: 410, data: { error: 'GONE' } };
    await expect(apiClient.post('/wallet/withdraw', { amount: 100 })).rejects.toMatchObject({ status: 410, message: 'GONE' });
    expect(mockRemoveToken).not.toHaveBeenCalled();
  });

  it('erreur réseau (pas de réponse) : status indéfini, message d’origine', async () => {
    reply = new Error('Network Error');
    const err: any = await walletService.getBalance().catch((e: any) => e);
    expect(err.message).toBe('Network Error');
    expect(err.status).toBeUndefined();
    expect(err.data).toBeUndefined();
    expect(mockRemoveToken).not.toHaveBeenCalled();
  });
});
