import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '@constants/theme';

interface PlaceholderScreenProps {
  title: string;
  emoji?: string;
  subtitle?: string;
}

export function PlaceholderScreen({ title, emoji = '🚧', subtitle }: PlaceholderScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <Text style={styles.note}>Sprint 3+ — Em desenvolvimento</Text>
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
  },
  emoji: {
    fontSize: 64,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.size.base,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  note: {
    fontSize: typography.size.xs,
    color: colors.primary,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.md,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 100,
  },
});
