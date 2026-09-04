/**
 * ReviewVideoRail — แถบรีวิวสินค้าเป็นวิดีโอ เลื่อนแนวนอน
 *
 * เจ้าของสั่ง 4 ก.ย. 2026: "ล่างแบรนเนอร์จะเป็นวิดีโอครับ ทำเหมือนการ์ดสินค้าแหละครับ
 * แต่เป็นวีดิโอ คือแถบรีวิวสินค้าครับ" และเลือก "เล่นเองในแถบ เหมือน TikTok"
 *
 * ★ เล่นทีละใบเท่านั้น ★ ใบที่อยู่ตรงหน้าจอที่สุดเล่น ที่เหลือหยุดและโชว์ภาพปกแทน
 * ปล่อยให้เล่นพร้อมกันทุกใบคือถอดรหัสวิดีโอหลายเส้นพร้อมกัน เครื่องรุ่นกลางจะกระตุก
 * ทั้งหน้า (เจ้าของเคยทักเรื่องแอปกระตุกมาแล้ว "แอพคือกระตุกมากๆ") และกินเน็ตลูกค้า
 * ฟรี ๆ ทั้งที่ดูได้ทีละใบอยู่แล้ว
 *
 * ปิดเสียงเสมอ ไม่มีข้อยกเว้น — เสียงดังขึ้นมาเองตอนเปิดแอปคือสิ่งที่ทำให้คนปิดแอปทิ้ง
 * และคนจำนวนมากเปิดแอปในที่สาธารณะ
 *
 * ต้องมี native module (expo-video) — ส่ง OTA ไม่ได้ ต้อง build ใหม่แล้วส่งสโตร์
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/text';
import { BRAND_ACCENT, type Accent } from '@/constants/accent';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { listReviewVideos, type ReviewVideo } from '@/lib/data/reviewVideos';

/** ความกว้างการ์ด — แคบกว่าการ์ดสินค้าเพราะคลิปเป็นแนวตั้ง สูงอยู่แล้ว */
const CARD_W = 156;
/** สัดส่วนคลิป 9:16 — คลิปรีวิวถ่ายจากมือถือแนวตั้งเป็นปกติ */
const MEDIA_RATIO = 9 / 16;
/** ระยะห่างระหว่างใบ ใช้คำนวณว่าใบไหนอยู่ตรงหน้าจอที่สุด ต้องตรงกับ styles.row.gap */
const GAP = Spacing.md;

export type ReviewVideoRailProps = {
  accent?: Accent;
};

