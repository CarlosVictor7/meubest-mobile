/**
 * TimeGrid — grade de chips de horário.
 *
 * Extraída do `ScheduleMatchScreen` para ser compartilhada com o modal de
 * disponibilidade. A grade não sabe se a seleção é única ou múltipla: recebe
 * o conjunto de selecionados e avisa o toque — quem decide a política é o pai
 * (o agendamento troca a seleção; o modal alterna no Set).
 */
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '@constants/theme';

interface TimeGridProps {
  times: readonly string[];
  selected: ReadonlySet<string>;
  onToggle: (time: string) => void;
}

export function TimeGrid({ times, selected, onToggle }: TimeGridProps) {
  return (
    <View style={styles.grid}>
      {times.map((time) => {
        const isSelected = selected.has(time);
        return (
          <TouchableOpacity
            key={time}
            style={[styles.chip, isSelected && styles.chipActive]}
            onPress={() => onToggle(time)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
              {time}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
    width: '31%', // 3 chips por linha
    paddingVertical: 10,
    gap: 6,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  chipTextActive: {
    color: colors.textInverted,
  },
});
