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
  /** Horários que não podem ser escolhidos (ex.: já passaram hoje). */
  disabled?: ReadonlySet<string>;
}

export function TimeGrid({ times, selected, onToggle, disabled }: TimeGridProps) {
  return (
    <View style={styles.grid}>
      {times.map((time) => {
        const isSelected = selected.has(time);
        const isDisabled = disabled?.has(time) ?? false;
        return (
          <TouchableOpacity
            key={time}
            style={[
              styles.chip,
              isSelected && styles.chipActive,
              isDisabled && styles.chipDisabled,
            ]}
            onPress={() => onToggle(time)}
            activeOpacity={0.8}
            disabled={isDisabled}
            accessibilityState={{ disabled: isDisabled, selected: isSelected }}
          >
            <Text
              style={[
                styles.chipText,
                isSelected && styles.chipTextActive,
                isDisabled && styles.chipTextDisabled,
              ]}
            >
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
  chipDisabled: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    opacity: 0.5,
  },
  chipTextDisabled: {
    color: colors.textMutedValue,
    textDecorationLine: 'line-through',
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
