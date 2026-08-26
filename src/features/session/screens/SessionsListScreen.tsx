/**
 * SessionsListScreen — Próximas sessões e histórico
 *
 * Três correções desta tela, todas de causa raiz:
 *
 * 1. Sem TabHeader. Esta aba não precisa do cabeçalho de papel/chave — ele
 *    empurrava o conteúdo para baixo sem servir para nada aqui. Home, Menu e
 *    Carteira continuam com ele.
 *
 * 2. O histórico mostra SOMENTE sessões concluídas. Antes listava tudo, e para
 *    cancelled/rejected o card renderizava "CANCELADA" no rodapé E no badge —
 *    o "CANCELADA CANCELADA". Filtrar na origem elimina o caminho.
 *
 * 3. As sessões vêm de useUserSessions, que consulta os DOIS papéis. Antes a
 *    consulta escolhia o campo pelo papel atual e metade do histórico sumia
 *    quando a pessoa alternava entre Desabafar e Acolher.
 *
 * E três correções complementares:
 *
 * 4. O histórico revela 5 por vez. Antes despejava tudo o que o hook trouxesse
 *    — que, por causa do limite da consulta, era bem menos do que existia.
 *
 * 5. A seção PRÓXIMAS SESSÕES não some mais quando está vazia. Antes um
 *    `upcoming.length > 0 &&` apagava a seção inteira, e o usuário não tinha
 *    como distinguir "não tenho nada agendado" de "a tela não implementou isso".
 *
 * 6. Ambas as listas ganharam VER MAIS com a contagem do que falta, para que a
 *    quantidade restante nunca seja um mistério.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Clock, Video, CalendarClock, ChevronDown } from 'lucide-react-native';
import { useAuth } from '@features/auth/hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import { BOTTOM_NAV_SCROLL_PAD } from '@shared/components';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { useUserSessions } from '@features/session/hooks/useUserSessions';
import { filterHistory, filterUpcoming, getCounterpart } from '@features/session/utils/sessionFilters';
import { canJoinSession, describeJoinReason, isUpcomingSession } from '@features/session/utils/sessionWindow';
import { sessionStatusColor, sessionStatusLabel } from '@features/session/utils/sessionStatus';
import { useJoinSession } from '@features/session/hooks/useJoinSession';
import {
  HISTORY_PAGE_SIZE,
  UPCOMING_PAGE_SIZE,
  advance,
  hasMore,
  paginate,
  remaining,
} from '@features/session/utils/pagination';

// Rótulos e cores de status vivem em utils/sessionStatus (um lugar só).

export function SessionsListScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  // Consulta os DOIS papéis — ver useUserSessions.
  const { sessions, loading } = useUserSessions(user?.uid);

  const upcoming = useMemo(
    () => filterUpcoming(sessions, (s) => isUpcomingSession(s)),
    [sessions]
  );
  const history = useMemo(() => filterHistory(sessions), [sessions]);

  // Quantos itens estão visíveis em cada lista. Estado mínimo de propósito:
  // a lista visível é sempre um prefixo da completa, então "carregar mais"
  // não tem como perder o que já estava na tela.
  const [historyVisible, setHistoryVisible] = useState(HISTORY_PAGE_SIZE);
  const [upcomingVisible, setUpcomingVisible] = useState(UPCOMING_PAGE_SIZE);

  // Reset só na troca de usuário. Resetar quando a lista muda de tamanho
  // colapsaria a paginação a cada snapshot do Firestore — inclusive no meio
  // da leitura de alguém que acabou de tocar em VER MAIS.
  useEffect(() => {
    setHistoryVisible(HISTORY_PAGE_SIZE);
    setUpcomingVisible(UPCOMING_PAGE_SIZE);
  }, [user?.uid]);

  const upcomingShown = paginate(upcoming, upcomingVisible);
  const historyShown = paginate(history, historyVisible);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Sem TabHeader nesta aba. A faixa de segurança saiu daqui em 19/08:
          o aviso pertence SOMENTE à Home — o acesso a CVV/SAMU continua no
          Menu (card Suporte e Segurança). */}
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.topBar}>
          <Text style={styles.topTitle}>SESSÕES</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        bounces
      >
        <View style={styles.padded}>
          {/* ── Próximas sessões ─────────────────────────────── */}
          {/* A seção existe sempre. Sumir quando vazia deixava o usuário sem
              saber se não tinha nada agendado ou se a tela estava quebrada. */}
          <View style={[styles.upcomingCard, shadows.sm]}>
            <View style={styles.upcomingHeader}>
              <View style={styles.upcomingIconWrap}>
                <CalendarClock size={18} color={colors.primary} strokeWidth={2.2} />
              </View>
              <Text style={styles.upcomingTitle}>PRÓXIMAS SESSÕES</Text>
            </View>

            {loading ? (
              <Text style={styles.loadingText}>Carregando...</Text>
            ) : upcoming.length === 0 ? (
              <Text style={styles.upcomingEmpty}>
                Nenhuma sessão agendada no momento.
              </Text>
            ) : (
              <>
                <View style={styles.list}>
                  {upcomingShown.map((session) => (
                    <UpcomingCard key={session.id} session={session} uid={user?.uid} />
                  ))}
                </View>

                {hasMore(upcoming, upcomingVisible) && (
                  <LoadMoreButton
                    label="VER MAIS AGENDADAS"
                    count={remaining(upcoming, upcomingVisible)}
                    onPress={() =>
                      setUpcomingVisible((v) =>
                        advance(v, upcoming.length, UPCOMING_PAGE_SIZE)
                      )
                    }
                  />
                )}
              </>
            )}
          </View>

          {/* ── Histórico ────────────────────────────────────── */}
          <View style={[styles.historyCard, shadows.sm]}>
            <Text style={styles.historyTitle}>{'HISTÓRICO DE\nSESSÕES'}</Text>

            {loading ? (
              <Text style={styles.loadingText}>Carregando...</Text>
            ) : history.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <View style={styles.list}>
                  {historyShown.map((session) => (
                    <SessionCard key={session.id} session={session} uid={user?.uid} />
                  ))}
                </View>

                {hasMore(history, historyVisible) ? (
                  <LoadMoreButton
                    label="VER MAIS"
                    count={remaining(history, historyVisible)}
                    onPress={() =>
                      setHistoryVisible((v) =>
                        advance(v, history.length, HISTORY_PAGE_SIZE)
                      )
                    }
                  />
                ) : (
                  <Text style={styles.historyCountNote}>
                    {history.length === 1
                      ? '1 sessão no histórico'
                      : `${history.length} sessões no histórico`}
                  </Text>
                )}
              </>
            )}
          </View>
        </View>

        <View style={{ height: BOTTOM_NAV_SCROLL_PAD + 16 }} />
      </ScrollView>
    </View>
  );
}

