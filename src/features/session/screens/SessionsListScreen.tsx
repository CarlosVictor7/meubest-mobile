/**
 * SessionsListScreen — Histórico de Sessões
 *
 * Fiel ao PWA:
 * - TabHeader padrão
 * - Card "HISTÓRICO DE SESSÕES" com título grande em vermelho (2 linhas)
 * - Empty state: círculo rosa + "VOCÊ AINDA NÃO REALIZOU SESSÕES."
 * - Dados reais do Firestore (listener em tempo real)
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { Calendar, Clock, Video } from 'lucide-react-native';
import { db } from '@shared/services/firebase';
import { useAuth } from '@features/auth/hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import { TabHeader } from '@shared/components/TabHeader';
import { BOTTOM_NAV_SCROLL_PAD } from '@shared/components';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';

// ─── Mapeamento de status → PT-BR ────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  active:    'EM ANDAMENTO',
  pending:   'AGUARDANDO',
  completed: 'CONCLUÍDA',
  rejected:  'CANCELADA',
  cancelled: 'CANCELADA',
};

const STATUS_COLOR: Record<string, string> = {
  active:    '#22C55E',
  pending:   '#F97316',
  completed: '#3B82F6',
  rejected:  '#9CA3AF',
  cancelled: '#9CA3AF',
};

// ─────────────────────────────────────────────────────────────────────────────

export function SessionsListScreen() {
  const { user, profile } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!user || !profile) {
      setLoading(false);
      return;
    }

    const field = profile.role === 'speaker' ? 'speakerId' : 'listenerId';
    const q = query(
      collection(db, 'sessions'),
      where(field, '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [user, profile?.role]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        bounces
      >
        {/* Cabeçalho padrão */}
        <TabHeader />

        {/* ── Card Histórico ──────────────────────────────────── */}
        <View style={styles.padded}>
          <View style={[styles.historyCard, shadows.sm]}>
            {/* Título grande — igual ao PWA */}
            <Text style={styles.historyTitle}>
              {'HISTÓRICO DE\nSESSÕES'}
            </Text>

            {loading ? (
              <Text style={styles.loadingText}>Carregando...</Text>
            ) : sessions.length === 0 ? (
              <EmptyState />
            ) : (
              <View style={styles.list}>
                {sessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Espaço para BottomNav */}
        <View style={{ height: BOTTOM_NAV_SCROLL_PAD + 16 }} />
      </ScrollView>
    </View>
  );
}

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

// ─── SessionCard ─────────────────────────────────────────────────────────────
function SessionCard({ session }: { session: any }) {
  const navigation = useNavigation<any>();
  const status      = session.status ?? 'pending';
  const statusLabel = STATUS_LABEL[status] ?? status.toUpperCase();
  const statusColor = STATUS_COLOR[status] ?? '#9CA3AF';

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

  const handlePress = () => {
    if (status === 'active' || status === 'pending') {
      navigation.navigate('Session', { sessionId: session.id });
    } else if (status === 'completed') {
      navigation.navigate('SessionDetail', { sessionId: session.id });
    }
  };

  return (
    <TouchableOpacity 
      style={card.container} 
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={status !== 'active' && status !== 'pending' && status !== 'completed'}
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
        </View>
      </View>

      <View style={card.footer}>
        <View style={{ flex: 1 }}>
          {(status === 'active' || status === 'pending') ? (
            <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
              <Text style={[card.detalhes, { color: colors.primary, fontWeight: '900' }]}>ENTRAR NA SALA</Text>
            </TouchableOpacity>
          ) : status === 'completed' ? (
            <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
              <Text style={[card.detalhes, { color: colors.primary }]}>VER DETALHES</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[card.detalhes, { color: colors.textMutedValue, textDecorationLine: 'none' }]}>CANCELADA</Text>
          )}
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
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

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
  badgeText: {
    fontSize: typography.size.xs - 1,
    fontWeight: typography.weight.black,
    letterSpacing: 0.5,
  },
});
