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
 * Dados: query paginada por cursor (`fetchListenersPage`, getDocs one-shot,
 * 12 por página, SEM orderBy — ver `services/exploreQuery.ts`). Navegar dentro
 * das páginas carregadas custa ZERO reads; a próxima página é prefetchada
 * quando faltam 3 cards para o fim. Filtros continuam client-side, sobre o que
 * já foi baixado (`buildExploreList`), com autofill limitado a 5 páginas.
 *
 * Fica no HomeStack, não como quinta aba: o BottomNav já tem 4 abas no Android
 * e 3 no iOS mais o botão central, e uma quinta estouraria o layout de
 * `half` + `centerGap`, aumentando a divergência entre plataformas.
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
import { useNavigation } from '@react-navigation/native';
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
import { getDisplayName } from '@shared/utils/displayName';
import { ProfilePagerCard } from '../components/ProfilePagerCard';
import { TalkThemeSheet } from '../components/TalkThemeSheet';
import { ExploreFiltersSheet } from '../components/ExploreFiltersSheet';
import { buildExploreList, type ExploreCandidate } from '../utils/exploreFilters';
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
import { fetchListenersPage, type ExploreCursor } from '../services/exploreQuery';
import { createDirectedSession } from '../services/directedSession';

export function ExploreScreen() {
  const navigation = useNavigation<any>();
  const { user, profile } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // ── Dados paginados ────────────────────────────────────────────────────────
  const [docs, setDocs] = useState<ExploreCandidate[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const cursorRef = useRef<ExploreCursor | null>(null);
  const hasMoreRef = useRef(false);
  const fetchingRef = useRef(false);
  const autoFillPagesRef = useRef(0);

  // ── Filtros ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [uf, setUf] = useState('');
  const [themeId, setThemeId] = useState('');
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ── Pager / fluxos ─────────────────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const [themeTarget, setThemeTarget] = useState<ExploreCandidate | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const listRef = useRef<FlatList<ExploreCandidate>>(null);

  const load = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoadError(false);
    setDocs(null);
    setCurrentIndex(0);
    cursorRef.current = null;
    autoFillPagesRef.current = 0;
    try {
      const page = await fetchListenersPage();
      cursorRef.current = page.cursor;
      hasMoreRef.current = page.hasMore;
      setHasMore(page.hasMore);
      setDocs(page.items);
    } catch (error) {
      console.error('[Explore] Falha ao carregar acolhedores:', error);
      hasMoreRef.current = false;
      setHasMore(false);
      setDocs([]);
      setLoadError(true);
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (fetchingRef.current || !hasMoreRef.current) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchListenersPage({ cursor: cursorRef.current });
      cursorRef.current = page.cursor;
      hasMoreRef.current = page.hasMore;
      setHasMore(page.hasMore);
      setDocs((prev) => mergeExplorePages(prev ?? [], page.items));
    } catch (error) {
      // Para de paginar em erro: sem isso, os effects de prefetch/autofill
      // tentariam de novo em loop. O refresh do header recomeça do zero.
      console.error('[Explore] Falha ao paginar acolhedores:', error);
      hasMoreRef.current = false;
      setHasMore(false);
    } finally {
      fetchingRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filters = useMemo(
    () => ({ search, state: uf, themeId, onlyOnline }),
    [search, uf, themeId, onlyOnline]
  );

  const list = useMemo(
    () =>
      buildExploreList(
        docs,
        { uid: user?.uid ?? '', blockedUserIds: profile?.blockedUserIds },
        filters
      ),
    [docs, user?.uid, profile?.blockedUserIds, filters]
  );

  const activeFilterCount = countActiveFilters(filters);

  // Filtro mudou: recomeça o pager e o orçamento de autofill.
  useEffect(() => {
    autoFillPagesRef.current = 0;
    setCurrentIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [search, uf, themeId, onlyOnline]);

  // Autofill: com filtros ativos (ou visibilidade client-side removendo muita
  // gente), continua paginando até a lista ter uma página — máx. 5 páginas.
  useEffect(() => {
    if (docs === null) return;
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
  }, [docs, list.length, hasMore, loadingMore, loadMore]);

  // Prefetch: quando a pessoa se aproxima do fim do que já foi carregado.
  useEffect(() => {
    if (
      shouldPrefetchNextPage({
        currentIndex,
        loadedCount: list.length,
        hasMore,
        isFetching: fetchingRef.current,
      })
    ) {
      loadMore();
    }
  }, [currentIndex, list.length, hasMore, loadingMore, loadMore]);

  // ── Navegação do pager ─────────────────────────────────────────────────────
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first && typeof first.index === 'number') {
        setCurrentIndex(first.index);
      }
    }
  );
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });

  const goToIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= list.length) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      listRef.current?.scrollToIndex({ index, animated: true });
    },
    [list.length]
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<ExploreCandidate> | null | undefined, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width]
  );

  // ── Ações ──────────────────────────────────────────────────────────────────
  const handleSchedule = useCallback(
    (listener: ExploreCandidate) => {
      navigation.navigate('ScheduleMatch', {
        rebook: {
          sessionId: '',
          speakerId: user?.uid ?? '',
          listenerId: listener.id,
          listenerName: getDisplayName(listener, 'Acolhedor'),
        },
      });
    },
    [navigation, user?.uid]
  );

  /** FALAR AGORA: primeiro a pessoa escolhe o TEMA — a categoria da sessão é dela. */
  const handleTalkNow = useCallback((listener: ExploreCandidate) => {
    setThemeTarget(listener);
  }, []);

  const handleThemeSelected = useCallback(
    async (category: string) => {
      const listener = themeTarget;
      setThemeTarget(null);
      if (!listener || !user) return;

      setStarting(listener.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        const sessionId = await createDirectedSession({
          speakerUid: user.uid,
          speakerEmail: user.email,
          speakerProfile: profile ?? null,
          listenerId: listener.id,
          listenerName: getDisplayName(listener, 'Acolhedor'),
          category,
        });
        navigation.navigate('MatchSearch', {
          category,
          directedSessionId: sessionId,
          listenerName: getDisplayName(listener, 'Acolhedor'),
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
    setOnlyOnline(false);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  const loading = docs === null;
  const bottomPad = insets.bottom + BOTTOM_NAV_SCROLL_PAD;

  const renderItem = useCallback(
    ({ item }: { item: ExploreCandidate }) => {
      const { canTalkNow, liveNow } = getTalkNowAvailability(item);
      return (
        <ProfilePagerCard
          listener={item}
          width={width}
          canTalkNow={canTalkNow}
          liveNow={liveNow}
          onTalkNow={handleTalkNow}
          onSchedule={handleSchedule}
        />
      );
    },
    [width, handleTalkNow, handleSchedule]
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.iconBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <ChevronLeft size={22} color={colors.primary} strokeWidth={2.5} />
          </TouchableOpacity>

          <Text style={styles.title}>EXPLORAR</Text>

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
      ) : list.length === 0 ? (
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
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
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
              {formatExploreProgress(currentIndex, list.length)}
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
          {currentIndex < list.length - 1 && (
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
        listenerName={getDisplayName(themeTarget, 'esta pessoa')}
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
        onlyOnline={onlyOnline}
        onOnlyOnlineChange={setOnlyOnline}
        onClear={clearFilters}
        resultCount={list.length}
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
