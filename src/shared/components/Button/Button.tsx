import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, borderRadius, typography, spacing, shadows } from '@constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const sizeStyles: Record<ButtonSize, { paddingV: number; paddingH: number; fontSize: number; borderRadius: number }> = {
  sm: { paddingV: 8, paddingH: 16, fontSize: typography.size.sm, borderRadius: borderRadius.sm },
  md: { paddingV: 14, paddingH: 24, fontSize: typography.size.base, borderRadius: borderRadius.md },
  lg: { paddingV: 18, paddingH: 32, fontSize: typography.size.md, borderRadius: borderRadius.lg },
  xl: { paddingV: 22, paddingH: 40, fontSize: typography.size.xl, borderRadius: borderRadius.xxl },
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  fullWidth = false,
  style,
  textStyle,
  disabled,
  onPress,
  ...rest
}: ButtonProps) {
  const sz = sizeStyles[size];

  const handlePress = (event: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(event);
  };

  const buttonStyle: ViewStyle = {
    borderRadius: sz.borderRadius,
    paddingVertical: sz.paddingV,
    paddingHorizontal: sz.paddingH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    alignSelf: fullWidth ? 'stretch' : 'auto',
    opacity: disabled || loading ? 0.5 : 1,
    ...(variant === 'outline' && styles.outline),
    ...(variant === 'ghost' && styles.ghost),
    ...(variant === 'secondary' && styles.secondary),
    ...(variant === 'danger' && styles.danger),
    ...style,
  };

  const labelStyle: TextStyle = {
    fontSize: sz.fontSize,
    fontWeight: typography.weight.bold,
    ...(variant === 'primary' && { color: colors.textInverted }),
    ...(variant === 'secondary' && { color: colors.primary }),
    ...(variant === 'outline' && { color: colors.primary }),
    ...(variant === 'ghost' && { color: colors.primary }),
    ...(variant === 'danger' && { color: colors.textInverted }),
    ...textStyle,
  };

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.85}
        {...rest}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[buttonStyle, shadows.primary]}
        >
          {loading ? (
            <ActivityIndicator color={colors.textInverted} size="small" />
          ) : (
            <>
              {leftIcon}
              <Text style={labelStyle}>{label}</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'danger' ? colors.textInverted : colors.primary}
          size="small"
        />
      ) : (
        <>
          {leftIcon}
          <Text style={labelStyle}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  outline: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  ghost: {
    backgroundColor: colors.primaryLight,
  },
  secondary: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: `${colors.primary}30`,
  },
  danger: {
    backgroundColor: colors.danger,
    ...shadows.sm,
  },
});
