/**
 * DeliveryStepper — the horizontal 4-stage delivery progress with motion.
 *
 * Connectors fill left-to-right with a staggered cascade as `activeIndex`
 * advances; the active node breathes a soft expanding ring. Completed nodes are
 * coral-filled, pending nodes are outlined. Respects reduce-motion. Tokens-only.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Radius } from '@/constants/theme';
import { type DeliveryStage } from '@/data/fulfillment';

const NODE = 40;

function Connector({ index, active }: { index: number; active: boolean }) {
  const fill = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    fill.value = withDelay(index * 140, withTiming(active ? 1 : 0, { duration: 420 }));
  }, [active, index, fill]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <View style={styles.connectorTrack}>
      <Animated.View style={[styles.connectorFill, fillStyle]} />
    </View>
  );
}

function StepNode({
  stage,
  done,
  active,
}: {
  stage: DeliveryStage;
  done: boolean;
  active: boolean;
}) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (active && !reduced) {
      pulse.value = withRepeat(withTiming(1, { duration: 1500 }), -1, false);
    } else {
      pulse.value = 0;
    }
  }, [active, reduced, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.7 }],
    opacity: 0.4 * (1 - pulse.value),
  }));

  return (
    <View style={styles.nodeWrap}>
      {active ? <Animated.View style={[styles.ring, ringStyle]} /> : null}
      <View style={[styles.node, done ? styles.nodeOn : styles.nodeOff]}>
        <Ionicons
          name={stage.icon}
          size={18}
          color={done ? Colors.textOnPrimary : Colors.borderStrong}
        />
      </View>
    </View>
  );
}

export function DeliveryStepper({
  stages,
  activeIndex,
}: {
  stages: DeliveryStage[];
  activeIndex: number;
}) {
  return (
    <View style={styles.row}>
      {stages.map((stage, i) => (
        <View key={stage.key} style={[styles.cell, i > 0 && styles.cellGrow]}>
          {i > 0 ? <Connector index={i} active={i <= activeIndex} /> : null}
          <StepNode stage={stage} done={i <= activeIndex} active={i === activeIndex} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cellGrow: {
    flex: 1,
  },
  connectorTrack: {
    flex: 1,
    height: 3,
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  connectorFill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  nodeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: NODE,
    height: NODE,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeOn: {
    backgroundColor: Colors.primary,
  },
  nodeOff: {
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
