// Le temps réel (lib/SocketContext.tsx, non modifiable) vu de l'extérieur : on
// remplace socket.io-client par une fausse socket qui garde les handlers et
// laisse le test émettre les événements serveur. On protège ce que l'utilisateur
// voit et subit : statut de connexion, toasts de paiement, navigation unique
// après acceptation / fin de mission, badges non lus, et le nettoyage des
// écouteurs au démontage ou à la déconnexion.
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { AppState } from 'react-native';

process.env.EXPO_PUBLIC_SOCKET_URL = 'https://socket.fixed.test';
process.env.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost/api';

// ── Fausse socket ────────────────────────────────────────────────────────────
const mockSockets = [];
function mockMakeSocket() {
  const handlers = {};
  const s = {
    id: `sock-${mockSockets.length + 1}`,
    connected: false,
    auth: null,
    handlers,
    on: jest.fn((ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); return s; }),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    removeAllListeners: jest.fn(() => { for (const k of Object.keys(handlers)) delete handlers[k]; }),
  };
  mockSockets.push(s);
  return s;
}
jest.mock('socket.io-client', () => ({ io: jest.fn((_url, opts) => Object.assign(mockMakeSocket(), { opts })) }));

// ── Dépendances lourdes ──────────────────────────────────────────────────────
const mockAuth = { user: null };
jest.mock('@/lib/auth/AuthContext', () => ({ useAuth: () => mockAuth }));
const mockNet = { isOnline: true };
jest.mock('@/lib/NetworkContext', () => ({ useNetwork: () => mockNet }));
const mockGetToken = jest.fn();
jest.mock('@/lib/storage', () => ({ tokenStorage: { getToken: () => mockGetToken() } }));
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
const mockApi = {
  notifications: { list: jest.fn() },
  messages: { unreadCount: jest.fn() },
  providers: { me: jest.fn() },
};
jest.mock('@/lib/api', () => ({ api: mockApi }));
const mockPlay = jest.fn();
jest.mock('@/hooks/useSoundManager', () => ({ useSoundManager: () => ({ play: mockPlay }) }));
const mockFeedback = { toast: jest.fn(), notif: jest.fn() };
jest.mock('@/lib/feedback/feedback', () => ({ feedback: mockFeedback }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { t: (k) => k } }));
const mockHandleNav = jest.fn();
jest.mock('@/lib/usePushNotifications', () => ({ handleNotificationNavigation: (...a) => mockHandleNav(...a) }));
const mockSheet = { props: null };
jest.mock('@/components/sheets/MissionRequestSheet', () => ({
  MissionRequestSheet: (props) => { mockSheet.props = props; return null; },
}));
jest.mock('@/lib/logger', () => ({ devLog: jest.fn(), devWarn: jest.fn(), devError: jest.fn() }));

const AsyncStorage = require('@react-native-async-storage/async-storage');
const Haptics = require('expo-haptics');
const { io } = require('socket.io-client');
const {
  SocketProvider, useSocket, onIncomingMessage, setActiveConversationUser,
  onUserTyping, onUserStopTyping, onMessageRead, onMessageReadAll, showMissionRequest,
} = require('@/lib/SocketContext');
const { isSocketUp } = require('@/lib/socketStatus');
const { markCompletionHandled } = require('@/lib/navDedup');

const CLIENT = { id: 'u1', roles: ['CLIENT'] };
const PROVIDER = { id: 'u2', roles: ['PROVIDER'] };

let ctx;
function Probe() { ctx = useSocket(); return null; }
const tree = () => <SocketProvider><Probe /></SocketProvider>;

let appStateHandler;
const appStateRemove = jest.fn();

