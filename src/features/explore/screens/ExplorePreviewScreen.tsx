/**
 * ExplorePreviewScreen — o PRÓPRIO perfil como terceiros o veem no Explorar.
 *
 * Reusa o `ProfilePagerCard` em `previewMode` com o DTO de `GET /explore/me`:
 * o mesmo nome abreviado, as mesmas fotos assinadas, os mesmos chips. Os
 * botões FALAR AGORA/AGENDAR aparecem desabilitados — a pessoa não chama a
 * si mesma, mas precisa ver onde eles ficam.
 *
 * O banner no topo traduz `visibility.state` — por que o perfil está (ou não)
 * público — e o ícone de atualizar no header refaz a chamada. Sem polling.
 * (O botão ATUALIZAR no rodapé foi removido no QA: colidia com o COMEÇAR.)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Eye, EyeOff, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@shared/services/api';
import { getFirebaseIdToken } from '@shared/services/paymentService';
import { BOTTOM_NAV_SCROLL_PAD } from '@shared/components';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import type { ProfileStackParamList } from '@navigation/types';
import { ProfilePagerCard } from '../components/ProfilePagerCard';
import { getTalkNowAvailability } from '../utils/exploreView';
import type { ExploreMeResponse, ExploreVisibilityState } from '../types';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'ExplorePreview'>;

const BANNER_TEXT: Record<ExploreVisibilityState, string> = {
  public: 'É assim que outras pessoas veem você.',
  not_approved: 'Seu perfil ainda não está público no Explorar.',
  not_in_listener_mode:
    'Seu perfil só aparece no Explorar quando você está no modo Acolher.',
  photo_consent_off:
    "Suas fotos estão ocultas — ative 'Exibir minhas fotos no Explorar' no Perfil.",
};

export function ExplorePreviewScreen() {
  const navigation = useNavigation<Nav>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<ExploreMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const token = await getFirebaseIdToken();
      const res = await api.getExploreMe(token);
      setData(res);
    } catch (err) {
      console.error('[ExplorePreview] Falha ao carregar prévia:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    load();
  }, [load]);

  const bottomPad = insets.bottom + BOTTOM_NAV_SCROLL_PAD;
  const visibilityState = data?.visibility.state;
  const isPublic = visibilityState === 'public';

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

          <Text style={styles.title}>PRÉVIA DO PERFIL</Text>

          <TouchableOpacity
            onPress={refresh}
            style={styles.iconBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Atualizar prévia"
          >
            <RefreshCw size={18} color={colors.primary} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        {visibilityState && (
          <View
            style={[styles.banner, isPublic ? styles.bannerPublic : styles.bannerHidden]}
            accessibilityRole="text"
          >
            {isPublic ? (
              <Eye size={16} color="#16A34A" strokeWidth={2.4} />
            ) : (
              <EyeOff size={16} color="#B45309" strokeWidth={2.4} />
            )}
            <Text
              style={[styles.bannerText, isPublic ? styles.bannerTextPublic : styles.bannerTextHidden]}
            >
              {BANNER_TEXT[visibilityState]}
            </Text>
          </View>
        )}
      </SafeAreaView>

      {loading ? (
        <View style={[styles.stateWrap, { paddingBottom: bottomPad }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.stateText}>Montando sua prévia...</Text>
        </View>
      ) : error || !data ? (
        <View style={[styles.stateWrap, { paddingBottom: bottomPad }]}>
          <EyeOff size={40} color={`${colors.primary}55`} strokeWidth={1.5} />
          <Text style={styles.stateText}>
            Não foi possível montar a prévia agora. Verifique sua conexão e tente de novo.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh} activeOpacity={0.85}>
            <Text style={styles.retryText}>TENTAR NOVAMENTE</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.cardWrap, { paddingBottom: bottomPad }]}>
          <ProfilePagerCard
            profile={data.profile}
            width={width}
            {...getTalkNowAvailability(data.profile)}
            previewMode
          />
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  bannerPublic: { backgroundColor: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.35)' },
  bannerHidden: { backgroundColor: colors.warningLight, borderColor: 'rgba(245,158,11,0.45)' },
  bannerText: {
    flex: 1,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    lineHeight: 18,
  },
  bannerTextPublic: { color: '#15803D' },
  bannerTextHidden: { color: '#92400E' },

  cardWrap: { flex: 1, gap: spacing.sm },
  updateBtn: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  updateText: {
    color: colors.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    letterSpacing: 0.6,
  },

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
});
