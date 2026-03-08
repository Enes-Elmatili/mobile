import { Audio } from 'expo-av';
import { useEffect, useRef, useCallback } from 'react';

export type SoundKey = 'newMission' | 'missionAccepted' | 'paymentReceived' | 'providerFound';

const SOUND_FILES: Record<SoundKey, any> = {
  newMission:      require('../assets/sounds/new-mission.wav'),
  missionAccepted: require('../assets/sounds/mission-accepted.wav'),
  paymentReceived: require('../assets/sounds/payment-received.wav'),
  providerFound:   require('../assets/sounds/provider-found.wav'),
};

export function useSoundManager() {
  const soundsRef = useRef<Partial<Record<SoundKey, Audio.Sound>>>({});

  useEffect(() => {
    let mounted = true;

    const preload = async () => {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: false,
        shouldDuckAndroid: true,
      });
      for (const [key, file] of Object.entries(SOUND_FILES)) {
        if (!mounted) return;
        const { sound } = await Audio.Sound.createAsync(file, { shouldPlay: false });
        soundsRef.current[key as SoundKey] = sound;
      }
    };
    preload();

    return () => {
      mounted = false;
      Object.values(soundsRef.current).forEach(s => s?.unloadAsync());
      soundsRef.current = {};
    };
  }, []);

  const play = useCallback(async (key: SoundKey) => {
    try {
      const sound = soundsRef.current[key];
      if (sound) {
        await sound.setPositionAsync(0);
        await sound.playAsync();
      }
    } catch {
      // Never block UX for a sound failure
    }
  }, []);

  return { play };
}
