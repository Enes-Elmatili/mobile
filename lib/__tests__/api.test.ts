// La couche requête de lib/api.ts : chaque appel de l'app (paiement, devis,
// acceptation de mission) passe par ApiClient.request. On protège les en-têtes
// de langue et d'auth, le refresh sur 401 (une seule fois, file d'attente),
// la session expirée, les erreurs réseau / HTML / JSON illisible, et l'URL du
// PDF de facture (le polonais retombe sur l'anglais).
process.env.EXPO_PUBLIC_API_URL = 'https://api.fixed.test/api';

jest.mock('../logger', () => ({ devLog: jest.fn(), devWarn: jest.fn(), devError: jest.fn() }));

// Stockage du token en mémoire : setToken/removeToken modifient ce que getToken rend.
const mockStore: { token: string | null } = { token: null };
jest.mock('../storage', () => ({
  tokenStorage: {
    getToken: jest.fn(async () => mockStore.token),
    setToken: jest.fn(async (t: string) => { mockStore.token = t; }),
    removeToken: jest.fn(async () => { mockStore.token = null; }),
  },
}));

jest.mock('../feedback/feedback', () => ({ feedback: { error: jest.fn(), toast: jest.fn() } }));
jest.mock('../i18n', () => ({ __esModule: true, default: { language: 'fr' } }));

/* eslint-disable @typescript-eslint/no-require-imports -- l'URL d'API doit être posée avant le chargement du module */
const { api, client } = require('../api');
const { tokenStorage } = require('../storage');
const { feedback } = require('../feedback/feedback');
const i18n = require('../i18n').default;
/* eslint-enable @typescript-eslint/no-require-imports */

const BASE = 'https://api.fixed.test/api';

type FakeRes = { status: number; body?: any; raw?: string; contentType?: string };
function res({ status, body, raw, contentType = 'application/json' }: FakeRes) {
  const text = raw ?? (body === undefined ? '' : JSON.stringify(body));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => text,
    json: async () => JSON.parse(text),
  };
}

const fetchMock = jest.fn();
(global as any).fetch = fetchMock;

const headersOf = (i: number) => fetchMock.mock.calls[i][1].headers as Record<string, string>;
const urlOf = (i: number) => fetchMock.mock.calls[i][0] as string;
const flush = async (n = 20) => { for (let i = 0; i < n; i++) await Promise.resolve(); };

beforeEach(() => {
  fetchMock.mockReset();
  mockStore.token = 'old';
  i18n.language = 'fr';
  jest.clearAllMocks();
});

