/**
 * OrderMiniMap — where the customer actually dropped their pin, shown inline in
 * the order drawer.
 *
 * The "นำทาง" button hands the trip to Google Maps, but before setting off the
 * shop wants the cheaper question answered first: *where is this, roughly?* —
 * near enough to walk, across town, or somewhere they will decline. A button
 * that navigates away cannot answer that.
 *
 * Leaflet + OpenStreetMap tiles rather than the Google JS SDK: the shop's Google
 * web key is referrer-locked to the customer store, so using it here would mean
 * a Google Cloud change before the map renders at all. OSM needs no key, and the
 * app already leans on the same pair for its own map fallback.
 */

import * as L from 'leaflet';
import { useEffect, useRef } from 'react';

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

/**
 * Leaflet ships its marker icon as bundler-hostile image paths. A small divIcon
 * avoids the whole problem and matches the POS palette — a coral pin on white.
 */
const PIN = L.divIcon({
  className: '',
  html:
    '<div style="width:22px;height:22px;border-radius:50%;background:#F15929;' +
    'border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export function OrderMiniMap({
  lat,
  lng,
  height = 190,
}: {
  lat: number;
  lng: number;
  height?: number;
}) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    ensureLeafletCss();
    if (!divRef.current) return;

    if (!mapRef.current) {
      const map = L.map(divRef.current, {
        center: [lat, lng],
        zoom: 16,
        // The drawer scrolls; a map that eats the wheel traps the operator
        // halfway down the order. Drag and the +/- control still work.
        scrollWheelZoom: false,
        attributionControl: true,
      });
      L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
      markerRef.current = L.marker([lat, lng], { icon: PIN }).addTo(map);
      mapRef.current = map;
      // The drawer animates open, so the container has no size on first paint —
      // without this the tiles render as grey slabs until something resizes.
      setTimeout(() => map.invalidateSize(), 250);
    } else {
      mapRef.current.setView([lat, lng], mapRef.current.getZoom());
      markerRef.current?.setLatLng([lat, lng]);
    }
  }, [lat, lng]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    },
    [],
  );

  return (
    <div
      ref={divRef}
      style={{ height, width: '100%', borderRadius: 4, overflow: 'hidden', zIndex: 0 }}
    />
  );
}
