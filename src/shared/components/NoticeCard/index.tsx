/**
 * NoticeCard — Aviso Importante
 * Alinhado ao Disclaimer Banner da web
 */
import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { ShieldAlert } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography, shadows } from '@constants/theme';

interface NoticeCardProps {
  title?: string;
  body: string;
  highlight?: string;
  style?: StyleProp<ViewStyle>;
}

export function NoticeCard({
  title = 'Aviso Importante',
  body,
  highlight,
  style,
}: NoticeCardProps) {
  return (
    <View style={[styles.card, shadows.sm, style]}>
      {/* Blob decorativo */}
      <View style={styles.blob} />

      {/* Ícone */}
      <View style={styles.iconWrap}>
        <ShieldAlert size={26} color={colors.primary} strokeWidth={2.5} />
      </View>

      {/* Texto */}
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title.toUpperCase()}</Text>
        <Text style={styles.body}>
          {body}
          {highlight && (
            <Text style={styles.highlight}> {highlight}</Text>
          )}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 3,
    borderColor: colors.primaryLight,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${colors.primaryLight}60`,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: `${colors.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '3deg' }],
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: typography.tracking.tight,
  },
  body: {
    fontSize: typography.size.base,
    color: colors.textMutedValue,
    lineHeight: 20,
    fontWeight: typography.weight.medium,
  },
  highlight: {
    color: colors.primary,
    fontWeight: typography.weight.bold,
  },
});