/**
 * Card de uma sessão agendada que ainda vai acontecer.
 * O botão só vira "ENTRAR NA SALA" dentro da janela — ver `canJoinSession` —
 * e passa pelo `/join` da API antes de abrir a sala (409 → alerta, sala não abre).
 * Tocar no card abre o detalhe (aceitar/recusar/cancelar/calendário).
 */
function UpcomingCard({ session, uid }: { session: any; uid?: string | null }) {
  const navigation = useNavigation<any>();
  const { join, joining } = useJoinSession();
  const decision = canJoinSession(session);
  const counterpart = getCounterpart(session, uid);
  const status = session.status ?? 'pending';
  const statusColor = sessionStatusColor(status);
  const isJoining = joining === session.id;

  const when = session.selectedTime
    ? new Date(session.selectedTime).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <TouchableOpacity
      style={up.container}
      onPress={() => navigation.navigate('SessionDetail', { sessionId: session.id })}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Ver detalhes da sessão agendada"
    >
      <View style={up.top}>
        <View style={up.iconWrap}>
          <Video size={18} color={colors.primary} strokeWidth={2} />
        </View>
        <View style={up.info}>
          <View style={up.titleRow}>
            <Text style={up.category}>{(session.category ?? '—').toUpperCase()}</Text>
            <View style={[up.badge, { backgroundColor: `${statusColor}18` }]}>
              <Text style={[up.badgeText, { color: statusColor }]}>
                {sessionStatusLabel(status)}
              </Text>
            </View>
          </View>
          <View style={up.metaRow}>
            <Clock size={11} color={colors.textMutedValue} strokeWidth={2} />
            <Text style={up.meta}>{when}</Text>
            {session.duration ? (
              <>
                <Text style={up.metaDot}>•</Text>
                <Text style={up.meta}>{session.duration} min</Text>
              </>
            ) : null}
          </View>
          {counterpart && (
            <Text style={up.counterpart} numberOfLines={1}>
              com {counterpart.name}
            </Text>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[up.joinBtn, !decision.canJoin && up.joinBtnDisabled]}
        disabled={!decision.canJoin || isJoining}
        onPress={() => join(session)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ disabled: !decision.canJoin, busy: isJoining }}
      >
        {isJoining ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Text style={[up.joinText, !decision.canJoin && up.joinTextDisabled]}>
            {describeJoinReason(decision)}
          </Text>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const up = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
    padding: spacing.md,
    gap: spacing.sm,
  },
  top: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  category: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: 0.3,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: typography.weight.black,
    letterSpacing: 0.5,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 11, color: colors.textMutedValue, fontWeight: typography.weight.medium },
  metaDot: { fontSize: 11, color: colors.textMutedValue },
  counterpart: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: typography.weight.bold,
  },
  joinBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  joinBtnDisabled: {
    backgroundColor: 'rgba(26,26,26,0.06)',
  },
  joinText: {
    color: '#FFF',
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    letterSpacing: 0.8,
  },
  joinTextDisabled: {
    color: colors.textMutedValue,
  },
});


