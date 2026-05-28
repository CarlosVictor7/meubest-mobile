/**
 * SessionDetailScreen — Detalhe de uma sessão concluída
 *
 * Exibe dados reais da sessão (Firestore):
 * - Tema/categoria, status, data/hora, duração
 * - Nome do speaker e listener
 * - Avaliação (estrelas + comentário) se existir
 * Visual fiel ao padrão Meu Best: card branco, borda laranja, tipografia forte.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {
  Calendar,
  Clock,
  User,
  Star,
  ChevronLeft,
  Video,
  ShieldCheck,
  MessageCircle,
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

export function SessionDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId } = route.params;
  const { user } = useAuth();

  const [session, setSession]   = useState<any>(null);
  const [review, setReview]     = useState<any>(null);
  const [loading, setLoading]   = useState(true);

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
      <SafeAreaView style={styles.root}>
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
  const statusLabel = STATUS_LABEL[status] ?? status.toUpperCase();
  const statusColor = STATUS_COLOR[status] ?? '#9CA3AF';
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

  const speakerName  = session.speakerName  ?? 'Ouvinte';
  const listenerName = session.listenerName ?? 'Apoiador';
  const isSpeaker    = user?.uid === session.speakerId;
  const sessionIdShort = sessionId.slice(0, 8).toUpperCase();

  return (
    <SafeAreaView style={styles.root}>
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

        {/* ── Botão de gorjeta se speaker e sessão concluída ── */}
        {isSpeaker && status === 'completed' && session.listenerId && (
          <TouchableOpacity
            style={[styles.tipButton, shadows.primary]}
            onPress={() => navigation.navigate('Session', { screen: 'TipAfterSession', params: { sessionId, fromCall: false } })}
            activeOpacity={0.85}
          >
            <Star size={16} color={colors.textInverted} fill={colors.textInverted} />
            <Text style={styles.tipButtonText}>RECONHECER APOIADOR</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
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
