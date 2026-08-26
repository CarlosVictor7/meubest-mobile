/**
 * ScheduleRequestModal — "Fulano quer conversar com você" (sessão AGENDADA).
 *
 * Irmão do IncomingCallModal, sem urgência: não toca ringtone, não pulsa.
 * ACEITAR/RECUSAR vão pela API (server-authoritative); o aceite NÃO abre a
 * sala — só confirma o horário. Quem entra na sala é o botão ENTRAR das
 * listas/detalhe, dentro da janela.
 *
 * Só recebe sessões `type === 'scheduled'` (ver useScheduleRequests).
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { CalendarClock, Check, X, Heart, Clock, Calendar } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { getPublicExploreName } from '@shared/utils/displayName';
import type { SessionLike } from '../utils/sessionFilters';
import { formatScheduleWhen, formatDuration } from '../utils/scheduleFormat';
import type { ScheduleRequestAction } from '../hooks/useScheduleRequests';

interface ScheduleRequestModalProps {
  request: SessionLike | null;
  busy: ScheduleRequestAction;
  onAccept: (sessionId: string) => void;
  onReject: (sessionId: string) => void;
  onDismiss: (sessionId: string) => void;
}

export function ScheduleRequestModal({
  request,
  busy,
  onAccept,
  onReject,
  onDismiss,
}: ScheduleRequestModalProps) {
  if (!request) return null;

  // speakerName já é público desde 24/08; a abreviação protege docs legados.
  const who = getPublicExploreName({ name: request.speakerName }, 'Alguém');
  const when = formatScheduleWhen(request.selectedTime);
  const category = (request.category ?? 'Conversa') as string;
  const duration = formatDuration(request.duration);
  const locked = busy !== null;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => !locked && onDismiss(request.id)}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.badge}>
            <CalendarClock size={12} color={colors.textInverted} />
            <Text style={styles.badgeText}>SOLICITAÇÃO DE AGENDAMENTO</Text>
          </View>

          <View style={styles.iconCircle}>
            <Calendar size={30} color={colors.textInverted} strokeWidth={1.8} />
          </View>

          <Text style={styles.title}>
            {who.toUpperCase()} QUER{'\n'}CONVERSAR COM VOCÊ
          </Text>
          <Text style={styles.subtitle}>
            {when ? (
              <>
                <Text style={styles.highlight}>{when.long}</Text> às{' '}
                <Text style={styles.highlight}>{when.time}</Text>
              </>
            ) : (
              'Horário a combinar'
            )}
            {'\n'}Você aceita este agendamento?
          </Text>

          <View style={styles.infoRow}>
            <View style={styles.chip}>
              <Heart size={12} color={colors.primary} fill={colors.primary} />
              <Text style={styles.chipText}>{category.toUpperCase()}</Text>
            </View>
            <View style={styles.chip}>
              <Clock size={12} color={colors.primary} />
              <Text style={styles.chipText}>{duration.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.acceptBtn, locked && styles.btnDisabled, shadows.primary]}
              onPress={() => onAccept(request.id)}
              activeOpacity={0.85}
              disabled={locked}
              accessibilityRole="button"
              accessibilityState={{ disabled: locked, busy: busy === 'accept' }}
            >
              {busy === 'accept' ? (
                <ActivityIndicator size="small" color={colors.textInverted} />
              ) : (
                <>
                  <Check size={18} color={colors.textInverted} strokeWidth={2.6} />
                  <Text style={styles.acceptBtnText}>ACEITAR</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.rejectBtn, locked && styles.btnDisabled]}
              onPress={() => onReject(request.id)}
              activeOpacity={0.8}
              disabled={locked}
              accessibilityRole="button"
              accessibilityState={{ disabled: locked, busy: busy === 'reject' }}
            >
              {busy === 'reject' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <X size={16} color={colors.primary} strokeWidth={2.6} />
                  <Text style={styles.rejectBtnText}>RECUSAR</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.laterBtn}
              onPress={() => onDismiss(request.id)}
              activeOpacity={0.7}
              disabled={locked}
              accessibilityRole="button"
            >
              <Text style={styles.laterBtnText}>Decidir depois</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.note}>
            Ao aceitar, o horário fica confirmado para vocês dois. A sala abre 15 minutos antes.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl + 8,
    alignItems: 'center',
    borderTopWidth: 3,
    borderTopColor: colors.primaryLight,
    ...shadows.lg,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: 1.5,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.primary,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: typography.tracking.tight,
    lineHeight: 28,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.size.base,
    color: colors.textMutedValue,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: typography.weight.medium,
    marginBottom: spacing.lg,
  },
  highlight: {
    fontWeight: typography.weight.black,
    color: colors.primary,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: `${colors.primary}20`,
  },
  chipText: {
    fontSize: 10,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 0.8,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md + 2,
    width: '100%',
  },
  acceptBtnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.widest,
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    paddingVertical: spacing.md,
    width: '100%',
  },
  rejectBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 0.8,
  },
  laterBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  laterBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textMutedValue,
  },
  btnDisabled: { opacity: 0.6 },
  note: {
    fontSize: 10,
    color: `${colors.textMutedValue}90`,
    textAlign: 'center',
    lineHeight: 14,
    fontWeight: typography.weight.medium,
  },
});
