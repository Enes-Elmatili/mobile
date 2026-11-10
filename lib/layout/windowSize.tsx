// lib/layout/windowSize.tsx
// La taille de la fenêtre, lue sur la vue native — pas sur Dimensions.
//
// Constaté sur le Duo (journal [DuoLayout], 10/11/2026) : après un dépliage,
// la scène native faisait bien 867 × 669, mais useWindowDimensions restait à
// 466 (taille pliée). React Native ne publie le changement que si l'app est
// « active » à l'instant exact du redimensionnement (RCTDeviceInfo) — ce que
// la bascule entre les deux écrans du Duo ne garantit pas. L'app se croyait
// alors compacte et étalait la colonne d'iPhone à travers la charnière.
//
// Ici : le cadre du SafeAreaProvider racine (natif, recalculé à chaque passe
// de layout de la fenêtre). Sans provider (tests, rendu isolé) : Dimensions.
import React, { createContext, useContext, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';

type Size = { width: number; height: number };

const WindowSizeContext = createContext<Size | null>(null);

/** À poser une fois, au-dessus de toute InsetScope (le provider racine = la fenêtre). */
export function WindowSizeProvider({ children }: { children: React.ReactNode }) {
  const frame = useSafeAreaFrame();
  const value = useMemo(() => ({ width: frame.width, height: frame.height }), [frame.width, frame.height]);
  return <WindowSizeContext.Provider value={value}>{children}</WindowSizeContext.Provider>;
}

/** Largeur / hauteur de la fenêtre, fiables au pliage. Remplace useWindowDimensions. */
export function useWindowSize(): Size {
  const native = useContext(WindowSizeContext);
  const dims = useWindowDimensions();
  return native && native.width > 0 && native.height > 0 ? native : { width: dims.width, height: dims.height };
}
