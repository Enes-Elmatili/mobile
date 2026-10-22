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
  const playersRef = useRef<Partial<Record<SoundKey, AudioPlayer>>>({});

  useEffect(() => {
    // Même intention qu'avec expo-av : silencieux si l'iPhone est en mode
    // silencieux, et on baisse la musique des autres apps sur Android.
    setAudioModeAsync({ playsInSilentMode: false, interruptionModeAndroid: 'duckOthers' }).catch(() => {});
    for (const [key, file] of Object.entries(SOUND_FILES)) {
      playersRef.current[key as SoundKey] = createAudioPlayer(file);
    }

    return () => {
      Object.values(playersRef.current).forEach(p => p?.remove());
      playersRef.current = {};
    };
  }, []);

  const play = useCallback(async (key: SoundKey) => {
    try {
      const player = playersRef.current[key];
      if (player) {
        await player.seekTo(0);
        player.play();
      }
    } catch {
      // Never block UX for a sound failure
    }
  }, []);

  return { play };
}
