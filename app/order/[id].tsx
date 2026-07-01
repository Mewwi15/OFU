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

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, View, StyleSheet } from 'react-native';

import { DeliveredView } from '@/components/order/DeliveredView';
import { ParcelTrackingView } from '@/components/order/ParcelTrackingView';
import { PreparingView } from '@/components/order/PreparingView';
import { TrackingMapView } from '@/components/order/TrackingMapView';
import { Text } from '@/components/ui/text';
import { Toast } from '@/components/ui/Toast';
import { Colors, Spacing } from '@/constants/theme';
import {
  cancelOrder,
  orderErrorMessage,
  submitRating as submitRatingApi,
  subscribeOrder,
} from '@/lib/data/order';
import { useT } from '@/lib/i18n';
import { useOrder } from '@/store/order';

export default function OrderTrackingScreen() {
  const router = useRouter();
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const active = useOrder((s) => s.active);
  const activeLoading = useOrder((s) => s.activeLoading);
  const loadActive = useOrder((s) => s.loadActive);
  const setStatus = useOrder((s) => s.setStatus);

  const [submitted, setSubmitted] = useState(false);

  // Load the order from the backend on focus (status reflects the DB; realtime
  // live-updates land in a later phase).
  useFocusEffect(
    useCallback(() => {
      if (id) void loadActive(id);
    }, [id, loadActive]),
  );

  // Live status: refetch whenever this order changes on the backend.
  useEffect(() => {
    if (!id) return;
    return subscribeOrder(id, () => void loadActive(id));
  }, [id, loadActive]);

  const goHome = () => router.replace('/');
  const openChat = () => router.push('/order/chat');
  const callRider = () => {
    if (active) Linking.openURL(`tel:${active.rider.phone}`).catch(() => {});
  };
  const openHelp = () => Alert.alert(t('track.helpTitle'), t('track.helpBody'));

  const onSubmitRating = async (stars: number, comment: string) => {
    if (active) await submitRatingApi(active.id, stars, comment).catch(() => {});
    setSubmitted(true);
  };

  const onCancel = () => {
    if (!active) return;
    Alert.alert(t('track.cancelOrder'), `${t('track.cancelConfirmPrefix')}${active.id} ?`, [
      { text: t('track.no'), style: 'cancel' },
      {
        text: t('track.cancelOrder'),
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelOrder(active.id);
            await loadActive(active.id);
          } catch (e) {
            Alert.alert(t('track.cancelFailed'), orderErrorMessage(e));
          }
        },
      },
    ]);
  };

  const finishRating = () => {
    setSubmitted(false);
    goHome();
  };

  if (!active) {
    return (
      <View style={styles.guard}>
        <Text variant="subtitle" style={styles.guardTitle}>
          {activeLoading ? t('track.loadingOrder') : t('track.orderNotFound')}
        </Text>
        {activeLoading ? null : (
          <Text variant="body" style={styles.guardBody} onPress={goHome}>
            {t('track.backHome')}
          </Text>
        )}
      </View>
    );
  }

  // Cancelled / failed orders show a simple terminal card (both modes).
  if (active.status === 'cancelled') {
    return (
      <View style={styles.guard}>
        <Text variant="subtitle" style={styles.guardTitle}>
          {t('track.orderPrefix')}{active.id}{t('track.orderCancelledSuffix')}
        </Text>
        <Text variant="body" style={styles.guardBody} onPress={goHome}>
          {t('track.backHome')}
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
          onDone={goHome}
          onHelp={openHelp}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {active.status === 'preparing' ? (
        <PreparingView
          order={active}
          onClose={goHome}
          onExplore={() => router.push('/search')}
          onCancel={onCancel}
        />
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
          message={t('track.ratingThanks')}
          subtitle={t('track.ratingThanksSub')}
          actionLabel={t('track.done')}
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
