// components/map/MapPin.tsx — LE marqueur de carte, pour toute l'app.
//
// Pourquoi il existe. react-native-maps rend un marqueur personnalisé en le
// photographiant (bitmap) : sur Android, avec `tracksViewChanges={false}` dès
// le montage, la photo est prise AVANT que le rond soit tracé et l'icône
// Feather dessinée — d'où des points carrés et des icônes avec leur boîte,
// « parfois », selon le tick. Et un `elevation` Android dans un marqueur
// dessine une ombre carrée autour d'un rond.
//
// Règles, appliquées ici une fois pour toutes :
//   - on laisse le marqueur se re-photographier le temps de son premier rendu
//     et de ses animations (`trackKey` change → nouvelle fenêtre), puis on fige
//     pour ne pas rasteriser à chaque frame de carte ;
//   - le contenu est posé dans une boîte transparente, non aplatie
//     (`collapsable={false}`), centrée sur la coordonnée ;
//   - pas d'`elevation` dans un marqueur : l'ombre, c'est iOS seulement.
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { Marker, type MapMarkerProps } from 'react-native-maps';

/** Vrai pendant `ms` après chaque changement de `key` : le temps de dessiner et d'animer. */
export function useTracksViewChanges(key: string | number | boolean = 'mount', ms = 1200): boolean {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    setTracking(true);
    const t = setTimeout(() => setTracking(false), ms);
    return () => clearTimeout(t);
  }, [key, ms]);
  return tracking;
}

type Props = Omit<MapMarkerProps, 'tracksViewChanges' | 'children'> & {
  /** Change quand le contenu change de forme (état, couleur, cap) : le marqueur se re-photographie. */
  trackKey?: string | number | boolean;
  /** Durée de la fenêtre de suivi (ms) — au moins la durée de l'animation d'entrée. */
  trackMs?: number;
  /** Suivre en permanence (contenu qui change tout le temps, ex. ETA) — coûteux, à réserver. */
  alwaysTrack?: boolean;
  boxStyle?: ViewStyle;
  children: React.ReactNode;
};

export function MapPin({ trackKey = 'mount', trackMs = 1200, alwaysTrack = false, anchor, boxStyle, children, ...marker }: Props) {
  const tracks = useTracksViewChanges(trackKey, trackMs);
  return (
    <Marker anchor={anchor ?? { x: 0.5, y: 0.5 }} tracksViewChanges={alwaysTrack || tracks} {...marker}>
      <View collapsable={false} style={[s.box, boxStyle]}>{children}</View>
    </Marker>
  );
}

/** Ombre d'un marqueur : iOS seulement — sur Android, `elevation` ferait une ombre carrée. */
export const pinShadow = (opacity: number): ViewStyle =>
  Platform.OS === 'ios'
    ? { shadowColor: '#000', shadowOpacity: opacity, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }
    : {};

const s = StyleSheet.create({
  box: { backgroundColor: 'transparent', overflow: 'visible', alignItems: 'center', justifyContent: 'center' },
});
