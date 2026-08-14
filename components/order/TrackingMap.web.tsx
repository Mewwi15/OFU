/**
 * TrackingMap (web) — Leaflet + OpenStreetMap stand-in for the native map.
 *
 * expo-maps cannot run on web, and the null stand-in it falls back to left the
 * customer staring at an empty rectangle for the whole delivery. The web store
 * is where a first-time customer is most likely to be watching, so "no map" is
 * the worst place to have no map.
 *
 * OSM tiles rather than the Google JS SDK: this needs no key, no billing, and
 * no Cloud console change — and PickerMap.web.tsx already falls back to the
 * same pair, so the two maps in the app look like siblings.
 *
 * Two markers, deliberately different shapes: the destination is a static pin
 * (this is fixed, it is your address) and the rider is a pulsing dot (this is
 * live, it moves). A customer glancing at the screen should be able to tell
 * which one is them without a legend.
 */

import * as L from 'leaflet';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { type LatLng } from '@/data/fulfillment';

import type { TrackingMapProps } from './TrackingMap';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const PULSE_KEYFRAMES = 'oofoo-rider-pulse';

/**
 * Leaflet's default marker is a bundler-hostile image path and its CSS lives
 * outside the RN styling system, so both icons and the pulse animation are
 * injected once as a plain stylesheet.
 */
function ensureLeafletCss() {
  if (document.getElementById('leaflet-css')) return;
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = LEAFLET_CSS;
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.id = 'oofoo-tracking-map-css';
  style.textContent = `
@keyframes ${PULSE_KEYFRAMES} {
  0%   { transform: scale(1);   opacity: .55 }
  70%  { transform: scale(2.6); opacity: 0 }
  100% { transform: scale(2.6); opacity: 0 }
}
@media (prefers-reduced-motion: reduce) {
  .oofoo-rider-halo { animation: none !important; opacity: .35 }
}`;
  document.head.appendChild(style);
}

/** Fixed pin: teardrop, dark, reads as "the place". */
const DEST_ICON = L.divIcon({
  className: '',
  html:
    `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);` +
    `background:${Colors.text};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

/** Live dot: coral, haloed, reads as "moving right now". */
const RIDER_ICON = L.divIcon({
  className: '',
  html:
    `<div style="position:relative;width:20px;height:20px">` +
    `<div class="oofoo-rider-halo" style="position:absolute;inset:0;border-radius:50%;` +
    `background:${Colors.primary};animation:${PULSE_KEYFRAMES} 2s ease-out infinite"></div>` +
    `<div style="position:absolute;inset:0;border-radius:50%;background:${Colors.primary};` +
    `border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>` +
    `</div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

export function TrackingMap({ dest, riderPos, camera, destLabel, riderLabel }: TrackingMapProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const destRef = useRef<L.Marker | null>(null);
  const riderRef = useRef<L.Marker | null>(null);

  // Mount once. Re-creating the map on every rider fix would restart the tile
  // fetch and flash the whole panel every five seconds.
  useEffect(() => {
    ensureLeafletCss();
    if (!divRef.current || mapRef.current) return;

    const map = L.map(divRef.current, {
      center: [camera.coordinates.latitude, camera.coordinates.longitude],
      zoom: camera.zoom,
      zoomControl: false,
      attributionControl: true,
    });
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
    // The sheet covers the bottom of the screen, so keep the zoom control clear
    // of it rather than in its default bottom-left spot.
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapRef.current = map;
    // The tracking screen animates in; without this the tiles paint as grey
    // slabs until the window happens to resize.
    setTimeout(() => map.invalidateSize(), 250);

    return () => {
      map.remove();
      mapRef.current = null;
      destRef.current = null;
      riderRef.current = null;
    };
    // Camera is intentionally not a dependency — see the follow effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the camera the shared view computed, so web and native frame the
  // delivery identically.
  useEffect(() => {
    mapRef.current?.setView(
      [camera.coordinates.latitude, camera.coordinates.longitude],
      camera.zoom,
      { animate: true },
    );
  }, [camera.coordinates.latitude, camera.coordinates.longitude, camera.zoom]);

  useEffect(() => {
    syncMarker(mapRef.current, destRef, dest, DEST_ICON, destLabel);
  }, [dest, destLabel]);

  useEffect(() => {
    syncMarker(mapRef.current, riderRef, riderPos, RIDER_ICON, riderLabel);
  }, [riderPos, riderLabel]);

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* zIndex 0 keeps Leaflet's panes under the sheet and the close button. */}
      <div ref={divRef} style={{ width: '100%', height: '100%', zIndex: 0 }} />
    </View>
  );
}

/** Add, move, or remove a marker without tearing down the map. */
function syncMarker(
  map: L.Map | null,
  ref: React.MutableRefObject<L.Marker | null>,
  at: LatLng | null | undefined,
  icon: L.DivIcon,
  title: string,
) {
  if (!map) return;
  if (!at) {
    if (ref.current) {
      ref.current.remove();
      ref.current = null;
    }
    return;
  }
  if (ref.current) {
    ref.current.setLatLng([at.latitude, at.longitude]);
  } else {
    ref.current = L.marker([at.latitude, at.longitude], { icon, title }).addTo(map);
  }
}
