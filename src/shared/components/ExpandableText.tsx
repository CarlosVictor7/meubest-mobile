/**
 * ExpandableText — texto recolhido em N linhas com "VER MAIS" SÓ quando
 * transborda de verdade.
 *
 * Como saber se transborda: um `Text` invisível de medição (mesmo estilo,
 * mesma largura, SEM numberOfLines) reporta `onTextLayout` → `lines.length`.
 * Se passa de `collapsedLines`, existe overflow. Bio curta não ganha botão.
 *
 * Expandido: texto completo dentro de um `ScrollView` com `maxHeight` (o card
 * não cresce sem limite) + "VER MENOS". `resetKey` (ex.: uid do perfil)
 * zera medição e expansão quando o componente é reciclado numa lista.
 *
 * Sem dependências: só core RN. Decisão pura em `bioOverflow`.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native';
import { bioOverflow } from '@shared/utils/expandableText';

interface ExpandableTextProps {
  text: string;
  /** Linhas visíveis quando recolhido. */
  collapsedLines: number;
  /** Teto de altura quando expandido (o excedente rola). */
  expandedMaxHeight: number;
  textStyle: StyleProp<TextStyle>;
  toggleStyle: StyleProp<TextStyle>;
  /** Muda → volta ao recolhido e mede de novo. */
  resetKey: string;
  moreLabel?: string;
  lessLabel?: string;
  moreA11yLabel?: string;
  lessA11yLabel?: string;
  onToggle?: (expanded: boolean) => void;
}

export function ExpandableText({
  text,
  collapsedLines,
  expandedMaxHeight,
  textStyle,
  toggleStyle,
  resetKey,
  moreLabel = 'VER MAIS',
  lessLabel = 'VER MENOS',
  moreA11yLabel = 'Ver o texto completo',
  lessA11yLabel = 'Recolher o texto',
  onToggle,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [lineCount, setLineCount] = useState<number | null>(null);

  useEffect(() => {
    setExpanded(false);
    setLineCount(null);
  }, [resetKey, text]);

  const handleMeasure = useCallback((e: NativeSyntheticEvent<TextLayoutEventData>) => {
    setLineCount(e.nativeEvent.lines.length);
  }, []);

  const hasOverflow = bioOverflow(lineCount, collapsedLines);

  const toggle = () => {
    setExpanded((v) => {
      onToggle?.(!v);
      return !v;
    });
  };

  return (
    <View>
      {/* Text de medição: mesma largura/estilo, invisível, fora do toque e da a11y. */}
      <Text
        style={[textStyle, styles.measure]}
        onTextLayout={handleMeasure}
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        {text}
      </Text>

      {expanded ? (
        <ScrollView
          style={{ maxHeight: expandedMaxHeight }}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <Text style={textStyle}>{text}</Text>
        </ScrollView>
      ) : (
        <Text style={textStyle} numberOfLines={collapsedLines}>
          {text}
        </Text>
      )}

      {hasOverflow && (
        <TouchableOpacity
          onPress={toggle}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={expanded ? lessA11yLabel : moreA11yLabel}
        >
          <Text style={toggleStyle}>{expanded ? lessLabel : moreLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  measure: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
    zIndex: -1,
  },
});
