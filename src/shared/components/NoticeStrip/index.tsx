/**
 * NoticeStrip — o aviso de segurança em formato compacto.
 *
 * Substitui o `NoticeCard` gigante que ocupava ~200px no topo de QUATRO telas
 * (Home, Sessões, Menu e Carteira), porque vivia dentro do `TabHeader`.
 *
 * O aviso não some: vira uma faixa de uma linha que abre um modal com o texto
 * completo, CVV 188 e SAMU 192. Na prática o modal diz *mais* do que o card
 * dizia — e o usuário recupera a área útil da tela.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldAlert, ChevronRight, X, Phone } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius, typography, shadows } from '@constants/theme';

interface NoticeStripProps {
  style?: StyleProp<ViewStyle>;
}

export function NoticeStrip({ style }: NoticeStripProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const openModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpen(true);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.strip, style]}
        onPress={openModal}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Aviso importante sobre segurança. Toque para ler."
      >
        <ShieldAlert size={16} color={colors.primary} strokeWidth={2.5} />
        <Text style={styles.stripText} numberOfLines={1}>
          Rede de voluntários — <Text style={styles.stripStrong}>não use em emergências</Text>
        </Text>
        <ChevronRight size={16} color={colors.primary} strokeWidth={2.5} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.overlay}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
          />

          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <ShieldAlert size={22} color={colors.primary} strokeWidth={2.5} />
              </View>
              <Text style={styles.title}>AVISO IMPORTANTE</Text>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                style={styles.closeBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.body}>
                O Meu Best é uma rede de acolhimento formada por{' '}
                <Text style={styles.bodyStrong}>voluntários</Text>, não por profissionais de saúde.
                Ninguém aqui substitui acompanhamento psicológico ou psiquiátrico.
              </Text>

              <Text style={styles.body}>
                <Text style={styles.bodyStrong}>Não use o app em emergências.</Text> Se você ou
                alguém estiver em risco imediato, procure ajuda agora:
              </Text>

              <TouchableOpacity
                style={styles.emergencyBtn}
                onPress={() => Linking.openURL('tel:188')}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Ligar para o CVV 188"
              >
                <Phone size={18} color="#FFF" strokeWidth={2.5} />
                <Text style={styles.emergencyText}>CVV 188 — apoio emocional 24h, gratuito</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.emergencyBtn, styles.emergencySecondary]}
                onPress={() => Linking.openURL('tel:192')}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Ligar para o SAMU 192"
              >
                <Phone size={18} color={colors.primary} strokeWidth={2.5} />
                <Text style={[styles.emergencyText, styles.emergencyTextSecondary]}>
                  SAMU 192 — emergência médica
                </Text>
              </TouchableOpacity>

              <Text style={styles.footer}>
                Busque ajuda profissional sempre que precisar. Acolher não é tratar.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  stripText: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
  },
  stripStrong: {
    color: colors.primary,
    fontWeight: typography.weight.black,
  },

  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '75%',
    ...shadows.lg,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headerIcon: {
    width: 40,
    height: 40,
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
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  bodyStrong: {
    color: colors.primary,
    fontWeight: typography.weight.black,
  },
  emergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  emergencySecondary: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primaryLight,
  },
  emergencyText: {
    color: '#FFF',
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  emergencyTextSecondary: {
    color: colors.primary,
  },
  footer: {
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
});
