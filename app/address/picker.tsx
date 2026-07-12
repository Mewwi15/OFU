/**
 * Address pin picker — `/address/picker` (optionally `?id=` to edit).
 *
 * Three ways to set the delivery point, all funnelling into one editable line:
 *  1. Pan the map under the fixed centre pin (Grab/Uber style).
 *  2. TAP anywhere on the map to drop the pin there.
 *  3. SEARCH a place/address in the top bar, then pick a result to fly there and
 *     auto-fill the address.
 * Whenever the point changes we reverse-geocode it into the editable "ตำแหน่งที่
 * ปักหมุด" field. A FAB recenters on the device GPS. Below the map a form
 * collects label / recipient / phone / extra detail, then saves to the book.
 *
 * Maps are native (expo-maps) — this screen only renders in a development build,
 * NOT Expo Go. Search is Google Places Autocomplete on Android (lib/places),
 * falling back to the on-device geocoder (expo-location) when Places fails or
 * on iOS; reverse geocoding is always on-device — it can return nothing on a
 * bare emulator but works on iOS and real Android devices.
 */

import { Ionicons } from '@expo/vector-icons';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { autocompletePlaces, fetchPlaceLocation, placesAvailable } from '@/lib/places';
import { selectedAddress, useAddress } from '@/store/address';
import { useLocale } from '@/store/locale';
import { useMode } from '@/store/mode';

type LatLng = { latitude: number; longitude: number };
/**
 * A row in the search dropdown: a Google Places suggestion (name + locality,
 * coordinates fetched on pick) or an on-device geocoder hit (fallback path).
 */
type SearchResult =
  | { kind: 'place'; placeId: string; primary: string; secondary: string }
  | { kind: 'geo'; coords: LatLng; label: string };

/** Best-effort map of a reverse-geocode result to Thai postal parts. */
type ParcelParts = {
  subDistrict: string;
  district: string;
  province: string;
  postalCode: string;
};
function parcelPartsFrom(a: Location.LocationGeocodedAddress): ParcelParts {
  return {
    subDistrict: a.district?.trim() ?? '',
    district: (a.subregion ?? a.city)?.trim() ?? '',
    province: (a.region ?? a.city)?.trim() ?? '',
    postalCode: a.postalCode?.trim() ?? '',
  };
}

/** Bangkok (สุขุมวิท) — fallback centre when there's no address yet. */
const DEFAULT_CENTER: LatLng = { latitude: 13.7236, longitude: 100.5686 };
const DEFAULT_ZOOM = 16;
/** Shortest query worth searching — Thai place names get useful at 2 chars. */
const MIN_QUERY = 2;
const LABEL_KEYS = ['address.labelHome', 'address.labelWork', 'address.labelOther'] as const;

/** Build a readable Thai address line from a reverse-geocode result. */
function formatLine(a: Location.LocationGeocodedAddress): string {
  const raw = [
    a.name,
    a.streetNumber,
    a.street,
    a.district,
    a.subregion,
    a.city,
    a.region,
    a.postalCode,
  ]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p);

  // Drop any part already represented in what we've collected — Apple often
  // returns `name` as "<streetNumber> <street>", duplicating the next two parts.
  const out: string[] = [];
  for (const p of raw) {
    if (!out.join(' ').includes(p)) out.push(p);
  }
  return out.join(' ');
}

