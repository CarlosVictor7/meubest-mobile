/**
 * ProfilePagerCard — um acolhedor em card de página inteira no Explorar.
 *
 * ┌── Compliance (ADR-007) ─────────────────────────────────────────────────────┐
 * │ Este card é uma PÁGINA de um carrossel, não um card de descarte.            │
 * │ Ele não voa, não inclina, não tem overlay de aprovação/reprovação.          │
 * │ As únicas ações são explícitas, em botões: FALAR AGORA e AGENDAR.           │
 * │ Ver o cabeçalho de `../screens/ExploreScreen.tsx`.                          │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Foto: `getDisplayPhotoUrl` (própria → provider → null). Sem foto ou com erro
 * de carregamento, o fundo vira o gradiente da marca com a inicial GRANDE.
 * O gradiente escuro inferior existe SEMPRE — é ele que garante a legibilidade
 * do texto branco tanto sobre foto quanto sobre o fundo claro da marca.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, MessageCircle, Calendar } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { getDisplayName, getInitial } from '@shared/utils/displayName';
import { getDisplayPhotoUrl } from '@shared/utils/profilePhoto';
import type { ExploreCandidate } from '../utils/exploreFilters';
import {
  formatAgeRange,
  formatLocation,
  getThemeChips,
} from '../utils/exploreView';

interface ProfilePagerCardProps {
  listener: ExploreCandidate;
  /** Largura da página (= largura da janela) — exigida pelo pagingEnabled. */
  width: number;
  /** CTA "FALAR AGORA" habilitado? (isListenerPushEligibleNow, decidido na tela) */
  canTalkNow: boolean;
  /** Presença fresca — o pontinho "Ativo agora". */
  liveNow: boolean;
  onTalkNow: (listener: ExploreCandidate) => void;
  onSchedule: (listener: ExploreCandidate) => void;
}

/** Linhas da bio quando recolhida / teto quando expandida. */
const BIO_COLLAPSED_LINES = 3;
const BIO_EXPANDED_MAX_HEIGHT = 8 * 20; // ~8 linhas de lineHeight 20

