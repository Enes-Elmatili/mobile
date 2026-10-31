// La file hors ligne (lib/OfflineQueueContext.tsx) : une demande créée, une
// mission acceptée ou une note laissée sans réseau doit partir au retour en
// ligne — une seule fois, vers le bon endpoint, avec un nombre d'essais borné.
// Une position GPS périmée, elle, ne doit jamais être rejouée.
import React from 'react';
import { render, act } from '@testing-library/react-native';

process.env.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost/api';

const mockNet = { isOnline: true, wasOffline: false };
jest.mock('@/lib/NetworkContext', () => ({ useNetwork: () => mockNet }));
const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({ api: { post: (...a) => mockPost(...a) } }));
jest.mock('@/lib/logger', () => ({ devLog: jest.fn(), devWarn: jest.fn(), devError: jest.fn() }));

const AsyncStorage = require('@react-native-async-storage/async-storage');
const { OfflineQueueProvider, useOfflineQueue } = require('@/lib/OfflineQueueContext');

const KEY = 'fixed:offline_queue';
let q;
function Probe() { q = useOfflineQueue(); return null; }
const tree = () => <OfflineQueueProvider><Probe /></OfflineQueueProvider>;
async function mount() {
  const r = render(tree());
  await act(async () => {});
  return r;
}
const stored = async () => JSON.parse((await AsyncStorage.getItem(KEY)) || 'null');

beforeEach(async () => {
  jest.clearAllMocks();
  mockNet.isOnline = true;
  mockNet.wasOffline = false;
  mockPost.mockResolvedValue({ ok: true });
  await AsyncStorage.clear();
});

describe('enqueue', () => {
  it('persiste l’action avec 3 essais (0 pour le GPS)', async () => {
    await mount();
    await act(async () => { await q.enqueue('CREATE_REQUEST', { title: 'Fuite' }); });
    await act(async () => { await q.enqueue('UPDATE_LOCATION', { lat: 50.8, lng: 4.3 }); });
    expect(q.pendingCount).toBe(2);
    const saved = await stored();
    expect(saved.map((a) => [a.type, a.retryCount, a.maxRetries])).toEqual([
      ['CREATE_REQUEST', 0, 3],
      ['UPDATE_LOCATION', 0, 0],
    ]);
    expect(saved[0].payload).toEqual({ title: 'Fuite' });
    expect(saved[0].id).not.toBe(saved[1].id);
    expect(Number.isFinite(Date.parse(saved[0].createdAt))).toBe(true);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('recharge la file persistée au démarrage', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify([{ id: 'a', type: 'SUBMIT_RATING', payload: { rating: 5 }, createdAt: new Date().toISOString(), retryCount: 1, maxRetries: 3 }]));
    await mount();
    expect(q.pendingCount).toBe(1);
    expect(q.queue[0].id).toBe('a');
  });

  it('stockage corrompu : file vide, pas de crash', async () => {
    await AsyncStorage.setItem(KEY, '{pas du json');
    await mount();
    expect(q.pendingCount).toBe(0);
  });
});

