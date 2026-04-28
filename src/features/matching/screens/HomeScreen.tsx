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
} from 'react-native';
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
import { Avatar, BOTTOM_NAV_SCROLL_PAD } from '@shared/components';
import { BlackCard } from '@shared/components/BlackCard';
import { NoticeCard } from '@shared/components/NoticeCard';
import { StatsCard } from '@shared/components/StatsCard';
import { SegmentedControl } from '@shared/components/SegmentedControl';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Home'>;

// ─── Opções do SegmentedControl ─────────────────────────────────────
const ROLE_OPTIONS = [
  {
    value: 'speaker',
    label: 'Ouvir',
    icon: <Text style={{ fontSize: 14 }}>💬</Text>,
  },
  {
    value: 'listener',
    label: 'Apoiar',
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
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const isListener = profile?.role === 'listener';
  const name = profile?.name?.split(' ')[0] ?? 'amigo(a)';
  const initials = (profile?.name ?? 'U').charAt(0).toUpperCase();
  const coins = profile?.gratitudeCoins ?? 0;
  const streak = profile?.currentStreak ?? 0;
  const sessionCount = sessions.length;
  const rating = profile?.rating?.toFixed(1) ?? '5.0';
  const balance = profile?.balance ?? 0;
  const referralCode = profile?.referralCode ?? '—';

  // Sincroniza isOnline com o profile
  useEffect(() => {
    setIsOnline(profile?.isOnline ?? false);
  }, [profile?.isOnline]);

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
  const toggleOnlineStatus = async (value: boolean) => {
    if (!user) return;
    setIsOnline(value);
    try {
      await updateDoc(doc(db, 'users', user.uid), { isOnline: value });
    } catch {
      setIsOnline(!value);
    }
  };

  // ── Toggle de papel (Ouvir/Apoiar) ───────────────────────────────
  const handleRoleChange = useCallback(
    async (newRole: string) => {
      if (!user || !profile || isUpdatingRole) return;
      if (newRole === profile.role) return;
      setIsUpdatingRole(true);
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          role: newRole,
          isOnline: newRole === 'listener',
        });
      } finally {
        setIsUpdatingRole(false);
      }
    },
    [user, profile, isUpdatingRole]
  );

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

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        bounces
      >
        {/* ═══════════════════════════════════════════════════════════
            1. HEADER
        ═══════════════════════════════════════════════════════════ */}
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            {/* Avatar + saudação */}
            <TouchableOpacity style={styles.avatarBtn} activeOpacity={0.85}>
              <View style={styles.avatarBox}>
                {profile?.photoURL ? (
                  <Avatar photoURL={profile.photoURL} name={profile.name} size="sm" />
                ) : (
                  <View style={styles.avatarInitial}>
                    <Text style={styles.avatarInitialText}>{initials}</Text>
                  </View>
                )}
              </View>
              <View style={styles.headerText}>
                <Text style={styles.greeting}>
                  OLÁ, {name.toUpperCase()}!
                </Text>
                <Text style={styles.greetingSub}>O seu melhor começa aqui</Text>
              </View>
            </TouchableOpacity>

            {/* Stats + Sino */}
            <View style={styles.headerRight}>
              {/* Streak + Moedas */}
              <TouchableOpacity style={styles.miniStats}>
                <View style={styles.miniStat}>
                  <Flame size={11} color="#F97316" fill="#F97316" />
                  <Text style={styles.miniStatText}>{streak}</Text>
                </View>
                <View style={styles.miniStat}>
                  <Coins size={11} color={colors.coins} />
                  <Text style={styles.miniStatText}>{coins}</Text>
                </View>
              </TouchableOpacity>

              {/* Toggle Online (apenas listener, no header) */}
              {isListener && (
                <View style={styles.onlineRow}>
                  <Switch
                    value={isOnline}
                    onValueChange={toggleOnlineStatus}
                    trackColor={{ false: 'rgba(26,26,26,0.1)', true: '#22C55E' }}
                    thumbColor={colors.surface}
                    style={styles.switch}
                  />
                  <Text style={[styles.onlineTxt, isOnline && styles.onlineTxtActive]}>
                    {isOnline ? 'ON' : 'OFF'}
                  </Text>
                </View>
              )}

              {/* Sino */}
              <TouchableOpacity style={styles.bellBtn}>
                <Bell size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

        <View style={styles.content}>

          {/* ═══════════════════════════════════════════════════════
              2. SEGMENTED CONTROL — Ouvir / Apoiar
          ═══════════════════════════════════════════════════════ */}
          <View style={styles.segmentWrap}>
            <SegmentedControl
              options={ROLE_OPTIONS}
              value={profile?.role ?? 'speaker'}
              onChange={handleRoleChange}
              disabled={isUpdatingRole}
            />
            <Text style={styles.segmentHint}>Vire a chave aqui!</Text>
          </View>

          {/* ═══════════════════════════════════════════════════════
              3. NOTICE CARD — Aviso Importante
          ═══════════════════════════════════════════════════════ */}
          <NoticeCard
            body="Somos uma rede de acolhimento formada por voluntários."
            highlight="Não use em emergências."
          />

          {/* ═══════════════════════════════════════════════════════
              4. BLACK CARD — Disponibilidade (listener) / Progresso (speaker)
          ═══════════════════════════════════════════════════════ */}
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
            <BlackCard
              icon={<Trophy size={34} color={colors.textInverted} strokeWidth={1.8} />}
              label="Speaker"
              title="Seu Progresso"
              subtitle="Acompanhe seu nível e medalhas conquistadas."
              actionLabel="Ver Jornada →"
              onAction={() => {}}
            />
          )}

          {/* ═══════════════════════════════════════════════════════
              5. STATS — lista vertical
          ═══════════════════════════════════════════════════════ */}
          <View style={styles.statsCol}>
            <StatsCard
              label="Sessões"
              value={String(sessionCount)}
              icon={<History size={20} color={colors.primary} strokeWidth={2} />}
            />
            <StatsCard
              label="Avaliação"
              value={rating}
              icon={<Star size={20} color={colors.primary} strokeWidth={2} />}
            />
            <StatsCard
              label={isListener ? 'Gorjeta Atual' : 'Saldo'}
              value={`R$${balance}`}
              subValue={isListener ? `TOTAL ACUMULADO: R$${profile?.totalEarnings ?? 0}` : undefined}
              icon={<CreditCard size={20} color={colors.primary} strokeWidth={2} />}
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
              <TouchableOpacity>
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
                <SessionRow key={s.id} session={s} />
              ))
            )}

            {/* Recentes */}
            {recent.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>
                  ⏱ SESSÕES RECENTES
                </Text>
                {recent.slice(0, 3).map((s) => (
                  <SessionRow key={s.id} session={s} isRecent />
                ))}
              </>
            )}
          </View>

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
function SessionRow({ session, isRecent }: { session: any; isRecent?: boolean }) {
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
    <View style={row.container}>
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
    </View>
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
