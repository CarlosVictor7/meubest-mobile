/**
 * ExploreScreen — descoberta de acolhedores em "profile pager" fullscreen.
 *
 * ┌── COMPLIANCE (ADR-007) — leia antes de mexer ───────────────────────────────┐
 * │ Isto NÃO é um deck de descarte. O gesto lateral significa APENAS navegar    │
 * │ anterior/próximo, como paginar um carrossel — a paginação nativa da         │
 * │ FlatList. O card NÃO "voa", NÃO inclina, NÃO tem overlay de aprovação ou    │
 * │ reprovação, e navegar NÃO grava NADA (zero writes por navegação).           │
 * │                                                                             │
 * │ A Apple já rejeitou este app por associação a companionship + pagamento; o  │
 * │ vocabulário visual E verbal de dating é PROIBIDO. Nunca usar, em nenhuma    │
 * │ string ou nome user-facing: match, like, curtir, crush, química, descartar, │
 * │ rejeitar pessoa, coração como ação. As únicas ações são explícitas, em      │
 * │ botões: FALAR AGORA e AGENDAR.                                              │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Dados: `GET /explore/listeners` paginado por offset (`fetchListenersPage`,
 * 12 por página). Visibilidade E filtros são do servidor — o app recebe só o
 * DTO público (`PublicExploreProfile`), com nome já abreviado e fotos em URLs
 * assinadas de 1 h. Navegar dentro das páginas carregadas não chama a API; a
 * próxima página é prefetchada quando faltam 3 cards para o fim. ZERO polling:
 * refetch só no refresh manual, na mudança de filtro e na paginação.
 *
 * Fotos: a galeria do card troca por tap zones; a tela prefetcha (expo-image,
 * cache em disco) a próxima foto do perfil visível e a primeira do seguinte.
 *
 * Onde vive: Android → rota do HomeStack (card da Home); iOS → aba própria
 * (`ExploreTab`, no slot da Carteira). FALAR AGORA/AGENDAR navegam para
 * `HomeTab → MatchSearch/ScheduleMatch` nos dois casos.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@features/auth/hooks/useAuth';
import { BOTTOM_NAV_SCROLL_PAD } from '@shared/components';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import type { AppTabParamList, ExploreStackParamList } from '@navigation/types';
import { ProfilePagerCard } from '../components/ProfilePagerCard';
import { TalkThemeSheet } from '../components/TalkThemeSheet';
import { ExploreFiltersSheet } from '../components/ExploreFiltersSheet';
import type { ExploreAgeRange, PublicExploreProfile } from '../types';
import type { ExploreFilters } from '../utils/exploreFilters';
import {
  mergeExplorePages,
  shouldPrefetchNextPage,
  shouldAutoFillFilteredPage,
} from '../utils/explorePaging';
import {
  countActiveFilters,
  formatExploreProgress,
  getTalkNowAvailability,
} from '../utils/exploreView';
import { getPhotoPrefetchUrls } from '../utils/exploreGallery';
import { fetchListenersPage } from '../services/exploreQuery';
import { createDirectedSession } from '../services/directedSession';

/**
 * A tela existe em dois lugares (HomeStack no Android, ExploreStack no iOS);
 * ambos têm a rota `Explore: undefined`, e as ações saem sempre pela aba Home.
 */
type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<ExploreStackParamList, 'Explore'>,
  BottomTabNavigationProp<AppTabParamList>
>;

/** Debounce da busca digitada — uma chamada à API por pausa, não por tecla. */
const SEARCH_DEBOUNCE_MS = 350;

