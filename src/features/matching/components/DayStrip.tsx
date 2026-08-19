/**
 * DayStrip — calendário horizontal de dias.
 *
 * Extraído do `ScheduleMatchScreen` (onde vivia inline) para ser compartilhado
 * com o modal de disponibilidade. Visual idêntico ao original; o componente é
 * burro de propósito: recebe os dias, quem está selecionado e avisa o toque.
 *
 * A seleção compara por CHAVE (`localDateKey`), nunca por identidade de Date —
 * dois `new Date()` do mesmo dia são objetos diferentes.
 */
import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '@constants/theme';
import { localDateKey } from '@shared/utils/availability';

interface DayStripProps {
  days: Date[];
  /** Chave `localDateKey` do dia selecionado, ou null. */
  selectedKey: string | null;
  onSelect: (date: Date, key: string) => void;
  /** Chaves que merecem o pontinho de "tem horário marcado" (opcional). */
  markedKeys?: ReadonlySet<string>;
}

export function DayStrip({ days, selectedKey, onSelect, markedKeys }: DayStripProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {days.map((date) => {
        const key = localDateKey(date);
        const isSelected = key === selectedKey;
        const isMarked = markedKeys?.has(key) ?? false;
        const weekday = date
          .toLocaleDateString('pt-BR', { weekday: 'short' })
          .replace('.', '')
          .toUpperCase();

        return (
          <TouchableOpacity
            key={key}
            style={[styles.day, isSelected && styles.dayActive]}
            onPress={() => onSelect(date, key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.weekday, isSelected && styles.weekdayActive]}>
              {weekday}
            </Text>
            <Text style={[styles.dayNum, isSelected && styles.dayNumActive]}>
              {date.getDate()}
            </Text>
            {isMarked && (
              <Text style={[styles.dot, isSelected && styles.dotActive]}>●</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    paddingVertical: 2,
  },
  day: {
    width: 68,
    height: 76,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  dayActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  weekday: {
    fontSize: 9,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
  },
  weekdayActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  dayNum: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.text,
  },
  dayNumActive: {
    color: colors.textInverted,
  },
  dot: {
    fontSize: 7,
    color: colors.primary,
    marginTop: -2,
  },
  dotActive: {
    color: colors.textInverted,
  },
});
