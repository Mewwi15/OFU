/**
 * Legal — `/account/legal`.
 *
 * Terms of use + PDPA privacy summary. Placeholder copy for v1 — the owner
 * should replace it with lawyer-reviewed text before launch.
 */

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'ข้อกำหนดการใช้งาน',
    body: 'การใช้แอปอู้ฟู่ถือว่าคุณยอมรับข้อกำหนดการใช้งาน คุณตกลงจะใช้บริการตามกฎหมาย ไม่ใช้ในทางที่ผิด และรับผิดชอบข้อมูลในบัญชีของคุณ ราคาสินค้าและค่าจัดส่งเป็นไปตามที่แสดงขณะสั่งซื้อ',
  },
  {
    title: 'นโยบายความเป็นส่วนตัว (PDPA)',
    body: 'เราเก็บข้อมูลส่วนบุคคล (ชื่อ เบอร์โทร ที่อยู่จัดส่ง) เพื่อให้บริการจัดส่งและติดต่อเรื่องคำสั่งซื้อเท่านั้น เราไม่ขายข้อมูลของคุณ คุณมีสิทธิ์ขอเข้าถึง แก้ไข หรือลบข้อมูล และถอนความยินยอมได้ทุกเมื่อผ่านเมนู "ลบบัญชี"',
  },
  {
    title: 'การชำระเงินและการคืนเงิน',
    body: 'รองรับการชำระเงินปลายทางและพร้อมเพย์ (แนบสลิป) กรณีสินค้ามีปัญหาหรือยกเลิกก่อนจัดส่ง สามารถติดต่อขอคืนเงินได้ตามเงื่อนไขของร้าน',
  },
  {
    title: 'ติดต่อเรา',
    body: 'ร้านอู้ฟู่ · โทร 02-000-0000 ทุกวัน 8:00–22:00 น. สำหรับคำถามเรื่องข้อมูลส่วนบุคคล ติดต่อเจ้าหน้าที่คุ้มครองข้อมูลได้ที่ช่องทางเดียวกัน',
  },
];

export default function LegalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="ข้อมูลทางกฎหมาย"
        style={styles.header}
        left={<IconButton icon="chevron-back" accessibilityLabel="ย้อนกลับ" onPress={() => router.back()} />}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.x2 }]}>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.card}>
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text variant="body" style={styles.cardBody}>
              {s.body}
            </Text>
          </View>
        ))}
        <Text variant="caption" style={styles.note}>
          อัปเดตล่าสุด: เวอร์ชันทดลอง — ข้อความฉบับสมบูรณ์จะประกาศก่อนเปิดให้บริการจริง
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg },
  content: { padding: Spacing.lg, gap: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadow.card,
  },
  cardTitle: { ...Typography.bodyStrong, color: Colors.text, marginBottom: Spacing.xs },
  cardBody: { color: Colors.textMuted, lineHeight: 22 },
  note: { color: Colors.textMuted, textAlign: 'center', paddingHorizontal: Spacing.lg },
});