export function ExploreScreen() {
  const navigation = useNavigation<Nav>();
  const { user, profile } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // ── Dados paginados ────────────────────────────────────────────────────────
  const [list, setList] = useState<PublicExploreProfile[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  /** Total do SERVIDOR para os filtros atuais — não o que já foi paginado. */
  const [serverTotal, setServerTotal] = useState(0);

  const nextOffsetRef = useRef<number | null>(null);
  const hasMoreRef = useRef(false);
  const fetchingRef = useRef(false);
  const autoFillPagesRef = useRef(0);
  /** Id da carga vigente — uma resposta atrasada de filtro antigo é descartada. */
  const loadIdRef = useRef(0);

  // ── Filtros ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [uf, setUf] = useState('');
  const [themeId, setThemeId] = useState('');
  const [religion, setReligion] = useState('');
  const [ageRange, setAgeRange] = useState<ExploreAgeRange | ''>('');
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const filters = useMemo<ExploreFilters>(
    () => ({ search: debouncedSearch, state: uf, themeId, religion, ageRange, onlyOnline }),
    [debouncedSearch, uf, themeId, religion, ageRange, onlyOnline]
  );
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const activeFilterCount = countActiveFilters({ ...filters, search });

  /**
   * Quick-toggle "DISPONÍVEIS AGORA" do header: o MESMO `onlyOnline` da sheet
   * (→ `onlyReachable` na API). Mudar o filtro já recomeça a paginação pelo
   * effect de `filters`. Coerente com o badge do card e com FALAR AGORA.
   */
  const toggleOnlyOnline = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOnlyOnline((v) => !v);
  }, []);

  // ── Pager / fluxos ─────────────────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [themeTarget, setThemeTarget] = useState<PublicExploreProfile | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const listRef = useRef<FlatList<PublicExploreProfile>>(null);

  const load = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    fetchingRef.current = true;
    setLoadError(false);
    setList(null);
    setCurrentIndex(0);
    setCurrentPhotoIndex(0);
    nextOffsetRef.current = null;
    autoFillPagesRef.current = 0;
    try {
      const page = await fetchListenersPage({ filters: filtersRef.current, offset: 0 });
      if (loadId !== loadIdRef.current) return;
      nextOffsetRef.current = page.nextOffset;
      hasMoreRef.current = page.hasMore;
      setHasMore(page.hasMore);
      setServerTotal(page.total);
      setList(page.items);
    } catch (error) {
      if (loadId !== loadIdRef.current) return;
      console.error('[Explore] Falha ao carregar acolhedores:', error);
      hasMoreRef.current = false;
      setHasMore(false);
      setServerTotal(0);
      setList([]);
      setLoadError(true);
    } finally {
      if (loadId === loadIdRef.current) fetchingRef.current = false;
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (fetchingRef.current || !hasMoreRef.current) return;
    const offset = nextOffsetRef.current;
    if (offset === null) return;
    const loadId = loadIdRef.current;
    fetchingRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchListenersPage({ filters: filtersRef.current, offset });
      if (loadId !== loadIdRef.current) return;
      nextOffsetRef.current = page.nextOffset;
      hasMoreRef.current = page.hasMore;
      setHasMore(page.hasMore);
      setServerTotal(page.total);
      setList((prev) => mergeExplorePages(prev ?? [], page.items));
    } catch (error) {
      if (loadId !== loadIdRef.current) return;
      // Para de paginar em erro: sem isso, os effects de prefetch/autofill
      // tentariam de novo em loop. O refresh do header recomeça do zero.
      console.error('[Explore] Falha ao paginar acolhedores:', error);
      hasMoreRef.current = false;
      setHasMore(false);
    } finally {
      if (loadId === loadIdRef.current) {
        fetchingRef.current = false;
        setLoadingMore(false);
      }
    }
  }, []);

  // Primeiro load E toda mudança de filtro (server-side) recomeçam do zero.
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    load();
  }, [filters, load]);

  // Autofill: se a API devolver uma página curta com `nextOffset`, completa
  // até uma página — máx. 5 páginas por interação.
  useEffect(() => {
    if (list === null) return;
    if (
      shouldAutoFillFilteredPage({
        filteredCount: list.length,
        hasMore,
        isFetching: fetchingRef.current,
        pagesAutoFetched: autoFillPagesRef.current,
      })
    ) {
      autoFillPagesRef.current += 1;
      loadMore();
    }
  }, [list, hasMore, loadingMore, loadMore]);

  // Prefetch de PÁGINA: quando a pessoa se aproxima do fim do que já carregou.
  useEffect(() => {
    if (
      shouldPrefetchNextPage({
        currentIndex,
        loadedCount: list?.length ?? 0,
        hasMore,
        isFetching: fetchingRef.current,
      })
    ) {
      loadMore();
    }
  }, [currentIndex, list?.length, hasMore, loadingMore, loadMore]);

  // Prefetch de FOTO: próxima do perfil visível + primeira do seguinte. Só isso.
  useEffect(() => {
    if (!list || list.length === 0) return;
    const urls = getPhotoPrefetchUrls(list, currentIndex, currentPhotoIndex);
    if (urls.length === 0) return;
    Image.prefetch(urls, 'disk').catch(() => {
      // Prefetch é oportunista — a foto carrega normalmente quando o card abrir.
    });
  }, [list, currentIndex, currentPhotoIndex]);

  // ── Navegação do pager ─────────────────────────────────────────────────────
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first && typeof first.index === 'number') {
        setCurrentIndex(first.index);
        setCurrentPhotoIndex(0);
      }
    }
  );
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });

  const total = list?.length ?? 0;

  const goToIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= total) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      listRef.current?.scrollToIndex({ index, animated: true });
    },
    [total]
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<PublicExploreProfile> | null | undefined, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width]
  );

  // ── Ações ──────────────────────────────────────────────────────────────────
  const handleSchedule = useCallback(
    (listener: PublicExploreProfile) => {
      navigation.navigate('HomeTab', {
        screen: 'ScheduleMatch',
        params: {
          rebook: {
            sessionId: '',
            speakerId: user?.uid ?? '',
            listenerId: listener.uid,
            listenerName: listener.publicName,
          },
        },
      });
    },
    [navigation, user?.uid]
  );

  /** FALAR AGORA: primeiro a pessoa escolhe o TEMA — a categoria da sessão é dela. */
  const handleTalkNow = useCallback((listener: PublicExploreProfile) => {
    setThemeTarget(listener);
  }, []);

  const handleThemeSelected = useCallback(
    async (category: string) => {
      const listener = themeTarget;
      setThemeTarget(null);
      if (!listener || !user) return;

      setStarting(listener.uid);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        const sessionId = await createDirectedSession({
          speakerUid: user.uid,
          speakerEmail: user.email,
          speakerProfile: profile ?? null,
          listenerId: listener.uid,
          listenerName: listener.publicName,
          category,
        });
        navigation.navigate('HomeTab', {
          screen: 'MatchSearch',
          params: {
            category,
            directedSessionId: sessionId,
            listenerId: listener.uid,
            listenerName: listener.publicName,
          },
        });
      } catch (error) {
        console.error('[Explore] Falha ao criar chamada direcionada:', error);
        Alert.alert(
          'Não foi possível chamar',
          'Tente novamente em instantes, ou agende uma conversa.'
        );
      } finally {
        setStarting(null);
      }
    },
    [themeTarget, user, profile, navigation]
  );

  const clearFilters = useCallback(() => {
    setSearch('');
    setUf('');
    setThemeId('');
    setReligion('');
    setAgeRange('');
    setOnlyOnline(false);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  const loading = list === null;
  const bottomPad = insets.bottom + BOTTOM_NAV_SCROLL_PAD;
  const canGoBack = navigation.canGoBack();

  const renderItem = useCallback(
    ({ item, index }: { item: PublicExploreProfile; index: number }) => {
      const { canTalkNow, liveNow } = getTalkNowAvailability(item);
      return (
        <ProfilePagerCard
          profile={item}
          width={width}
          canTalkNow={canTalkNow}
          liveNow={liveNow}
          onTalkNow={handleTalkNow}
          onSchedule={handleSchedule}
          onPhotoIndexChange={
            index === currentIndex ? setCurrentPhotoIndex : undefined
          }
        />
      );
    },
    [width, handleTalkNow, handleSchedule, currentIndex]
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          {canGoBack && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.iconBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <ChevronLeft size={22} color={colors.primary} strokeWidth={2.5} />
            </TouchableOpacity>
          )}

          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>EXPLORAR</Text>

          <TouchableOpacity
            onPress={toggleOnlyOnline}
            style={[styles.quickToggle, onlyOnline && styles.quickToggleActive]}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            activeOpacity={0.85}
            accessibilityRole="switch"
            accessibilityState={{ checked: onlyOnline }}
            accessibilityLabel="Somente disponíveis agora"
          >
            <View style={[styles.quickDot, onlyOnline && styles.quickDotActive]} />
            <Text style={[styles.quickToggleText, onlyOnline && styles.quickToggleTextActive]}>
              DISPONÍVEIS AGORA
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFiltersOpen(true)}
            style={styles.iconBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={
              activeFilterCount > 0
                ? `Filtros, ${activeFilterCount} ativos`
                : 'Filtros'
            }
          >
            <SlidersHorizontal size={20} color={colors.primary} strokeWidth={2.4} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={load}
            style={styles.iconBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Recarregar lista"
          >
            <RefreshCw size={18} color={colors.primary} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={[styles.stateWrap, { paddingBottom: bottomPad }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.stateText}>Carregando acolhedores...</Text>
        </View>
      ) : loadError ? (
        <View style={[styles.stateWrap, { paddingBottom: bottomPad }]}>
          <Compass size={40} color={`${colors.primary}55`} strokeWidth={1.5} />
          <Text style={styles.stateText}>
            Não foi possível carregar a lista agora. Verifique sua conexão e tente de novo.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.85}>
            <Text style={styles.retryText}>TENTAR NOVAMENTE</Text>
          </TouchableOpacity>
        </View>
      ) : total === 0 ? (
        <View style={[styles.stateWrap, { paddingBottom: bottomPad }]}>
          <Compass size={40} color={`${colors.primary}55`} strokeWidth={1.5} />
          <Text style={styles.stateText}>
            {activeFilterCount > 0
              ? 'Nenhum acolhedor disponível com esses filtros agora.'
              : 'Nenhum acolhedor disponível no momento. Volte daqui a pouco — ou agende uma conversa pela tela inicial.'}
          </Text>
          {activeFilterCount > 0 && (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={clearFilters}
              activeOpacity={0.85}
            >
              <Text style={styles.retryText}>LIMPAR FILTROS</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={activeFilterCount > 0 ? styles.ghostBtn : styles.retryBtn}
            onPress={load}
            activeOpacity={0.85}
          >
            <Text style={activeFilterCount > 0 ? styles.ghostText : styles.retryText}>
              ATUALIZAR
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.pagerWrap, { paddingBottom: bottomPad }]}>
          <FlatList
            ref={listRef}
            data={list}
            keyExtractor={(item) => item.uid}
            renderItem={renderItem}
            extraData={currentIndex}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialNumToRender={2}
            maxToRenderPerBatch={3}
            windowSize={3}
            removeClippedSubviews
            getItemLayout={getItemLayout}
            onViewableItemsChanged={onViewableItemsChanged.current}
            viewabilityConfig={viewabilityConfig.current}
          />

          {/* Indicador de posição — "3 de 12". */}
          <View style={styles.progressPill} pointerEvents="none">
            <Text style={styles.progressText}>
              {formatExploreProgress(currentIndex, total)}
            </Text>
            {loadingMore && (
              <ActivityIndicator size="small" color="#FFF" style={styles.progressSpinner} />
            )}
          </View>

          {/* Botões ‹ › — o mesmo navegar do gesto, em forma acessível. */}
          {currentIndex > 0 && (
            <TouchableOpacity
              style={[styles.navBtn, styles.navBtnLeft]}
              onPress={() => goToIndex(currentIndex - 1)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Acolhedor anterior"
            >
              <ChevronLeft size={22} color={colors.primary} strokeWidth={2.6} />
            </TouchableOpacity>
          )}
          {currentIndex < total - 1 && (
            <TouchableOpacity
              style={[styles.navBtn, styles.navBtnRight]}
              onPress={() => goToIndex(currentIndex + 1)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Próximo acolhedor"
            >
              <ChevronRight size={22} color={colors.primary} strokeWidth={2.6} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <TalkThemeSheet
        visible={themeTarget !== null}
        listenerName={themeTarget?.publicName || 'esta pessoa'}
        onClose={() => setThemeTarget(null)}
        onSelect={handleThemeSelected}
      />

      <ExploreFiltersSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        search={search}
        onSearchChange={setSearch}
        state={uf}
        onStateChange={setUf}
        themeId={themeId}
        onThemeChange={setThemeId}
        religion={religion}
        onReligionChange={setReligion}
        ageRange={ageRange}
        onAgeRangeChange={setAgeRange}
        onlyOnline={onlyOnline}
        onOnlyOnlineChange={setOnlyOnline}
        onClear={clearFilters}
        resultCount={serverTotal}
        hasActiveFilters={activeFilterCount > 0}
      />

      {starting !== null && (
        <View style={styles.blockingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safeTop: { backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  iconBtn: { padding: 4 },
  title: {
    flex: 1,
    flexShrink: 1,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: { fontSize: 9, fontWeight: typography.weight.black, color: '#FFF' },

  // Quick-toggle "DISPONÍVEIS AGORA" — mesmo estado do chip da sheet.
  quickToggle: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
    backgroundColor: colors.surface,
  },
  quickToggleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  quickDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(26,26,26,0.25)',
  },
  quickDotActive: { backgroundColor: '#7CFFB2' },
  quickToggleText: {
    fontSize: 9,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 0.8,
  },
  quickToggleTextActive: { color: '#FFF' },

  pagerWrap: { flex: 1 },
  progressPill: {
    position: 'absolute',
    top: spacing.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  progressText: {
    fontSize: 11,
    fontWeight: typography.weight.bold,
    color: '#FFF',
    letterSpacing: 0.4,
  },
  progressSpinner: { marginLeft: spacing.sm, transform: [{ scale: 0.7 }] },
  navBtn: {
    position: 'absolute',
    top: '45%',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  navBtnLeft: { left: spacing.lg + spacing.sm },
  navBtnRight: { right: spacing.lg + spacing.sm },

  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  stateText: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.xl,
    ...shadows.primary,
  },
  retryText: {
    color: '#FFF',
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    letterSpacing: 0.6,
  },
  ghostBtn: {
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.xl,
  },
  ghostText: {
    color: colors.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    letterSpacing: 0.6,
  },
  blockingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(253,246,240,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
