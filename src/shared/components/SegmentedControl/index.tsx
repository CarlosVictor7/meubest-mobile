/**
 * SegmentedControl — Toggle Ouvir / Apoiar
 * Alinhado ao RoleToggle da web (pill, dois segmentos)
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius, typography, shadows } from '@constants/theme';

interface SegmentOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  style,
  disabled,
}: SegmentedControlProps) {
  const handlePress = (v: string) => {
    if (disabled || v === value) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(v);
  };

  return (
    <View style={[styles.container, shadows.sm, style]}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.segment, isActive && styles.segmentActive]}
            onPress={() => handlePress(opt.value)}
            activeOpacity={0.8}
            disabled={disabled}
          >
            {opt.icon && (
              <View style={styles.segIcon}>{opt.icon}</View>
            )}
            <Text style={[styles.segLabel, isActive && styles.segLabelActive]}>
              {opt.label.toUpperCase()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'center',
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segIcon: {
    opacity: 1,
  },
  segLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
    letterSpacing: typography.tracking.widest,
  },
  segLabelActive: {
    color: colors.textInverted,
  },
});
