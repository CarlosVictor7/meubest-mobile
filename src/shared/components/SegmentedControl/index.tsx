/**
 * SegmentedControl — Toggle Ouvir / Apoiar
 * Alinhado ao RoleToggle da web (pill, dois segmentos)
 *
 * 26/08 — thumb ANIMADO: um View absoluto por baixo dos segmentos desliza com
 * `Animated.spring` em translateX (`useNativeDriver: true`). Os segmentos em
 * si não mudam de layout ao trocar — zero layout shift; só a cor do label.
 * A largura do thumb vem do `onLayout` do container.
 *
 * `educationalHint`: nas 3 primeiras aberturas do app (contador em
 * AsyncStorage `@meubest:toggleHintCount`) o thumb "espia" 2× o lado inativo
 * (6–8 px, ~1,2 s) e volta, sem mudar o estado. Com "reduzir movimento"
 * ligado: sem peek e a troca acontece sem spring. Regras puras e testadas em
 * `@shared/utils/toggleHint`. Só Animated do core — sem reanimated.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  AccessibilityInfo,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, typography, shadows } from '@constants/theme';
import {
  shouldShowToggleHint,
  parseToggleHintCount,
  peekDirection,
  TOGGLE_HINT_STORAGE_KEY,
  TOGGLE_PEEK_DISTANCE,
  TOGGLE_PEEK_CYCLES,
  TOGGLE_PEEK_LEG_MS,
} from '@shared/utils/toggleHint';

interface SegmentOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Peek educativo nas primeiras aberturas (só o toggle de papel da Home). */
  educationalHint?: boolean;
}

const TRACK_PADDING = spacing.xs;

/** O peek roda no máximo UMA vez por abertura do app, mesmo se remontar. */
let hintRanThisLaunch = false;

export function SegmentedControl({
  options,
  value,
  onChange,
  style,
  disabled,
  educationalHint = false,
}: SegmentedControlProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const count = Math.max(options.length, 1);
  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / count : 0;
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );

  // Posição do thumb (índice → px) e o deslocamento do peek, somados.
  const position = useRef(new Animated.Value(0)).current;
  const peek = useRef(new Animated.Value(0)).current;
  const translateX = useMemo(() => Animated.add(position, peek), [position, peek]);

  // Reduzir movimento: lê uma vez e acompanha mudanças.
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (alive) setReduceMotion(Boolean(v)); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) =>
      setReduceMotion(Boolean(v))
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // Segue o valor ativo: spring (ou salto seco com reduceMotion).
  const firstLayoutRef = useRef(true);
  useEffect(() => {
    if (segmentWidth <= 0) return;
    const target = activeIndex * segmentWidth;
    if (firstLayoutRef.current || reduceMotion) {
      firstLayoutRef.current = false;
      position.setValue(target);
      return;
    }
    Animated.spring(position, {
      toValue: target,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
      mass: 0.8,
    }).start();
  }, [activeIndex, segmentWidth, reduceMotion, position]);

  // Peek educativo — não toca no estado real, só no `peek`.
  useEffect(() => {
    if (!educationalHint || hintRanThisLaunch || segmentWidth <= 0) return;
    hintRanThisLaunch = true;
    let cancelled = false;

    (async () => {
      let shows = 0;
      try {
        shows = parseToggleHintCount(await AsyncStorage.getItem(TOGGLE_HINT_STORAGE_KEY));
      } catch { /* sem storage = trata como primeira vez */ }

      let rm = reduceMotion;
      try {
        rm = Boolean(await AccessibilityInfo.isReduceMotionEnabled());
      } catch { /* mantém o estado lido */ }

      if (cancelled || !shouldShowToggleHint(shows, rm)) return;

      try {
        await AsyncStorage.setItem(TOGGLE_HINT_STORAGE_KEY, String(shows + 1));
      } catch { /* silencia — no pior caso mostra de novo */ }

      const dir = peekDirection(activeIndex, options.length);
      const legs: Animated.CompositeAnimation[] = [];
      for (let i = 0; i < TOGGLE_PEEK_CYCLES; i++) {
        legs.push(
          Animated.timing(peek, {
            toValue: dir * TOGGLE_PEEK_DISTANCE,
            duration: TOGGLE_PEEK_LEG_MS,
            useNativeDriver: true,
          }),
          Animated.timing(peek, {
            toValue: 0,
            duration: TOGGLE_PEEK_LEG_MS,
            useNativeDriver: true,
          })
        );
      }
      Animated.sequence(legs).start(() => peek.setValue(0));
    })();

    return () => {
      cancelled = true;
    };
    // Roda uma vez por abertura, assim que a largura existe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [educationalHint, segmentWidth]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const handlePress = (v: string) => {
    if (disabled || v === value) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(v);
  };

  return (
    <View style={[styles.container, shadows.sm, style]} onLayout={handleLayout}>
      {segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            { width: segmentWidth, transform: [{ translateX }] },
          ]}
        />
      )}
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={styles.segment}
            onPress={() => handlePress(opt.value)}
            activeOpacity={0.8}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive, disabled: Boolean(disabled) }}
          >
            {opt.icon && (
              <View style={styles.segIcon}>{opt.icon}</View>
            )}
            <Text style={[styles.segLabel, isActive && styles.segLabelActive]}>
              {opt.label.toUpperCase()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    padding: TRACK_PADDING,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'center',
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  segIcon: {
    opacity: 1,
  },
  segLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
    letterSpacing: typography.tracking.widest,
  },
  segLabelActive: {
    color: colors.textInverted,
  },
});
