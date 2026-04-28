/**
 * BlackCard — Card escuro estilo web (bg-dbm-darkblue)
 * Usado para: Minha Disponibilidade, Seu Progresso, Indique um Amigo
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '@constants/theme';

interface BlackCardProps {
  icon?: React.ReactNode;
  label?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function BlackCard({
  icon,
  label,
  title,
  subtitle,
  actionLabel,
  onAction,
  actionIcon,
  children,
  style,
}: BlackCardProps) {
  return (
    <View style={[styles.card, shadows.lg, style]}>
      {/* Label pequeno acima do título */}
      {label && (
        <Text style={styles.label}>{label.toUpperCase()}</Text>
      )}

      {/* Ícone */}
      {icon && (
        <View style={styles.iconWrap}>
          {icon}
        </View>
      )}

      {/* Textos */}
      <Text style={styles.title}>{title.toUpperCase()}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      {/* Conteúdo customizado */}
      {children}

      {/* Botão de ação */}
      {actionLabel && onAction && (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onAction}
          activeOpacity={0.85}
        >
          <Text style={styles.actionBtnText}>{actionLabel.toUpperCase()}</Text>
          {actionIcon}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.dark,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: typography.tracking.widest,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    textAlign: 'center',
    letterSpacing: typography.tracking.tight,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: typography.size.base,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    fontWeight: typography.weight.medium,
    lineHeight: 20,
  },
  actionBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionBtnText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.black,
    color: colors.dark,
    letterSpacing: typography.tracking.widest,
  },
});
