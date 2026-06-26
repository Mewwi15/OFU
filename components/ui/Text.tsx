import { useColor } from '@/hooks/useColor';
import { FONT_SIZE } from '@/theme/globals';
import React, { forwardRef } from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  TextStyle,
} from 'react-native';

type TextVariant =
  | 'body'
  | 'title'
  | 'subtitle'
  | 'caption'
  | 'heading'
  | 'link';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  lightColor?: string;
  darkColor?: string;
  children: React.ReactNode;
}

// อู้ฟู่ uses the Poppins family; weight is selected via the font family name
// (not fontWeight) so Thai + Latin render consistently across platforms.
export const Text = forwardRef<RNText, TextProps>(
  (
    { variant = 'body', lightColor, darkColor, style, children, ...props },
    ref
  ) => {
    const textColor = useColor('text', { light: lightColor, dark: darkColor });
    const mutedColor = useColor('textMuted');

    const getTextStyle = (): TextStyle => {
      const baseStyle: TextStyle = { color: textColor };

      switch (variant) {
        case 'heading':
          return {
            ...baseStyle,
            fontFamily: 'Poppins_700Bold',
            fontSize: 28,
          };
        case 'title':
          return {
            ...baseStyle,
            fontFamily: 'Poppins_700Bold',
            fontSize: 22,
          };
        case 'subtitle':
          return {
            ...baseStyle,
            fontFamily: 'Poppins_600SemiBold',
            fontSize: 18,
          };
        case 'caption':
          return {
            ...baseStyle,
            fontFamily: 'Poppins_400Regular',
            fontSize: FONT_SIZE - 2,
            color: mutedColor,
          };
        case 'link':
          return {
            ...baseStyle,
            fontFamily: 'Poppins_500Medium',
            fontSize: FONT_SIZE,
            textDecorationLine: 'underline',
          };
        default: // 'body'
          return {
            ...baseStyle,
            fontFamily: 'Poppins_400Regular',
            fontSize: FONT_SIZE,
          };
      }
    };

    return (
      <RNText ref={ref} style={[getTextStyle(), style]} {...props}>
        {children}
      </RNText>
    );
  }
);

Text.displayName = 'Text';
