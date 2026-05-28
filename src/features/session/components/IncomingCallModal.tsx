/**
 * IncomingCallModal — Modal premium de chamado urgente
 *
 * Exibido quando um apoiador (listener) online recebe um chamado imediato.
 * Design inspirado no modal do Web com identidade visual Meu Best.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { PhoneIncoming, X, Heart, Clock, Zap } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import type { IncomingCallSession } from '../hooks/useIncomingCall';
import { useCallRingtone } from '../hooks/useCallRingtone';

interface IncomingCallModalProps {
  session: IncomingCallSession | null;
  isAccepting: boolean;
  onAccept: (sessionId: string) => void;
  onDecline: (sessionId: string) => void;
}

export function IncomingCallModal({
  session,
  isAccepting,
  onAccept,
  onDecline,
}: IncomingCallModalProps) {
  const visible = session !== null;

  // ── Ringtone: toca em loop enquanto o modal está visível ────────────────────
  useCallRingtone(visible);

  // ── Animação de pulso no ícone ─────────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (!visible) return;

    // Entrada com slide-up
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();

    // Pulso contínuo no ícone de chamada
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => {
      pulse.stop();
      slideAnim.setValue(300);
    };
  }, [visible]);

  if (!session) return null;

  const durationLabel = session.duration ? `${session.duration} minutos` : '15 minutos';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => session && onDecline(session.id)}
    >
      {/* Overlay escuro semitransparente */}
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* ── Badge urgente ─────────────────────────────────────────── */}
          <View style={styles.urgencyBadge}>
            <Zap size={12} color={colors.textInverted} fill={colors.textInverted} />
            <Text style={styles.urgencyText}>CHAMADO IMEDIATO</Text>
          </View>

          {/* ── Ícone pulsante ────────────────────────────────────────── */}
          <View style={styles.iconWrapper}>
            <Animated.View
              style={[
                styles.iconPulse,
                { transform: [{ scale: pulseAnim }] },
              ]}
            />
            <View style={styles.iconCircle}>
              <PhoneIncoming size={32} color={colors.textInverted} strokeWidth={1.8} />
            </View>
          </View>

          {/* ── Título e descrição ────────────────────────────────────── */}
          <Text style={styles.title}>ALGUÉM PRECISA{'\n'}DA SUA ESCUTA AGORA</Text>
          <Text style={styles.subtitle}>
            Um(a) usuário(a) está buscando apoio sobre{' '}
            <Text style={styles.highlight}>{session.category}</Text>.
            {'\n'}Você aceita este chamado?
          </Text>

          {/* ── Chips de info ─────────────────────────────────────────── */}
          <View style={styles.infoRow}>
            <View style={styles.chip}>
              <Heart size={12} color={colors.primary} fill={colors.primary} />
              <Text style={styles.chipText}>{session.category.toUpperCase()}</Text>
            </View>
            <View style={styles.chip}>
              <Clock size={12} color={colors.primary} />
              <Text style={styles.chipText}>{durationLabel.toUpperCase()}</Text>
            </View>
          </View>

          {/* ── Botões ───────────────────────────────────────────────── */}
          <View style={styles.actions}>
            {/* Aceitar */}
            <TouchableOpacity
              style={[styles.acceptBtn, isAccepting && styles.btnDisabled, shadows.primary]}
              onPress={() => !isAccepting && onAccept(session.id)}
              activeOpacity={0.85}
              disabled={isAccepting}
            >
              {isAccepting ? (
                <ActivityIndicator size="small" color={colors.textInverted} />
              ) : (
                <>
                  <PhoneIncoming size={18} color={colors.textInverted} />
                  <Text style={styles.acceptBtnText}>ACEITAR CHAMADO</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Recusar */}
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => onDecline(session.id)}
              activeOpacity={0.7}
              disabled={isAccepting}
            >
              <X size={14} color={colors.textMutedValue} />
              <Text style={styles.declineBtnText}>Recusar agora</Text>
            </TouchableOpacity>
          </View>

          {/* ── Aviso de privacidade ─────────────────────────────────── */}
          <Text style={styles.privacyNote}>
            Ao aceitar, você concorda em iniciar uma sessão de escuta ativa voluntária.
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.75)',
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

  // Badge urgência
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    marginBottom: spacing.xl,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: 1.5,
  },

  // Ícone
  iconWrapper: {
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconPulse: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    opacity: 0.2,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.primary,
  },

  // Texto
  title: {
    fontSize: typography.size.xl + 2,
    fontWeight: typography.weight.black,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: typography.tracking.tight,
    lineHeight: 30,
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

  // Chips
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

  // Botões
  actions: {
    width: '100%',
    gap: spacing.md,
    marginBottom: spacing.lg,
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
  btnDisabled: {
    opacity: 0.6,
  },
  acceptBtnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.widest,
  },
  declineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    width: '100%',
  },
  declineBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textMutedValue,
  },

  // Nota
  privacyNote: {
    fontSize: 10,
    color: `${colors.textMutedValue}80`,
    textAlign: 'center',
    lineHeight: 14,
    fontWeight: typography.weight.medium,
  },
});
