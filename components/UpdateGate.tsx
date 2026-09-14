/**
 * บอกเมื่อมีเวอร์ชันใหม่พร้อมใช้ แทนที่จะให้ลูกค้าปิดเปิดแอปเองสองรอบ
 *
 * เจ้าของแจ้ง 14 ก.ย. 2026: "แอปจำเวอร์ชันเก่าตอนโหลดแอปใหม่"
 *
 * ★ ไม่ใช่อาการเสีย แต่เป็นวิธีทำงานของระบบอัปเดต ★ เปิดแอปมา ระบบจะเปิดด้วยโค้ดชุดที่
 * เก็บไว้ในเครื่อง (เร็ว) แล้วค่อยดาวน์โหลดชุดใหม่อยู่เบื้องหลัง — ชุดใหม่จะถูกใช้ "ครั้งถัดไป
 * ที่เปิดแอป" ลูกค้าจึงต้องปิดเปิดสองรอบถึงจะเห็นของใหม่ โดยไม่มีอะไรบอกเลย
 *
 * ★ ทำไมไม่ให้รอโหลดตอนเปิด ★ ตั้งให้รอได้ แต่จะแลกมาด้วยจอค้างตอนเปิดแอปทุกครั้ง
 * ซึ่งเป็นอีกข้อที่เจ้าของบ่นในคราวเดียวกัน ("เปิดแอปครั้งแรก กว่าจะขึ้นหน้าแรก")
 * — เปิดเร็วไว้เหมือนเดิม แล้วค่อยบอกตอนของใหม่พร้อม เป็นทางที่ได้ทั้งสองอย่าง
 *
 * ★ ให้คนกดเอง ไม่รีสตาร์ตให้ ★ ลูกค้าอาจกำลังเลือกของอยู่ในตะกร้าหรือกรอกที่อยู่
 * การรีสตาร์ตเองกลางคันคือสิ่งที่แย่กว่าการใช้รุ่นเก่าอีกวัน
 */

import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';

export function UpdateGate() {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    /* ตอนรันด้วย Metro ไม่มีการอัปเดตให้ตรวจ — เช็คไปก็ได้ error เปล่า ๆ ทุกครั้ง */
    if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return;

    let alive = true;
    const check = async () => {
      try {
        const res = await Updates.checkForUpdateAsync();
        if (!res.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (alive) setReady(true);
      } catch {
        /* ไม่มีเน็ต/เซิร์ฟเวอร์อัปเดตล่ม — ไม่ใช่เรื่องที่ต้องรบกวนลูกค้า */
      }
    };

    void check();
    /* เช็คอีกทีตอนกลับมาที่แอป — คนเปิดแอปค้างไว้หลายวันจะไม่มีวันเห็นของใหม่เลยถ้า
       ตรวจแค่ตอนเปิดครั้งแรกครั้งเดียว */
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  if (!ready) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: insets.bottom + Spacing.x2 }]}>
      <View style={styles.bar}>
        <View style={styles.copy}>
          <Text style={styles.title}>มีเวอร์ชันใหม่พร้อมใช้</Text>
          <Text variant="caption" style={styles.sub}>
            แตะเพื่อเริ่มใหม่ ตะกร้าของคุณยังอยู่
          </Text>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="อัปเดตแอปตอนนี้"
          onPress={() => void Updates.reloadAsync()}
          style={styles.btn}>
          <Text style={styles.btnText}>อัปเดต</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* ลอยเหนือแถบล่าง ไม่กินพื้นที่ของหน้า และปล่อยให้กดทะลุได้ทุกที่ที่ไม่ใช่ตัวแถบเอง */
  wrap: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: 0,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Shadow.float,
  },
  copy: { flex: 1 },
  title: { fontFamily: 'Mitr_500Medium', fontSize: 15, color: Colors.text },
  sub: { color: Colors.textMuted },
  btn: {
    paddingHorizontal: Spacing.lg,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  btnText: { fontFamily: 'Mitr_500Medium', fontSize: 15, color: Colors.textOnPrimary },
});