describe('processQueue', () => {
  it('chaque type part vers son endpoint, la file se vide', async () => {
    await mount();
    await act(async () => {
      await q.enqueue('CREATE_REQUEST', { title: 'Fuite' });
      await q.enqueue('CANCEL_REQUEST', { requestId: 7 });
      await q.enqueue('ACCEPT_MISSION', { requestId: 8 });
      await q.enqueue('SUBMIT_RATING', { requestId: 9, rating: 5 });
      await q.enqueue('UPDATE_LOCATION', { lat: 1, lng: 2 });
    });
    await act(async () => { await q.processQueue(); });
    expect(mockPost.mock.calls).toEqual([
      ['/requests', { title: 'Fuite' }],
      ['/requests/7/cancel', { requestId: 7 }],
      ['/requests/8/accept', { requestId: 8 }],
      ['/ratings', { requestId: 9, rating: 5 }],
      ['/providers/location', { lat: 1, lng: 2 }],
    ]);
    expect(q.pendingCount).toBe(0);
    expect(q.isProcessing).toBe(false);
    expect(await stored()).toEqual([]);
  });

  it('échec : l’action reste avec un essai de plus, abandonnée après 3 nouveaux essais', async () => {
    mockPost.mockRejectedValue(new Error('offline'));
    await mount();
    await act(async () => { await q.enqueue('ACCEPT_MISSION', { requestId: 8 }); });
    for (const expected of [1, 2, 3]) {
      await act(async () => { await q.processQueue(); });
      expect(q.queue).toHaveLength(1);
      expect(q.queue[0].retryCount).toBe(expected);
    }
    await act(async () => { await q.processQueue(); });
    expect(q.queue).toHaveLength(0);
    expect(mockPost).toHaveBeenCalledTimes(4);
    expect(await stored()).toEqual([]);
  });

  it('seules les actions en échec restent, dans l’ordre', async () => {
    mockPost.mockImplementation(async (url) => { if (url === '/ratings') throw new Error('500'); return {}; });
    await mount();
    await act(async () => {
      await q.enqueue('SUBMIT_RATING', { rating: 4 });
      await q.enqueue('CREATE_REQUEST', { title: 'B' });
    });
    await act(async () => { await q.processQueue(); });
    expect(q.queue.map((a) => a.type)).toEqual(['SUBMIT_RATING']);
  });

  it('GPS en échec : jeté tout de suite (aucun nouvel essai)', async () => {
    mockPost.mockRejectedValue(new Error('offline'));
    await mount();
    await act(async () => { await q.enqueue('UPDATE_LOCATION', { lat: 1, lng: 2 }); });
    await act(async () => { await q.processQueue(); });
    expect(q.pendingCount).toBe(0);
  });

  it('GPS de plus de 30 s : jamais rejoué', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify([
      { id: 'old', type: 'UPDATE_LOCATION', payload: { lat: 1 }, createdAt: new Date(Date.now() - 31_000).toISOString(), retryCount: 0, maxRetries: 0 },
      { id: 'new', type: 'UPDATE_LOCATION', payload: { lat: 2 }, createdAt: new Date(Date.now() - 5_000).toISOString(), retryCount: 0, maxRetries: 0 },
    ]));
    await mount();
    await act(async () => { await q.processQueue(); });
    expect(mockPost.mock.calls).toEqual([['/providers/location', { lat: 2 }]]);
    expect(q.pendingCount).toBe(0);
  });

  it('type inconnu : traité comme un échec', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify([{ id: 'x', type: 'NOPE', payload: {}, createdAt: new Date().toISOString(), retryCount: 0, maxRetries: 3 }]));
    await mount();
    await act(async () => { await q.processQueue(); });
    expect(mockPost).not.toHaveBeenCalled();
    expect(q.queue[0].retryCount).toBe(1);
  });

  it('deux rejeux simultanés : chaque action ne part qu’une fois', async () => {
    let release;
    mockPost.mockReturnValueOnce(new Promise((r) => { release = r; }));
    await mount();
    await act(async () => { await q.enqueue('CREATE_REQUEST', { title: 'A' }); });
    let first;
    await act(async () => { first = q.processQueue(); });
    expect(q.isProcessing).toBe(true);
    await act(async () => { await q.processQueue(); });
    expect(mockPost).toHaveBeenCalledTimes(1);
    await act(async () => { release({}); await first; });
    expect(q.isProcessing).toBe(false);
    expect(q.pendingCount).toBe(0);
  });

  it('une action ajoutée pendant un rejeu n’est pas perdue', async () => {
    let release;
    mockPost.mockReturnValueOnce(new Promise((r) => { release = r; }));
    await mount();
    await act(async () => { await q.enqueue('CREATE_REQUEST', { title: 'A' }); });
    let first;
    await act(async () => { first = q.processQueue(); });
    await act(async () => { await q.enqueue('SUBMIT_RATING', { rating: 5 }); });
    expect(q.pendingCount).toBe(2);
    await act(async () => { release({}); await first; });
    expect(q.pendingCount).toBe(1);
    expect((await stored()).map((a) => a.type)).toEqual(['SUBMIT_RATING']);
  });

  it('file vide : rien ne part', async () => {
    await mount();
    await act(async () => { await q.processQueue(); });
    expect(mockPost).not.toHaveBeenCalled();
    expect(await stored()).toBeNull();
  });
});

describe('retour en ligne', () => {
  it('rejoue automatiquement quand le réseau revient après une coupure', async () => {
    mockNet.isOnline = false;
    const r = await mount();
    await act(async () => { await q.enqueue('CREATE_REQUEST', { title: 'Hors ligne' }); });
    expect(mockPost).not.toHaveBeenCalled();
    mockNet.isOnline = true;
    mockNet.wasOffline = true;
    r.rerender(tree());
    await act(async () => {});
    expect(mockPost).toHaveBeenCalledWith('/requests', { title: 'Hors ligne' });
    expect(q.pendingCount).toBe(0);
  });

  it('en ligne sans coupure préalable : pas de rejeu automatique', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify([{ id: 'a', type: 'CREATE_REQUEST', payload: {}, createdAt: new Date().toISOString(), retryCount: 0, maxRetries: 3 }]));
    await mount();
    expect(mockPost).not.toHaveBeenCalled();
    expect(q.pendingCount).toBe(1);
  });
});

describe('clearQueue', () => {
  it('vide la file et le stockage', async () => {
    await mount();
    await act(async () => { await q.enqueue('CREATE_REQUEST', {}); });
    await act(async () => { await q.clearQueue(); });
    expect(q.pendingCount).toBe(0);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });
});

