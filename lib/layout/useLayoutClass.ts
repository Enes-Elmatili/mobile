// lib/layout/useLayoutClass.ts
// Remplace tout `Dimensions.get('window')` : réactif au pliage, à la rotation
// et au Split View. Les insets gauche/droite sont exposés SÉPARÉMENT — sur
// l'écran interne du Duo, la Dynamic Island est latérale et ils diffèrent.
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveLayoutClass, type LayoutClass } from './resolveLayoutClass';
import { useWindowSize } from './windowSize';

export interface Layout {
  width: number;
  height: number;
  cls: LayoutClass;
  isRegular: boolean;
  isLandscape: boolean;
  insets: { top: number; bottom: number; left: number; right: number };
}

export function useLayoutClass(): Layout {
  // Taille lue sur la vue native (lib/layout/windowSize) : Dimensions peut
  // rester à la taille pliée après un dépliage du Duo.
  const { width, height } = useWindowSize();
  const insets = useSafeAreaInsets();
  return useMemo(() => {
    const cls = resolveLayoutClass(width, height);
    return {
      width,
      height,
      cls,
      isRegular: cls === 'regular',
      isLandscape: width > height,
      insets: { top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right },
    };
  }, [width, height, insets.top, insets.bottom, insets.left, insets.right]);
}