describe('en-têtes', () => {
  it('JSON, langue courte en Accept-Language et X-Client-Lang, Bearer', async () => {
    i18n.language = 'nl-BE';
    fetchMock.mockResolvedValueOnce(res({ status: 200, body: { ok: true } }));
    await api.get('/requests');
    const h = headersOf(0);
    expect(urlOf(0)).toBe(`${BASE}/requests`);
    expect(h['Content-Type']).toBe('application/json');
    expect(h['Accept-Language']).toBe('nl');
    expect(h['X-Client-Lang']).toBe('nl');
    expect(h.Authorization).toBe('Bearer old');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });

  it('langue absente → fr ; majuscules ramenées en minuscules', async () => {
    i18n.language = undefined;
    fetchMock.mockResolvedValue(res({ status: 200, body: {} }));
    await api.get('/x');
    expect(headersOf(0)['Accept-Language']).toBe('fr');
    i18n.language = 'PL';
    await api.get('/x');
    expect(headersOf(1)['X-Client-Lang']).toBe('pl');
  });

  it('sans token : pas d’Authorization du tout', async () => {
    mockStore.token = null;
    fetchMock.mockResolvedValueOnce(res({ status: 200, body: {} }));
    await api.get('/categories');
    expect(headersOf(0)).not.toHaveProperty('Authorization');
  });

  it('corps sérialisé, méthode transmise, en-têtes de l’appelant fusionnés, URL absolue respectée', async () => {
    fetchMock.mockResolvedValueOnce(res({ status: 200, body: { id: 1 } }));
    await api.request('https://autre.test/hook', { method: 'PATCH', body: { a: 1 }, headers: { 'X-Test': 'oui' } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://autre.test/hook');
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe('{"a":1}');
    expect(init.headers['X-Test']).toBe('oui');
    expect(init.signal).toBeDefined();
  });

  it('pas de body quand il n’y en a pas', async () => {
    fetchMock.mockResolvedValueOnce(res({ status: 200, body: {} }));
    await api.post('/requests/1/accept');
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('body');
  });
});

describe('réponses et erreurs', () => {
  it('200 : renvoie le JSON parsé', async () => {
    fetchMock.mockResolvedValueOnce(res({ status: 200, body: { data: [1, 2] } }));
    await expect(api.get('/requests')).resolves.toEqual({ data: [1, 2] });
  });

  it('JSON illisible : « Réponse invalide du serveur (status) »', async () => {
    fetchMock.mockResolvedValueOnce(res({ status: 200, raw: 'pas du json', contentType: 'text/plain' }));
    await expect(api.get('/x')).rejects.toMatchObject({ message: 'Réponse invalide du serveur (200)', status: 200 });
  });

  it('page HTML (proxy) : erreur marquée isHTMLResponse, même sans content-type', async () => {
    fetchMock.mockResolvedValueOnce(res({ status: 502, raw: '<!DOCTYPE html><p>Bad gateway</p>', contentType: '' }));
    await expect(api.get('/x')).rejects.toMatchObject({
      message: 'Serveur indisponible (502)', status: 502, isHTMLResponse: true, isNgrokError: false,
    });
  });

  it('503 HTML du tunnel ngrok : message dédié', async () => {
    fetchMock.mockResolvedValueOnce(res({ status: 503, raw: '<html>ERR_NGROK_3200</html>', contentType: 'text/html' }));
    const err: any = await api.get('/x').catch((e: any) => e);
    expect(err.status).toBe(503);
    expect(err.isNgrokError).toBe(true);
    expect(err.message).toBe('Serveur temporairement indisponible (503). Tunnel ngrok down.');
  });

  it('503 JSON : message du serveur, data jointe', async () => {
    fetchMock.mockResolvedValueOnce(res({ status: 503, body: { error: 'Maintenance' } }));
    await expect(api.get('/x')).rejects.toMatchObject({ message: 'Maintenance', status: 503, data: { error: 'Maintenance' } });
    fetchMock.mockResolvedValueOnce(res({ status: 503, body: {} }));
    await expect(api.get('/x')).rejects.toMatchObject({ message: 'Serveur temporairement indisponible (503)' });
  });

  it('4xx/5xx JSON : error, sinon message, sinon « HTTP n »', async () => {
    fetchMock.mockResolvedValueOnce(res({ status: 409, body: { error: 'REQUEST_ALREADY_CLAIMED' } }));
    await expect(api.post('/requests/1/accept')).rejects.toMatchObject({ message: 'REQUEST_ALREADY_CLAIMED', status: 409 });
    fetchMock.mockResolvedValueOnce(res({ status: 400, body: { message: 'Code promo invalide' } }));
    await expect(api.post('/payments/setup')).rejects.toMatchObject({ message: 'Code promo invalide', status: 400 });
    fetchMock.mockResolvedValueOnce(res({ status: 500, body: {} }));
    await expect(api.get('/x')).rejects.toMatchObject({ message: 'HTTP 500', status: 500, data: {} });
  });

  it('erreur réseau : relancée telle quelle, sans status', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    const err: any = await api.get('/x').catch((e: any) => e);
    expect(err).toBeInstanceOf(TypeError);
    expect(err.message).toBe('Network request failed');
    expect(err.status).toBeUndefined();
    expect(tokenStorage.removeToken).not.toHaveBeenCalled();
  });

  it('délai dépassé : la requête est annulée au bout de 12 s', async () => {
    jest.useFakeTimers();
    try {
      fetchMock.mockImplementationOnce((_url: string, init: any) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
      }));
      const p = api.get('/lent').catch((e: any) => e);
      await flush();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(11_999);
      await flush();
      expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
      jest.advanceTimersByTime(1);
      const err: any = await p;
      expect(err.name).toBe('AbortError');
      expect(err.status).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('401 : refresh du token puis rejeu', () => {
  // Le serveur : 401 pour l'ancien token, 200 pour le nouveau.
  function serverWithRefresh(refresh: () => any) {
    fetchMock.mockImplementation(async (url: string, init: any) => {
      if (url === `${BASE}/auth/refresh`) return refresh();
      return init.headers.Authorization === 'Bearer new'
        ? res({ status: 200, body: { ok: true, url } })
        : res({ status: 401, body: { error: 'AUTH_INVALID' } });
    });
  }

  it('refresh réussi : nouveau token stocké, requête rejouée avec lui', async () => {
    serverWithRefresh(() => res({ status: 200, body: { token: 'new' } }));
    await expect(api.get('/payments')).resolves.toEqual({ ok: true, url: `${BASE}/payments` });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(urlOf(1)).toBe(`${BASE}/auth/refresh`);
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
    expect(headersOf(1).Authorization).toBe('Bearer old');
    expect(headersOf(2).Authorization).toBe('Bearer new');
    expect(tokenStorage.setToken).toHaveBeenCalledWith('new');
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it('refresh refusé : session effacée, toast « session expirée », erreur 401', async () => {
    serverWithRefresh(() => res({ status: 401, body: { error: 'REVOKED' } }));
    await expect(api.get('/payments')).rejects.toMatchObject({ message: 'Session expirée', status: 401 });
    expect(tokenStorage.removeToken).toHaveBeenCalledTimes(1);
    expect(feedback.error).toHaveBeenCalledWith('common.session_expired');
    expect(mockStore.token).toBeNull();
  });

  it('refresh sans token dans la réponse : même chemin « session expirée »', async () => {
    serverWithRefresh(() => res({ status: 200, body: {} }));
    await expect(api.get('/x')).rejects.toMatchObject({ message: 'Session expirée', status: 401 });
    expect(tokenStorage.setToken).not.toHaveBeenCalled();
  });

  it('refresh en panne réseau : session expirée, pas de crash', async () => {
    serverWithRefresh(() => { throw new TypeError('Network request failed'); });
    await expect(api.get('/x')).rejects.toMatchObject({ message: 'Session expirée' });
  });

  it('aucun token à rafraîchir : pas d’appel /auth/refresh', async () => {
    mockStore.token = null;
    fetchMock.mockResolvedValue(res({ status: 401, body: { error: 'AUTH_REQUIRED' } }));
    await expect(api.get('/x')).rejects.toMatchObject({ message: 'Session expirée' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('un seul rejeu : si le nouveau token prend aussi 401, l’erreur remonte sans boucle', async () => {
    fetchMock.mockImplementation(async (url: string) => (url === `${BASE}/auth/refresh`
      ? res({ status: 200, body: { token: 'new' } })
      : res({ status: 401, body: { error: 'FORBIDDEN_ROLE' } })));
    await expect(api.get('/admin')).rejects.toMatchObject({ message: 'FORBIDDEN_ROLE', status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(tokenStorage.removeToken).not.toHaveBeenCalled();
  });

  it('login / signup en 401 : identifiants faux, pas de refresh ni de déconnexion', async () => {
    fetchMock.mockResolvedValue(res({ status: 401, body: { error: 'Identifiants invalides' } }));
    await expect(api.auth.login('a@b.be', 'x')).rejects.toMatchObject({ message: 'Identifiants invalides', status: 401 });
    await expect(api.auth.signup('a@b.be', 'x')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(tokenStorage.removeToken).not.toHaveBeenCalled();
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it('401 simultanés : un seul refresh, les deux requêtes rejouées', async () => {
    let releaseRefresh: (v: any) => void = () => {};
    const refreshGate = new Promise((r) => { releaseRefresh = r; });
    serverWithRefresh(() => refreshGate);
    const a = api.get('/a');
    const b = api.get('/b');
    await flush(50);
    releaseRefresh(res({ status: 200, body: { token: 'new' } }));
    await expect(a).resolves.toMatchObject({ url: `${BASE}/a` });
    await expect(b).resolves.toMatchObject({ url: `${BASE}/b` });
    const refreshCalls = fetchMock.mock.calls.filter(([u]) => u === `${BASE}/auth/refresh`);
    expect(refreshCalls).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});

describe('méthodes métier', () => {
  beforeEach(() => fetchMock.mockResolvedValue(res({ status: 200, body: { ok: true } })));

  it('login stocke le token rendu ; logout l’efface avant d’appeler le serveur', async () => {
    fetchMock.mockResolvedValueOnce(res({ status: 200, body: { token: 'jwt-1', user: { id: 1 } } }));
    await api.auth.login('a@b.be', 'pw');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'a@b.be', password: 'pw' });
    expect(tokenStorage.setToken).toHaveBeenCalledWith('jwt-1');

    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(api.auth.logout()).resolves.toBeUndefined();
    expect(mockStore.token).toBeNull();
    await flush();
    expect(urlOf(1)).toBe(`${BASE}/auth/logout`);
  });

  it('payments.setup : refuse sans session, sans appel réseau', async () => {
    mockStore.token = null;
    await expect(api.payments.setup('42')).rejects.toThrow('Erreur de session');
    await expect(api.payments.intent('42')).rejects.toThrow('Erreur de session');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('payments.setup / quotes.calloutPayment : promoCode transmis seulement s’il existe', async () => {
    await api.payments.setup('42');
    await api.payments.setup('42', 'BIENVENUE');
    await api.quotes.calloutPayment(7);
    await api.quotes.calloutPayment(7, 'DEPLACEMENT');
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(bodies).toEqual([
      { requestId: '42' },
      { requestId: '42', promoCode: 'BIENVENUE' },
      { requestId: 7 },
      { requestId: 7, promoCode: 'DEPLACEMENT' },
    ]);
    expect(urlOf(0)).toBe(`${BASE}/payments/setup`);
    expect(urlOf(2)).toBe(`${BASE}/quotes/callout-payment`);
  });

  it('quotes : envoi du devis, acceptation, confirmation avec ou sans PaymentIntent', async () => {
    await api.quotes.send(12, { laborAmount: 120, partsAmount: 35.5 });
    await api.quotes.confirmPayment(3, 'pi_123');
    await api.quotes.confirmPayment(3);
    expect(urlOf(0)).toBe(`${BASE}/quotes/12`);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ laborAmount: 120, partsAmount: 35.5 });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ paymentIntentId: 'pi_123' });
    expect(fetchMock.mock.calls[2][1]).not.toHaveProperty('body');
  });

  it('requests.create : coordonnées hors bornes refusées avant tout appel', () => {
    expect(() => api.requests.create({ lat: 91, lng: 4 })).toThrow('Latitude invalide');
    expect(() => api.requests.create({ lat: 50, lng: -181 })).toThrow('Longitude invalide');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('providers.available : seuls les filtres fournis vont dans la query', async () => {
    await api.providers.available({ lat: 50.84, lng: 4.35, categoryId: 3 });
    expect(urlOf(0)).toBe(`${BASE}/providers/available?lat=50.84&lng=4.35&categoryId=3`);
  });

  it('client() : raccourci vers request', async () => {
    await client('/stats', 'POST', { a: 1 });
    expect(urlOf(0)).toBe(`${BASE}/stats`);
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });
});

describe('invoices.getPdfUrl', () => {
  it.each([
    ['fr', 'fr'],
    ['nl-BE', 'nl'],
    ['en-GB', 'en'],
    ['pl', 'en'],
    ['pl-PL', 'en'],
    ['de', 'en'],
    [undefined, 'fr'],
  ])('langue %s → modèle %s', (lang, pdf) => {
    i18n.language = lang;
    expect(api.invoices.getPdfUrl('42')).toBe(`https://api.fixed.test/api/invoices/42/pdf?lang=${pdf}`);
  });

  it('base sans /api final (avec ou sans slash)', () => {
    const prev = process.env.EXPO_PUBLIC_API_URL;
    try {
      process.env.EXPO_PUBLIC_API_URL = 'https://x.test/api/';
      expect(api.invoices.getPdfUrl('9')).toBe('https://x.test/api/invoices/9/pdf?lang=fr');
      process.env.EXPO_PUBLIC_API_URL = 'https://x.test';
      expect(api.invoices.getPdfUrl('9')).toBe('https://x.test/api/invoices/9/pdf?lang=fr');
    } finally {
      process.env.EXPO_PUBLIC_API_URL = prev;
    }
  });
});

describe('uploads multipart', () => {
  it('providerDocs.upload : sans Content-Type, 401 → refresh puis rejeu', async () => {
    fetchMock.mockImplementation(async (url: string, init: any) => {
      if (url === `${BASE}/auth/refresh`) return res({ status: 200, body: { token: 'new' } });
      return init.headers.Authorization === 'Bearer new'
        ? res({ status: 201, body: { id: 5 } })
        : res({ status: 401, body: {} });
    });
    const form = {} as FormData;
    await expect(api.providerDocs.upload(form)).resolves.toEqual({ id: 5 });
    expect(headersOf(0)).not.toHaveProperty('Content-Type');
    expect(fetchMock.mock.calls[2][1].body).toBe(form);
  });

  it('providerDocs.upload / requestPhotos.upload : erreurs lisibles', async () => {
    fetchMock.mockResolvedValueOnce(res({ status: 200, raw: 'oops', contentType: 'text/plain' }));
    await expect(api.providerDocs.upload({} as FormData)).rejects.toThrow('Réponse invalide du serveur');
    fetchMock.mockResolvedValueOnce(res({ status: 413, body: { error: 'FILE_TOO_LARGE' } }));
    await expect(api.providerDocs.upload({} as FormData)).rejects.toMatchObject({ message: 'FILE_TOO_LARGE', status: 413 });
    fetchMock.mockResolvedValueOnce(res({ status: 422, body: { code: 'BAD_SHOT' } }));
    await expect(api.requestPhotos.upload(8, {} as FormData)).rejects.toMatchObject({ message: 'BAD_SHOT', status: 422 });
    expect(urlOf(2)).toBe(`${BASE}/requests/8/photos`);
  });
});
