// lib/layout/InsetScope.tsx
// Une scène qui s'arrête au bord du rail système — et des enfants qui le savent.
//
// Sur l'écran interne de l'iPhone Duo, la barre d'état et la Dynamic Island
// vivent dans un rail vertical de 84 pt (à droite ou à gauche). Deux défauts
// symétriques en découlaient, écran par écran :
//   - un écran qui n'applique que l'inset du haut passe SOUS le rail ;
//   - un écran posé dans une scène déjà décalée (onglets) qui rajoute l'inset
//     latéral se décale DEUX fois (84 pt de vide en plus).
//
// InsetScope règle les deux à un seul endroit : le conteneur se décale de
// `pad`, puis un SafeAreaProvider imbriqué recalcule les insets pour SON cadre
// (natif : UIView.safeAreaInsets du provider). Les enfants voient left/right
// = 0 du côté déjà traité, top/bottom intacts. Aucun écran n'a plus à penser
// au rail : SafeAreaView, useSafeAreaInsets et useLayoutClass disent vrai.
//
// La structure est la même plié comme déplié (pad = 0 sur un iPhone) : plier
// le Duo ne démonte jamais l'écran.
import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { StyleSheet, View, type ColorValue, type HostInstance } from 'react-native';
import { useWindowSize } from './windowSize';
import { debugSnapshot } from './hinge';
import { SafeAreaProvider, useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

export type SidePad = { left: number; right: number };

/**
 * La racine de l'écran (le conteneur d'InsetScope, à x = 0 de la fenêtre au
 * repos). Les mises en page autour du pli mesurent leur position PAR RAPPORT
 * À ELLE (measureLayout : la mise en page pure) — jamais avec measureInWindow,
 * qui compte les transformations en cours (glissement d'ouverture d'écran,
 * bascule plié / déplié) et garde ensuite une position fausse.
 */
const SceneRootContext = createContext<(() => HostInstance | null) | null>(null);
export const useSceneRoot = () => useContext(SceneRootContext);

/** Les insets que verront les enfants : ceux du parent, moins le décalage déjà posé. */
export function insetsWithin(parent: EdgeInsets, pad: SidePad): EdgeInsets {
  return {
    top: parent.top,
    bottom: parent.bottom,
    left: Math.max(0, parent.left - pad.left),
    right: Math.max(0, parent.right - pad.right),
  };
}

type Props = {
  children: React.ReactNode;
  /** Décalage latéral du conteneur. Par défaut : les insets gauche/droite du parent. */
  pad?: SidePad;
  /** Couleur sous le décalage (le rail laisse voir le fond de la scène). */
  backgroundColor?: ColorValue;
  /** Diagnostic Duo : nom de l'écran pour son image (drapeau FixedHingeLog). */
  debugName?: string;
};

export function InsetScope({ children, pad, backgroundColor, debugName }: Props) {
  useEffect(() => { if (debugName) debugSnapshot(`screen-${debugName}`, 1400); }, [debugName]);
  const parent = useSafeAreaInsets();
  const { width, height } = useWindowSize();
  const rootRef = useRef<HostInstance>(null);
  const getRoot = useCallback(() => rootRef.current, []);
  const side = pad ?? { left: parent.left, right: parent.right };
  // Premier rendu juste (pas de saut d'une frame) : le natif confirme ensuite.
  const initialMetrics = {
    insets: insetsWithin(parent, side),
    frame: { x: side.left, y: 0, width: Math.max(0, width - side.left - side.right), height },
  };
  return (
    <View ref={rootRef} style={[s.fill, { paddingLeft: side.left, paddingRight: side.right, backgroundColor }]}>
      <SafeAreaProvider initialMetrics={initialMetrics} style={s.fill}>
        <SceneRootContext.Provider value={getRoot}>{children}</SceneRootContext.Provider>
      </SafeAreaProvider>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
});
