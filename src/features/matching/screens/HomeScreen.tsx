/**
 * HomeScreen — Dashboard principal do usuário
 * Layout fiel à versão mobile web (meu.best)
 *
 * Seções (scroll vertical):
 * 1. Header — avatar (inicial), saudação, moedas/streak, sino
 * 2. SegmentedControl — Ouvir / Apoiar
 * 3. Toggle Online (apenas listener)
 * 4. NoticeCard — Aviso Importante
 * 5. BlackCard — Disponibilidade (listener) ou Progresso (speaker)
 * 6. Stats Row — Sessões, Avaliação, Gorjeta/Saldo
 * 7. Sessões Card — próximas e recentes
 * 8. BlackCard — Indique um Amigo
 * 9. Dicas de Segurança
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  StatusBar,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SESSION_THEMES } from '@constants/config';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  Flame,
  Coins,
  History,
  Star,
  CreditCard,
  Calendar,
  Trophy,
  Gift,
  ShieldCheck,
  Video,
  ChevronRight,
} from 'lucide-react-native';
import { doc, updateDoc, collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '@navigation/types';
import { db } from '@shared/services/firebase';
import { useAuth } from '@features/auth/hooks/useAuth';
import { Avatar, BlackCard, NoticeCard, StatsCard, SegmentedControl, BOTTOM_NAV_SCROLL_PAD, StartModal } from '@shared/components';
import { TabHeader } from '@shared/components/TabHeader';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { getWalletSummary } from '@shared/services/paymentService';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Home'>;

// ─── Opções do SegmentedControl ─────────────────────────────────────
const ROLE_OPTIONS = [
  {
    value: 'speaker',
    label: 'Desabafar',
    icon: <Text style={{ fontSize: 14 }}>💬</Text>,
  },
  {
    value: 'listener',
    label: 'Acolher',
    icon: <Text style={{ fontSize: 14 }}>❤️</Text>,
  },
];

// ─── Dicas de Segurança ─────────────────────────────────────────────
const SAFETY_TIPS = [
  'Nunca compartilhe dados bancários fora da plataforma.',
  'Mantenha as conversas dentro do ambiente seguro.',
  'Denuncie qualquer comportamento inadequado.',
];

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user, profile } = useAuth();
  const [isOnline, setIsOnline] = useState(profile?.isOnline ?? false);
  const [sessions, setSessions] = useState<any[]>([]);
  // Estado do modal de seleção de tema (card "Início Rápido")
  const [startModalVisible, setStartModalVisible] = useState(false);

  // Estados para o Card de Temas que você apoia (Task 10)
  const [isEditingThemes, setIsEditingThemes] = useState(false);
  const [editableInterests, setEditableInterests] = useState<string[]>([]);
  const [isSavingThemes, setIsSavingThemes] = useState(false);


  const isListener = profile?.role === 'listener';
  const name = profile?.name?.split(' ')[0] ?? 'amigo(a)';
  const initials = (profile?.name ?? 'U').charAt(0).toUpperCase();
  const coins = profile?.gratitudeCoins ?? 0;
  const streak = profile?.currentStreak ?? 0;
  const sessionCount = sessions.length;
  const rating = profile?.rating?.toFixed(1) ?? '5.0';
  const balance = profile?.balance ?? 0;
  const referralCode = profile?.referralCode ?? '—';

  const [walletSummary, setWalletSummary] = useState<any>(null);

  // Sincroniza isOnline com o profile
  useEffect(() => {
    setIsOnline(profile?.isOnline ?? false);
  }, [profile?.isOnline]);

  // Carrega walletSummary quando focado e no mount
  useEffect(() => {
    let active = true;
    const fetchSummary = async () => {
      try {
        const res = await getWalletSummary();
        if (active) setWalletSummary(res);
      } catch (err) {
        console.error('Error fetching summary on Home:', err);
      }
    };
    fetchSummary();
    
    const focusUnsub = navigation.addListener('focus', fetchSummary);
    return () => {
      active = false;
      focusUnsub();
    };
  }, [navigation]);

  // Escuta sessões do usuário
  useEffect(() => {
    if (!user || !profile) return;
    const q = query(
      collection(db, 'sessions'),
      where(profile.role === 'speaker' ? 'speakerId' : 'listenerId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsub = onSnapshot(q, (snap) => {
      setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user, profile?.role]);

  // ── Toggle Online ─────────────────────────────────────────────────
  // Mantido para referência local — lógica principal centralizada no TabHeader
  const toggleOnlineStatus = async (value: boolean) => {
    if (!user) return;
    setIsOnline(value);
    try {
      await updateDoc(doc(db, 'users', user.uid), { isOnline: value });
    } catch {
      setIsOnline(!value);
    }
  };

  // ── Temas de Apoio (Task 10) ──────────────────────────────────────
  const handleToggleTheme = useCallback((themeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditableInterests((prev) =>
      prev.includes(themeId) ? prev.filter((id) => id !== themeId) : [...prev, themeId]
    );
  }, []);

  const handleStartEditThemes = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Aceita aliases antigos por segurança
    const topics = profile?.interests || (profile as any)?.selectedTopics || (profile as any)?.temasInteresse || [];
    setEditableInterests(topics);
    setIsEditingThemes(true);
  }, [profile]);

  const handleCancelEditThemes = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsEditingThemes(false);
    setEditableInterests([]);
  }, []);

  const handleSaveThemes = useCallback(async () => {
    if (!user?.uid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSavingThemes(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        interests: editableInterests,
      });
      setIsEditingThemes(false);
      Alert.alert('Sucesso', 'Temas de apoio atualizados com sucesso!');
    } catch (err) {
      console.error('[HomeScreen] Erro ao salvar temas:', err);
      Alert.alert('Erro', 'Não foi possível salvar os temas. Tente novamente.');
    } finally {
      setIsSavingThemes(false);
    }
  }, [user?.uid, editableInterests]);

  const hasThemeChanges = isEditingThemes && 
    JSON.stringify([...editableInterests].sort()) !== JSON.stringify([...(profile?.interests || (profile as any)?.selectedTopics || (profile as any)?.temasInteresse || [])].sort());

  // NOTA: handleRoleChange foi removido desta tela.
  // A lógica de troca de papel (Ouvir/Apoiar) e persistência de isOnline
  // está centralizada no TabHeader para evitar race condition no Firestore.


  // ── Compartilhar código referral ─────────────────────────────────
  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Entre no Meu Best com meu código e receba apoio voluntário! Código: ${referralCode} — https://meu.best`,
        title: 'Indique um Amigo — Meu Best',
      });
    } catch {}
  }, [referralCode]);

  // ── Sessões próximas e recentes ─────────────────────────────────
  const upcoming = sessions.filter(
    (s) => s.status === 'active' || s.status === 'pending'
  );
  const recent = sessions.filter((s) => s.status === 'completed');

  const handleSessionPress = useCallback((s: any) => {
    if (s.status === 'active' || s.status === 'pending') {
      (navigation as any).navigate('Session', { sessionId: s.id });
    }
  }, [navigation]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        bounces
      >
        {/* ═══════════════════════════════════════════════════════════
            1-3. HEADER PADRÃO (avatar, segmented, online, notice)
        ═══════════════════════════════════════════════════════════ */}
        <TabHeader />

        <View style={styles.content}>

          {/* ═══════════════════════════════════════════════════════
              4. CARDS DE AÇÃO
              - Listener: BlackCard Disponibilidade (como antes)
              - Speaker: Início Rápido + Agendar Momento
          ═══════════════════════════════════════════════ */}
          {isListener ? (
            <BlackCard
              icon={<Calendar size={34} color={colors.textInverted} strokeWidth={1.8} />}
              label="Listener"
              title="Minha Disponibilidade"
              subtitle="Defina os dias e horários que você pode apoiar outras pessoas."
              actionLabel="Gerenciar"
              actionIcon={<Text style={{ fontSize: 14 }}>⚙️</Text>}
              onAction={() => {}}
            />
          ) : (
            // Modo Ouvir: Início Rápido + Agendar Momento
            <View style={styles.speakerCards}>

              {/* ─── Card Início Rápido ─────────────────────────────── */}
              <TouchableOpacity
                style={[styles.quickStartCard, shadows.sm]}
                onPress={() => setStartModalVisible(true)}
                activeOpacity={0.88}
              >
                <View style={styles.quickStartBgBlob} />
                <View style={styles.quickStartIconWrap}>
                  <Flame size={26} color={colors.primary} strokeWidth={1.8} />
                </View>
                <View style={styles.quickStartContent}>
                  <Text style={styles.quickStartTitle}>INÍCIO RÁPIDO</Text>
                  <Text style={styles.quickStartSubtitle}>
                    Precisa desabafar agora? Escolha um tema e comece.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.quickStartBtn}
                  onPress={() => setStartModalVisible(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.quickStartBtnText}>DESABAFAR AGORA →</Text>
                </TouchableOpacity>
              </TouchableOpacity>

              {/* ─── Card Agendar Momento ───────────────────────────── */}
              <TouchableOpacity
                style={[styles.scheduleCard, shadows.sm]}
                onPress={() => navigation.navigate('ScheduleMatch', {})}
                activeOpacity={0.88}
              >
                <View style={styles.scheduleBgBlob} />
                <View style={styles.scheduleIconWrap}>
                  <Calendar size={26} color={colors.textInverted} strokeWidth={1.8} />
                </View>
                <View style={styles.scheduleContent}>
                  <Text style={styles.scheduleTitle}>AGENDAR MOMENTO</Text>
                  <Text style={styles.scheduleSubtitle}>
                    Prefere marcar um horário? Escolha quem você quer ouvir.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.scheduleBtn}
                  onPress={() => navigation.navigate('ScheduleMatch', {})}
                  activeOpacity={0.85}
                >
                  <Text style={styles.scheduleBtnText}>AGENDAR →</Text>
                </TouchableOpacity>
              </TouchableOpacity>

            </View>
          )}

          {/* StartModal — mesmo fluxo do botão central COMEÇAR */}
          <StartModal
            visible={startModalVisible}
            onClose={() => setStartModalVisible(false)}
            onSelectTheme={(theme) => {
              setStartModalVisible(false);
              navigation.navigate('MatchSearch', { category: theme });
            }}
          />


          {/* ═══════════════════════════════════════════════════════
              5. STATS — lista vertical
          ═══════════════════════════════════════════════════════ */}
          <View style={styles.statsCol}>
            <StatsCard
              label="Sessões"
              value={String(sessionCount)}
              icon={<History size={20} color={colors.primary} strokeWidth={2} />}
              onPress={() => (navigation as any).navigate('SessionsTab')}
            />
            <StatsCard
              label="Avaliação"
              value={rating}
              icon={<Star size={20} color={colors.primary} strokeWidth={2} />}
            />
            <StatsCard
              label={isListener ? 'Retribuição Atual' : 'Saldo Recebido'}
              value={walletSummary === null ? 'Carregando...' : `R$${(walletSummary.balanceRewards ?? 0).toFixed(2)}`}
              subValue={isListener && walletSummary !== null ? `TOTAL ACUMULADO: R$${(walletSummary.totalTipsReceived ?? 0).toFixed(2)}` : undefined}
              icon={<CreditCard size={20} color={colors.primary} strokeWidth={2} />}
              onPress={() => (navigation as any).navigate('WalletTab')}
            />
          </View>

          {/* ═══════════════════════════════════════════════════════
              6. SESSÕES CARD
          ═══════════════════════════════════════════════════════ */}
          <View style={[styles.sessionsCard, shadows.sm]}>
            {/* Header do card */}
            <View style={styles.sessionsHeader}>
              <View style={styles.sessionsHeaderLeft}>
                <Video size={18} color={colors.primary} />
                <Text style={styles.sessionsTitle}>SESSÕES</Text>
              </View>
              <TouchableOpacity onPress={() => (navigation as any).navigate('SessionsTab')}>
                <Text style={styles.sessionsVerTudo}>VER TUDO</Text>
              </TouchableOpacity>
            </View>

            {/* Próximas */}
            <Text style={styles.sectionLabel}>● PRÓXIMAS SESSÕES</Text>
            {upcoming.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>NENHUMA SESSÃO AGENDADA PARA AGORA.</Text>
              </View>
            ) : (
              upcoming.slice(0, 2).map((s) => (
                <SessionRow key={s.id} session={s} onPress={() => handleSessionPress(s)} />
              ))
            )}

            {/* Recentes */}
            {recent.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>
                  ⏱ SESSÕES RECENTES
                </Text>
                {recent.slice(0, 3).map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    isRecent
                    onPress={() => (navigation as any).navigate('SessionsTab', {
                      screen: 'SessionDetail',
                      params: { sessionId: s.id },
                    })}
                  />
                ))}
              </>
            )}
          </View>

          {/* ═══════════════════════════════════════════════════════
              6.5. CARD TEMAS QUE VOCÊ APOIA (Apenas modo Apoiar)
          ═══════════════════════════════════════════════════════ */}
          {isListener && (
            <View style={[styles.themesCard, shadows.sm]}>
              <View style={styles.themesHeader}>
                <View style={styles.themesHeaderIconWrap}>
                  <Flame size={20} color={colors.primary} strokeWidth={2} />
                </View>
                <Text style={styles.themesTitle}>TEMAS QUE VOCÊ APOIA</Text>
              </View>
              <Text style={styles.themesSubtitle}>
                Escolha os assuntos em que você se sente preparado para acolher.
              </Text>

              {isEditingThemes ? (
                // ─── ESTADO EDIÇÃO ───
                <>
                  <View style={styles.themesGrid}>
                    {SESSION_THEMES.map((theme) => {
                      const isSelected = editableInterests.includes(theme.id);
                      return (
                        <TouchableOpacity
                          key={theme.id}
                          activeOpacity={0.8}
                          onPress={() => handleToggleTheme(theme.id)}
                          style={[styles.themePill, isSelected && styles.themePillActive]}
                        >
                          <Text style={[styles.themePillText, isSelected && styles.themePillTextActive]}>
                            {theme.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.themesActions}>
                    <TouchableOpacity
                      style={styles.btnCancelThemes}
                      onPress={handleCancelEditThemes}
                      disabled={isSavingThemes}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btnCancelThemesText}>CANCELAR</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.btnSaveThemes,
                        (!hasThemeChanges || isSavingThemes) && styles.btnSaveThemesDisabled,
                      ]}
                      onPress={handleSaveThemes}
                      disabled={!hasThemeChanges || isSavingThemes}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.btnSaveThemesText}>
                        {isSavingThemes ? 'SALVANDO...' : 'SALVAR'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                // ─── ESTADO LEITURA ───
                <>
                  <View style={styles.themesGrid}>
                    {profile?.interests && profile.interests.length > 0 ? (
                      SESSION_THEMES.filter((t) => (profile.interests ?? []).includes(t.id)).map((theme) => (
                        <View key={theme.id} style={[styles.themePill, styles.themePillActive]}>
                          <Text style={[styles.themePillText, styles.themePillTextActive]}>{theme.label}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noThemesText}>Nenhum tema selecionado ainda.</Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.btnEditThemes}
                    onPress={handleStartEditThemes}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnEditThemesText}>EDITAR TEMAS</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════
              7. BLACK CARD — Indique um Amigo
          ═══════════════════════════════════════════════════════ */}
          <BlackCard
            icon={<Gift size={34} color={colors.textInverted} strokeWidth={1.8} />}
            label="Recompensas"
            title="Indique um Amigo"
            subtitle="Espalhe o bem! Ganhe 50 Moedas de Gratidão por indicação!"
          >
            {/* Código + botão */}
            <View style={styles.referralBox}>
              <View style={styles.referralCode}>
                <Text style={styles.referralLabel}>SEU CÓDIGO</Text>
                <Text style={styles.referralValue}>{referralCode}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.inviteBtn}
              onPress={handleShare}
              activeOpacity={0.85}
            >
              <Text style={styles.inviteBtnText}>CONVIDAR AGORA →</Text>
            </TouchableOpacity>
          </BlackCard>

          {/* ═══════════════════════════════════════════════════════
              8. DICAS DE SEGURANÇA
          ═══════════════════════════════════════════════════════ */}
          <View style={[styles.safetyCard, shadows.sm]}>
            <View style={styles.safetyHeader}>
              <ShieldCheck size={18} color={colors.primary} />
              <Text style={styles.safetyTitle}>DICAS DE SEGURANÇA</Text>
            </View>
            {SAFETY_TIPS.map((tip, i) => (
              <View key={i} style={styles.safetyRow}>
                <View style={styles.safetyNum}>
                  <Text style={styles.safetyNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.safetyTip}>{tip}</Text>
              </View>
            ))}
          </View>

          {/* Espaço para o BottomNav — usa constante da própria barra */}
          <View style={{ height: BOTTOM_NAV_SCROLL_PAD + 16 }} />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── SessionRow ─────────────────────────────────────────────────────
function SessionRow({ session, isRecent, onPress }: { session: any; isRecent?: boolean; onPress?: () => void }) {
  const dateStr = session.selectedTime
    ? new Date(session.selectedTime).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const statusLabel: Record<string, string> = {
    active: 'ATIVA',
    pending: 'AGUARDANDO',
    completed: 'CONCLUÍDA',
    rejected: 'CANCELADA',
  };

  const statusColor: Record<string, string> = {
    active: '#22C55E',
    pending: colors.coins,
    completed: '#3B82F6',
    rejected: '#9CA3AF',
  };

  return (
    <TouchableOpacity 
      style={row.container} 
      onPress={onPress} 
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={row.iconWrap}>
        <Video size={16} color={colors.primary} />
      </View>
      <View style={row.info}>
        <Text style={row.category}>{session.category?.toUpperCase() ?? '—'}</Text>
        <Text style={row.date}>{dateStr}</Text>
      </View>
      <View style={[row.badge, { backgroundColor: `${statusColor[session.status] ?? '#9CA3AF'}18` }]}>
        <Text style={[row.badgeText, { color: statusColor[session.status] ?? '#9CA3AF' }]}>
          {statusLabel[session.status] ?? session.status}
        </Text>
      </View>
      <ChevronRight size={16} color={colors.textMutedValue} />
    </TouchableOpacity>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.primaryLight,
  },
  avatarBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  avatarBox: {},
  avatarInitial: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '6deg' }],
    ...shadows.sm,
  },
  avatarInitialText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
  },
  headerText: { flex: 1 },
  greeting: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: typography.tracking.tight,
    lineHeight: 20,
  },
  greetingSub: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.textMutedValue,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.widest,
    marginTop: 1,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  miniStats: { alignItems: 'flex-end', gap: 1 },
  miniStat: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  miniStatText: {
    fontSize: 9,
    fontWeight: typography.weight.black,
    color: colors.text,
  },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  switch: { transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] },
  onlineTxt: {
    fontSize: 9,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
    textTransform: 'uppercase',
  },
  onlineTxtActive: { color: '#22C55E' },
  bellBtn: {
    padding: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.primaryLight,
  },

  // Content
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },

  // Segmented control + hint
  segmentWrap: { alignItems: 'center', gap: spacing.xs + 2 },
  segmentHint: {
    fontFamily: 'Caveat-Regular', // se disponível, senão fallback
    fontSize: typography.size.lg,
    color: colors.primary,
  },

  // Stats em coluna vertical
  statsCol: {
    gap: spacing.sm,
  },

  // Sessões card
  sessionsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 3,
    borderColor: colors.primaryLight,
    padding: spacing.xl,
    gap: spacing.md,
  },
  sessionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sessionsTitle: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: typography.tracking.tight,
  },
  sessionsVerTudo: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary,
    letterSpacing: typography.tracking.wide,
  },
  sectionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
    letterSpacing: typography.tracking.wider,
  },
  emptyState: {
    backgroundColor: 'rgba(26,26,26,0.03)',
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textMutedValue,
    letterSpacing: typography.tracking.wide,
  },

  // Referral
  referralBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: spacing.md,
    alignSelf: 'stretch',
  },
  referralCode: { flex: 1 },
  referralLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: typography.tracking.widest,
  },
  referralValue: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.widest,
  },
  inviteBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignSelf: 'stretch',
    alignItems: 'center',
    ...shadows.primary,
  },
  inviteBtnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.widest,
  },

  // Safety
  safetyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
  },
  safetyHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  safetyTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: typography.tracking.tight,
  },
  safetyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  safetyNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  safetyNumText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  safetyTip: {
    fontSize: typography.size.base,
    color: colors.text,
    lineHeight: 22,
    fontWeight: typography.weight.medium,
    flex: 1,
  },

  // ─── Cards de Ação — Modo Ouvir ─────────────────────────────────
  speakerCards: {
    gap: spacing.md,
  },

  // Card Início Rápido (light, borda primária)
  quickStartCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: spacing.lg,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  quickStartBgBlob: {
    position: 'absolute',
    top: -24,
    right: -24,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.primary}12`,
  },
  quickStartIconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickStartContent: { gap: 4 },
  quickStartTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: typography.tracking.tight,
  },
  quickStartSubtitle: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 18,
  },
  quickStartBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    ...shadows.primary,
  },
  quickStartBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.wider,
  },

  // Card Agendar Momento (dark)
  scheduleCard: {
    backgroundColor: colors.dark ?? '#1A1A1A',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  scheduleBgBlob: {
    position: 'absolute',
    top: -24,
    right: -24,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  scheduleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleContent: { gap: 4 },
  scheduleTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.tight,
  },
  scheduleSubtitle: {
    fontSize: typography.size.sm,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: typography.weight.medium,
    lineHeight: 18,
  },
  scheduleBtn: {
    backgroundColor: colors.textInverted,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  scheduleBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.dark ?? '#1A1A1A',
    letterSpacing: typography.tracking.wider,
  },

  // ── Temas que você apoia Card (Task 10) ──
  themesCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 3,
    borderColor: colors.primaryLight,
    padding: spacing.xl,
    gap: spacing.md,
  },
  themesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  themesHeaderIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themesTitle: {
    fontSize: typography.size.xxl - 2,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: typography.tracking.tight,
  },
  themesSubtitle: {
    fontSize: typography.size.xs + 1,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  themesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  themePill: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.sm,
  },
  themePillRead: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
  },
  themePillText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.text,
    letterSpacing: 0.5,
  },
  themePillTextActive: {
    color: colors.textInverted,
  },
  themePillTextRead: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  noThemesText: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    fontWeight: typography.weight.bold,
    fontStyle: 'italic',
    paddingVertical: spacing.xs,
  },
  themesActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  btnCancelThemes: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: spacing.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelThemesText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: typography.tracking.wider,
  },
  btnSaveThemes: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.primary,
  },
  btnSaveThemesDisabled: {
    backgroundColor: colors.primaryLight,
    borderColor: 'transparent',
    opacity: 0.6,
  },
  btnSaveThemesText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.wider,
  },
  btnEditThemes: {
    backgroundColor: colors.dark ?? '#1A1A1A',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    ...shadows.sm,
  },
  btnEditThemesText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.wider,
  },
});



const row = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: { flex: 1 },
  category: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: 0.3,
  },
  date: {
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
  },
});