export function ReviewVideoRail({ accent = BRAND_ACCENT }: ReviewVideoRailProps) {
  const [videos, setVideos] = useState<ReviewVideo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(0);
  /* เคารพการตั้งค่า "ลดการเคลื่อนไหว" — วิดีโอที่เล่นวนเองเป็นตัวกระตุ้นอาการเวียนหัว
     ของคนที่แพ้การเคลื่อนไหว ปิดไว้แล้วโชว์ภาพปกกับปุ่มเล่นแทน */
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listReviewVideos()
      .then((v) => {
        if (!cancelled) setVideos(v);
      })
      /* หน้าแรกไม่ควรพังเพราะคลิปโหลดไม่ได้ — ซ่อนแถบไปเงียบ ๆ พอ */
      .catch(() => {
        if (!cancelled) setVideos([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    void AccessibilityInfo.isReduceMotionEnabled().then((r) => {
      if (!cancelled) setReduceMotion(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ใบที่อยู่ตรงหน้าจอที่สุด = ใบที่ขอบซ้ายเลยจุดกึ่งกลางใบไปแล้ว คิดจากระยะเลื่อนตรง ๆ
     ไม่ต้องวัดตำแหน่งแต่ละใบ เพราะทุกใบกว้างเท่ากันและระยะห่างคงที่ */
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setActive(Math.max(0, Math.round(x / (CARD_W + GAP))));
  }, []);

  // ไม่มีคลิป = ไม่มีแถบนี้เลย ดีกว่าโชว์หัวข้อแล้วว่างข้างล่าง
  if (loaded && videos.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text variant="subtitle" style={styles.head}>
        รีวิวจากลูกค้า
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={loaded}
        onScroll={onScroll}
        scrollEventThrottle={64}
        contentContainerStyle={styles.row}>
        {!loaded
          ? [0, 1, 2].map((i) => (
              <View key={i} style={styles.card}>
                <Skeleton width={CARD_W} height={Math.round(CARD_W / MEDIA_RATIO)} />
              </View>
            ))
          : videos.map((v, i) => (
              <ReviewCard
                key={v.id}
                video={v}
                /* เล่นเฉพาะใบที่อยู่ตรงหน้าจอ และเฉพาะเมื่อไม่ได้เปิดโหมดลดการเคลื่อนไหว */
                playing={i === active && !reduceMotion}
                accent={accent}
              />
            ))}
      </ScrollView>
    </View>
  );
}

function ReviewCard({
  video,
  playing,
  accent,
}: {
  video: ReviewVideo;
  playing: boolean;
  accent: Accent;
}) {
  const router = useRouter();
  const player = useVideoPlayer(video.video, (p) => {
    p.loop = true;
    p.muted = true;
  });

  /* สั่งเล่น/หยุดตามว่าเป็นใบที่อยู่ตรงหน้าจอไหม — ตัวเล่นถูกสร้างไว้ทุกใบก็จริง แต่ใบที่
     ไม่ได้เล่นจะไม่ถอดรหัสภาพ จึงไม่กินแรงเครื่อง */
  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [playing, player]);

  /* ยังไม่ได้เล่น = โชว์ภาพปกทับไว้ ไม่ปล่อยให้เห็นกล่องดำเรียงกันทั้งแถว
     (เฟรมแรกของคลิปยังไม่ถูกถอดรหัสจนกว่าจะสั่งเล่น) */
  const showPoster = !playing;

  const open = () => {
    if (video.productId) router.push(`/product/${video.productId}`);
  };

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={video.caption ?? 'คลิปรีวิวสินค้า'}
      onPress={open}
      /* ไม่ได้ผูกสินค้าไว้ก็ไม่ต้องกดได้ — ปุ่มที่กดแล้วไม่มีอะไรเกิดขึ้นทำให้คนกดซ้ำ */
      disabled={!video.productId}
      style={styles.card}>
      <View style={styles.media}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          /* ปิดโหมดเต็มจอกับ picture-in-picture — การ์ดในแถบไม่ใช่เครื่องเล่นเต็มตัว */
          allowsFullscreen={false}
          allowsPictureInPicture={false}
        />
        {showPoster ? (
          video.poster ? (
            <Image
              source={{ uri: video.poster }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={180}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.posterFallback]} />
          )
        ) : null}

        {/* ไอคอนเล่น โผล่เฉพาะใบที่ยังไม่เล่น — บอกว่านี่คือคลิป ไม่ใช่รูปนิ่ง */}
        {showPoster ? (
          <View style={styles.playBadge}>
            <Ionicons name="play" size={14} color={Colors.textOnPrimary} />
          </View>
        ) : null}
      </View>

      {video.caption ? (
        <View style={styles.captionWrap}>
          <Text numberOfLines={2} style={styles.caption}>
            {video.caption}
          </Text>
          {video.productId ? (
            <Text style={[styles.link, { color: accent.strong }]}>ดูสินค้า</Text>
          ) : null}
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: Spacing.lg },
  head: { marginBottom: Spacing.md },
  row: { gap: GAP, paddingRight: Spacing.lg },
  card: {
    width: CARD_W,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.card,
  },
  media: {
    width: '100%',
    aspectRatio: MEDIA_RATIO,
    backgroundColor: Colors.surfaceMuted,
  },
  // ไม่ได้ตั้งภาพปกไว้ — เทาอ่อน ไม่ใช่ดำ กล่องดำดูเหมือนคลิปเสียมากกว่าที่ว่าง
  posterFallback: { backgroundColor: Colors.surfaceMuted },
  playBadge: {
    position: 'absolute',
    left: Spacing.sm,
    bottom: Spacing.sm,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    // ดำโปร่ง ไม่ใช่สีแบรนด์ — ทับอยู่บนภาพปกที่สีอะไรก็ได้ ต้องอ่านออกทุกพื้น
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  captionWrap: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: 2,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.text,
  },
  link: { fontFamily: 'Mitr_500Medium', fontSize: 12 },
});
