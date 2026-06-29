/**
 * Order tracking — `/order/[id]`.
 *
 * One status-driven screen for the whole post-checkout delivery lifecycle. It
 * reads the active order from the store and renders:
 *   preparing        → PreparingView   (shop is preparing + ETA)
 *   out_for_delivery → TrackingMapView (live route map + stepper + rider)
 *   delivered        → DeliveredView   (order complete + rating)
 *
 * For the frontend-first demo the status auto-advances preparing → out for
 * delivery on a timer; the rider hand-off ("ได้รับสินค้าแล้ว") moves it to
 * delivered. Realtime order events will drive these transitions later.
 */

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, View, StyleSheet } from 'react-native';

import { DeliveredView } from '@/components/order/DeliveredView';
import { ParcelTrackingView } from '@/components/order/ParcelTrackingView';
import { PreparingView } from '@/components/order/PreparingView';
import { TrackingMapView } from '@/components/order/TrackingMapView';
import { Text } from '@/components/ui/text';
import { Toast } from '@/components/ui/Toast';
import { Colors, Spacing } from '@/constants/theme';
import { type OrderStatus } from '@/data/fulfillment';
import { useOrder } from '@/store/order';

/** Auto-advance preparing → out for delivery after this long (demo only). */
const PREP_DEMO_MS = 5000;

/** Parcel demo: how the Flash timeline walks itself forward (demo only). */
const PARCEL_DEMO_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  preparing: 'picked_up',
  picked_up: 'in_transit',
  in_transit: 'out_for_delivery',
};

export default function OrderTrackingScreen() {
  const router = useRouter();
  const active = useOrder((s) => s.active);
  const setStatus = useOrder((s) => s.setStatus);
  const submitRating = useOrder((s) => s.submitRating);
  const archive = useOrder((s) => s.archive);

  const [submitted, setSubmitted] = useState(false);

  const status = active?.status;
  const fulfilment = active?.fulfilment;

  // Demo (rider): let the "preparing" state settle, then start the delivery.
  useEffect(() => {
    if (fulfilment === 'parcel') return;
    if (status !== 'preparing') return;
    const t = setTimeout(() => setStatus('out_for_delivery'), PREP_DEMO_MS);
    return () => clearTimeout(t);
  }, [fulfilment, status, setStatus]);

  // Demo (parcel): walk the Flash timeline preparing → picked_up → in_transit →
  // out_for_delivery, then wait for the customer to confirm receipt.
  useEffect(() => {
    if (fulfilment !== 'parcel' || !status) return;
    const next = PARCEL_DEMO_NEXT[status];
    if (!next) return;
    const t = setTimeout(() => setStatus(next), PREP_DEMO_MS);
    return () => clearTimeout(t);
  }, [fulfilment, status, setStatus]);

  const goHome = () => router.replace('/');
  const openChat = () => router.push('/order/chat');
  const callRider = () => {
    if (active) Linking.openURL(`tel:${active.rider.phone}`).catch(() => {});
  };
  const openHelp = () =>
    Alert.alert('ศูนย์ช่วยเหลือ', 'ติดต่อทีมงานอู้ฟู่ได้ที่ 02-000-0000 ทุกวัน 8:00-22:00 น.');

  const onSubmitRating = (stars: number, comment: string) => {
    submitRating(stars, comment);
    setSubmitted(true);
  };

  const finishRating = () => {
    setSubmitted(false);
    archive();
    goHome();
  };

  if (!active) {
    return (
      <View style={styles.guard}>
        <Text variant="subtitle" style={styles.guardTitle}>
          ไม่มีคำสั่งซื้อที่กำลังติดตาม
        </Text>
        <Text variant="body" style={styles.guardBody} onPress={goHome}>
          กลับหน้าหลัก
        </Text>
      </View>
    );
  }

  // Online orders ship as a Flash parcel — one timeline view across all states.
  if (active.fulfilment === 'parcel') {
    return (
      <View style={styles.screen}>
        <ParcelTrackingView
          order={active}
          onClose={goHome}
          onArrived={() => setStatus('delivered')}
          onDone={() => {
            archive();
            goHome();
          }}
          onHelp={openHelp}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {active.status === 'preparing' ? (
        <PreparingView order={active} onClose={goHome} onExplore={() => router.push('/search')} />
      ) : active.status === 'out_for_delivery' ? (
        <TrackingMapView
          order={active}
          onClose={goHome}
          onHelp={openHelp}
          onChat={openChat}
          onCall={callRider}
          onArrived={() => setStatus('delivered')}
        />
      ) : (
        <DeliveredView
          order={active}
          onClose={finishRating}
          onChat={openChat}
          onCall={callRider}
          onSubmit={onSubmitRating}
        />
      )}

      {submitted ? (
        <Toast
          message="ขอบคุณสำหรับคะแนน"
          subtitle="ความเห็นของคุณช่วยให้ร้านอู้ฟู่ดีขึ้น"
          actionLabel="เสร็จสิ้น"
          onAction={finishRating}
          onHide={finishRating}
          duration={2600}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  guard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
  },
  guardTitle: {
    color: Colors.text,
  },
  guardBody: {
    color: Colors.primaryStrong,
  },
});