export default function AddressPickerScreen() {
  const t = useT();
  const lang = useLocale((s) => s.lang);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const upsert = useAddress((s) => s.upsert);
  const editing = useAddress((s) =>
    id ? s.addresses.find((a) => a.id === id) : undefined,
  );
  const current = useAddress(selectedAddress);
  // Online orders ship a parcel nationwide, so they need a full structured
  // postal address; the delivery (rider) flow only needs the pin + line.
  const isOnline = useMode((s) => s.mode === 'online');

  const start = editing ?? current;
  const initialCenter: LatLng = start
    ? { latitude: start.lat, longitude: start.lng }
    : DEFAULT_CENTER;

  const appleRef = useRef<AppleMaps.MapView>(null);
  const googleRef = useRef<GoogleMaps.MapView>(null);
  const centerRef = useRef<LatLng>(initialCenter);
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geoSeq = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

  const [line, setLine] = useState(editing?.line ?? '');
  const [geocoding, setGeocoding] = useState(false);
  // Reverse geocode came back empty/failed — surface it instead of silently
  // keeping the stale line (the user can always type the address manually).
  const [geoFailed, setGeoFailed] = useState(false);
  const [label, setLabel] = useState(editing?.label ?? t(LABEL_KEYS[0]));
  const [recipient, setRecipient] = useState(editing?.recipient ?? '');
  const [phone, setPhone] = useState(editing?.phone ?? '');
  const [detail, setDetail] = useState(editing?.detail ?? '');

  // Structured parcel fields (online / parcel only).
  const [subDistrict, setSubDistrict] = useState(editing?.subDistrict ?? '');
  const [district, setDistrict] = useState(editing?.district ?? '');
  const [province, setProvince] = useState(editing?.province ?? '');
  const [postalCode, setPostalCode] = useState(editing?.postalCode ?? '');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  // A completed search found nothing — show "no results" instead of nothing.
  const [noResults, setNoResults] = useState(false);

  const recenter = (coordinates: LatLng) => {
    // setCameraPosition is a native call that can throw if the view isn't ready
    // yet (e.g. an auto-locate that resolves before the first layout). The pin
    // is driven by centerRef regardless, so swallowing this is safe.
    try {
      appleRef.current?.setCameraPosition({ coordinates, zoom: DEFAULT_ZOOM });
      googleRef.current?.setCameraPosition({ coordinates, zoom: DEFAULT_ZOOM });
    } catch {
      // view not ready — ignore
    }
  };

  // Last point that reverse-geocoded successfully. Camera-settle events after
  // auto-locate/search re-request virtually the SAME point; Apple's geocoder
  // throttles rapid calls, so that redundant request used to fail and flash
  // the stale-address warning under a perfectly good line. Same point → skip.
  const lastGeo = useRef<LatLng | null>(null);

  // keepLine: the line was just set from an authoritative source (a picked
  // Places result) — reverse-geocode only to fill blank parcel fields, and
  // don't flag failure (the line isn't stale).
  const runGeocode = async ({ keepLine = false } = {}) => {
    const { latitude, longitude } = centerRef.current;
    if (
      lastGeo.current &&
      Math.abs(latitude - lastGeo.current.latitude) < 1.5e-4 &&
      Math.abs(longitude - lastGeo.current.longitude) < 1.5e-4
    ) {
      return;
    }
    // Guard against out-of-order resolves: if the pin moves again before this
    // reverse-geocode returns, a newer call bumps geoSeq and this stale result
    // is ignored — otherwise it could overwrite the line with the old address.
    const seq = ++geoSeq.current;
    setGeocoding(true);
    try {
      const res = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (seq === geoSeq.current) {
        if (res[0]) {
          lastGeo.current = { latitude, longitude };
          setGeoFailed(false);
          if (!keepLine) setLine(formatLine(res[0]));
          // Fill any BLANK parcel field from the geocode — never clobber a value
          // the user has already typed/corrected.
          const parts = parcelPartsFrom(res[0]);
          if (parts.subDistrict) setSubDistrict((v) => v || parts.subDistrict);
          if (parts.district) setDistrict((v) => v || parts.district);
          if (parts.province) setProvince((v) => v || parts.province);
          if (parts.postalCode) setPostalCode((v) => v || parts.postalCode);
        } else if (!keepLine) {
          setGeoFailed(true);
        }
      }
    } catch {
      // Keep the previous line, but tell the user it's stale.
      if (seq === geoSeq.current && !keepLine) setGeoFailed(true);
    } finally {
      if (seq === geoSeq.current) setGeocoding(false);
    }
  };

  const scheduleGeocode = (opts?: { keepLine?: boolean }) => {
    if (geoTimer.current) clearTimeout(geoTimer.current);
    geoTimer.current = setTimeout(() => runGeocode(opts), 650);
  };

  // Android's map view throws a hard SecurityException if my-location is
  // enabled before the permission is granted — track it and gate the prop.
  const [locGranted, setLocGranted] = useState(false);

  // On first mount: NEW addresses actively request location permission and
  // jump straight to the device GPS — the address is the whole point of this
  // screen, so we don't make the user hunt for themselves on a Bangkok default
  // (denying keeps the fallback centre; the FAB can re-ask later). Editing an
  // existing address never jumps — its saved pin is what matters — we only
  // silently check permission so the my-location dot can show.
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const { status } = editing
          ? await Location.getForegroundPermissionsAsync()
          : await Location.requestForegroundPermissionsAsync();
        if (status === 'granted' && !cancelled) setLocGranted(true);
        if (!editing && status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (!cancelled) {
            setPoint({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
            return;
          }
        }
      } catch {
        // Permission check / fix failed — fall back to the default centre.
      }
      if (!cancelled && !editing?.line) runGeocode();
    };
    init();
    return () => {
      cancelled = true;
      if (geoTimer.current) clearTimeout(geoTimer.current);
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Move the pin to a point, then reverse-geocode it into the line. */
  const setPoint = (coords: LatLng, { fly = true, keepLine = false } = {}) => {
    centerRef.current = coords;
    if (fly) recenter(coords);
    scheduleGeocode({ keepLine });
  };

  // Where a picked Places result put the pin. Camera-move events near this
  // point (our own fly settling, or nudging the pin within the same building)
  // must NOT overwrite the Google-formatted line with a reverse geocode.
  const pickedPlace = useRef<LatLng | null>(null);
  const nearPickedPlace = (p: LatLng) =>
    !!pickedPlace.current &&
    Math.abs(p.latitude - pickedPlace.current.latitude) < 3e-4 &&
    Math.abs(p.longitude - pickedPlace.current.longitude) < 3e-4;

  const onCameraMove = (e: {
    coordinates: { latitude?: number; longitude?: number };
  }) => {
    const { latitude, longitude } = e.coordinates;
    if (latitude == null || longitude == null) return;
    // User panned the map — the pin already tracks the centre; just geocode.
    setPoint(
      { latitude, longitude },
      { fly: false, keepLine: nearPickedPlace({ latitude, longitude }) },
    );
  };

  /** Tap anywhere on the map to drop the pin there. */
  const onMapClick = (e: {
    coordinates: { latitude?: number; longitude?: number };
  }) => {
    const { latitude, longitude } = e.coordinates;
    if (latitude == null || longitude == null) return;
    pickedPlace.current = null;
    setPoint({ latitude, longitude });
    dismissSearch();
  };

  /* --------------------------- place search --------------------------- */

  /** On-device geocoder search — iOS path and the fallback when Places fails. */
  const geocodeSearch = async (q: string): Promise<SearchResult[]> => {
    const hits = await Location.geocodeAsync(q);
    const labeled = await Promise.all(
      hits.slice(0, 5).map(async (h) => {
        const coords = { latitude: h.latitude, longitude: h.longitude };
        let label = q;
        try {
          const rev = await Location.reverseGeocodeAsync(coords);
          const formatted = rev[0] && formatLine(rev[0]);
          if (formatted) label = formatted;
        } catch {
          // fall back to the raw query
        }
        return { kind: 'geo' as const, coords, label };
      }),
    );
    // Drop duplicate labels (geocoder often returns near-identical hits).
    const seen = new Set<string>();
    return labeled.filter((r) =>
      seen.has(r.label) ? false : (seen.add(r.label), true),
    );
  };

  const runSearch = async (raw: string) => {
    const q = raw.trim();
    if (q.length < MIN_QUERY) {
      setResults([]);
      setSearching(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    try {
      let found: SearchResult[] = [];
      if (placesAvailable()) {
        try {
          const suggestions = await autocompletePlaces(q, {
            lang,
            near: centerRef.current,
          });
          found = suggestions.map((s) => ({ kind: 'place' as const, ...s }));
        } catch {
          // Places unreachable (offline, key/API not enabled) — the on-device
          // geocoder below still gives address-level results.
        }
      }
      if (found.length === 0) found = await geocodeSearch(q);
      if (seq === searchSeq.current) {
        setResults(found);
        setNoResults(found.length === 0);
      }
    } catch {
      if (seq === searchSeq.current) {
        setResults([]);
        setNoResults(true);
      }
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  };

  const onQueryChange = (text: string) => {
    setQuery(text);
    setNoResults(false);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < MIN_QUERY) {
      setResults([]);
      setSearching(false);
      return;
    }
    searchTimer.current = setTimeout(() => runSearch(text), 350);
  };

  const pickResult = async (r: SearchResult) => {
    if (r.kind === 'geo') {
      pickedPlace.current = null;
      setPoint(r.coords);
      setLine(r.label);
      dismissSearch();
      return;
    }
    // A Places suggestion carries no coordinates — resolve them now. Keep the
    // dropdown open until it works so a failed tap isn't a dead end.
    setSearching(true);
    try {
      const place = await fetchPlaceLocation(r.placeId, lang);
      pickedPlace.current = place.coords;
      setGeoFailed(false);
      setLine(place.address || [r.primary, r.secondary].filter(Boolean).join(' '));
      // keepLine: Google's formatted address beats the on-device reverse
      // geocode — that run only fills blank parcel fields.
      setPoint(place.coords, { keepLine: true });
      dismissSearch();
    } catch {
      Alert.alert(t('address.placeFailed'), t('address.placeFailedBody'));
    } finally {
      setSearching(false);
    }
  };

  const dismissSearch = () => {
    setResults([]);
    setNoResults(false);
    setQuery('');
    Keyboard.dismiss();
  };

  /* -------------------------------------------------------------------- */

  const [locating, setLocating] = useState(false);

  const useMyLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('address.locPermTitle'), t('address.locPermBody'));
        return;
      }
      setLocGranted(true); // เพิ่งได้สิทธิ์ — เปิดจุดตำแหน่งบนแผนที่ได้แล้ว
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setPoint({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch {
      // GPS can reject if location is momentarily unavailable (cold start,
      // weak signal). Tell the user instead of leaking an unhandled rejection.
      Alert.alert(t('address.locateFailed'), t('address.locateFailedBody'));
    } finally {
      setLocating(false);
    }
  };

  const postalValid = /^\d{5}$/.test(postalCode.trim());
  const baseValid =
    recipient.trim().length > 0 && phone.trim().length > 0 && line.trim().length > 0;
  // Online parcels additionally need province + a valid 5-digit postcode.
  const canSave =
    baseValid && (!isOnline || (province.trim().length > 0 && postalValid));

  const onSave = async () => {
    const c = centerRef.current;
    try {
      await upsert({
        id: editing?.id,
        label,
        recipient: recipient.trim(),
        phone: phone.trim(),
        line: line.trim(),
        detail: detail.trim(),
        lat: c.latitude,
        lng: c.longitude,
        subDistrict: subDistrict.trim() || undefined,
        district: district.trim() || undefined,
        province: province.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
      });
      router.back();
    } catch {
      Alert.alert(t('address.saveFailed'), t('address.saveFailedBody'));
    }
  };

  return (
    <View style={styles.screen}>
      {/* Map */}
      <View style={styles.mapWrap}>
        {Platform.OS === 'ios' ? (
          <AppleMaps.View
            ref={appleRef}
            style={StyleSheet.absoluteFill}
            cameraPosition={{ coordinates: initialCenter, zoom: DEFAULT_ZOOM }}
            properties={{ isMyLocationEnabled: locGranted }}
            uiSettings={{ myLocationButtonEnabled: false, compassEnabled: false }}
            onMapClick={onMapClick}
            onCameraMove={onCameraMove}
          />
        ) : Platform.OS === 'android' ? (
          <GoogleMaps.View
            ref={googleRef}
            style={StyleSheet.absoluteFill}
            cameraPosition={{ coordinates: initialCenter, zoom: DEFAULT_ZOOM }}
            properties={{ isMyLocationEnabled: locGranted }}
            uiSettings={{ myLocationButtonEnabled: false }}
            onMapClick={onMapClick}
            onCameraMove={onCameraMove}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.mapFallback]}>
            <Text style={{ color: Colors.textMuted }}>
              {t('address.mapUnavailable')}
            </Text>
          </View>
        )}

        {/* Fixed centre pin (tip points at the map centre) */}
        <View style={styles.pinWrap} pointerEvents="none">
          <Ionicons name="location" size={40} color={Colors.primaryStrong} />
          <View style={styles.pinShadow} />
        </View>

        {/* Top bar: back + place search */}
        <View style={[styles.topBar, { top: insets.top + Spacing.sm }]}>
          <IconButton
            icon="chevron-back"
            accessibilityLabel={t('common.back')}
            onPress={() => router.back()}
          />
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={onQueryChange}
              placeholder={t('address.searchPlaceholder')}
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={() => runSearch(query)}
            />
            {searching ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : query.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('address.clearSearch')}
                hitSlop={8}
                onPress={dismissSearch}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Search found nothing — say so instead of showing nothing */}
        {noResults && results.length === 0 ? (
          <View
            style={[
              styles.results,
              styles.noResults,
              { top: insets.top + Spacing.sm + 48 + Spacing.xs },
            ]}>
            <Ionicons name="search" size={16} color={Colors.textMuted} />
            <Text variant="caption" style={styles.noResultsText}>
              {t('address.searchNoResults')}
            </Text>
          </View>
        ) : null}

        {/* Search results dropdown */}
        {results.length > 0 ? (
          <View style={[styles.results, { top: insets.top + Spacing.sm + 48 + Spacing.xs }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {results.map((r, i) => {
                const title = r.kind === 'place' ? r.primary : r.label;
                const caption = r.kind === 'place' ? r.secondary : '';
                return (
                  <Pressable
                    key={r.kind === 'place' ? r.placeId : `${r.label}-${i}`}
                    accessibilityRole="button"
                    onPress={() => pickResult(r)}
                    style={[styles.resultItem, i > 0 && styles.resultDivider]}>
                    <Ionicons name="location-outline" size={18} color={Colors.primaryStrong} />
                    <View style={styles.resultText}>
                      <Text variant="body" numberOfLines={caption ? 1 : 2}>
                        {title}
                      </Text>
                      {caption ? (
                        <Text variant="caption" numberOfLines={1} style={styles.resultCaption}>
                          {caption}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Current-location FAB */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('address.useCurrentLocation')}
          onPress={useMyLocation}
          style={styles.locFab}>
          {locating ? (
            <ActivityIndicator size="small" color={Colors.primaryStrong} />
          ) : (
            <Ionicons name="locate" size={22} color={Colors.primaryStrong} />
          )}
        </Pressable>
      </View>

      {/* Form sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheet}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.sheetContent,
            { paddingBottom: insets.bottom + Spacing.lg },
          ]}>
          <View style={styles.handle} />

          {/* Geocoded line */}
          <View style={styles.lineRow}>
            <Ionicons name="location-sharp" size={18} color={Colors.primary} />
            <View style={styles.lineTextWrap}>
              <Text variant="caption" style={{ color: Colors.textMuted }}>
                {t('address.pinnedLocation')}
              </Text>
              <TextInput
                value={line}
                onChangeText={setLine}
                placeholder={t('address.pinHint')}
                placeholderTextColor={Colors.textMuted}
                multiline
                style={styles.lineInput}
              />
            </View>
            {geocoding ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
          </View>

          {/* Reverse geocode failed — the line above is stale/manual */}
          {geoFailed && !geocoding ? (
            <View style={styles.geoWarn}>
              <Ionicons name="alert-circle-outline" size={14} color={Colors.starStrong} />
              <Text variant="caption" style={styles.geoWarnText}>
                {t('address.geoFailed')}
              </Text>
            </View>
          ) : null}

          {/* Label chips */}
          <Text variant="caption" style={styles.fieldLabel}>
            {t('address.labelField')}
          </Text>
          <View style={styles.chips}>
            {LABEL_KEYS.map((key) => {
              const l = t(key);
              const active = l === label;
              return (
                <PressableScale
                  key={key}
                  onPress={() => setLabel(l)}
                  style={[styles.chip, active && styles.chipActive]}>
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? Colors.textOnPrimary : Colors.text },
                    ]}>
                    {l}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          {/* Recipient + phone */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldCol}>
              <Text variant="caption" style={styles.fieldLabel}>
                {t('address.recipient')}
              </Text>
              <TextInput
                value={recipient}
                onChangeText={setRecipient}
                placeholder={t('address.recipientPlaceholder')}
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
              />
            </View>
            <View style={styles.fieldCol}>
              <Text variant="caption" style={styles.fieldLabel}>
                {t('address.phone')}
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="08x-xxx-xxxx"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                style={styles.input}
              />
            </View>
          </View>

          {/* Detail */}
          <Text variant="caption" style={styles.fieldLabel}>
            {t('address.detail')}
          </Text>
          <TextInput
            value={detail}
            onChangeText={setDetail}
            placeholder={t('address.detailPlaceholder')}
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />

          {/* Parcel address — online (parcel) only */}
          {isOnline ? (
            <>
              <View style={styles.parcelHead}>
                <Ionicons name="cube-outline" size={16} color={Colors.primaryStrong} />
                <Text style={styles.parcelHeadText}>
                  {t('address.parcelHead')}
                </Text>
              </View>
              <Text variant="caption" style={styles.parcelHint}>
                {t('address.parcelHint')}
              </Text>

              <View style={styles.fieldRow}>
                <View style={styles.fieldCol}>
                  <Text variant="caption" style={styles.fieldLabel}>
                    {t('address.subDistrict')}
                  </Text>
                  <TextInput
                    value={subDistrict}
                    onChangeText={setSubDistrict}
                    placeholder={t('address.districtExample')}
                    placeholderTextColor={Colors.textMuted}
                    style={styles.input}
                  />
                </View>
                <View style={styles.fieldCol}>
                  <Text variant="caption" style={styles.fieldLabel}>
                    {t('address.district')}
                  </Text>
                  <TextInput
                    value={district}
                    onChangeText={setDistrict}
                    placeholder={t('address.districtExample')}
                    placeholderTextColor={Colors.textMuted}
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldCol}>
                  <Text variant="caption" style={styles.fieldLabel}>
                    {t('address.province')}
                  </Text>
                  <TextInput
                    value={province}
                    onChangeText={setProvince}
                    placeholder={t('address.provincePlaceholder')}
                    placeholderTextColor={Colors.textMuted}
                    style={styles.input}
                  />
                </View>
                <View style={styles.fieldCol}>
                  <Text variant="caption" style={styles.fieldLabel}>
                    {t('address.postalCode')}
                  </Text>
                  <TextInput
                    value={postalCode}
                    onChangeText={(v) => setPostalCode(v.replace(/\D/g, '').slice(0, 5))}
                    placeholder={t('address.postalPlaceholder')}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={5}
                    style={styles.input}
                  />
                </View>
              </View>
            </>
          ) : null}

          <Button onPress={onSave} disabled={!canSave} style={styles.saveBtn}>
            {t('address.save')}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mapWrap: {
    flex: 1,
    backgroundColor: Colors.surfaceMuted,
  },
  mapFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // Lift so the pin's tip (not its centre) sits on the map centre.
    paddingBottom: 40,
  },
  pinShadow: {
    width: 10,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginTop: -2,
  },

  /* Top bar: back + search */
  topBar: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    ...Shadow.float,
  },
  searchInput: {
    ...Typography.body,
    flex: 1,
    color: Colors.text,
    padding: 0,
  },
  results: {
    position: 'absolute',
    left: Spacing.lg + 44 + Spacing.sm,
    right: Spacing.lg,
    maxHeight: 240,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    ...Shadow.float,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  resultDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  resultText: {
    flex: 1,
  },
  resultCaption: {
    color: Colors.textMuted,
    marginTop: 1,
  },
  noResults: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  noResultsText: {
    flex: 1,
    color: Colors.textMuted,
  },
  geoWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: -Spacing.xs,
  },
  geoWarnText: {
    flex: 1,
    color: Colors.starStrong,
  },

  locFab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.lg,
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.float,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    ...Shadow.float,
  },
  sheetContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
    marginBottom: Spacing.md,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  lineTextWrap: {
    flex: 1,
  },
  lineInput: {
    ...Typography.body,
    color: Colors.text,
    padding: 0,
    marginTop: 2,
  },
  fieldLabel: {
    color: Colors.textMuted,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primaryStrong,
    borderColor: Colors.primaryStrong,
  },
  chipText: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 14,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  fieldCol: {
    flex: 1,
  },
  parcelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xl,
  },
  parcelHeadText: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 14,
    color: Colors.primaryStrong,
  },
  parcelHint: {
    color: Colors.textMuted,
    marginTop: 2,
  },
  input: {
    ...Typography.body,
    height: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveBtn: {
    marginTop: Spacing.xl,
  },
});
