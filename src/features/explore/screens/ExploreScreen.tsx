/**
 * ExploreScreen — descoberta de acolhedores disponíveis.
 *
 * Lista vertical com ações explícitas. Ver a nota de compliance em
 * `components/ListenerCard.tsx` e o ADR-006.
 *
 * Fica no HomeStack, não como quinta aba: o BottomNav já tem 4 abas no Android
 * e 3 no iOS mais o botão central, e uma quinta estouraria o layout de
 * `half` + `centerGap`, aumentando a divergência entre plataformas.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Search, ChevronLeft, Compass, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { db } from '@shared/services/firebase';
import { useAuth } from '@features/auth/hooks/useAuth';
import { BOTTOM_NAV_SCROLL_PAD } from '@shared/components';
import { SelectSheet } from '@shared/components/SelectSheet';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { BR_STATES } from '@constants/brazilLocations';
import { SESSION_THEMES } from '@constants/config';
import { getDisplayName } from '@shared/utils/displayName';
import { ListenerCard } from '../components/ListenerCard';
import { buildExploreList, type ExploreCandidate } from '../utils/exploreFilters';
import { createDirectedSession } from '../services/directedSession';

export function ExploreScreen() {
  const navigation = useNavigation<any>();
  const { user, profile } = useAuth();

  const [candidates, setCandidates] = useState<ExploreCandidate[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [themeId, setThemeId] = useState('');
  const [onlyOnline, setOnlyOnline] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    setCandidates(null);
    try {
      // A query filtra por role='listener' porque é o que as Rules publicadas
      // permitem listar (`allow read` libera docs com role == 'listener').
      // O restante da visibilidade é decidido em `buildExploreList`.
      const snap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'listener'))
      );
      setCandidates(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ExploreCandidate));
    } catch (error) {
      console.error('[Explore] Falha ao carregar acolhedores:', error);
      setCandidates([]);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const list = useMemo(
    () =>
      buildExploreList(
        candidates,
        { uid: user?.uid ?? '', blockedUserIds: profile?.blockedUserIds },
        { search, state, themeId, onlyOnline }
      ),
    [candidates, user?.uid, profile?.blockedUserIds, search, state, themeId, onlyOnline]
  );

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

  const handleTalkNow = useCallback(
    (listener: ExploreCandidate) => {
      const name = getDisplayName(listener, 'esta pessoa');
      Alert.alert(
        'Falar agora',
        `Vamos avisar ${name} que você quer conversar. Se ela não puder atender agora, você pode agendar.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Chamar',
            onPress: async () => {
              if (!user) return;
              setStarting(listener.id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              try {
                const sessionId = await createDirectedSession({
                  speakerUid: user.uid,
                  speakerEmail: user.email,
                  speakerProfile: profile ?? null,
                  listenerId: listener.id,
                  listenerName: getDisplayName(listener, 'Acolhedor'),
                  category: SESSION_THEMES[0].label,
                });
                navigation.navigate('MatchSearch', {
                  category: SESSION_THEMES[0].label,
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
          },
        ]
      );
    },
    [user, profile, navigation]
  );

  const loading = candidates === null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <ChevronLeft size={22} color={colors.primary} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.title}>EXPLORAR</Text>
          <TouchableOpacity
            onPress={load}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Recarregar lista"
          >
            <RefreshCw size={18} color={colors.primary} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          Pessoas voluntárias disponíveis para ouvir você.
        </Text>

        <View style={styles.searchBox}>
          <Search size={18} color={colors.textMutedValue} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nome ou tema"
            placeholderTextColor={colors.textMutedValue}
            autoCorrect={false}
            accessibilityLabel="Buscar acolhedores"
          />
        </View>

        <View style={styles.filtersRow}>
          <View style={styles.filterCell}>
            <SelectSheet
              value={state}
              onChange={setState}
              options={[
                { value: '', label: 'Todos os estados' },
                ...BR_STATES.map((s) => ({ value: s.uf, label: `${s.name} (${s.uf})` })),
              ]}
              placeholder="Estado"
              title="Filtrar por estado"
            />
          </View>
          <View style={styles.filterCell}>
            <SelectSheet
              value={themeId}
              onChange={setThemeId}
              options={[
                { value: '', label: 'Todos os temas' },
                ...SESSION_THEMES.map((t) => ({ value: t.id, label: `${t.emoji} ${t.label}` })),
              ]}
              placeholder="Tema"
              title="Filtrar por tema"
              searchable={false}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.onlineToggle, onlyOnline && styles.onlineToggleActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setOnlyOnline((v) => !v);
          }}
          activeOpacity={0.85}
          accessibilityRole="switch"
          accessibilityState={{ checked: onlyOnline }}
        >
          <View style={[styles.onlineDot, onlyOnline && styles.onlineDotActive]} />
          <Text style={[styles.onlineToggleText, onlyOnline && styles.onlineToggleTextActive]}>
            SOMENTE DISPONÍVEIS AGORA
          </Text>
        </TouchableOpacity>
      </SafeAreaView>

      {loading ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.stateText}>Carregando acolhedores...</Text>
        </View>
      ) : loadError ? (
        <View style={styles.stateWrap}>
          <Compass size={40} color={`${colors.primary}55`} strokeWidth={1.5} />
          <Text style={styles.stateText}>
            Não foi possível carregar a lista agora. Verifique sua conexão e tente de novo.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.85}>
            <Text style={styles.retryText}>TENTAR NOVAMENTE</Text>
          </TouchableOpacity>
        </View>
      ) : list.length === 0 ? (
        <View style={styles.stateWrap}>
          <Compass size={40} color={`${colors.primary}55`} strokeWidth={1.5} />
          <Text style={styles.stateText}>
            {onlyOnline || state || themeId || search
              ? 'Ninguém encontrado com esses filtros. Tente ampliar a busca.'
              : 'Nenhum acolhedor disponível no momento. Você pode agendar uma conversa pela tela inicial.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ListenerCard
              listener={item}
              onTalkNow={handleTalkNow}
              onSchedule={handleSchedule}
            />
          )}
          ListFooterComponent={<View style={{ height: BOTTOM_NAV_SCROLL_PAD }} />}
        />
      )}

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
  safeTop: { backgroundColor: colors.background, paddingHorizontal: spacing.lg, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  backBtn: { padding: 4 },
  title: {
    flex: 1,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.text,
    fontWeight: typography.weight.medium,
  },
  filtersRow: { flexDirection: 'row', gap: spacing.sm },
  filterCell: { flex: 1 },
  onlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  onlineToggleActive: { borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.08)' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  onlineDotActive: { backgroundColor: '#22C55E' },
  onlineToggleText: {
    fontSize: 10,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
    letterSpacing: 0.6,
  },
  onlineToggleTextActive: { color: '#16A34A' },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
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
  blockingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(253,246,240,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