/**
 * Botão de revelar mais itens.
 *
 * Mostra quantos faltam. Sem esse número, "VER MAIS" num histórico de 54
 * sessões não diz se o próximo toque traz 5 ou 40 — e some sem aviso quando
 * acaba, o que parece bug.
 */
function LoadMoreButton({
  label,
  count,
  onPress,
}: {
  label: string;
  count: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={more.button}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Faltam ${count}.`}
    >
      <Text style={more.text}>{label}</Text>
      <View style={more.badge}>
        <Text style={more.badgeText}>{count}</Text>
      </View>
      <ChevronDown size={16} color={colors.primary} strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

const more = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
    backgroundColor: colors.background,
  },
  text: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 0.8,
  },
  badge: {
    minWidth: 24,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: typography.weight.black,
    color: colors.primary,
  },
});

// ─── EmptyState ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <View style={empty.container}>
      {/* Círculo rosa com ícone */}
      <View style={empty.circle}>
        <Calendar
          size={36}
          color={`${colors.primary}55`}
          strokeWidth={1.5}
        />
      </View>

      {/* Mensagem igual ao PWA */}
      <Text style={empty.text}>
        {'VOCÊ AINDA NÃO REALIZOU\nSESSÕES.'}
      </Text>
    </View>
  );
}

// ─── SessionCard — apenas sessões CONCLUÍDAS chegam aqui ─────────────────────
function SessionCard({ session, uid }: { session: any; uid?: string | null }) {
  const navigation = useNavigation<any>();
  const status      = session.status ?? 'completed';
  const statusLabel = sessionStatusLabel(status);
  const statusColor = sessionStatusColor(status);
  const counterpart = getCounterpart(session, uid);

  const duration = session.duration
    ? `${session.duration} min`
    : session.durationMinutes
    ? `${session.durationMinutes} min`
    : null;

  const rawDate = session.selectedTime ?? session.createdAt?.toDate?.();
  const dateStr = rawDate
    ? new Date(rawDate).toLocaleDateString('pt-BR', {
        day:    '2-digit',
        month:  '2-digit',
        year:   'numeric',
        hour:   '2-digit',
        minute: '2-digit',
      })
    : '—';

  const category = (session.category ?? session.theme ?? '—').toUpperCase();

  // A lista já é filtrada para `completed`, então o destino é sempre o detalhe.
  const handlePress = () => navigation.navigate('SessionDetail', { sessionId: session.id });

  return (
    <TouchableOpacity 
      style={card.container} 
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={card.top}>
        <View style={card.iconWrap}>
          <Video size={18} color={colors.primary} strokeWidth={2} />
        </View>
        <View style={card.info}>
          <Text style={card.category}>{category}</Text>
          <View style={card.metaRow}>
            {duration && (
              <>
                <Clock size={11} color={colors.textMutedValue} strokeWidth={2} />
                <Text style={card.meta}>{duration}</Text>
                <Text style={card.metaDot}>•</Text>
              </>
            )}
            <Text style={card.meta}>{dateStr}</Text>
          </View>
          {counterpart && (
            <Text style={card.counterpart} numberOfLines={1}>
              com {counterpart.name}
            </Text>
          )}
        </View>
      </View>

      {/* O rodapé tinha um ramo que escrevia "CANCELADA" ao lado do badge, que
          também dizia "CANCELADA". Como a lista agora só recebe sessões
          concluídas, o ramo foi removido em vez de ficar armado. */}
      <View style={card.footer}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
            <Text style={[card.detalhes, { color: colors.primary }]}>VER DETALHES</Text>
          </TouchableOpacity>
        </View>
        <View style={[card.badge, { backgroundColor: `${statusColor}18` }]}>
          <Text style={[card.badgeText, { color: statusColor }]}>
            {statusLabel}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.lg },

  // Barra própria da aba, no lugar do TabHeader
  safeTop: { backgroundColor: colors.background },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  topTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 0.5,
  },

  // Card de próximas sessões
  upcomingCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 3,
    borderColor: colors.primaryLight,
    padding: spacing.lg,
    gap: spacing.md,
  },
  upcomingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  upcomingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingTitle: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 0.8,
  },

  upcomingEmpty: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 20,
  },

  historyCountNote: {
    fontSize: 11,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 3,
    borderColor: colors.primaryLight,
    padding: spacing.xl,
    gap: spacing.xl,
  },

  // Título grande em 2 linhas — fiel ao PWA
  historyTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -0.5,
    lineHeight: 38,
    textTransform: 'uppercase',
  },

  loadingText: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    textAlign: 'center',
    fontWeight: typography.weight.medium,
    paddingVertical: spacing.xl,
  },

  list: { gap: spacing.sm },
});

// ─── Empty state styles ───────────────────────────────────────────────────────
const empty = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  // Círculo rosa claro com ícone — igual ao PWA
  circle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: `${colors.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Texto uppercase, cinza claro, letra espaçada — igual ao PWA
  text: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: 'rgba(26,26,26,0.22)',
    letterSpacing: typography.tracking.wider,
    textAlign: 'center',
    lineHeight: 22,
    textTransform: 'uppercase',
  },
});

// ─── Card individual de sessão ────────────────────────────────────────────────
const card = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: spacing.md,
    gap: spacing.sm,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  info: { flex: 1, gap: 4 },
  category: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: typography.tracking.tight,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  meta: {
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
  },
  metaDot: { fontSize: typography.size.xs, color: colors.textMutedValue },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.primaryLight,
  },
  detalhes: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: typography.tracking.wider,
    textDecorationLine: 'underline',
    textDecorationColor: `${colors.primary}60`,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  counterpart: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: typography.weight.bold,
    marginTop: 2,
  },
  badgeText: {
    fontSize: typography.size.xs - 1,
    fontWeight: typography.weight.black,
    letterSpacing: 0.5,
  },
});
