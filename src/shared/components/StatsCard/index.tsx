/**
 * StatsCard — Card de estatística horizontal (largura total)
 * Label uppercase + valor vermelho à esquerda, ícone à direita
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '@constants/theme';

interface StatsCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export function StatsCard({ label, value, subValue, icon, style, onPress }: StatsCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.card, shadows.sm, style]}
    >
      {/* Conteúdo esquerdo — label + valor */}
      <View style={styles.left}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        <Text style={styles.value}>{value}</Text>
        {subValue && <Text style={styles.subValue}>{subValue}</Text>}
      </View>

      {/* Ícone à direita */}
      <View style={styles.iconWrap}>
        {icon}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    gap: 4,
    flex: 1,
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
    letterSpacing: typography.tracking.wider,
  },
  value: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: typography.tracking.tight,
    lineHeight: 32,
  },
  subValue: {
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    fontWeight: typography.weight.semibold,
    marginTop: 2,
    letterSpacing: typography.tracking.wide,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
});
