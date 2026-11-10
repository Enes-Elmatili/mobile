// components/provider/cockpit/CockpitMap.tsx — la carte plein écran de
// l'accueil prestataire : l'écran, c'est elle ; l'interface flotte dessus.
// Tracé, demandes, porte de la mission et mon repère.
import React, { type RefObject } from 'react';
import { StyleSheet } from 'react-native';
import MapView from 'react-native-maps';
import { MAP_PROVIDER, mapAppearance } from '@/lib/map/appearance';
import type { LatLng } from '@/lib/mission/route';
import type { CockpitStage } from '@/lib/cockpit/stage';
import type { MeTone } from '@/lib/cockpit/framing';
import type { IncomingRequest } from '@/lib/cockpit/incoming';
import { MePin, DemandPin, DoorPin, RouteTrace } from '@/components/cockpit/markers';
import { BRUSSELS } from './useCockpitCamera';

type Props = {
  mapRef: RefObject<MapView | null>;
  isDark: boolean;
  onReady: () => void;
  /** Bas des mentions légales : au-dessus de la journée. */
  legalBottom: number;
  legalLeft: number;
  stage: CockpitStage;
  location: LatLng | null;
  heading: number;
  routeCoords: LatLng[];
  routeColor: string;
  incomingRequests: IncomingRequest[];
  doorCoord: LatLng | null;
  meTone: MeTone;
  /** La flèche de cap (en route vers la porte). */
  arrow: boolean;
  me: { name: string | null; avatarUrl: string | null };
  /** Duo déplié, fiche ou mission dans la page droite : la carte s'arrête avant (0 = plein cadre).
   *  La caméra cadre alors dans ce qui reste visible, sans rembourrage latéral. */
  right?: number;
};

export function CockpitMap({ mapRef, isDark, onReady, legalBottom, legalLeft, stage, location, heading, routeCoords, routeColor, incomingRequests, doorCoord, meTone, arrow, me, right = 0 }: Props) {
  return (
    <MapView
      ref={mapRef}
      provider={MAP_PROVIDER}
      {...mapAppearance(isDark)}
      style={[StyleSheet.absoluteFill, right > 0 ? { right } : null]}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={false}
      showsScale={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      onMapReady={onReady}
      legalLabelInsets={{ top: 0, left: legalLeft, bottom: legalBottom, right: 0 }}
      initialRegion={{ ...(location ?? BRUSSELS), latitudeDelta: 0.035, longitudeDelta: 0.035 }}
    >
      <RouteTrace coords={routeCoords} color={routeColor} />

      {incomingRequests.map((req, i) =>
        req.latitude && req.longitude ? (
          <DemandPin key={req.requestId} id={req.requestId} coordinate={{ latitude: req.latitude, longitude: req.longitude }} index={i} big={stage === 'incoming' && i === 0} />
        ) : null
      )}

      {stage === 'busy' && doorCoord ? <DoorPin coordinate={doorCoord} /> : null}

      {location ? <MePin coordinate={location} tone={meTone} heading={heading} arrow={arrow} me={me} /> : null}
    </MapView>
  );
}
