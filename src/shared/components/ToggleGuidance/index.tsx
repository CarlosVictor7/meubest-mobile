/**
 * ToggleGuidance — indicação orgânica acima do toggle DESABAFAR | ACOLHER:
 * duas curvas simétricas saindo do centro, cada uma com ponta de seta, uma
 * apontando para o lado esquerdo (Desabafar) e outra para o direito (Acolher).
 *
 * - Nas 3 primeiras aberturas (mesmo contador do peek do SegmentedControl,
 *   `@meubest:toggleHintCount`, que o SegmentedControl incrementa) a ênfase
 *   alterna esquerda ↔ direita (opacity + 3 px de deslocamento). Depois fica
 *   ESTÁTICA e mais sutil — nunca some.
 * - Reduce Motion: sem movimento, indicação visível.
 * - Só visual: não toca role/isOnline/estado nenhum.
 * - Sem dependência nova: `Animated` do core + `react-native-svg` já presente.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '@constants/theme';
import { TOGGLE_HINT_STORAGE_KEY, parseToggleHintCount } from '@shared/utils/toggleHint';
import {
  GUIDANCE_HEIGHT, GUIDANCE_STATIC_OPACITY, GUIDANCE_DIM_OPACITY, GUIDANCE_EMPHASIS_OPACITY,
  GUIDANCE_SHIFT_PX, GUIDANCE_LEG_MS, emphasisSequence, guidanceMode,
} from '@shared/utils/toggleGuidance';

const W = 132;
const H = GUIDANCE_HEIGHT;

/** Uma curva orgânica do centro para um lado, com ponta de seta (espelhada via `dir`). */
function Arrow({ dir, color }: { dir: 1 | -1; color: string }) {
  const c = W / 2;
  const x = (v: number) => c + dir * v;
  // Curva: nasce no centro (topo), desce suave e termina apontando para baixo/fora.
  const d = `M ${x(6)} 5 C ${x(22)} 4, ${x(38)} 8, ${x(50)} ${H - 6}`;
  const head = `M ${x(42)} ${H - 9} L ${x(50)} ${H - 6} L ${x(49)} ${H - 15}`;
  return (
    <>
      <Path d={d} stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Path d={head} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  );
}

export function ToggleGuidance() {
  const [mode, setMode] = useState<'static' | 'animated' | null>(null);
  const left = useRef(new Animated.Value(GUIDANCE_STATIC_OPACITY)).current;
  const right = useRef(new Animated.Value(GUIDANCE_STATIC_OPACITY)).current;
  const shift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [raw, rm] = await Promise.all([
        AsyncStorage.getItem(TOGGLE_HINT_STORAGE_KEY).catch(() => null),
        AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
      ]);
      if (!cancelled) setMode(guidanceMode(parseToggleHintCount(raw), rm));
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (mode !== 'animated') return;
    const legs = emphasisSequence().map((side) =>
      Animated.parallel([
        Animated.timing(left, { toValue: side === 'left' ? GUIDANCE_EMPHASIS_OPACITY : GUIDANCE_DIM_OPACITY, duration: GUIDANCE_LEG_MS, useNativeDriver: true }),
        Animated.timing(right, { toValue: side === 'right' ? GUIDANCE_EMPHASIS_OPACITY : GUIDANCE_DIM_OPACITY, duration: GUIDANCE_LEG_MS, useNativeDriver: true }),
        Animated.timing(shift, { toValue: side === 'left' ? -GUIDANCE_SHIFT_PX : GUIDANCE_SHIFT_PX, duration: GUIDANCE_LEG_MS, useNativeDriver: true }),
      ])
    );
    const settle = Animated.parallel([
      Animated.timing(left, { toValue: GUIDANCE_STATIC_OPACITY, duration: GUIDANCE_LEG_MS, useNativeDriver: true }),
      Animated.timing(right, { toValue: GUIDANCE_STATIC_OPACITY, duration: GUIDANCE_LEG_MS, useNativeDriver: true }),
      Animated.timing(shift, { toValue: 0, duration: GUIDANCE_LEG_MS, useNativeDriver: true }),
    ]);
    const seq = Animated.sequence([Animated.delay(450), ...legs, settle]);
    seq.start();
    return () => seq.stop();
  }, [mode, left, right, shift]);

  const color = useMemo(() => colors.primary, []);

  return (
    <Animated.View
      style={[styles.wrap, { transform: [{ translateX: shift }] }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: left }]}>
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <Arrow dir={-1} color={color} />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: right }]}>
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <Arrow dir={1} color={color} />
        </Svg>
      </Animated.View>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Circle cx={W / 2} cy={5} r={2.2} fill={color} opacity={0.7} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: W,
    height: H,
    alignSelf: 'center',
    marginBottom: -4,
  },
});
