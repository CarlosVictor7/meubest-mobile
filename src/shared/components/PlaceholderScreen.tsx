/**
 * PlaceholderScreen — Tela premium "Em breve"
 * Sem textos técnicos de dev mode visíveis ao usuário.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius, shadows } from '@constants/theme';

interface PlaceholderScreenProps {
  title: string;
  /** @deprecated Use `message` instead. Mantido para compatibilidade. */
  emoji?: string;
  /** @deprecated Mantido para compatibilidade. */
  subtitle?: string;
  message?: string;
}

export function PlaceholderScreen({
  title,
  message = 'Estamos preparando essa área para você.',
}: PlaceholderScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Ícone */}
        <View style={styles.iconWrap}>
          <Clock size={40} color={colors.primary} strokeWidth={1.8} />
        </View>

        {/* Textos */}
        <Text style={styles.title}>{title.toUpperCase()}</Text>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.note}>Em breve você poderá acompanhar tudo por aqui.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: 100, // espaço para o BottomNav fixo
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  title: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.black,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: typography.tracking.tight,
    lineHeight: 32,
  },
  message: {
    fontSize: typography.size.base,
    color: colors.textMutedValue,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: typography.weight.medium,
  },
  note: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