async function mount(user = CLIENT) {
  mockAuth.user = user;
  const r = render(tree());
  await act(async () => {});
  return r;
}
const sock = () => mockSockets[mockSockets.length - 1];
async function serverEmits(ev, ...args) {
  const hs = sock().handlers[ev] || [];
  expect(hs.length).toBeGreaterThan(0);
  await act(async () => { for (const h of hs) await h(...args); });
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockSockets.length = 0;
  mockAuth.user = null;
  mockNet.isOnline = true;
  mockSheet.props = null;
  mockGetToken.mockResolvedValue('jwt-1');
  mockApi.notifications.list.mockResolvedValue({ data: [{ id: 1, readAt: null }, { id: 2, readAt: '2026-01-01' }, { id: 3 }] });
  mockApi.messages.unreadCount.mockResolvedValue({ unread: 3 });
  mockApi.providers.me.mockResolvedValue({ data: { id: 'p-9' } });
  await AsyncStorage.clear();
  setActiveConversationUser(null);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_ev, fn) => { appStateHandler = fn; return { remove: appStateRemove }; });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('initialisation', () => {
  it('sans utilisateur : aucune socket, statut « connecting », badges à zéro', async () => {
    await mount(null);
    expect(io).not.toHaveBeenCalled();
    expect(ctx.socket).toBeNull();
    expect(ctx.isConnected).toBe(false);
    expect(ctx.connectionStatus).toBe('connecting');
    expect(ctx.unreadCount).toBe(0);
    expect(ctx.unreadMessages).toBe(0);
  });

  it('ouvre la socket vers EXPO_PUBLIC_SOCKET_URL avec le JWT, reconnexion infinie', async () => {
    await mount();
    expect(io).toHaveBeenCalledTimes(1);
    const [url, opts] = io.mock.calls[0];
    expect(url).toBe('https://socket.fixed.test');
    expect(opts.auth).toEqual({ token: 'jwt-1' });
    expect(opts.reconnection).toBe(true);
    expect(opts.reconnectionAttempts).toBe(Infinity);
    expect(opts.transports).toEqual(['polling', 'websocket']);
    expect(ctx.socket).toBe(sock());
  });

  it('badges initiaux : notifications non lues comptées, messages depuis le serveur', async () => {
    await mount();
    expect(ctx.unreadCount).toBe(2);
    expect(ctx.unreadMessages).toBe(3);
  });

  it('badge messages : accepte { data: { unread } } et ignore un compte illisible', async () => {
    mockApi.messages.unreadCount.mockResolvedValueOnce({ data: { unread: '5' } });
    await mount();
    expect(ctx.unreadMessages).toBe(5);
    mockApi.messages.unreadCount.mockResolvedValueOnce({ unread: 'abc' });
    await act(async () => { ctx.refreshUnreadMessages(); });
    expect(ctx.unreadMessages).toBe(0);
  });

  it('API en échec au démarrage : badges à zéro, pas de crash', async () => {
    mockApi.notifications.list.mockRejectedValueOnce(new Error('offline'));
    mockApi.messages.unreadCount.mockRejectedValueOnce(new Error('offline'));
    await mount();
    expect(ctx.unreadCount).toBe(0);
    expect(ctx.unreadMessages).toBe(0);
  });
});

describe('statut de connexion', () => {
  it('connect → disconnect → reconnect_attempt → reconnect → reconnect_failed', async () => {
    await mount();
    await serverEmits('connect');
    expect(ctx.isConnected).toBe(true);
    expect(ctx.connectionStatus).toBe('connected');
    expect(isSocketUp()).toBe(true);

    await serverEmits('disconnect');
    expect(ctx.isConnected).toBe(false);
    expect(ctx.connectionStatus).toBe('disconnected');
    expect(isSocketUp()).toBe(false);

    await serverEmits('reconnect_attempt', 2);
    expect(ctx.connectionStatus).toBe('reconnecting');

    await serverEmits('reconnect');
    expect(ctx.isConnected).toBe(true);
    expect(ctx.connectionStatus).toBe('connected');
    expect(isSocketUp()).toBe(true);

    await serverEmits('reconnect_failed');
    expect(ctx.connectionStatus).toBe('disconnected');
  });

  it('connect_error d’auth : un seul nouvel essai avec un token frais', async () => {
    await mount();
    mockGetToken.mockResolvedValue('jwt-2');
    await serverEmits('connect_error', new Error('AUTH_INVALID'));
    expect(sock().auth).toEqual({ token: 'jwt-2' });
    expect(sock().connect).toHaveBeenCalledTimes(1);
    expect(ctx.connectionStatus).toBe('connecting'); // pas encore « perdue »

    await serverEmits('connect_error', new Error('AUTH_INVALID'));
    expect(sock().connect).toHaveBeenCalledTimes(1); // pas de boucle
    expect(ctx.connectionStatus).toBe('disconnected');
    expect(ctx.isConnected).toBe(false);
  });

  it('connect_error d’auth sans token frais : déconnecté tout de suite', async () => {
    await mount();
    mockGetToken.mockResolvedValue(null);
    await serverEmits('connect_error', new Error('AUTH_REQUIRED'));
    expect(sock().connect).not.toHaveBeenCalled();
    expect(ctx.connectionStatus).toBe('disconnected');
  });

  it('connect_error réseau : déconnecté, pas de nouvel essai manuel', async () => {
    await mount();
    await serverEmits('connect_error', new Error('xhr poll error'));
    expect(sock().connect).not.toHaveBeenCalled();
    expect(ctx.connectionStatus).toBe('disconnected');
  });

  it('retour réseau : reconnecte une socket tombée, pas une socket active', async () => {
    const r = await mount();
    mockNet.isOnline = false;
    r.rerender(tree());
    await act(async () => {});
    mockNet.isOnline = true;
    r.rerender(tree());
    await act(async () => {});
    expect(sock().connect).toHaveBeenCalledTimes(1);

    sock().connected = true;
    mockNet.isOnline = false; r.rerender(tree());
    mockNet.isOnline = true; r.rerender(tree());
    await act(async () => {});
    expect(sock().connect).toHaveBeenCalledTimes(1);
  });

  it('retour au premier plan : reconnecte si la socket est tombée', async () => {
    await mount();
    act(() => appStateHandler('background'));
    expect(sock().connect).not.toHaveBeenCalled();
    act(() => appStateHandler('active'));
    expect(sock().connect).toHaveBeenCalledTimes(1);
    sock().connected = true;
    act(() => appStateHandler('active'));
    expect(sock().connect).toHaveBeenCalledTimes(1);
  });
});

