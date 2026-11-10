// lib/layout/sceneFrame.ts
// Le cadre et les insets de la scène courante — le SafeAreaProvider le plus
// proche (InsetScope en pose un par écran). Lus par contexte, sans exception
// hors provider (tests, rendu isolé) : on retombe alors sur la fenêtre.
import React, { useContext } from 'react';
import { SafeAreaFrameContext, SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useWindowSize } from './windowSize';

type Rect = { x: number; y: number; width: number; height: number };
type Insets = { top: number; bottom: number; left: number; right: number };

// Un mock de react-native-safe-area-context peut ne pas exporter les contextes.
const NoFrame = React.createContext<Rect | null>(null);
const NoInsets = React.createContext<Insets | null>(null);
const ZERO: Insets = { top: 0, bottom: 0, left: 0, right: 0 };

/** Cadre de la scène en repère fenêtre ; la fenêtre entière à défaut. */
export function useSceneFrame(): Rect {
  const frame = useContext(SafeAreaFrameContext ?? NoFrame);
  const { width, height } = useWindowSize();
  return frame ?? { x: 0, y: 0, width, height };
}

/** Insets vus dans la scène ; zéro à défaut. */
export function useSceneInsets(): Insets {
  return useContext(SafeAreaInsetsContext ?? NoInsets) ?? ZERO;
}
