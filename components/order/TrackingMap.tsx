/**
 * TrackingMap — the map layer behind the order-tracking sheet (native).
 *
 * Split out of TrackingMapView so the web build can swap in a Leaflet map
 * (TrackingMap.web.tsx) instead of rendering nothing. expo-maps throws at
 * import time on web, so the platform boundary has to be a whole module, not a
 * `Platform.OS` branch inside one — a branch still evaluates the import.
 *
 * That was the bug: the shared view branched iOS / everything-else, and on the
 * web store "everything else" resolved to the null stand-in from
 * components/maps/native-maps.web.ts. Customers tracking an order on
 * ofu-shop.vercel.app got an empty cream rectangle where the map should be.
 */

import { useImage } from 'expo-image';
import { Platform, StyleSheet } from 'react-native';

import { AppleMaps, GoogleMaps } from '@/components/maps/native-maps';
import { type LatLng } from '@/data/fulfillment';

export type TrackingMapProps = {
  /** Where the customer asked for it. Undefined until the order carries a pin. */
  dest: LatLng | undefined;
  /** Live rider fix, or null while no position has been broadcast yet. */
  riderPos: LatLng | null;
  /** Framing computed by the caller so both platforms stay in sync. */
  camera: { coordinates: LatLng; zoom: number };
  destLabel: string;
  riderLabel: string;
};

export function TrackingMap({ dest, riderPos, camera, destLabel, riderLabel }: TrackingMapProps) {
  const riderIcon = useImage(require('@/assets/images/rider-marker.png'));

  if (Platform.OS === 'ios') {
    return (
      <AppleMaps.View
        style={StyleSheet.absoluteFill}
        cameraPosition={camera}
        markers={dest ? [{ coordinates: dest, title: destLabel }] : []}
        annotations={
          riderPos
            ? riderIcon
              ? [{ coordinates: riderPos, icon: riderIcon, title: riderLabel }]
              : [{ coordinates: riderPos, text: riderLabel }]
            : []
        }
      />
    );
  }

  return (
    <GoogleMaps.View
      style={StyleSheet.absoluteFill}
      cameraPosition={camera}
      markers={[
        ...(riderPos
          ? [
              riderIcon
                ? { coordinates: riderPos, icon: riderIcon, title: riderLabel }
                : { coordinates: riderPos, title: riderLabel },
            ]
          : []),
        ...(dest ? [{ coordinates: dest, title: destLabel }] : []),
      ]}
    />
  );
}
