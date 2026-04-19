import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import { colors, borderRadius, shadows, spacing } from '@constants/theme';

interface CardProps extends TouchableOpacityProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Se true, é clicável e tem feedback de toque */
  pressable?: boolean;
  /** Variante visual */
  variant?: 'default' | 'dark' | 'highlight';
}

export function Card({ children, style, pressable = false, variant = 'default', onPress, ...rest }: CardProps) {
  const cardStyle: ViewStyle[] = [
    styles.base,
    variant === 'dark' && styles.dark,
    variant === 'highlight' && styles.highlight,
    style as ViewStyle,
  ].filter(Boolean) as ViewStyle[];

  if (pressable || onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        activeOpacity={0.88}
        onPress={onPress}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  dark: {
    backgroundColor: colors.dark,
    borderColor: 'transparent',
  },
  highlight: {
    backgroundColor: colors.primaryLight,
    borderColor: `${colors.primary}30`,
    borderWidth: 2,
  },
});
