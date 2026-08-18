/**
 * ListenerTrainingSheet — o que aparece quando alguém toca em "Acolher" sem
 * autorização.
 *
 * Regra de produto da Sprint 6: **nem todo usuário pode acolher**. Desabafar
 * segue livre; acolher passa por seleção e treinamento.
 *
 * O tom aqui importa mais que o normal. A pessoa se ofereceu para ajudar
 * alguém — a resposta não pode soar como uma porta na cara. Por isso a tela
 * explica o motivo (segurança de quem chega precisando falar) antes de pedir
 * qualquer coisa, e quem é reprovado continua sendo lembrado de que pode usar
 * o app para desabafar.
 *
 * ⚠️ Esta tela só é alcançável com `LISTENER_APPROVAL_ENFORCED = true`.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, ShieldCheck, HeartHandshake, GraduationCap, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@shared/services/firebase';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import {
  canRequestTraining,
  getListenerStatus,
  LISTENER_STATUS_COPY,
  type ListenerSource,
} from '@shared/utils/listener';

interface ListenerTrainingSheetProps {
  visible: boolean;
  onClose: () => void;
  uid: string | null | undefined;
  profile: ListenerSource | null | undefined;
}

const PASSOS = [
  {
    Icon: ShieldCheck,
    title: 'Por que existe seleção',
    body: 'Quem chega aqui muitas vezes está num momento difícil. Antes de alguém acolher, precisamos ter certeza de que essa pessoa sabe ouvir sem julgar e reconhecer quando encaminhar para ajuda profissional.',
  },
  {
    Icon: GraduationCap,
    title: 'O treinamento',
    body: 'É um material curto sobre escuta ativa, limites do acolhimento voluntário e sinais de risco. Não substitui formação em saúde mental — e é justamente por isso que existe.',
  },
  {
    Icon: Clock,
    title: 'Enquanto isso',
    body: 'Você continua podendo desabafar normalmente. Nada muda no seu uso do app.',
  },
];

export function ListenerTrainingSheet({
  visible,
  onClose,
  uid,
  profile,
}: ListenerTrainingSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetHeight = Math.min(windowHeight * 0.85, windowHeight - insets.top - 24);

  const [submitting, setSubmitting] = useState(false);

  const status = getListenerStatus(profile);
  const copy = LISTENER_STATUS_COPY[status];
  const podeSolicitar = canRequestTraining(profile);

  const handleRequest = async () => {
    if (!uid) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // A ÚNICA transição que o próprio usuário faz. Qualquer outra é
      // privativa da administração — garantido pelas Firestore Rules.
      await updateDoc(doc(db, 'users', uid), {
        listenerStatus: 'training_requested',
        listenerStatusUpdatedAt: new Date().toISOString(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Solicitação enviada',
        'Obrigado por querer acolher. Em breve entramos em contato com os próximos passos.',
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      console.error('[ListenerTraining] Falha ao solicitar treinamento:', error);
      Alert.alert(
        'Não foi possível enviar',
        'Tente novamente em instantes. Se continuar, fale com o suporte pelo Menu.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        />

        <View
          style={[
            styles.sheet,
            { height: sheetHeight, paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <HeartHandshake size={22} color={colors.primary} strokeWidth={2.2} />
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {copy.title}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
            >
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.lead}>{copy.message}</Text>

            {/* Os passos só fazem sentido para quem ainda não entrou no ciclo. */}
            {podeSolicitar &&
              PASSOS.map(({ Icon, title, body }) => (
                <View key={title} style={styles.step}>
                  <View style={styles.stepIcon}>
                    <Icon size={18} color={colors.primary} strokeWidth={2.2} />
                  </View>
                  <View style={styles.stepText}>
                    <Text style={styles.stepTitle}>{title}</Text>
                    <Text style={styles.stepBody}>{body}</Text>
                  </View>
                </View>
              ))}

            {!podeSolicitar && status !== 'approved' && (
              <View style={styles.statusBox}>
                <Clock size={16} color={colors.primary} strokeWidth={2.2} />
                <Text style={styles.statusText}>
                  Você continua podendo desabafar normalmente enquanto isso.
                </Text>
              </View>
            )}
          </ScrollView>

          {podeSolicitar && (
            <TouchableOpacity
              style={[styles.cta, submitting && styles.ctaDisabled, shadows.primary]}
              onPress={handleRequest}
              disabled={submitting}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Quero participar do treinamento"
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.ctaText}>QUERO PARTICIPAR DO TREINAMENTO</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26,26,26,0.55)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.primary,
    lineHeight: 22,
  },
  closeBtn: { padding: 4 },
  scroll: { flex: 1 },
  scrollContent: { gap: spacing.md, paddingBottom: spacing.md },
  lead: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 21,
  },
  step: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    backgroundColor: `${colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1, gap: 2 },
  stepTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.text,
  },
  stepBody: {
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 18,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: `${colors.primary}0D`,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: spacing.md,
  },
  statusText: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 18,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: {
    color: '#FFF',
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    letterSpacing: 0.6,
  },
});
