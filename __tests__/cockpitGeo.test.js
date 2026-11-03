// La position du prestataire part bien vers le serveur (useCockpitGeo) —
// même quand la socket n'existe pas encore au premier rendu, ce qui est le cas
// normal : SocketContext la crée après avoir lu le jeton. Sans ça, le suivi
// GPS du client restait vide pendant toute la mission.
import { renderHook, act } from '@testing-library/react-native';

let mockWatchCb;
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3, High: 4 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 50.84, longitude: 4.35, heading: null } })),
  watchPositionAsync: jest.fn(async (_opts, cb) => { mockWatchCb = cb; return { remove: jest.fn() }; }),
}));
jest.mock('expo-router', () => ({ useFocusEffect: () => {} }));

const { useCockpitGeo } = require('@/components/provider/cockpit/useCockpitGeo');

const fakeSocket = () => ({ connected: true, emit: jest.fn() });
const at = (lat, lng) => ({ coords: { latitude: lat, longitude: lng, heading: null } });

function setup(initial) {
  const refs = {
    currentMissionRef: { current: null },
    etaRef: { current: null },
    isOnlineRef: { current: true },
  };
  const hook = renderHook((p) => useCockpitGeo({ ...refs, ...p }), { initialProps: initial });
  return { ...hook, refs };
}

beforeEach(() => { mockWatchCb = undefined; jest.spyOn(Date, 'now').mockReturnValue(1_000_000); });
afterEach(() => jest.restoreAllMocks());

describe('useCockpitGeo — émission de la position', () => {
  it('socket absente au montage puis prête : la position initiale part dès qu’elle arrive', async () => {
    const { rerender } = setup({ socket: null, userId: 'p1', networkOnline: true });
    await act(async () => {});
    const socket = fakeSocket();
    await act(async () => { rerender({ socket, userId: 'p1', networkOnline: true }); });
    expect(socket.emit).toHaveBeenCalledWith('provider:location_update', { providerId: 'p1', latitude: 50.84, longitude: 4.35 });
  });

  it('en mission : la position et l’ETA partent vers le suivi du client avec la socket du moment', async () => {
    const { rerender, refs } = setup({ socket: null, userId: 'p1', networkOnline: true });
    await act(async () => {});
    const socket = fakeSocket();
    await act(async () => { rerender({ socket, userId: 'p1', networkOnline: true }); });
    socket.emit.mockClear();
    refs.currentMissionRef.current = { id: '42' };
    refs.etaRef.current = 6;
    Date.now.mockReturnValue(1_020_000);
    await act(async () => { mockWatchCb(at(50.85, 4.36)); });
    expect(socket.emit).toHaveBeenCalledWith('provider:location_update', { requestId: 42, lat: 50.85, lng: 4.36, eta: '6 min' });
  });

  it('au repos et en ligne : vers le matching toutes les 15 s, pas plus souvent', async () => {
    const socket = fakeSocket();
    setup({ socket, userId: 'p1', networkOnline: true });
    await act(async () => {});
    socket.emit.mockClear();
    Date.now.mockReturnValue(1_016_000);
    await act(async () => { mockWatchCb(at(50.85, 4.36)); });
    Date.now.mockReturnValue(1_020_000);
    await act(async () => { mockWatchCb(at(50.86, 4.37)); });
    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('provider:location_update', { providerId: 'p1', latitude: 50.85, longitude: 4.36 });
  });

  it('réseau coupé : rien ne part vers le matching', async () => {
    const socket = fakeSocket();
    const { rerender } = setup({ socket, userId: 'p1', networkOnline: true });
    await act(async () => {});
    await act(async () => { rerender({ socket, userId: 'p1', networkOnline: false }); });
    socket.emit.mockClear();
    Date.now.mockReturnValue(1_016_000);
    await act(async () => { mockWatchCb(at(50.85, 4.36)); });
    expect(socket.emit).not.toHaveBeenCalled();
  });
});
