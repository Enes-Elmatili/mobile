// lib/map/appearance.ts — la carte native de chaque plateforme, au thème de l'app.
//
// iOS : Apple Maps (MapKit) — pas de clé, pas de logo, la carte d'iOS 26.
//   `mutedStandard` (les données au premier plan, le fond en retrait),
//   POI masqués, et `userInterfaceStyle` suit `isDark` de l'app — pas le
//   réglage système — comme le style Google le faisait.
// Android : Google Maps avec nos styles JSON monochromes (MapKit n'existe pas ailleurs).
//
// L'ETA, le tracé (lib/mission/route.ts) et le bouton « Itinéraire » (app de
// navigation du téléphone) ne dépendent pas du fond de carte.
import { Platform } from 'react-native';
import { PROVIDER_DEFAULT, PROVIDER_GOOGLE, type MapViewProps } from 'react-native-maps';
import { MAP_STYLE_DARK, MAP_STYLE_LIGHT } from '@/constants/mapStyles';

export const MAP_PROVIDER = Platform.OS === 'ios' ? PROVIDER_DEFAULT : PROVIDER_GOOGLE;

/** Props d'apparence à étaler sur une `MapView`. */
export function mapAppearance(isDark: boolean): Partial<MapViewProps> {
  if (Platform.OS === 'ios') {
    return { userInterfaceStyle: isDark ? 'dark' : 'light', mapType: 'mutedStandard', showsPointsOfInterest: false, showsBuildings: false, showsTraffic: false };
  }
  return { customMapStyle: isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT, showsPointsOfInterest: false };
}
