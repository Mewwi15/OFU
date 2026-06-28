/**
 * Address pin picker — `/address/picker` (optionally `?id=` to edit).
 *
 * A Grab/Uber-style location picker: the map pans under a fixed center pin, and
 * whenever the map settles we reverse-geocode the centre into an editable
 * address line. A "ตำแหน่งปัจจุบัน" button recenters on the device GPS. Below the
 * map a form collects label / recipient / phone / extra detail, then saves to
 * the address book.
 *
 * Maps are native (expo-maps) — this screen only renders in a development build,
 * NOT Expo Go.
 */

import { Ionicons } from '@expo/vector-icons';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { selectedAddress, useAddress } from '@/store/address';

type LatLng = { latitude: number; longitude: number };

/** Bangkok (สุขุมวิท) — fallback centre when there's no address yet. */
const DEFAULT_CENTER: LatLng = { latitude: 13.7236, longitude: 100.5686 };
const DEFAULT_ZOOM = 16;
const LABELS = ['บ้าน', 'ที่ทำงาน', 'อื่นๆ'];

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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const upsert = useAddress((s) => s.upsert);
  const editing = useAddress((s) =>
    id ? s.addresses.find((a) => a.id === id) : undefined,
  );
  const current = useAddress(selectedAddress);

  const start = editing ?? current;
  const initialCenter: LatLng = start
    ? { latitude: start.lat, longitude: start.lng }
    : DEFAULT_CENTER;

  const appleRef = useRef<AppleMaps.MapView>(null);
  const googleRef = useRef<GoogleMaps.MapView>(null);
  const centerRef = useRef<LatLng>(initialCenter);
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [line, setLine] = useState(editing?.line ?? '');
  const [geocoding, setGeocoding] = useState(false);
  const [label, setLabel] = useState(editing?.label ?? LABELS[0]);
  const [recipient, setRecipient] = useState(editing?.recipient ?? '');
  const [phone, setPhone] = useState(editing?.phone ?? '');
  const [detail, setDetail] = useState(editing?.detail ?? '');

  const recenter = (coordinates: LatLng) => {
    appleRef.current?.setCameraPosition({ coordinates, zoom: DEFAULT_ZOOM });
    googleRef.current?.setCameraPosition({ coordinates, zoom: DEFAULT_ZOOM });
  };

  const runGeocode = async () => {
    const { latitude, longitude } = centerRef.current;
    setGeocoding(true);
    try {
      const res = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (res[0]) setLine(formatLine(res[0]));
    } catch {
      // Keep the previous line on failure.
    } finally {
      setGeocoding(false);
    }
  };

  const scheduleGeocode = () => {
    if (geoTimer.current) clearTimeout(geoTimer.current);
    geoTimer.current = setTimeout(runGeocode, 650);
  };

  // Prefill the line from the initial centre on first mount (new addresses).
  useEffect(() => {
    if (!editing?.line) runGeocode();
    return () => {
      if (geoTimer.current) clearTimeout(geoTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCameraMove = (e: { coordinates: Location.LocationObjectCoords | { latitude?: number; longitude?: number } }) => {
    const { latitude, longitude } = e.coordinates;
    if (latitude == null || longitude == null) return;
    centerRef.current = { latitude, longitude };
    scheduleGeocode();
  };

  const useMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'ต้องการสิทธิ์ตำแหน่ง',
        'กรุณาอนุญาตให้แอปเข้าถึงตำแหน่ง เพื่อปักหมุดที่อยู่ปัจจุบัน',
      );
      return;
    }
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const coords = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
    centerRef.current = coords;
    recenter(coords);
    scheduleGeocode();
  };

  const canSave =
    recipient.trim().length > 0 && phone.trim().length > 0 && line.trim().length > 0;

  const onSave = () => {
    const c = centerRef.current;
    upsert({
      id: editing?.id,
      label,
      recipient: recipient.trim(),
      phone: phone.trim(),
      line: line.trim(),
      detail: detail.trim(),
      lat: c.latitude,
      lng: c.longitude,
    });
    router.back();
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
            properties={{ isMyLocationEnabled: true }}
            uiSettings={{ myLocationButtonEnabled: false, compassEnabled: false }}
            onCameraMove={onCameraMove}
          />
        ) : Platform.OS === 'android' ? (
          <GoogleMaps.View
            ref={googleRef}
            style={StyleSheet.absoluteFill}
            cameraPosition={{ coordinates: initialCenter, zoom: DEFAULT_ZOOM }}
            onCameraMove={onCameraMove}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.mapFallback]}>
            <Text style={{ color: Colors.textMuted }}>
              แผนที่ใช้ได้บน iOS / Android
            </Text>
          </View>
        )}

        {/* Fixed centre pin (tip points at the map centre) */}
        <View style={styles.pinWrap} pointerEvents="none">
          <Ionicons name="location" size={40} color={Colors.primaryStrong} />
          <View style={styles.pinShadow} />
        </View>

        {/* Back button */}
        <View style={[styles.backBtn, { top: insets.top + Spacing.sm }]}>
          <IconButton
            icon="chevron-back"
            accessibilityLabel="ย้อนกลับ"
            onPress={() => router.back()}
          />
        </View>

        {/* Current-location FAB */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="ใช้ตำแหน่งปัจจุบัน"
          onPress={useMyLocation}
          style={styles.locFab}>
          <Ionicons name="locate" size={22} color={Colors.primaryStrong} />
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
                ตำแหน่งที่ปักหมุด
              </Text>
              <TextInput
                value={line}
                onChangeText={setLine}
                placeholder="เลื่อนแผนที่เพื่อปักหมุด"
                placeholderTextColor={Colors.textMuted}
                multiline
                style={styles.lineInput}
              />
            </View>
            {geocoding ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
          </View>

          {/* Label chips */}
          <Text variant="caption" style={styles.fieldLabel}>
            ป้ายกำกับ
          </Text>
          <View style={styles.chips}>
            {LABELS.map((l) => {
              const active = l === label;
              return (
                <Pressable
                  key={l}
                  onPress={() => setLabel(l)}
                  style={[styles.chip, active && styles.chipActive]}>
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? Colors.textOnPrimary : Colors.text },
                    ]}>
                    {l}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Recipient + phone */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldCol}>
              <Text variant="caption" style={styles.fieldLabel}>
                ชื่อผู้รับ
              </Text>
              <TextInput
                value={recipient}
                onChangeText={setRecipient}
                placeholder="ชื่อ-นามสกุล"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
              />
            </View>
            <View style={styles.fieldCol}>
              <Text variant="caption" style={styles.fieldLabel}>
                เบอร์โทร
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
            รายละเอียดเพิ่มเติม (บ้านเลขที่ / ชั้น / จุดสังเกต)
          </Text>
          <TextInput
            value={detail}
            onChangeText={setDetail}
            placeholder="เช่น คอนโด ABC ชั้น 8 ห้อง 812"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />

          <Button
            onPress={onSave}
            disabled={!canSave}
            style={styles.saveBtn}>
            บันทึกที่อยู่
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
  backBtn: {
    position: 'absolute',
    left: Spacing.lg,
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
