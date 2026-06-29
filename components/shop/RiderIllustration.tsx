/**
 * RiderIllustration — `<RiderIllustration size={160} />`.
 *
 * A cute อู้ฟู่ delivery rider on a coral scooter with the branded delivery box,
 * facing right with little motion lines. Vector (react-native-svg), crisp at any
 * size, zero emoji. Used on the order-tracking surfaces ("กำลังจัดส่ง").
 *
 * Art is laid out in a 64×48 viewBox; `size` sets the width (height follows 3:4).
 */

import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

type Props = {
  /** Width in px; height is 0.75× this. Default 160. */
  size?: number;
};

export function RiderIllustration({ size = 160 }: Props) {
  return (
    <Svg width={size} height={size * 0.75} viewBox="0 0 64 48">
      {/* ground shadow */}
      <Ellipse cx={32} cy={45} rx={27} ry={2.6} fill="#E7D8CF" />

      {/* motion lines */}
      <G stroke="#F4B6A0" strokeWidth={1.8} strokeLinecap="round">
        <Line x1={1} y1={15} x2={5.5} y2={15} />
        <Line x1={0.5} y1={22} x2={6} y2={22} />
        <Line x1={1.5} y1={29} x2={5} y2={29} />
      </G>

      {/* wheels */}
      <G>
        <Circle cx={16} cy={37} r={7} fill="#37474F" />
        <Circle cx={16} cy={37} r={3} fill="#CFD8DC" />
        <Circle cx={16} cy={37} r={1.2} fill="#78909C" />
        <Circle cx={48} cy={37} r={7} fill="#37474F" />
        <Circle cx={48} cy={37} r={3} fill="#CFD8DC" />
        <Circle cx={48} cy={37} r={1.2} fill="#78909C" />
      </G>

      {/* delivery box (rear) */}
      <G>
        <Rect x={6} y={16} width={12.5} height={12} rx={1.6} fill="#E8623C" />
        <Rect x={6} y={16} width={12.5} height={3.2} rx={1.6} fill="#C9512E" />
        <Rect x={9.6} y={20.5} width={5.4} height={5.4} rx={1} fill="#FFF7F0" />
        <Circle cx={12.3} cy={23.2} r={1.5} fill="#F2784B" />
      </G>

      {/* scooter body */}
      <Path d="M9.5 33 Q8.8 25.5 16.5 25.5 L26 25.5 Q29 25.5 29 28.5 L29 33 Z" fill="#F2784B" />
      <Rect x={26} y={31} width={15} height={3} rx={1.5} fill="#D9663E" />
      <Path d="M40 33 L40 30 Q40 23.5 46 21.5 L50.5 23.5 Q50.5 27 47 28 L46 33 Z" fill="#F2784B" />
      <Circle cx={49} cy={25} r={1.7} fill="#FFE082" />

      {/* rider */}
      <Path d="M20 27 L26.5 30 L29.5 33" stroke="#37474F" strokeWidth={3.6} strokeLinecap="round" fill="none" />
      <Path d="M18 27 Q16.8 20 23 18 L28.5 16 Q31.5 16.4 31 19.4 L26 22 Q22 23.6 22 27 Z" fill="#2BB673" />
      <Path d="M29 18.4 Q40 17 49.5 17.6" stroke="#2BB673" strokeWidth={3.2} strokeLinecap="round" fill="none" />
      <Circle cx={50} cy={17.6} r={1.7} fill="#F1C9A5" />
      <Path d="M47 21.5 L50.5 16" stroke="#455A64" strokeWidth={2} strokeLinecap="round" />
      <Circle cx={50.8} cy={15.6} r={1.6} fill="#37474F" />

      {/* head / helmet */}
      <Circle cx={30} cy={11.2} r={5.2} fill="#F2784B" />
      <Circle cx={28.2} cy={9.3} r={1.5} fill="#FF9E7D" />
      <Path d="M31.4 12 Q35.2 12 35.2 14 Q35.2 15.4 33 15.4 Q31.2 15.2 31.2 13.4 Z" fill="#F4C9A0" />
      <Path d="M30.2 9 Q35 9.2 34.6 12 L31.2 12.2 Q30.2 10.8 30.2 9 Z" fill="#455A64" />
    </Svg>
  );
}
