// lib/layout/rowFrame.ts
// Où est une rangée dans la fenêtre — pour la caler sur le pli.
//
// Constaté sur le Duo (journal [DuoLayout], 10/11/2026) : measureInWindow,
// appelé au onLayout, renvoyait une position prise PENDANT une transformation
// (glissement d'ouverture d'écran, bascule plié / déplié). La mise en page ne
// changeant plus ensuite, la position fausse restait : coupure à 271 pt au
// lieu du pli à 455,5, carte à cheval sur la charnière.
//
// Ici : largeur/hauteur du onLayout (mise en page pure), position x par
// measureLayout RELATIVE à la racine de l'écran (InsetScope, à x = 0 de la
// fenêtre au repos) — sans transformation ni décalage de fenêtre. Hors
// InsetScope (pleins écrans), la rangée est supposée au bord de la scène.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { HostInstance, LayoutChangeEvent } from 'react-native';
import { useSceneRoot } from './InsetScope';
import { useSceneFrame } from './sceneFrame';
import type { Frame } from './posture';

export function useRowFrame(deps: unknown[] = []) {
  const scene = useSceneFrame();
  const getRoot = useSceneRoot();
  const ref = useRef<HostInstance>(null);
  const size = useRef<{ width: number; height: number } | null>(null);
  // Premier rendu calé sur la scène (la rangée l'occupe presque toujours).
  const [frame, setFrame] = useState<Frame>(() => ({ x: scene.x, y: scene.y, width: scene.width, height: scene.height }));

  const commit = useCallback((next: Frame) => {
    setFrame((f) => (f.x === next.x && f.y === next.y && f.width === next.width && f.height === next.height ? f : next));
  }, []);

  const measure = useCallback(() => {
    const dims = size.current;
    if (!dims) return;
    const node = ref.current;
    const rootNode = getRoot ? getRoot() : null;
    const fallback = () => commit({ x: scene.x, y: scene.y, ...dims });
    if (!node || !rootNode) { fallback(); return; }
    node.measureLayout(rootNode, (x: number, y: number) => commit({ x, y, ...dims }), fallback);
  }, [getRoot, scene.x, scene.y, commit]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    size.current = { width, height };
    measure();
  }, [measure]);

  // La scène peut bouger sans que la rangée change de taille (rail qui change
  // de côté), ou le pli changer : on remesure.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps fournis par l'appelant (état de charnière)
  useEffect(() => { measure(); }, [measure, scene.width, scene.height, ...deps]);

  return { ref, onLayout, frame };
}
