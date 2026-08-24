/**
 * ExplorePhotoIndicators — barras segmentadas no topo do card, uma por foto.
 *
 * Só aparece com 2+ fotos (com 1 não há o que indicar). O segmento ativo é
 * branco cheio; os demais, branco translúcido. Puramente decorativo para o
 * toque (pointerEvents none) — a navegação é pelas tap zones da galeria.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';

interface ExplorePhotoIndicatorsProps {
  count: number;
  activeIndex: number;
  /** Índices cujas fotos falharam — ficam apagados. */
  failed?: ReadonlySet<number>;
}

export function ExplorePhotoIndicators({
  count,
  activeIndex,
  failed,
}: ExplorePhotoIndicatorsProps) {
  if (count < 2) return null;

  return (
    <View
      style={styles.row}
      pointerEvents="none"
      accessibilityRole="progressbar"
      accessibilityLabel={`Foto ${activeIndex + 1} de ${count}`}
      accessibilityValue={{ min: 1, max: count, now: activeIndex + 1 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            i === activeIndex && styles.segmentActive,
            failed?.has(i) && styles.segmentFailed,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  segmentActive: {
    backgroundColor: '#FFF',
  },
  segmentFailed: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});