describe('prestataire : enregistrement à la connexion', () => {
  it('utilise l’id prestataire en cache, puis rafraîchit le cache depuis /providers/me', async () => {
    await AsyncStorage.setItem('provider', JSON.stringify({ id: 'p-1' }));
    await mount(PROVIDER);
    await serverEmits('connect');
    expect(sock().emit).toHaveBeenCalledWith('provider:register', { providerId: 'p-1', userId: 'u2' });
    await act(async () => {});
    expect(JSON.parse(await AsyncStorage.getItem('provider'))).toEqual({ id: 'p-9' });
  });

  it('sans cache : s’enregistre avec l’id utilisateur', async () => {
    mockApi.providers.me.mockRejectedValueOnce(new Error('offline'));
    await mount(PROVIDER);
    await serverEmits('connect');
    expect(sock().emit).toHaveBeenCalledWith('provider:register', { providerId: 'u2', userId: 'u2' });
  });

  it('un client ne s’enregistre pas comme prestataire', async () => {
    await mount(CLIENT);
    await serverEmits('connect');
    expect(sock().emit).not.toHaveBeenCalledWith('provider:register', expect.anything());
  });
});

describe('acceptation de mission', () => {
  it('client : provider:accepted → son + toast « X est en route »', async () => {
    await mount(CLIENT);
    await serverEmits('provider:accepted', { requestId: 42, provider: { name: 'Yassine' } });
    expect(mockPlay).toHaveBeenCalledWith('providerFound');
    expect(mockFeedback.toast).toHaveBeenCalledWith('Yassine est en route vers vous.', 'success');
    await serverEmits('provider:accepted', { requestId: 43 });
    expect(mockFeedback.toast).toHaveBeenLastCalledWith('Un professionnel est en route vers vous.', 'success');
  });

  it('prestataire : provider:accepted est ignoré', async () => {
    await mount(PROVIDER);
    await serverEmits('provider:accepted', { requestId: 42, provider: { name: 'Yassine' } });
    expect(mockFeedback.toast).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('prestataire : accept_success puis accept_confirmed → une seule navigation vers /ongoing', async () => {
    await mount(PROVIDER);
    await serverEmits('provider:accept_success', { requestId: 42 });
    await serverEmits('provider:accept_confirmed', { requestId: 42 });
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledWith('/request/42/ongoing');
    expect(mockPlay).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('acceptation sans requestId : aucune navigation vers /request/undefined', async () => {
    await mount(PROVIDER);
    await serverEmits('provider:accept_success', {});
    expect(mockRouter.push).not.toHaveBeenCalled();
    // …et une vraie acceptation ensuite n'est pas avalée par la déduplication.
    await serverEmits('provider:accept_success', { requestId: 43 });
    expect(mockRouter.push).toHaveBeenCalledWith('/request/43/ongoing');
  });

  it('request:claimed de notre propre acceptation : pas de toast « déjà prise »', async () => {
    await mount(PROVIDER);
    await serverEmits('provider:accept_success', { requestId: 42 });
    await serverEmits('request:claimed', 42);
    expect(mockFeedback.toast).not.toHaveBeenCalled();
  });

  it('request:claimed par un autre : toast d’erreur et la feuille de mission se ferme', async () => {
    await mount(PROVIDER);
    act(() => showMissionRequest({ requestId: 77, title: 'Fuite' }));
    expect(mockSheet.props.request).toEqual({ requestId: 77, title: 'Fuite' });
    await serverEmits('request:claimed', 77);
    expect(mockFeedback.toast).toHaveBeenCalledWith('Mission déjà prise par un autre prestataire.', 'error');
    expect(mockSheet.props.request).toBeNull();
  });

  it('request:expired : toast info et la feuille se ferme', async () => {
    await mount(PROVIDER);
    act(() => showMissionRequest({ requestId: 78 }));
    await serverEmits('request:expired', 78);
    expect(mockFeedback.toast).toHaveBeenCalledWith('Cette mission a expiré.', 'info');
    expect(mockSheet.props.request).toBeNull();
  });

  it('mission planifiée dans plus de 30 min : pas de redirection vers /ongoing', async () => {
    await mount(PROVIDER);
    const later = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
    await serverEmits('provider:accept_success', { requestId: 50, preferredTimeStart: later });
    await serverEmits('provider:accept_success', { requestId: 51, request: { preferredTimeStart: later } });
    expect(mockRouter.push).not.toHaveBeenCalled();
    const soon = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await serverEmits('provider:accept_success', { requestId: 52, preferredTimeStart: soon });
    expect(mockRouter.push).toHaveBeenCalledWith('/request/52/ongoing');
  });

  it('feuille « Nouvelle mission » : accepter émet request:accept et ferme la feuille', async () => {
    await mount(PROVIDER);
    act(() => showMissionRequest({ requestId: 90 }));
    act(() => mockSheet.props.onAccept('90'));
    expect(sock().emit).toHaveBeenCalledWith('request:accept', { requestId: '90' });
    expect(mockSheet.props.request).toBeNull();
    act(() => showMissionRequest({ requestId: 91 }));
    act(() => mockSheet.props.onDecline());
    expect(mockSheet.props.request).toBeNull();
    expect(sock().emit).not.toHaveBeenCalledWith('request:decline', expect.anything());
  });

  it('new_request : son et haptique d’alerte', async () => {
    await mount(PROVIDER);
    await serverEmits('new_request', { requestId: 5 });
    expect(mockPlay).toHaveBeenCalledWith('newMission');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('warning');
  });
});

describe('fin de mission', () => {
  it('client : toast puis /rating après 900 ms, une seule fois même si l’événement arrive deux fois', async () => {
    jest.useFakeTimers();
    await mount(CLIENT);
    await serverEmits('request:completed', { requestId: 'c-1' });
    await serverEmits('request:completed', { requestId: 'c-1' });
    expect(mockFeedback.toast).toHaveBeenCalledTimes(1);
    expect(mockFeedback.toast).toHaveBeenCalledWith('Mission terminée. Merci !', 'success');
    expect(mockRouter.replace).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(900));
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/request/[id]/rating', params: { id: 'c-1' } });
  });

  it('fin de mission sans requestId : ni toast ni navigation vers « undefined »', async () => {
    jest.useFakeTimers();
    await mount(CLIENT);
    await serverEmits('request:completed', {});
    act(() => jest.advanceTimersByTime(900));
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await serverEmits('request:completed', { requestId: 'c-2' });
    act(() => jest.advanceTimersByTime(900));
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/request/[id]/rating', params: { id: 'c-2' } });
  });

  it('prestataire : /earnings', async () => {
    jest.useFakeTimers();
    await mount(PROVIDER);
    await serverEmits('request:completed', { requestId: 'p-1' });
    expect(mockFeedback.toast).toHaveBeenCalledWith('Mission terminée. Consultez vos gains.', 'success');
    act(() => jest.advanceTimersByTime(900));
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/request/[id]/earnings', params: { id: 'p-1' } });
  });

  it('écran source déjà navigué (navDedup) : pas de double navigation', async () => {
    jest.useFakeTimers();
    await mount(CLIENT);
    markCompletionHandled('c-2');
    await serverEmits('request:completed', { requestId: 'c-2' });
    act(() => jest.advanceTimersByTime(2000));
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockFeedback.toast).not.toHaveBeenCalled();
  });

  it('démontage avant les 900 ms : la navigation différée est annulée', async () => {
    jest.useFakeTimers();
    const r = await mount(CLIENT);
    await serverEmits('request:completed', { requestId: 'c-3' });
    r.unmount();
    act(() => jest.advanceTimersByTime(2000));
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe('paiements', () => {
  it('payment:succeeded : son d’encaissement et toast de confirmation', async () => {
    await mount();
    await serverEmits('payment:succeeded', { requestId: 1, amount: 14100 });
    expect(mockPlay).toHaveBeenCalledWith('paymentReceived');
    expect(mockFeedback.toast).toHaveBeenCalledWith('Paiement confirmé.', 'success');
  });

  it('payment:charge_failed : raison du serveur, sinon message par défaut, toujours en erreur', async () => {
    await mount();
    await serverEmits('payment:charge_failed', { requestId: 1, reason: 'Carte refusée' });
    expect(mockFeedback.toast).toHaveBeenLastCalledWith('Carte refusée', 'error');
    await serverEmits('payment:charge_failed', { requestId: 1 });
    expect(mockFeedback.toast).toHaveBeenLastCalledWith('Le paiement de votre mission a échoué. Mettez à jour votre carte.', 'error');
    await serverEmits('payment:charge_failed', undefined);
    expect(mockFeedback.toast).toHaveBeenCalledTimes(3);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');
  });

  it('payment:refunded et invoice:generated : toasts', async () => {
    await mount();
    await serverEmits('payment:refunded', {});
    expect(mockFeedback.toast).toHaveBeenLastCalledWith('Votre paiement a été remboursé.', 'info');
    await serverEmits('invoice:generated', { invoiceNumber: 'F-1' });
    expect(mockFeedback.toast).toHaveBeenLastCalledWith('Votre facture est disponible', 'success');
  });

  it('prestataire préféré : refus nommé ou absence de réponse', async () => {
    await mount();
    await serverEmits('request:preferred_refused', { providerName: 'Ana' });
    expect(mockFeedback.toast).toHaveBeenLastCalledWith('Ana n\'a pas pu accepter. Recherche d\'un autre prestataire…', 'info');
    await serverEmits('request:preferred_refused', {});
    expect(mockFeedback.toast).toHaveBeenLastCalledWith('Le prestataire demandé n\'a pas pu accepter. Recherche d\'un autre prestataire…', 'info');
    await serverEmits('request:preferred_unavailable', {});
    expect(mockFeedback.toast).toHaveBeenLastCalledWith('Le prestataire demandé n\'a pas répondu à temps. Recherche élargie.', 'info');
  });
});

describe('messages et notifications', () => {
  const msg = (over = {}) => ({ id: 'm1', senderId: 'u9', recipientId: 'u1', text: 'Bonjour', createdAt: '2026-01-01', readAt: null, ...over });

  it('message:received : badge +1 et diffusion aux écrans abonnés', async () => {
    await mount();
    const seen = [];
    const off = onIncomingMessage((m) => seen.push(m.id));
    await serverEmits('message:received', msg());
    expect(ctx.unreadMessages).toBe(4);
    expect(seen).toEqual(['m1']);
    off();
    await serverEmits('message:received', msg({ id: 'm2' }));
    expect(seen).toEqual(['m1']);
    expect(ctx.unreadMessages).toBe(5);
  });

  it('conversation ouverte avec l’expéditeur : pas de badge', async () => {
    await mount();
    setActiveConversationUser('u9');
    await serverEmits('message:received', msg());
    expect(ctx.unreadMessages).toBe(3);
    await serverEmits('message:received', msg({ senderId: 'autre' }));
    expect(ctx.unreadMessages).toBe(4);
  });

  it('message:sent est diffusé sans toucher au badge', async () => {
    await mount();
    const seen = [];
    const off = onIncomingMessage((m) => seen.push(m.id));
    await serverEmits('message:sent', msg({ id: 'mine' }));
    off();
    expect(seen).toEqual(['mine']);
    expect(ctx.unreadMessages).toBe(3);
  });

  it('clearUnreadMessages / refreshUnreadMessages resynchronisent le badge', async () => {
    await mount();
    act(() => ctx.clearUnreadMessages());
    expect(ctx.unreadMessages).toBe(0);
    mockApi.messages.unreadCount.mockResolvedValueOnce({ unread: 7 });
    await act(async () => { ctx.refreshUnreadMessages(); });
    expect(ctx.unreadMessages).toBe(7);
    mockApi.messages.unreadCount.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { ctx.refreshUnreadMessages(); });
    expect(ctx.unreadMessages).toBe(7);
  });

  it('frappe et accusés de lecture relayés aux abonnés', async () => {
    await mount();
    const log = [];
    const offs = [
      onUserTyping((e) => log.push(['typing', e.userId])),
      onUserStopTyping((e) => log.push(['stop', e.userId])),
      onMessageRead((e) => log.push(['read', e.messageId])),
      onMessageReadAll((e) => log.push(['all', e.readBy])),
    ];
    await serverEmits('user:typing', { userId: 'u9' });
    await serverEmits('user:stop_typing', { userId: 'u9' });
    await serverEmits('message:read', { messageId: 'm1', readAt: 'x', readBy: 'u9' });
    await serverEmits('message:read_all', { readBy: 'u9', readAt: 'x' });
    offs.forEach((f) => f());
    await serverEmits('user:typing', { userId: 'u9' });
    expect(log).toEqual([['typing', 'u9'], ['stop', 'u9'], ['read', 'm1'], ['all', 'u9']]);
  });

  it('notification:received : badge +1 et toast de l’île (vert pour l’argent) avec action', async () => {
    await mount(CLIENT);
    await serverEmits('notification:received', { title: 'Paiement reçu', message: '141 €', data: { family: 'money', requestId: 42 } });
    expect(ctx.unreadCount).toBe(3);
    expect(mockFeedback.notif).toHaveBeenCalledTimes(1);
    const arg = mockFeedback.notif.mock.calls[0][0];
    expect(arg).toMatchObject({ title: 'Paiement reçu', message: '141 €', tone: 'green' });
    expect(arg.action.label).toBe('notifications.toast_view');
    arg.action.onPress();
    expect(mockHandleNav).toHaveBeenCalledWith({ family: 'money', requestId: 42 }, { isProvider: false });
  });

  it('notification de message : action « répondre », ton accent ; sans cible : pas d’action', async () => {
    await mount(PROVIDER);
    await serverEmits('notification:received', { title: 'Nouveau message', data: { screen: 'Messages' } });
    const a = mockFeedback.notif.mock.calls[0][0];
    expect(a.tone).toBe('accent');
    expect(a.message).toBe('');
    expect(a.action.label).toBe('notifications.toast_reply');
    a.action.onPress();
    expect(mockHandleNav).toHaveBeenCalledWith({ screen: 'Messages' }, { isProvider: true });
    await serverEmits('notification:received', { title: 'Info', data: { family: 'news' } });
    expect(mockFeedback.notif.mock.calls[1][0].action).toBeUndefined();
  });

  it('notification déjà visible à l’écran (toast:false) ou sans titre : badge seul', async () => {
    await mount();
    await serverEmits('notification:received', { title: 'X', data: { toast: false } });
    await serverEmits('notification:received', { data: {} });
    expect(ctx.unreadCount).toBe(4);
    expect(mockFeedback.notif).not.toHaveBeenCalled();
    act(() => ctx.clearUnread());
    expect(ctx.unreadCount).toBe(0);
  });
});

describe('erreurs serveur', () => {
  it('PROVIDER_NOT_FOUND : cache prestataire effacé + toast', async () => {
    await AsyncStorage.setItem('provider', JSON.stringify({ id: 'p-1' }));
    await mount(PROVIDER);
    await serverEmits('error', { code: 'PROVIDER_NOT_FOUND' });
    expect(await AsyncStorage.getItem('provider')).toBeNull();
    expect(mockFeedback.toast).toHaveBeenCalledWith('Profil prestataire à reconfigurer.', 'error');
  });

  it('REQUEST_NOT_AVAILABLE / ALREADY_CLAIMED : la feuille se ferme, toast dédié', async () => {
    await mount(PROVIDER);
    act(() => showMissionRequest({ requestId: 1 }));
    await serverEmits('error', { code: 'REQUEST_NOT_AVAILABLE' });
    expect(mockSheet.props.request).toBeNull();
    expect(mockFeedback.toast).toHaveBeenLastCalledWith('Cette mission a déjà été prise.', 'error');
    act(() => showMissionRequest({ requestId: 2 }));
    await serverEmits('error', { code: 'REQUEST_ALREADY_CLAIMED' });
    expect(mockSheet.props.request).toBeNull();
    expect(mockFeedback.toast).toHaveBeenLastCalledWith('Un autre prestataire a accepté en premier.', 'error');
  });

  it('autre erreur : son message ; erreur vide : rien', async () => {
    await mount();
    await serverEmits('error', { message: 'Quota dépassé' });
    expect(mockFeedback.toast).toHaveBeenLastCalledWith('Quota dépassé', 'error');
    await serverEmits('error', {});
    expect(mockFeedback.toast).toHaveBeenCalledTimes(1);
  });
});

describe('salles (rooms)', () => {
  it('joinRoom dédoublonne ; une reconnexion permet de rejoindre à nouveau', async () => {
    await mount();
    act(() => { ctx.joinRoom('request', '42'); ctx.joinRoom('request', '42'); });
    expect(sock().emit.mock.calls.filter(([e]) => e === 'join:request')).toEqual([['join:request', { requestId: '42' }]]);
    await serverEmits('connect');
    act(() => ctx.joinRoom('request', '42'));
    expect(sock().emit.mock.calls.filter(([e]) => e === 'join:request')).toHaveLength(2);
    act(() => ctx.leaveRoom('request', '42'));
    expect(sock().emit).toHaveBeenCalledWith('leave:request', { requestId: '42' });
    act(() => ctx.joinRoom('request', '42'));
    expect(sock().emit.mock.calls.filter(([e]) => e === 'join:request')).toHaveLength(3);
  });
});

describe('nettoyage', () => {
  it('démontage : écouteurs retirés, socket fermée, AppState désabonné', async () => {
    const r = await mount();
    const s = sock();
    expect(Object.keys(s.handlers).length).toBeGreaterThan(10);
    r.unmount();
    expect(s.removeAllListeners).toHaveBeenCalledTimes(1);
    expect(s.disconnect).toHaveBeenCalledTimes(1);
    expect(Object.keys(s.handlers)).toHaveLength(0);
    expect(appStateRemove).toHaveBeenCalledTimes(1);
  });

  it('déconnexion utilisateur : socket fermée, statut remis à « connecting », badges à zéro', async () => {
    const r = await mount();
    await serverEmits('connect');
    const s = sock();
    mockAuth.user = null;
    r.rerender(tree());
    await act(async () => {});
    expect(s.removeAllListeners).toHaveBeenCalled();
    expect(s.disconnect).toHaveBeenCalled();
    // Plus de socket morte exposée : un emit après déconnexion partirait dans le vide.
    expect(ctx.socket).toBeNull();
    expect(ctx.isConnected).toBe(false);
    expect(ctx.connectionStatus).toBe('connecting');
    expect(isSocketUp()).toBe(false);
    expect(ctx.unreadCount).toBe(0);
    expect(ctx.unreadMessages).toBe(0);
  });

  it('changement d’utilisateur : une nouvelle socket, l’ancienne fermée', async () => {
    const r = await mount(CLIENT);
    const first = sock();
    mockAuth.user = PROVIDER;
    r.rerender(tree());
    await act(async () => {});
    expect(first.disconnect).toHaveBeenCalled();
    expect(mockSockets).toHaveLength(2);
    expect(ctx.socket).toBe(mockSockets[1]);
  });

  it('démontage avant la lecture du token : aucune socket ouverte', async () => {
    let release;
    mockGetToken.mockReturnValueOnce(new Promise((r) => { release = r; }));
    mockAuth.user = CLIENT;
    const r = render(tree());
    r.unmount();
    await act(async () => { release('jwt-late'); });
    expect(io).not.toHaveBeenCalled();
  });
});
