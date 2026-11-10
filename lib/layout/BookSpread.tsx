// lib/layout/BookSpread.tsx
// Deux pages autour du pli : le Duo déplié se lit comme un livre ouvert.
//
// Une colonne de lecture centrée (560 pt) passait À CHEVAL sur la charnière —
// texte, champs et boutons coupés par le pli. Ici, la page gauche s'arrête au
// bord du pli, la page droite reprend après lui (40 pt mesurés sur le Duo).
// Sans pli connu (pliable Android, iPad), deux moitiés séparées par une
// gouttière. Statique : pas d'animation d'entrée — c'est une mise en page, pas
// un volet de détail (pour ça, SplitPane).
//
// À n'utiliser que sur regular (useSplitPane()) : sur compact, l'écran garde
// sa colonne habituelle.
import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { layoutLog, useHinge } from './hinge';
import { foldLineFor } from './posture';
import { useRowFrame } from './rowFrame';
import { useWindowSize } from './windowSize';
import { useSceneFrame } from './sceneFrame';
import { HINGE_GUTTER } from './SplitPane';

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Largeur de la page gauche et de la gouttière pour un conteneur donné. */
export function bookColumnsFor(line: { start: number; end: number } | null, width: number): { left: number; gutter: number } {
  if (line) return { left: line.start, gutter: line.end - line.start };
  return { left: Math.max(0, (width - HINGE_GUTTER) / 2), gutter: HINGE_GUTTER };
}

export function BookSpread({ left, right, style }: Props) {
  const scene = useSceneFrame();
  const hinge = useHinge();
  // Position mesurée par rapport à la racine de l'écran, sans transformations
  // (lib/layout/rowFrame) ; remesurée quand la scène ou le pli change.
  const { ref, onLayout, frame } = useRowFrame([hinge]);
  const line = foldLineFor(hinge, frame);
  const cols = bookColumnsFor(line, frame.width);
  const win = useWindowSize();
  useEffect(() => {
    layoutLog('book', { frame, scene, win: { w: win.width, h: win.height }, posture: hinge?.posture, fold: hinge?.fold, line, cols });
  }, [frame, scene, win.width, win.height, hinge, line, cols]);

  return (
    <View ref={ref} onLayout={onLayout} style={[s.row, style]}>
      <View style={[s.page, { width: cols.left }]}>{left}</View>
      <View style={{ width: cols.gutter }} />
      <View style={[s.page, s.fill]}>{right}</View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  page: { minWidth: 0 },
  fill: { flex: 1 },
});
