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
 * Dados: recebe SÓ o DTO público (`PublicExploreProfile`) — nome já abreviado
 * pelo servidor, sem nome completo, sem e-mail. `photos` são URLs assinadas de
 * 1 h; a galeria (`ExplorePhotoGallery`) troca de foto por tap zones. Sem foto
 * ou com todas falhando, o fundo vira o gradiente da marca com a inicial
 * GRANDE. O gradiente escuro inferior existe SEMPRE — é ele que garante a
 * legibilidade do texto branco tanto sobre foto quanto sobre o fundo claro.
 *
 * Z-order (de baixo para cima): galeria + tap zones → gradiente (sem toque) →
 * bloco de conteúdo com os botões. Um toque no rodapé nunca chega à galeria.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, MessageCircle, Calendar } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import type { PublicExploreProfile } from '../types';
import {
  formatAgeRange,
  formatLocation,
  getThemeChips,
} from '../utils/exploreView';
import { ExplorePhotoGallery } from './ExplorePhotoGallery';

interface ProfilePagerCardProps {
  profile: PublicExploreProfile;
  /** Largura da página (= largura da janela) — exigida pelo pagingEnabled. */
  width: number;
  /** CTA "FALAR AGORA" habilitado? (`reachable`, decidido pelo servidor) */
  canTalkNow: boolean;
  /** Presença fresca — o pontinho "Ativo agora". */
  liveNow: boolean;
  onTalkNow?: (profile: PublicExploreProfile) => void;
  onSchedule?: (profile: PublicExploreProfile) => void;
  /**
   * Prévia do PRÓPRIO perfil: os botões de ação ficam desabilitados (a pessoa
   * não chama a si mesma) e os indicadores sobem, pois não há pill "N de M".
   */
  previewMode?: boolean;
  /** Índice da foto visível — a tela usa para o prefetch da próxima. */
  onPhotoIndexChange?: (index: number) => void;
}

/** Linhas da bio quando recolhida / teto quando expandida. */
const BIO_COLLAPSED_LINES = 3;
const BIO_EXPANDED_MAX_HEIGHT = 8 * 20; // ~8 linhas de lineHeight 20

/**
 * Altura reservada no topo do card para a pill "N de M" da tela (top 8 +
 * ~24 de pill + folga). Os indicadores de foto entram logo abaixo dela.
 */
const INDICATORS_TOP_WITH_PILL = spacing.sm + 24 + spacing.sm;
const INDICATORS_TOP_PLAIN = spacing.md;

export function ProfilePagerCard({
  profile,
  width,
  canTalkNow,
  liveNow,
  onTalkNow,
  onSchedule,
  previewMode = false,
  onPhotoIndexChange,
}: ProfilePagerCardProps) {
  const [galleryFailed, setGalleryFailed] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);

  // Perfil trocou (FlatList recicla o componente) → reseta o estado local.
  useEffect(() => {
    setGalleryFailed(false);
    setBioExpanded(false);
  }, [profile.uid]);

  const name = profile.publicName || 'Acolhedor(a)';
  const initial = (profile.initial || name.charAt(0) || 'A').toUpperCase();
  const photos = Array.isArray(profile.photos) ? profile.photos : [];
  const showGallery = photos.length > 0 && !galleryFailed;

  const age = formatAgeRange(profile.ageRange);
  const place = formatLocation(profile.city, profile.state);
  const bio = typeof profile.bio === 'string' ? profile.bio.trim() : '';
  const { chips, extra } = getThemeChips(profile.interests);

  const actionsEnabled = !previewMode;
  const talkEnabled = actionsEnabled && canTalkNow && Boolean(onTalkNow);
  const scheduleEnabled = actionsEnabled && Boolean(onSchedule);

  const handleAllFailed = useCallback(() => setGalleryFailed(true), []);

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
        {/* ── Fundo: galeria ou marca ───────────────────────────────────── */}
        {showGallery ? (
          <ExplorePhotoGallery
            photos={photos}
            indicatorsTop={previewMode ? INDICATORS_TOP_PLAIN : INDICATORS_TOP_WITH_PILL}
            onAllFailed={handleAllFailed}
            onIndexChange={onPhotoIndexChange}
          />
        ) : (
          <LinearGradient
            colors={[colors.primaryLight, '#F6C9CD']}
            style={StyleSheet.absoluteFill}
          >
            <View style={styles.initialWrap}>
              <Text style={styles.initialText}>{initial}</Text>
            </View>
          </LinearGradient>
        )}

        {/* ── Scrim superior: indicadores e pill legíveis sobre foto clara ── */}
        <LinearGradient
          colors={['rgba(0,0,0,0.42)', 'transparent']}
          style={styles.topShade}
          pointerEvents="none"
        />

        {/* ── Gradiente de legibilidade no terço inferior ───────────────── */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.88)']}
          locations={[0, 0.35, 1]}
          style={styles.bottomShade}
          pointerEvents="none"
        />

        {/* ── Conteúdo sobre o gradiente (acima das tap zones) ──────────── */}
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

          {!canTalkNow && !previewMode && (
            <Text style={styles.unavailableHint}>Indisponível para chamada agora</Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, !talkEnabled && styles.btnDisabled]}
              onPress={talkEnabled && onTalkNow ? press(() => onTalkNow(profile)) : undefined}
              disabled={!talkEnabled}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ disabled: !talkEnabled }}
              accessibilityLabel={
                previewMode
                  ? 'Falar agora (desativado na prévia)'
                  : canTalkNow
                    ? `Falar agora com ${name}`
                    : `${name} está indisponível para chamada agora`
              }
            >
              <MessageCircle size={16} color="#FFF" strokeWidth={2.4} />
              <Text style={styles.btnPrimaryText}>FALAR AGORA</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary, !scheduleEnabled && styles.btnDisabled]}
              onPress={scheduleEnabled && onSchedule ? press(() => onSchedule(profile)) : undefined}
              disabled={!scheduleEnabled}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ disabled: !scheduleEnabled }}
              accessibilityLabel={
                previewMode
                  ? 'Agendar (desativado na prévia)'
                  : `Agendar uma conversa com ${name}`
              }
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
  topShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '14%',
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
  btnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderColor: 'rgba(255,255,255,0.25)',
    shadowOpacity: 0,
    elevation: 0,
  },
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
