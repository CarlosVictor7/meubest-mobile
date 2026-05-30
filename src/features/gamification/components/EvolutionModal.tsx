import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { X, Trophy, Target, Award, Lock, ShieldCheck, Flame, Compass, Check } from 'lucide-react-native';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@shared/services/firebase';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { Avatar } from '@shared/components';
import { UserProfile } from '@models/user';
import * as Haptics from 'expo-haptics';

interface EvolutionModalProps {
  visible: boolean;
  onClose: () => void;
  profile: UserProfile | null;
}

interface Achievement {
  id: string;
  name: string;
  icon: string;
  desc: string;
  threshold: number;
}

export function EvolutionModal({ visible, onClose, profile }: EvolutionModalProps) {
  const [ranking, setRanking] = useState<any[]>([]);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [rankingError, setRankingError] = useState<string | null>(null);

  // 1. Dados e Cálculos de Nível
  const isListener = profile?.role === 'listener';
  const currentLevel = Math.max(1, Number(profile?.level ?? 1));
  const currentPoints = Math.max(0, Number(profile?.points ?? 0));
  const sessionsCount = Math.max(0, Number(profile?.sessionsCount ?? 0));
  
  const nextLevelPoints = Math.pow(currentLevel, 2) * 10;
  const progressPercent = Math.min(100, (currentPoints / nextLevelPoints) * 100);
  const pointsToNextLevel = Math.max(0, nextLevelPoints - currentPoints);

  // 2. Conquistas Locais Personalizadas
  const listenerAchievements: Achievement[] = [
    { id: '🌱', name: 'Ouvinte Iniciante', icon: '🌱', desc: 'Conquiste 100 pontos para iniciar.', threshold: 100 },
    { id: '🥈', name: 'Ouvinte Prata', icon: '🥈', desc: 'Ajude mais e chegue a 500 pontos.', threshold: 500 },
    { id: '🥇', name: 'Ouvinte Ouro', icon: '🥇', desc: 'Seja um pilar com 1.000 pontos.', threshold: 1000 },
    { id: '💎', name: 'Mestre da Empatia', icon: '💎', desc: 'Espalhe empatia com 2.500 pontos.', threshold: 2500 },
    { id: '👼', name: 'Anjo da Guarda', icon: '👼', desc: 'Acolhimento supremo com 5.000 pontos.', threshold: 5000 },
  ];

  const speakerAchievements: Achievement[] = [
    { id: '🚶', name: 'Primeiro Passo', icon: '🚶', desc: 'Realize sua primeira sessão.', threshold: 1 },
    { id: '🦁', name: 'Coragem', icon: '🦁', desc: 'Complete 5 sessões no Meu Best.', threshold: 5 },
    { id: '🏔️', name: 'Superação', icon: '🏔️', desc: 'Alcance a marca de 15 sessões.', threshold: 15 },
    { id: '🌳', name: 'Resiliência', icon: '🌳', desc: 'Exemplo de superação com 30 sessões.', threshold: 30 },
  ];

  const activeAchievements = isListener ? listenerAchievements : speakerAchievements;

  // 3. Busca do Ranking de Apoiadores (Top 10)
  useEffect(() => {
    if (!visible) return;

    setRankingLoading(true);
    setRankingError(null);

    const q = query(
      collection(db, 'users'),
      where('role', '==', 'listener'),
      orderBy('points', 'desc'),
      limit(10)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRanking(list);
        setRankingLoading(false);
      },
      (error) => {
        console.error('[EvolutionModal] Erro ao carregar ranking:', error);
        setRankingError('Ranking indisponível no momento.');
        setRankingLoading(false);
      }
    );

    return () => unsub();
  }, [visible]);

  // Haptic feedback ao fechar
  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          {/* Alça visual */}
          <View style={styles.handle} />

          {/* Cabeçalho */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.iconWrap}>
                <Trophy size={20} color={colors.primary} />
              </View>
              <Text style={styles.title}>SUA EVOLUÇÃO</Text>
            </View>

            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Conteúdo Principal com Scroll */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* 1. Card de Progresso / Nível */}
            <View style={styles.levelCard}>
              <View style={styles.levelHeader}>
                <View style={styles.levelBadgeContainer}>
                  <Flame size={24} color={colors.surface} />
                  <Text style={styles.levelBadgeText}>{currentLevel}</Text>
                </View>
                <View style={styles.levelStats}>
                  <Text style={styles.levelTitle}>Nível Atual {currentLevel}</Text>
                  <Text style={styles.pointsText}>{currentPoints} XP Acumulados</Text>
                </View>
              </View>

              {/* Barra de Progresso */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                </View>
                <View style={styles.progressLabels}>
                  <Text style={styles.progressText}>{Math.round(progressPercent)}% concluído</Text>
                  <Text style={styles.progressPoints}>{currentPoints} / {nextLevelPoints} XP</Text>
                </View>
              </View>

              {pointsToNextLevel > 0 ? (
                <View style={styles.nextLevelTip}>
                  <Text style={styles.nextLevelTipText}>
                    Faltam <Text style={styles.nextLevelTipHighlight}>{pointsToNextLevel} pts</Text> para alcançar o <Text style={styles.nextLevelTipHighlight}>Nível {currentLevel + 1}</Text>!
                  </Text>
                </View>
              ) : (
                <View style={styles.nextLevelTip}>
                  <Text style={styles.nextLevelTipText}>Você atingiu o máximo de progresso deste nível!</Text>
                </View>
              )}
            </View>

            {/* 2. Próximos Passos */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Compass size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Próximos Passos</Text>
              </View>

              <View style={styles.tipsList}>
                {isListener ? (
                  <>
                    <View style={styles.tipItem}>
                      <Text style={styles.tipEmoji}>🤝</Text>
                      <Text style={styles.tipText}>Apoie novas pessoas em tempo real para acumular mais XP.</Text>
                    </View>
                    <View style={styles.tipItem}>
                      <Text style={styles.tipEmoji}>⭐</Text>
                      <Text style={styles.tipText}>Mantenha uma ótima avaliação ao fim das suas conversas.</Text>
                    </View>
                    <View style={styles.tipItem}>
                      <Text style={styles.tipEmoji}>🟢</Text>
                      <Text style={styles.tipText}>Fique online nos horários com mais pessoas buscando ajuda.</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.tipItem}>
                      <Text style={styles.tipEmoji}>💬</Text>
                      <Text style={styles.tipText}>Participe de novas sessões de acolhimento sempre que precisar.</Text>
                    </View>
                    <View style={styles.tipItem}>
                      <Text style={styles.tipEmoji}>🪙</Text>
                      <Text style={styles.tipText}>Reconheça seus apoiadores enviando retribuições e avaliações.</Text>
                    </View>
                    <View style={styles.tipItem}>
                      <Text style={styles.tipEmoji}>🚀</Text>
                      <Text style={styles.tipText}>Avance na sua jornada de bem-estar cuidando de você.</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* 3. Conquistas / Badges */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Award size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Galeria de Conquistas</Text>
              </View>

              <View style={styles.badgesGrid}>
                {activeAchievements.map((item) => {
                  const userMetric = isListener ? currentPoints : sessionsCount;
                  const isUnlocked = userMetric >= item.threshold;
                  const missingValue = item.threshold - userMetric;

                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.badgeCard,
                        !isUnlocked && styles.badgeCardLocked,
                      ]}
                    >
                      <View style={[styles.badgeIconBg, isUnlocked ? styles.badgeIconBgUnlocked : styles.badgeIconBgLocked]}>
                        <Text style={[styles.badgeIcon, !isUnlocked && styles.badgeIconLocked]}>{item.icon}</Text>
                        {!isUnlocked && (
                          <View style={styles.lockIconOverlay}>
                            <Lock size={12} color={colors.textMutedValue} />
                          </View>
                        )}
                      </View>

                      <View style={styles.badgeInfo}>
                        <Text style={[styles.badgeName, !isUnlocked && styles.badgeNameLocked]}>{item.name}</Text>
                        <Text style={styles.badgeDesc}>{item.desc}</Text>

                        {isUnlocked ? (
                          <View style={styles.unlockedTag}>
                            <Check size={10} color="#22C55E" style={{ marginRight: 2 }} />
                            <Text style={styles.unlockedTagText}>CONQUISTADO</Text>
                          </View>
                        ) : (
                          <View style={styles.lockedTag}>
                            <Text style={styles.lockedTagText}>
                              {isListener ? `Falta ${missingValue} pts` : `Falta ${missingValue} ${missingValue === 1 ? 'sessão' : 'sessões'}`}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 4. Ranking Top 10 */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Trophy size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Top 10 Apoiadores</Text>
              </View>

              {rankingLoading ? (
                <View style={styles.rankingStateWrap}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.rankingStateText}>Carregando ranking...</Text>
                </View>
              ) : rankingError ? (
                <View style={styles.rankingStateWrap}>
                  <Text style={styles.rankingErrorText}>{rankingError}</Text>
                </View>
              ) : ranking.length === 0 ? (
                <View style={styles.rankingStateWrap}>
                  <Text style={styles.rankingStateText}>Nenhum apoiador ranqueado no momento.</Text>
                </View>
              ) : (
                <View style={styles.rankingList}>
                  {ranking.map((user, idx) => {
                    const position = idx + 1;
                    const isTopThree = position <= 3;
                    const trophyMap: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

                    return (
                      <View key={user.id} style={styles.rankingItem}>
                        {/* Posição */}
                        <View style={styles.positionContainer}>
                          {isTopThree ? (
                            <Text style={styles.trophyText}>{trophyMap[position]}</Text>
                          ) : (
                            <Text style={styles.positionText}>{position}º</Text>
                          )}
                        </View>

                        {/* Avatar */}
                        <Avatar photoURL={user.photoURL} name={user.name} size="sm" />

                        {/* Dados */}
                        <View style={styles.rankingUserInfo}>
                          <Text style={styles.rankingName} numberOfLines={1}>
                            {user.name || 'Apoiador'}
                          </Text>
                          <Text style={styles.rankingSubtext}>Nível {user.level ?? 1}</Text>
                        </View>

                        {/* Pontuação */}
                        <View style={styles.rankingPointsWrap}>
                          <Text style={styles.rankingPointsText}>{user.points ?? 0}</Text>
                          <Text style={styles.rankingPointsLabel}>XP</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26,26,26,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
    maxHeight: '85%',
    minHeight: '50%',
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: typography.tracking.tight,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // 1. Card de Nível
  levelCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    padding: spacing.md,
    ...shadows.sm,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  levelBadgeContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    ...shadows.md,
  },
  levelBadgeText: {
    position: 'absolute',
    color: colors.textInverted,
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    marginTop: 2,
  },
  levelStats: {
    flex: 1,
  },
  levelTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.text,
  },
  pointsText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textMutedValue,
  },
  progressContainer: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  progressBarBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.background,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 5,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.textMutedValue,
  },
  progressPoints: {
    fontSize: 10,
    fontWeight: typography.weight.black,
    color: colors.primary,
  },
  nextLevelTip: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  nextLevelTipText: {
    fontSize: typography.size.xs + 1,
    color: colors.textMutedValue,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
  },
  nextLevelTipHighlight: {
    fontWeight: typography.weight.black,
    color: colors.primary,
  },

  // Seções Gerais
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.primaryLight,
    paddingBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: typography.tracking.tight,
  },

  // 2. Próximos Passos
  tipsList: {
    gap: spacing.sm,
  },
  tipItem: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  tipEmoji: {
    fontSize: 20,
  },
  tipText: {
    flex: 1,
    fontSize: typography.size.xs + 1,
    color: colors.textMutedValue,
    fontWeight: typography.weight.bold,
    lineHeight: 18,
  },

  // 3. Conquistas
  badgesGrid: {
    gap: spacing.sm,
  },
  badgeCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  badgeCardLocked: {
    backgroundColor: '#FAF9F9',
    borderColor: colors.border,
  },
  badgeIconBg: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badgeIconBgUnlocked: {
    backgroundColor: '#FFE9E0',
  },
  badgeIconBgLocked: {
    backgroundColor: '#EAEAEA',
  },
  badgeIcon: {
    fontSize: 26,
  },
  badgeIconLocked: {
    opacity: 0.35,
  },
  lockIconOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeInfo: {
    flex: 1,
    gap: 2,
  },
  badgeName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  badgeNameLocked: {
    color: 'rgba(26,26,26,0.6)',
  },
  badgeDesc: {
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 14,
  },
  unlockedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  unlockedTagText: {
    fontSize: 9,
    fontWeight: typography.weight.black,
    color: '#22C55E',
  },
  lockedTag: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  lockedTagText: {
    fontSize: 8,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
  },

  // 4. Ranking
  rankingStateWrap: {
    paddingVertical: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rankingStateText: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    fontWeight: typography.weight.semibold,
  },
  rankingErrorText: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.bold,
  },
  rankingList: {
    gap: spacing.sm,
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  positionContainer: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyText: {
    fontSize: 22,
  },
  positionText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
  },
  rankingUserInfo: {
    flex: 1,
    gap: 2,
  },
  rankingName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  rankingSubtext: {
    fontSize: 10,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
  },
  rankingPointsWrap: {
    alignItems: 'flex-end',
  },
  rankingPointsText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.primary,
  },
  rankingPointsLabel: {
    fontSize: 8,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
    textTransform: 'uppercase',
  },
});
