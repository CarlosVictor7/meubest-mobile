/**
 * ListenerCard — um acolhedor na lista do Explorar.
 *
 * ┌── Decisão de design registrada em ADR ──────────────────────────────────────┐
 * │ Este card NÃO é um card de dating.                                          │
 * │                                                                             │
 * │ Sem swipe, sem pilha, sem descarte, sem animação de "curtida". É uma linha  │
 * │ de lista com ações explícitas em botões. O motivo é concreto: a Apple já    │
 * │ rejeitou este app por associação a companionship + pagamento, e o card      │
 * │ empilhado com swipe é o vocabulário visual do dating — o revisor reconhece  │
 * │ o padrão antes de ler o texto.                                              │
 * │                                                                             │
 * │ Também é mais acessível e muito mais fácil de testar.                       │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Vocabulário: "acolhedor", "temas que apoia", "falar agora", "agendar".
 * Nunca "match", "curtir", "conectar-se com alguém especial".
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapPin, MessageCircle, CalendarPlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Avatar } from '@shared/components';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { getDisplayName, getInitial } from '@shared/utils/displayName';
import { isAvailableNow } from '@shared/utils/presence';
import { SESSION_THEMES } from '@constants/config';
import type { ExploreCandidate } from '../utils/exploreFilters';

interface ListenerCardProps {
  listener: ExploreCandidate;
  onTalkNow: (listener: ExploreCandidate) => void;
  onSchedule: (listener: ExploreCandidate) => void;
}

/** Máximo de temas exibidos antes do "+N". */
const MAX_THEMES = 3;

export function ListenerCard({ listener, onTalkNow, onSchedule }: ListenerCardProps) {
  const name = getDisplayName(listener, 'Acolhedor');
  const online = isAvailableNow(listener);

  const themes = (listener.interests ?? [])
    .map((id) => SESSION_THEMES.find((t) => t.id === id))
    .filter(Boolean)
    .slice(0, MAX_THEMES) as { id: string; label: string; emoji: string }[];

  const extraThemes = Math.max(0, (listener.interests?.length ?? 0) - themes.length);

  // Cidade é gravada como "São Paulo - SP". Exibimos como está: só a UF seria
  // pouco informativo, e reformatar arriscaria estragar valores antigos.
  const place = listener.city || listener.state || null;

  const press = (fn: () => void) => () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fn();
  };

  return (
    <View style={[styles.card, shadows.sm]}>
      <View style={styles.top}>
        {listener.photoURL ? (
          <Avatar photoURL={listener.photoURL} name={name} size="md" />
        ) : (
          <View style={styles.initialWrap}>
            <Text style={styles.initialText}>{getInitial(listener)}</Text>
          </View>
        )}

        <View style={styles.headline}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {online && (
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>DISPONÍVEL</Text>
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            {listener.ageRange && <Text style={styles.meta}>{listener.ageRange} anos</Text>}
            {listener.ageRange && place && <Text style={styles.metaDot}>•</Text>}
            {place && (
              <>
                <MapPin size={11} color={colors.textMutedValue} strokeWidth={2} />
                <Text style={styles.meta} numberOfLines={1}>
                  {place}
                </Text>
              </>
            )}
          </View>
        </View>
      </View>

      {listener.bio ? (
        <Text style={styles.bio} numberOfLines={3}>
          {listener.bio}
        </Text>
      ) : null}

      {themes.length > 0 && (
        <View style={styles.themes}>
          {themes.map((t) => (
            <View key={t.id} style={styles.themeChip}>
              <Text style={styles.themeText}>
                {t.emoji} {t.label}
              </Text>
            </View>
          ))}
          {extraThemes > 0 && (
            <View style={styles.themeChip}>
              <Text style={styles.themeText}>+{extraThemes}</Text>
            </View>
          )}
        </View>
      )}

      {/*
        Sem avaliação no card: `rating` não é calculado por nenhum código hoje
        (todo mundo aparece com 5,0). Exibir um número decorativo aqui seria
        enganoso justamente na tela em que a pessoa escolhe com quem falar.
        Registrado em riscos-abertos.md.
      */}

      <View style={styles.actions}>
        {online && (
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={press(() => onTalkNow(listener))}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Falar agora com ${name}`}
          >
            <MessageCircle size={16} color="#FFF" strokeWidth={2.4} />
            <Text style={styles.btnPrimaryText}>FALAR AGORA</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary, !online && styles.btnFull]}
          onPress={press(() => onSchedule(listener))}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Agendar uma conversa com ${name}`}
        >
          <CalendarPlus size={16} color={colors.primary} strokeWidth={2.4} />
          <Text style={styles.btnSecondaryText}>AGENDAR</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    padding: spacing.md,
    gap: spacing.sm,
  },
  top: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  initialWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.primary,
  },
  headline: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: {
    flexShrink: 1,
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.text,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  onlineText: { fontSize: 9, fontWeight: typography.weight.black, color: '#16A34A', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 11, color: colors.textMutedValue, fontWeight: typography.weight.medium },
  metaDot: { fontSize: 11, color: colors.textMutedValue },
  bio: {
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 18,
  },
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  themeChip: {
    backgroundColor: `${colors.primary}0F`,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  themeText: { fontSize: 10, fontWeight: typography.weight.bold, color: colors.primary },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm - 2,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm + 4,
  },
  btnFull: { flex: 1 },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: {
    color: '#FFF',
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    letterSpacing: 0.5,
  },
  btnSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primaryLight,
  },
  btnSecondaryText: {
    color: colors.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    letterSpacing: 0.5,
  },
});
