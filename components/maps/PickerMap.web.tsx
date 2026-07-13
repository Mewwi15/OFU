/**
 * PickerMap (web) — Google Maps JS when EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY is
 * set (owner wants the same Google look as the app), falling back to
 * Leaflet + OpenStreetMap when the key is missing or the script fails, so the
 * picker never renders an empty map. Same props/handle as the native
 * PickerMap; the parent keeps its fixed centre-pin overlay, so no markers —
 * the map only reports settle/click coordinates in the expo-maps event shape.
 *
 * NOTE: the web key must be restricted to Websites (ofu-shop.vercel.app +
 * localhost) + Maps JavaScript API only — it ships in the public bundle.
 */

import * as L from 'leaflet';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

import type { PickerMapHandle, PickerMapProps } from '@/components/maps/PickerMap';

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY;

/* ------------------------------ Google Maps ------------------------------ */

let gmapsLoader: Promise<void> | null = null;

/** Load the Maps JS script once; rejects if Google fails (bad key, offline). */
function loadGoogleMaps(key: string): Promise<void> {
  if (typeof google !== 'undefined' && google.maps?.Map) return Promise.resolve();
  if (gmapsLoader) return gmapsLoader;
  gmapsLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&v=weekly&language=th&region=TH&loading=async&callback=__oofooGmapsReady`;
    (window as unknown as Record<string, unknown>).__oofooGmapsReady = () => resolve();
    // Google reports auth failures (wrong key/referer) via this global, after
    // the script itself loaded fine — treat it as a load failure so the
    // caller can fall back to OSM.
    (window as unknown as Record<string, unknown>).gm_authFailure = () =>
      reject(new Error('gm_authFailure'));
    script.onerror = () => reject(new Error('gmaps script failed'));
    document.head.appendChild(script);
  });
  return gmapsLoader;
}

/* -------------------------------- Leaflet -------------------------------- */

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function ensureLeafletCss() {
  if (document.getElementById('leaflet-css')) return;
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = LEAFLET_CSS;
  document.head.appendChild(link);
}

/* ------------------------------- component ------------------------------- */

export const PickerMap = forwardRef<PickerMapHandle, PickerMapProps>(function PickerMap(
  { initialCenter, initialZoom, onCameraMove, onMapClick },
  ref,
) {
  const divRef = useRef<HTMLDivElement>(null);
  const gmapRef = useRef<google.maps.Map | null>(null);
  const lmapRef = useRef<L.Map | null>(null);
  // null = deciding (google script in flight), then locked to one engine.
  const [engine, setEngine] = useState<'google' | 'osm' | null>(GOOGLE_KEY ? null : 'osm');

  const moveRef = useRef(onCameraMove);
  moveRef.current = onCameraMove;
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  // setCameraPosition can arrive before the (async) map exists — e.g. the
  // picker's auto-locate resolving while the Google script is still loading.
  // Remember the latest request and honour it when the map mounts.
  const pendingCamera = useRef<{ lat: number; lng: number; zoom: number } | null>(null);

  // Decide the engine: try Google when a key exists, fall back to OSM.
  useEffect(() => {
    if (!GOOGLE_KEY) return;
    let cancelled = false;
    loadGoogleMaps(GOOGLE_KEY)
      .then(() => !cancelled && setEngine('google'))
      .catch(() => !cancelled && setEngine('osm'));
    return () => {
      cancelled = true;
    };
  }, []);

  // Mount the chosen map into the div.
  useEffect(() => {
    if (!divRef.current || !engine) return;

    if (engine === 'google') {
      const start = pendingCamera.current;
      const map = new google.maps.Map(divRef.current, {
        center: start
          ? { lat: start.lat, lng: start.lng }
          : { lat: initialCenter.latitude, lng: initialCenter.longitude },
        zoom: start?.zoom ?? initialZoom,
        clickableIcons: false,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
      });
      map.addListener('idle', () => {
        const c = map.getCenter();
        if (c) moveRef.current({ coordinates: { latitude: c.lat(), longitude: c.lng() } });
      });
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          clickRef.current({
            coordinates: { latitude: e.latLng.lat(), longitude: e.latLng.lng() },
          });
        }
      });
      gmapRef.current = map;
      return () => {
        google.maps.event.clearInstanceListeners(map);
        gmapRef.current = null;
      };
    }

    ensureLeafletCss();
    const start = pendingCamera.current;
    const map = L.map(divRef.current, {
      center: start
        ? [start.lat, start.lng]
        : [initialCenter.latitude, initialCenter.longitude],
      zoom: start?.zoom ?? initialZoom,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
    map.on('moveend', () => {
      const c = map.getCenter();
      moveRef.current({ coordinates: { latitude: c.lat, longitude: c.lng } });
    });
    map.on('click', (e: L.LeafletMouseEvent) => {
      clickRef.current({ coordinates: { latitude: e.latlng.lat, longitude: e.latlng.lng } });
    });
    lmapRef.current = map;
    return () => {
      map.remove();
      lmapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  useImperativeHandle(ref, () => ({
    setCameraPosition: ({ coordinates, zoom }) => {
      pendingCamera.current = { lat: coordinates.latitude, lng: coordinates.longitude, zoom };
      if (gmapRef.current) {
        gmapRef.current.panTo({ lat: coordinates.latitude, lng: coordinates.longitude });
        gmapRef.current.setZoom(zoom);
        return;
      }
      lmapRef.current?.setView([coordinates.latitude, coordinates.longitude], zoom, {
        animate: true,
      });
    },
  }));

  return <div ref={divRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />;
});
