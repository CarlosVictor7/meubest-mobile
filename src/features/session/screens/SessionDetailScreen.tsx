/**
 * SessionDetailScreen — Detalhe de uma sessão (concluída OU agendada)
 *
 * Exibe dados reais da sessão (Firestore):
 * - Tema/categoria, status, data/hora, duração
 * - Nome do speaker e listener
 * - Avaliação (estrelas + comentário) se existir
 *
 * Sessão AGENDADA (26/08 — modelo de solicitação) ganha ações, todas pela API:
 * - ENTRAR (dentro da janela → POST /join → VideoRoom; 409 = alerta)
 * - ACEITAR / RECUSAR (pending e eu sou o acolhedor)
 * - CANCELAR AGENDAMENTO (pending/accepted, com confirmação)
 * - ADICIONAR AO CALENDÁRIO (confirmada; deep link do Google Calendar)
 * Push de aceite/recusa/cancelamento/lembrete cai aqui — nunca na sala.
 *
 * Visual fiel ao padrão Meu Best: card branco, borda laranja, tipografia forte.
 *
 * ┌── Safe area: por que o header ficava embaixo da status bar ─────────────────┐
 * │ Esta tela importava `SafeAreaView` do **react-native**. Esse componente só  │
 * │ faz algo no iOS — no Android ele é um `View` comum, sem inset nenhum.       │
 * │                                                                            │
 * │ Com `edgeToEdgeEnabled` ligado (app.config), o Android desenha o conteúdo   │
 * │ sob a status bar por padrão. O resultado era o header colado no relógio e   │
 * │ o botão de voltar parcialmente coberto — pior em aparelhos com câmera       │
 * │ centralizada, onde o recorte invade a área do título.                       │
 * │                                                                            │
 * │ A correção usa `SafeAreaView` do **react-native-safe-area-context**, que    │
 * │ aplica o inset real do dispositivo nas duas plataformas. `edges={['top']}`  │
 * │ deixa a borda inferior por conta do BottomNav, que já tem folga própria —   │
 * │ pedir 'bottom' aqui somaria padding duas vezes.                             │
 * │                                                                            │
 * │ Nada de `paddingTop` fixo: o inset varia entre notch, Dynamic Island e      │
 * │ status bar comum.                                                          │
 * └────────────────────────────────────────────────────────────────────────────┘
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
  Linking,
} from 'react-native';
// SafeAreaView do react-native é NO-OP no Android — ver o bloco de doc no topo.
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Calendar,
  Clock,
  User,
  Star,
  ChevronLeft,
  Video,
  ShieldCheck,
  MessageCircle,
  CalendarPlus,
  Check,
  X,
  LogIn,
  XCircle,
  Hourglass,
} from 'lucide-react-native';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { db } from '@shared/services/firebase';
import { useAuth } from '@features/auth/hooks/useAuth';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { FINANCIAL_FEATURES_ENABLED } from '@shared/constants/platformFeatures';
import { getCounterpart, publicCounterpartName } from '@features/session/utils/sessionFilters';
import {
  sessionStatusColor,
  sessionStatusLabel,
  isCancellableScheduled,
} from '@features/session/utils/sessionStatus';
import { canJoinSession, describeJoinReason } from '@features/session/utils/sessionWindow';
import { formatScheduleWhen } from '@features/session/utils/scheduleFormat';
import { useJoinSession } from '@features/session/hooks/useJoinSession';
import {
  acceptScheduledSession,
  rejectScheduledSession,
  cancelScheduledSession,
} from '@features/session/services/scheduling';
import { googleCalendarUrl } from '@shared/utils/calendarLink';
import { BOTTOM_NAV_SCROLL_PAD } from '@shared/components';

type DetailAction = 'accept' | 'reject' | 'cancel' | null;

export function SessionDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId } = route.params;
  const { user } = useAuth();

  const [session, setSession]   = useState<any>(null);
  const [review, setReview]     = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState<DetailAction>(null);
  const { join, joining }       = useJoinSession();

  /** Relê a sessão (getDoc) — usado no mount e depois de cada ação via API. */
  const reloadSession = useCallback(async () => {
    const sessionSnap = await getDoc(doc(db, 'sessions', sessionId));
    if (!sessionSnap.exists()) return null;
    const data = { id: sessionSnap.id, ...sessionSnap.data() };
    setSession(data);
    return data;
  }, [sessionId]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        // 1. Busca sessão
        const sessionSnap = await getDoc(doc(db, 'sessions', sessionId));
        if (!sessionSnap.exists() || !active) { setLoading(false); return; }
        const sessionData = { id: sessionSnap.id, ...sessionSnap.data() };
        setSession(sessionData);

        // 2. Busca avaliação vinculada à sessão (pode não existir)
        const reviewsSnap = await getDocs(
          query(
            collection(db, 'reviews'),
            where('sessionId', '==', sessionId),
            limit(1)
          )
        );
        if (!reviewsSnap.empty && active) {
          setReview({ id: reviewsSnap.docs[0].id, ...reviewsSnap.docs[0].data() });
        }
      } catch (err) {
        if (__DEV__) console.error('[SessionDetail] error:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [sessionId]);

  // ── Ações de agendamento (API) — guard de duplo toque via `acting` ─────────
  const runAction = useCallback(
    async (action: Exclude<DetailAction, null>, fn: () => Promise<unknown>, onDone?: () => void) => {
      if (acting) return;
      setActing(action);
      try {
        await fn();
        await reloadSession();
        onDone?.();
      } catch (err: any) {
        Alert.alert('Não foi possível concluir', err?.message || 'Tente novamente.');
        // Estado pode ter mudado por fora (409/404): reflete o que está no banco.
        reloadSession().catch(() => {});
      } finally {
        setActing(null);
      }
    },
    [acting, reloadSession]
  );

  const handleAccept = () =>
    runAction('accept', () => acceptScheduledSession(sessionId), () => {
      const when = formatScheduleWhen(session?.selectedTime);
      Alert.alert(
        'Agendamento aceito',
        when
          ? `Conversa marcada para ${when.day} às ${when.time}. A sala abre 15 minutos antes.`
          : 'Conversa confirmada.'
      );
    });

  const handleReject = () =>
    Alert.alert('Recusar solicitação?', 'A pessoa será avisada de que este horário não deu.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Recusar',
        style: 'destructive',
        onPress: () => runAction('reject', () => rejectScheduledSession(sessionId)),
      },
    ]);

  const handleCancel = () =>
    Alert.alert('Cancelar agendamento?', 'O outro participante será avisado do cancelamento.', [
      { text: 'Manter', style: 'cancel' },
      {
        text: 'Cancelar agendamento',
        style: 'destructive',
        onPress: () => runAction('cancel', () => cancelScheduledSession(sessionId)),
      },
    ]);

  const handleAddToCalendar = async () => {
    if (!session?.selectedTime) return;
    const other = publicCounterpartName(session, user?.uid, 'Meu Best');
    const url = googleCalendarUrl({
      title: `Meu Best — Conversa com ${other}`,
      start: session.selectedTime,
      durationMinutes: session.duration,
      details: `Tema: ${session.category ?? 'Conversa'}\nEntre no app Meu Best até 15 minutos antes do horário.`,
    });
    if (!url) {
      Alert.alert('Não foi possível', 'Horário inválido para o calendário.');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Não foi possível abrir o calendário', 'Verifique se há um navegador ou o app do Google Agenda instalado.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando detalhes...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <SafeAreaView edges={['top']} style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Sessão não encontrada.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Derivados da sessão ──────────────────────────────────────────────────
  const status      = session.status ?? 'completed';
  const statusLabel = sessionStatusLabel(status);
  const statusColor = sessionStatusColor(status);
  const category    = (session.category ?? session.theme ?? '—').toUpperCase();

  const rawDate = session.selectedTime ?? session.createdAt?.toDate?.();
  const dateStr = rawDate
    ? new Date(rawDate).toLocaleDateString('pt-BR', {
        day:    '2-digit',
        month:  'long',
        year:   'numeric',
        hour:   '2-digit',
        minute: '2-digit',
      })
    : '—';

  const duration = session.actualDuration
    ? `${session.actualDuration} min`
    : session.duration
    ? `${session.duration} min`
    : session.durationMinutes
    ? `${session.durationMinutes} min`
    : '—';

  const isSpeaker    = user?.uid === session.speakerId;
  const isListener   = !!user?.uid && user.uid === session.listenerId;
  const isParticipant = isSpeaker || isListener;
  const counterpart  = getCounterpart(session, user?.uid);

  // ── Ações disponíveis (sessão agendada) ────────────────────────────────────
  const isScheduled   = session.type === 'scheduled';
  const joinDecision  = canJoinSession(session);
  const showAcceptReject = isScheduled && status === 'pending' && isListener;
  const showJoin      = isScheduled && isParticipant && (status === 'accepted' || status === 'active');
  const showCancel    = isParticipant && isCancellableScheduled(session);
  // Confirmada = accepted, ou active legado (aceite do web antigo, sem startedAt).
  const isConfirmed   = isScheduled && (status === 'accepted' || (status === 'active' && !session.startedAt));
  const showCalendar  = isConfirmed && isParticipant && !!session.selectedTime;
  const waitingOther  = isScheduled && status === 'pending' && isSpeaker;
  const isJoining     = joining === sessionId;
  // O OUTRO participante aparece sempre pelo nome público ("Ana S."), mesmo em
  // sessões legadas que gravaram o nome completo. O próprio nome fica como está.
  const speakerName  = isSpeaker
    ? session.speakerName ?? 'Ouvinte'
    : publicCounterpartName(session, user?.uid, 'Ouvinte');
  const listenerName = isSpeaker
    ? publicCounterpartName(session, user?.uid, 'Apoiador')
    : session.listenerName ?? 'Apoiador';
  const sessionIdShort = sessionId.slice(0, 8).toUpperCase();

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* ── Header com voltar ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ChevronLeft size={22} color={colors.primary} strokeWidth={2.5} />
          <Text style={styles.headerBackText}>Histórico</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>DETALHE DA SESSÃO</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Card principal ── */}
        <View style={[styles.card, shadows.sm]}>

          {/* Ícone + título */}
          <View style={styles.iconRow}>
            <View style={styles.iconCircle}>
              <Video size={28} color={colors.primary} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.categoryText}>{category}</Text>
              <View style={[styles.badge, { backgroundColor: `${statusColor}18` }]}>
                <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Metadados */}
          <View style={styles.metaGrid}>
            <MetaRow icon={<Calendar size={16} color={colors.primary} />} label="DATA E HORÁRIO" value={dateStr} />
            <MetaRow icon={<Clock size={16} color={colors.primary} />} label="DURAÇÃO" value={duration} />
            <MetaRow icon={<User size={16} color={colors.primary} />} label="OUVINTE" value={speakerName} />
            <MetaRow icon={<ShieldCheck size={16} color={colors.primary} />} label="APOIADOR" value={listenerName} />
            <MetaRow
              icon={<MessageCircle size={16} color={colors.primary} />}
              label="ID DA SESSÃO"
              value={`#${sessionIdShort}`}
              mono
            />
          </View>
        </View>

        {/* ── Ações da sessão AGENDADA (todas via API) ── */}
        {waitingOther && (
          <View style={[styles.hintCard, shadows.sm]}>
            <Hourglass size={16} color={colors.textMutedValue} strokeWidth={2.2} />
            <Text style={styles.hintText}>
              {session.listenerId
                ? `Aguardando ${listenerName} confirmar. Você será avisado(a) quando responder.`
                : 'Aguardando um acolhedor disponível confirmar este horário.'}
            </Text>
          </View>
        )}

        {showAcceptReject && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.primaryBtn, acting && styles.btnDisabled, shadows.primary]}
              onPress={handleAccept}
              disabled={!!acting}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!acting, busy: acting === 'accept' }}
            >
              {acting === 'accept' ? (
                <ActivityIndicator size="small" color={colors.textInverted} />
              ) : (
                <>
                  <Check size={16} color={colors.textInverted} strokeWidth={2.6} />
                  <Text style={styles.primaryBtnText}>ACEITAR</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.outlineBtn, acting && styles.btnDisabled]}
              onPress={handleReject}
              disabled={!!acting}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!acting, busy: acting === 'reject' }}
            >
              {acting === 'reject' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <X size={16} color={colors.primary} strokeWidth={2.6} />
                  <Text style={styles.outlineBtnText}>RECUSAR</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {showJoin && (
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!joinDecision.canJoin || isJoining) && styles.btnDisabled,
              joinDecision.canJoin && shadows.primary,
            ]}
            onPress={() => join(session)}
            disabled={!joinDecision.canJoin || isJoining}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ disabled: !joinDecision.canJoin, busy: isJoining }}
          >
            {isJoining ? (
              <ActivityIndicator size="small" color={colors.textInverted} />
            ) : (
              <>
                <LogIn size={16} color={colors.textInverted} strokeWidth={2.4} />
                <Text style={styles.primaryBtnText}>
                  {joinDecision.canJoin ? 'ENTRAR' : describeJoinReason(joinDecision)}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {showCalendar && (
          <TouchableOpacity
            style={[styles.rebookButton, shadows.sm]}
            onPress={handleAddToCalendar}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Adicionar ao calendário"
          >
            <CalendarPlus size={16} color={colors.primary} strokeWidth={2.4} />
            <Text style={styles.rebookButtonText}>ADICIONAR AO CALENDÁRIO</Text>
          </TouchableOpacity>
        )}

        {showCancel && (
          <TouchableOpacity
            style={[styles.dangerBtn, acting && styles.btnDisabled]}
            onPress={handleCancel}
            disabled={!!acting}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!acting, busy: acting === 'cancel' }}
          >
            {acting === 'cancel' ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <>
                <XCircle size={16} color="#DC2626" strokeWidth={2.2} />
                <Text style={styles.dangerBtnText}>CANCELAR AGENDAMENTO</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* ── Card de Avaliação ── */}
        {review ? (
          <View style={[styles.card, styles.reviewCard, shadows.sm]}>
            <Text style={styles.sectionTitle}>AVALIAÇÃO DA SESSÃO</Text>

            {/* Estrelas */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={28}
                  color={s <= (review.rating ?? 0) ? colors.primary : '#EAD7CC'}
                  fill={s <= (review.rating ?? 0) ? colors.primary : 'transparent'}
                />
              ))}
            </View>

            {/* Comentário */}
            {!!review.comment && (
              <View style={styles.commentBox}>
                <Text style={styles.commentText}>"{review.comment}"</Text>
              </View>
            )}

            <Text style={styles.reviewMeta}>
              {review.isPublic ? 'Avaliação pública' : 'Avaliação privada'} · visível após 3 dias
            </Text>
          </View>
        ) : status === 'completed' ? (
          <View style={[styles.card, styles.noReviewCard, shadows.sm]}>
            <Star size={28} color={`${colors.primary}44`} strokeWidth={1.5} />
            <Text style={styles.noReviewText}>Nenhuma avaliação registrada para esta sessão.</Text>
          </View>
        ) : null}

        {/* ── Agendar novamente com a mesma pessoa ─────────────────────────
            Disponível nos DOIS papéis e nas DUAS plataformas: reagendar não é
            uma ação financeira. A sessão nova preserva os papéis ORIGINAIS —
            quem desabafou continua desabafando — independentemente de quem
            apertou o botão. */}
        {status === 'completed' && counterpart && isSpeaker && (
          <TouchableOpacity
            style={[styles.rebookButton, shadows.sm]}
            onPress={() =>
              (navigation as any).navigate('HomeTab', {
                screen: 'ScheduleMatch',
                params: {
                  rebook: {
                    sessionId,
                    speakerId: session.speakerId,
                    listenerId: session.listenerId,
                    listenerName: session.listenerName,
                    category: session.category,
                    duration: session.duration,
                  },
                },
              })
            }
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Agendar novamente com ${counterpart.name}`}
          >
            <CalendarPlus size={16} color={colors.primary} strokeWidth={2.4} />
            <Text style={styles.rebookButtonText}>AGENDAR NOVAMENTE</Text>
          </TouchableOpacity>
        )}

        {/* Para o acolhedor o botão não aparece: as Firestore Rules exigem
            `speakerId == request.auth.uid` na criação de sessão
            (firestore.rules:135), então ele não consegue criar o agendamento —
            a tentativa falharia com permission-denied. Habilitar isso exige
            mudança de Rules, que é assunto da Sprint 6. */}
        {status === 'completed' && counterpart && !isSpeaker && (
          <View style={[styles.rebookNote, shadows.sm]}>
            <CalendarPlus size={16} color={colors.textMutedValue} strokeWidth={2.2} />
            <Text style={styles.rebookNoteText}>
              Um novo encontro com {counterpart.name} parte de quem foi acolhido.
            </Text>
          </View>
        )}

        {/* ── Botão de gorjeta se speaker e sessão concluída (Android apenas) ── */}
        {FINANCIAL_FEATURES_ENABLED && isSpeaker && status === 'completed' && session.listenerId && (
          <TouchableOpacity
            style={[styles.tipButton, shadows.primary]}
            onPress={() => navigation.navigate('Session', { screen: 'TipAfterSession', params: { sessionId, fromCall: false } })}
            activeOpacity={0.85}
          >
            <Star size={16} color={colors.textInverted} fill={colors.textInverted} />
            <Text style={styles.tipButtonText}>RECONHECER APOIADOR</Text>
          </TouchableOpacity>
        )}

        {/* O BottomNav flutua sobre esta tela: sem esta folga, o último botão
            fica embaixo da barra e não dá para tocar. */}
        <View style={{ height: BOTTOM_NAV_SCROLL_PAD }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── MetaRow ─────────────────────────────────────────────────────────────────
function MetaRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={meta.row}>
      <View style={meta.iconWrap}>{icon}</View>
      <View style={meta.content}>
        <Text style={meta.label}>{label}</Text>
        <Text style={[meta.value, mono && meta.mono]}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    fontWeight: typography.weight.bold,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  errorText: {
    fontSize: typography.size.md,
    color: colors.textMutedValue,
    textAlign: 'center',
    fontWeight: typography.weight.bold,
  },
  backBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  backBtnText: {
    color: colors.textInverted,
    fontWeight: typography.weight.black,
    fontSize: typography.size.sm,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.primaryLight,
  },
  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    width: 80,
  },
  headerBackText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  headerTitle: {
    fontSize: typography.size.xs + 1,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: typography.tracking.wider,
  },

  // Scroll
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
    flexGrow: 1,
  },

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 3,
    borderColor: colors.primaryLight,
    padding: spacing.xl,
    gap: spacing.md,
  },
  reviewCard: {
    alignItems: 'center',
  },
  noReviewCard: {
    alignItems: 'center',
    opacity: 0.7,
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  noReviewText: {
    fontSize: typography.size.xs + 1,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    textAlign: 'center',
  },

  // Ícone + categoria
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  categoryText: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: typography.tracking.tight,
    lineHeight: 24,
    marginBottom: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: typography.size.xs - 1,
    fontWeight: typography.weight.black,
    letterSpacing: 0.5,
  },

  divider: {
    height: 1,
    backgroundColor: colors.primaryLight,
    marginVertical: spacing.xs,
  },

  metaGrid: {
    gap: spacing.md,
  },

  // Avaliação
  sectionTitle: {
    fontSize: typography.size.xs + 1,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
    letterSpacing: typography.tracking.wider,
  },
  starsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  commentBox: {
    backgroundColor: '#FDF8F5',
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    padding: spacing.md,
    alignSelf: 'stretch',
  },
  commentText: {
    fontSize: typography.size.sm,
    color: colors.text,
    fontWeight: typography.weight.medium,
    lineHeight: 20,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  reviewMeta: {
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
  },

  // Ações de agendamento
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  hintText: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
  },
  primaryBtnText: {
    color: colors.textInverted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    letterSpacing: typography.tracking.widest,
  },
  outlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
  },
  outlineBtnText: {
    color: colors.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    letterSpacing: 0.8,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'rgba(220,38,38,0.35)',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
  },
  dangerBtnText: {
    color: '#DC2626',
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    letterSpacing: 0.8,
  },
  btnDisabled: {
    opacity: 0.55,
  },

  // Botão gorjeta
  tipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  rebookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  rebookButtonText: {
    color: colors.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    letterSpacing: 0.8,
  },
  rebookNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  rebookNoteText: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 18,
  },
  tipButtonText: {
    color: colors.textInverted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    letterSpacing: typography.tracking.widest,
  },
});

// ─── MetaRow styles ───────────────────────────────────────────────────────────
const meta = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 9,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.text,
    lineHeight: 20,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: typography.size.xs + 1,
    color: colors.textMutedValue,
  },
});
