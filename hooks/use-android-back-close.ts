// hooks/use-android-back-close.ts — bouton back Android ferme l'overlay ouvert
// (bottom sheet, panneau…) au lieu de déclencher la navigation arrière.
import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Tant que `active` est vrai, intercepte le bouton back hardware Android et
 * appelle `close` (fermeture de la sheet) au lieu de laisser la navigation
 * dépiler l'écran sous l'overlay. No-op sur iOS.
 */
export function useAndroidBackClose(active: boolean, close: () => void) {
  useEffect(() => {
    if (Platform.OS !== 'android' || !active) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [active, close]);
}
