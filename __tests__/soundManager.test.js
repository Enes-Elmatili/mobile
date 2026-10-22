// Sons de l'app sur expo-audio (expo-av est retiré du SDK 58) : un lecteur
// préchargé par son, rembobiné avant chaque lecture, libéré au démontage.
jest.mock('expo-audio', () => {
  const players = [];
  return {
    __players: players,
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    createAudioPlayer: jest.fn(() => {
      const p = { play: jest.fn(), seekTo: jest.fn(() => Promise.resolve()), remove: jest.fn(), loop: false };
      players.push(p);
      return p;
    }),
  };
});

const { renderHook, act } = require('@testing-library/react-native');
const audio = require('expo-audio');
const { useSoundManager } = require('../hooks/useSoundManager');

describe('useSoundManager (expo-audio)', () => {
  beforeEach(() => {
    audio.__players.length = 0;
    jest.clearAllMocks();
  });

  it('précharge un lecteur par son, sans jouer', async () => {
    await renderHook(() => useSoundManager());
    expect(audio.createAudioPlayer).toHaveBeenCalledTimes(4);
    audio.__players.forEach((p) => expect(p.play).not.toHaveBeenCalled());
  });

  it('play() rembobine puis joue un seul lecteur', async () => {
    const { result } = await renderHook(() => useSoundManager());
    await act(async () => { await result.current.play('missionAccepted'); });
    const played = audio.__players.filter((p) => p.play.mock.calls.length > 0);
    expect(played).toHaveLength(1);
    expect(played[0].seekTo).toHaveBeenCalledWith(0);
  });

  it('libère les lecteurs au démontage', async () => {
    const { unmount } = await renderHook(() => useSoundManager());
    await unmount();
    audio.__players.forEach((p) => expect(p.remove).toHaveBeenCalled());
  });
});
