/**
 * ExplorePhotoGallery — as fotos de UM perfil, como fundo do card do Explorar.
 *
 * Não é um pager: é UMA `expo-image` por vez, trocada por tap zones (40% à
 * esquerda = anterior, 40% à direita = próxima, centro = nada). O swipe
 * horizontal continua sendo da FlatList da tela — troca de PESSOA, nunca de
 * foto — então aqui não há nenhum ScrollView/pager aninhado.
 *
 * ┌── contentPosition ──────────────────────────────────────────────────────────┐
 * │ Escolhido "top center" em vez do default "center": o card é alto (retrato  │
 * │ ~9:16) e as fotos de perfil costumam ser mais quadradas, com o rosto no    │
 * │ terço superior. Com `cover` + "center" o crop come testa/cabelo e deixa    │
 * │ ombro; com "top center" o rosto fica ancorado no topo, onde o gradiente    │
 * │ escuro do rodapé não alcança. Validado na régua com fotos do provider      │
 * │ (quadradas, rosto centrado) — se a prova em aparelho mostrar cortes de     │
 * │ queixo em selfies muito verticais, o ajuste é aqui, num único lugar.       │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Erro de imagem: marca o índice como falho e pula para a próxima válida (sem
 * loop — índice falho nunca é revisitado). Sem nenhuma válida → `onAllFailed`
 * e o card mostra o fallback gradiente+inicial.
 *
 * Z-order: este componente é o PRIMEIRO filho do card. As tap zones ficam,
 * portanto, ABAIXO do gradiente de legibilidade e do bloco de conteúdo
 * (FALAR AGORA / AGENDAR / VER MAIS) — um toque sobre o rodapé vai para o
 * conteúdo, nunca para a galeria.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { colors } from '@constants/theme';
import type { ExplorePhoto } from '../types';
import {
  describePhotoUrl,
  firstValidPhotoIndex,
  nextValidPhotoIndex,
} from '../utils/exploreGallery';
import { ExplorePhotoIndicators } from './ExplorePhotoIndicators';

interface ExplorePhotoGalleryProps {
  photos: ExplorePhoto[];
  /** Deslocamento do topo para os indicadores não colidirem com a pill "N de M". */
  indicatorsTop: number;
  /** Chamado quando todas as fotos falharam — o pai troca para o fallback. */
  onAllFailed: () => void;
  /** Índice da foto visível — o pai usa para o prefetch da próxima. */
  onIndexChange?: (index: number) => void;
}

/** Cor neutra do placeholder enquanto a foto carrega (mesma do card antigo). */
const PLACEHOLDER_COLOR = colors.surfaceAlt;

export function ExplorePhotoGallery({
  photos,
  indicatorsTop,
  onAllFailed,
  onIndexChange,
}: ExplorePhotoGalleryProps) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<ReadonlySet<number>>(() => new Set());
  const allFailedNotified = useRef(false);

  const count = photos.length;

  // Troca de perfil (as fotos mudam) → recomeça na primeira.
  useEffect(() => {
    setIndex(0);
    setFailed(new Set());
    allFailedNotified.current = false;
  }, [photos]);

  useEffect(() => {
    onIndexChange?.(index);
  }, [index, onIndexChange]);

  const current: ExplorePhoto | undefined = photos[index];

  const go = useCallback(
    (dir: 1 | -1) => {
      const target = nextValidPhotoIndex(count, index, dir, failed);
      // Sem wrap: na borda, só um toque leve de "não tem mais".
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (target === null) return;
      setIndex(target);
    },
    [count, index, failed]
  );

  const handleError = useCallback(() => {
    if (__DEV__) {
      console.warn('[Explore] Foto falhou:', describePhotoUrl(current?.url));
    }
    setFailed((prev) => {
      const next = new Set(prev);
      next.add(index);
      const fallback = firstValidPhotoIndex(count, index, next);
      if (fallback === null) {
        if (!allFailedNotified.current) {
          allFailedNotified.current = true;
          onAllFailed();
        }
      } else if (fallback !== index) {
        setIndex(fallback);
      }
      return next;
    });
  }, [count, index, current?.url, onAllFailed]);

  const hasPrev = useMemo(
    () => nextValidPhotoIndex(count, index, -1, failed) !== null,
    [count, index, failed]
  );
  const hasNext = useMemo(
    () => nextValidPhotoIndex(count, index, 1, failed) !== null,
    [count, index, failed]
  );

  if (!current) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Image
        // key por índice: a troca de foto remonta a view e o `transition`
        // faz o crossfade a partir do placeholder, não da foto anterior.
        key={index}
        source={{ uri: current.url }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="top center"
        cachePolicy="disk"
        transition={150}
        placeholder={PLACEHOLDER_COLOR}
        placeholderContentFit="cover"
        onError={handleError}
        accessibilityIgnoresInvertColors
        accessible={false}
      />

      {/* Tap zones: 40% | 20% morto | 40%. Botões invisíveis, mas acessíveis. */}
      {count > 1 && (
        <View style={styles.zones} pointerEvents="box-none">
          <Pressable
            style={styles.zone}
            onPress={() => go(-1)}
            accessibilityRole="button"
            accessibilityLabel="Foto anterior"
            accessibilityState={{ disabled: !hasPrev }}
          />
          <View style={styles.deadZone} pointerEvents="none" />
          <Pressable
            style={styles.zone}
            onPress={() => go(1)}
            accessibilityRole="button"
            accessibilityLabel="Próxima foto"
            accessibilityState={{ disabled: !hasNext }}
          />
        </View>
      )}

      <View style={[styles.indicators, { top: indicatorsTop }]} pointerEvents="none">
        <ExplorePhotoIndicators count={count} activeIndex={index} failed={failed} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  zone: { flex: 4 },
  deadZone: { flex: 2 },
  indicators: {
    position: 'absolute',
    left: 12,
    right: 12,
  },
});
