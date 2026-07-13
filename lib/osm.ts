/**
 * OpenStreetMap Nominatim geocoding — the WEB replacement for the on-device
 * geocoder (expo-location has no web backend) and for Places search (the
 * Google key is Android/iOS-restricted). Free service: keep calls debounced
 * and low-volume per the usage policy (≤1 req/s; browser sends the referer).
 *
 * Results are mapped into expo-location's LocationGeocodedAddress shape so
 * the address picker reuses its formatLine / parcel-parts logic untouched.
 */

import type * as Location from 'expo-location';

type LatLng = { latitude: number; longitude: number };

const BASE = 'https://nominatim.openstreetmap.org';

/** Nominatim's address object (the subset Thailand responses actually carry). */
type OsmAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  quarter?: string;
  suburb?: string;
  city_district?: string;
  district?: string;
  county?: string;
  town?: string;
  village?: string;
  city?: string;
  state?: string;
  province?: string;
  postcode?: string;
};

function toGeocodedAddress(a: OsmAddress): Location.LocationGeocodedAddress {
  return {
    name: null,
    streetNumber: a.house_number ?? null,
    street: a.road ?? null,
    // ตำบล/แขวง
    district: a.suburb ?? a.quarter ?? a.neighbourhood ?? null,
    // อำเภอ/เขต
    subregion: a.city_district ?? a.district ?? a.county ?? null,
    city: a.town ?? a.city ?? a.village ?? null,
    // จังหวัด (Bangkok comes back as state "กรุงเทพมหานคร")
    region: a.state ?? a.province ?? null,
    postalCode: a.postcode ?? null,
    country: null,
    isoCountryCode: null,
    timezone: null,
    formattedAddress: null,
  };
}

/** Reverse geocode a point → LocationGeocodedAddress[] (empty on failure). */
export async function osmReverseGeocode(
  { latitude, longitude }: LatLng,
  lang: string,
): Promise<Location.LocationGeocodedAddress[]> {
  const url =
    `${BASE}/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}` +
    `&accept-language=${lang === 'en' ? 'en' : 'th'}&zoom=18`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const data = (await res.json()) as { address?: OsmAddress };
  return data.address ? [toGeocodedAddress(data.address)] : [];
}

export type OsmHit = { coords: LatLng; label: string };

/** Free-text place/address search biased to Thailand. */
export async function osmSearch(query: string, lang: string): Promise<OsmHit[]> {
  const url =
    `${BASE}/search?format=jsonv2&q=${encodeURIComponent(query)}` +
    `&countrycodes=th&limit=5&accept-language=${lang === 'en' ? 'en' : 'th'}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  return data.map((d) => ({
    coords: { latitude: Number(d.lat), longitude: Number(d.lon) },
    // display_name is long ("ที่, ตำบล, อำเภอ, จังหวัด, รหัส, ประเทศไทย") — drop the country.
    label: d.display_name.replace(/,\s*(ประเทศไทย|Thailand)$/, ''),
  }));
}