export function ProfilePagerCard({
  listener,
  width,
  canTalkNow,
  liveNow,
  onTalkNow,
  onSchedule,
}: ProfilePagerCardProps) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);

  const name = getDisplayName(listener, 'Acolhedor');
  const photoUrl = getDisplayPhotoUrl(listener);
  const showPhoto = Boolean(photoUrl) && !photoFailed;

  const age = formatAgeRange(listener.ageRange);
  const place = formatLocation(listener.city, listener.state);
  const bio = typeof listener.bio === 'string' ? listener.bio.trim() : '';
  const { chips, extra } = getThemeChips(listener.interests);

  const press = useCallback(
    (fn: () => void) => () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      fn();
    },
    []
  );

  return (
    <View style={[styles.page, { width }]}>
      <View style={[styles.card, shadows.md]}>
        {/* ── Fundo: foto ou marca ──────────────────────────────────────── */}
        {showPhoto ? (
          <>
            {/* Placeholder neutro visível enquanto a foto carrega. */}
            {!photoLoaded && <View style={styles.photoPlaceholder} />}
            <Image
              source={{ uri: photoUrl as string }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onLoad={() => setPhotoLoaded(true)}
              onError={() => setPhotoFailed(true)}
              accessibilityIgnoresInvertColors
            />
          </>
        ) : (
          <LinearGradient
            colors={[colors.primaryLight, '#F6C9CD']}
            style={StyleSheet.absoluteFill}
          >
            <View style={styles.initialWrap}>
              <Text style={styles.initialText}>{getInitial(listener)}</Text>
            </View>
          </LinearGradient>
        )}

        {/* ── Gradiente de legibilidade no terço inferior ───────────────── */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.88)']}
          locations={[0, 0.35, 1]}
          style={styles.bottomShade}
          pointerEvents="none"
        />

        {/* ── Conteúdo sobre o gradiente ────────────────────────────────── */}
        <View style={styles.content}>
          {canTalkNow && (
            <View style={styles.badgeRow}>
              <View style={styles.availableBadge}>
                <View style={styles.availableDot} />
                <Text style={styles.availableText}>DISPONÍVEL AGORA</Text>
              </View>
              {liveNow && (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>Ativo agora</Text>
                </View>
              )}
            </View>
          )}

          <Text style={styles.name} numberOfLines={2}>
            {name}
            {age ? <Text style={styles.age}>{`  ·  ${age}`}</Text> : null}
          </Text>

          {place && (
            <View style={styles.placeRow}>
              <MapPin size={13} color="rgba(255,255,255,0.85)" strokeWidth={2.2} />
              <Text style={styles.placeText} numberOfLines={1}>
                {place}
              </Text>
            </View>
          )}

          {bio ? (
            <View style={styles.bioBlock}>
              <Text style={styles.bioLabel}>SOBRE MIM</Text>
              {bioExpanded ? (
                <ScrollView
                  style={styles.bioScroll}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.bioText}>{bio}</Text>
                </ScrollView>
              ) : (
                <Text style={styles.bioText} numberOfLines={BIO_COLLAPSED_LINES}>
                  {bio}
                </Text>
              )}
              <TouchableOpacity
                onPress={() => setBioExpanded((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={
                  bioExpanded ? 'Recolher a apresentação' : 'Ver a apresentação completa'
                }
              >
                <Text style={styles.bioToggle}>
                  {bioExpanded ? 'VER MENOS' : 'VER MAIS'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {chips.length > 0 && (
            <View style={styles.themes}>
              {chips.map((t) => (
                <View key={t.id} style={styles.themeChip}>
                  <Text style={styles.themeText}>
                    {t.emoji} {t.label}
                  </Text>
                </View>
              ))}
              {extra > 0 && (
                <View style={styles.themeChip}>
                  <Text style={styles.themeText}>+{extra}</Text>
                </View>
              )}
            </View>
          )}

          {!canTalkNow && (
            <Text style={styles.unavailableHint}>Indisponível para chamada agora</Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, !canTalkNow && styles.btnDisabled]}
              onPress={canTalkNow ? press(() => onTalkNow(listener)) : undefined}
              disabled={!canTalkNow}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canTalkNow }}
              accessibilityLabel={
                canTalkNow
                  ? `Falar agora com ${name}`
                  : `${name} está indisponível para chamada agora`
              }
            >
              <MessageCircle size={16} color="#FFF" strokeWidth={2.4} />
              <Text style={styles.btnPrimaryText}>FALAR AGORA</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={press(() => onSchedule(listener))}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Agendar uma conversa com ${name}`}
            >
              <Calendar size={16} color="#FFF" strokeWidth={2.4} />
              <Text style={styles.btnSecondaryText}>AGENDAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    // Em FlatList HORIZONTAL, `flex: 1` num item controla LARGURA — a altura
    // vem do stretch do eixo transversal, então é '100%' explícito.
    height: '100%',
    paddingHorizontal: spacing.lg,
  },
  card: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.primaryLight,
  },
  photoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surfaceAlt,
  },
  initialWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: '30%',
  },
  initialText: {
    fontSize: 120,
    fontWeight: typography.weight.black,
    color: colors.primary,
    opacity: 0.85,
  },
  bottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  content: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(34,197,94,0.92)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  availableDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  availableText: {
    fontSize: 9,
    fontWeight: typography.weight.black,
    color: '#FFF',
    letterSpacing: 0.6,
  },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  liveText: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: 'rgba(255,255,255,0.9)',
  },
  name: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.black,
    color: '#FFF',
    lineHeight: 32,
  },
  age: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: 'rgba(255,255,255,0.9)',
  },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  placeText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: 'rgba(255,255,255,0.85)',
    flexShrink: 1,
  },
  bioBlock: { gap: 4 },
  bioLabel: {
    fontSize: 10,
    fontWeight: typography.weight.black,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
  bioScroll: { maxHeight: BIO_EXPANDED_MAX_HEIGHT },
  bioText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 20,
  },
  bioToggle: {
    fontSize: 11,
    fontWeight: typography.weight.black,
    color: '#FFF',
    letterSpacing: 0.6,
  },
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  themeChip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  themeText: { fontSize: 11, fontWeight: typography.weight.bold, color: '#FFF' },
  unavailableHint: {
    fontSize: 11,
    fontWeight: typography.weight.medium,
    color: 'rgba(255,255,255,0.7)',
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm - 2,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm + 6,
  },
  btnPrimary: { backgroundColor: colors.primary, ...shadows.primary },
  btnDisabled: { backgroundColor: 'rgba(255,255,255,0.25)', shadowOpacity: 0, elevation: 0 },
  btnPrimaryText: {
    color: '#FFF',
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    letterSpacing: 0.5,
  },
  btnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  btnSecondaryText: {
    color: '#FFF',
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    letterSpacing: 0.5,
  },
});
