/**
 * PickerMap — the pannable map inside the address pin picker, behind one
 * platform-neutral API. Native renders expo-maps (Apple/Google); web swaps in
 * PickerMap.web.tsx (Leaflet + OpenStreetMap — expo-maps has no web backend).
 *
 * The parent owns the fixed centre pin overlay and reverse geocoding; this
 * component only reports camera-settle / tap coordinates and exposes
 * `setCameraPosition` for programmatic recentres (search picks, GPS).
 */

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { AppleMaps, GoogleMaps } from '@/components/maps/native-maps';

type LatLng = { latitude: number; longitude: number };

export type PickerMapHandle = {
  setCameraPosition: (pos: { coordinates: LatLng; zoom: number }) => void;
};

export type PickerMapProps = {
  initialCenter: LatLng;
  initialZoom: number;
  /** Show the OS my-location dot (only pass true once permission is granted). */
  myLocationEnabled: boolean;
  onCameraMove: (e: { coordinates: { latitude?: number; longitude?: number } }) => void;
  onMapClick: (e: { coordinates: { latitude?: number; longitude?: number } }) => void;
};

export const PickerMap = forwardRef<PickerMapHandle, PickerMapProps>(function PickerMap(
  { initialCenter, initialZoom, myLocationEnabled, onCameraMove, onMapClick },
  ref,
) {
  const appleRef = useRef<AppleMaps.MapView>(null);
  const googleRef = useRef<GoogleMaps.MapView>(null);

  useImperativeHandle(ref, () => ({
    setCameraPosition: (pos) => {
      // Native call that can throw before the first layout — pin state is
      // owned by the parent, so a missed recentre is safe to swallow.
      try {
        appleRef.current?.setCameraPosition(pos);
        googleRef.current?.setCameraPosition(pos);
      } catch {
        // view not ready — ignore
      }
    },
  }));

  if (Platform.OS === 'ios') {
    return (
      <AppleMaps.View
        ref={appleRef}
        style={StyleSheet.absoluteFill}
        cameraPosition={{ coordinates: initialCenter, zoom: initialZoom }}
        properties={{ isMyLocationEnabled: myLocationEnabled }}
        uiSettings={{ myLocationButtonEnabled: false, compassEnabled: false }}
        onMapClick={onMapClick}
        onCameraMove={onCameraMove}
      />
    );
  }
  return (
    <GoogleMaps.View
      ref={googleRef}
      style={StyleSheet.absoluteFill}
      cameraPosition={{ coordinates: initialCenter, zoom: initialZoom }}
      properties={{ isMyLocationEnabled: myLocationEnabled }}
      uiSettings={{ myLocationButtonEnabled: false }}
      onMapClick={onMapClick}
      onCameraMove={onCameraMove}
    />
  );
});
