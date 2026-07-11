/**
 * Order tracking — `/order/[id]`.
 *
 * One status-driven screen for the whole post-checkout delivery lifecycle. It
 * loads the order from the backend (and re-loads on Realtime updates) and renders:
 *   awaiting slip    → PreparingView (awaitingSlip) — shop is checking the slip
 *   preparing        → PreparingView   (shop is preparing + ETA)
 *   out_for_delivery → TrackingMapView (live route map + stepper + rider)
 *   delivered        → DeliveredView   (order complete + rating)
 *
 * Status comes from the orders table; the admin's approve/advance actions flip
 * it and `subscribeOrder` refreshes this screen live.
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, View, StyleSheet } from 'react-native';

import { DeliveredView } from '@/components/order/DeliveredView';
import { ParcelTrackingView } from '@/components/order/ParcelTrackingView';
import { PreparingView } from '@/components/order/PreparingView';
import { TrackingMapView } from '@/components/order/TrackingMapView';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Toast } from '@/components/ui/Toast';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { isAwaitingSlipCheck } from '@/data/fulfillment';
import {
  cancelOrder,
  confirmDelivered,
  orderErrorMessage,
  submitRating as submitRatingApi,
  subscribeOrder,
} from '@/lib/data/order';
import { useT } from '@/lib/i18n';
import { useOrder } from '@/store/order';

/**
 * Full-screen terminal state (cancelled / rejected slip / not found) — icon in
 * a soft circle, title, optional body, and a primary way back home. Mirrors
 * the empty-cart layout so dead ends feel like the rest of the app.
 */
function TerminalState({
  icon,
  tone,
  title,
  body,
  buttonLabel,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'danger' | 'brand';
  title: string;
  body?: string;
  buttonLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.terminal}>
      <View style={[styles.terminalBadge, tone === 'brand' && styles.terminalBadgeBrand]}>
        <Ionicons
          name={icon}
          size={40}
          color={tone === 'danger' ? Colors.danger : Colors.primaryStrong}
        />
      </View>
      <Text variant="title" style={styles.terminalTitle}>
        {title}
      </Text>
      {body ? (
        <Text variant="body" style={styles.terminalBody}>
          {body}
        </Text>
      ) : null}
      <Button onPress={onPress} style={styles.terminalButton}>
        {buttonLabel}
      </Button>
    </View>
  );
}

export default function OrderTrackingScreen() {
  const router = useRouter();
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const active = useOrder((s) => s.active);
  const activeLoading = useOrder((s) => s.activeLoading);
  const loadActive = useOrder((s) => s.loadActive);

  const [submitted, setSubmitted] = useState(false);

  // Load the order from the backend on focus (status always reflects the DB).
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

  // Customer confirms receipt — persists via RPC, then reloads from the DB
  // (the screen flips to DeliveredView from the real status, not local state).
  const onArrived = async () => {
    if (!active) return;
    try {
      await confirmDelivered(active.id);
      await loadActive(active.id);
    } catch (e) {
      Alert.alert(t('track.confirmDeliveredFailed'), orderErrorMessage(e));
    }
  };

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
    if (activeLoading) {
      return (
        <View style={styles.guard}>
          <Text variant="subtitle" style={styles.guardTitle}>
            {t('track.loadingOrder')}
          </Text>
        </View>
      );
    }
    return (
      <TerminalState
        icon="receipt-outline"
        tone="brand"
        title={t('track.orderNotFound')}
        buttonLabel={t('track.backHome')}
        onPress={goHome}
      />
    );
  }

  // Cancelled / failed orders end in a full terminal state (both modes). A
  // rejected slip gets its own honest copy instead of a generic "cancelled".
  if (active.status === 'cancelled') {
    const rejected = active.paymentStatus === 'rejected';
    return (
      <TerminalState
        icon={rejected ? 'alert' : 'close'}
        tone="danger"
        title={
          rejected
            ? t('track.paymentRejectedTitle')
            : `${t('track.orderPrefix')}${active.id}${t('track.orderCancelledSuffix')}`
        }
        body={rejected ? t('track.paymentRejectedBody') : t('track.orderCancelledBody')}
        buttonLabel={t('track.backHome')}
        onPress={goHome}
      />
    );
  }

  // Prepay order whose slip the shop hasn't approved yet (either fulfilment):
  // show the honest waiting state; Realtime flips it once the shop approves.
  if (isAwaitingSlipCheck(active)) {
    return (
      <View style={styles.screen}>
        <PreparingView order={active} awaitingSlip onClose={goHome} onCancel={onCancel} />
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
          onArrived={() => void onArrived()}
          onDone={goHome}
          onHelp={openHelp}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {active.status === 'preparing' ? (
        <PreparingView order={active} onClose={goHome} onCancel={onCancel} />
      ) : active.status === 'out_for_delivery' ? (
        <TrackingMapView
          order={active}
          onClose={goHome}
          onHelp={openHelp}
          onChat={openChat}
          onCall={callRider}
          onArrived={() => void onArrived()}
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

  /* Terminal state — mirrors the empty-cart layout */
  terminal: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.x2,
    backgroundColor: Colors.background,
  },
  terminalBadge: {
    width: 96,
    height: 96,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  terminalBadgeBrand: {
    backgroundColor: Colors.primaryTint,
  },
  terminalTitle: {
    marginTop: Spacing.xl,
    textAlign: 'center',
  },
  terminalBody: {
    marginTop: Spacing.sm,
    textAlign: 'center',
    color: Colors.textMuted,
  },
  terminalButton: {
    marginTop: Spacing.xl,
    minWidth: 180,
  },
});
