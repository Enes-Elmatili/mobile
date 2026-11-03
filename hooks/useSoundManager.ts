import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useEffect, useRef, useCallback } from 'react';

export type SoundKey = 'newMission' | 'missionAccepted' | 'paymentReceived' | 'providerFound';

const SOUND_FILES: Record<SoundKey, any> = {
  newMission:      require('../assets/sounds/new-mission.wav'),
  missionAccepted: require('../assets/sounds/mission-accepted.wav'),
  paymentReceived: require('../assets/sounds/payment-received.wav'),
  providerFound:   require('../assets/sounds/provider-found.wav'),
};

// Pas de vraie sonnerie dédiée dans les assets : new-mission.wav est le son
// existant le plus adapté — joué en boucle par IncomingCallOverlay pour les
// appels entrants (accompagné d'une vibration répétée).
export const RINGTONE_SOUND = SOUND_FILES.newMission;

export function useSoundManager() {
  const soundsRef = useRef<Partial<Record<SoundKey, AudioPlayer>>>({});

  useEffect(() => {
    let mounted = true;

    const preload = async () => {
      await setAudioModeAsync({
        playsInSilentMode: false,
        interruptionModeAndroid: 'duckOthers',
      });
      for (const [key, file] of Object.entries(SOUND_FILES)) {
        if (!mounted) return;
        soundsRef.current[key as SoundKey] = createAudioPlayer(file);
      }
    };
    preload();

    return () => {
      mounted = false;
      Object.values(soundsRef.current).forEach(s => s?.remove());
      soundsRef.current = {};
    };
  }, []);

  const play = useCallback(async (key: SoundKey) => {
    try {
      const sound = soundsRef.current[key];
      if (sound) {
        await sound.seekTo(0);
        sound.play();
      }
    } catch {
      // Never block UX for a sound failure
    }
  }, []);

  return { play };
}
