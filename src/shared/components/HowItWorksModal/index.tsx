/**
 * HowItWorksModal — "Como funciona?" do Meu Best.
 *
 * Vivia inline no TabHeader, aberto pelo link "COMO FUNCIONA?" abaixo do
 * toggle da Home. Em 26/08 a Home perdeu esse bloco (~90 px) e o conteúdo
 * migrou para um item do Menu — o modal é o mesmo, só mudou de dono.
 */
import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { X, ShieldCheck } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@constants/theme';

export const HOW_IT_WORKS = [
  {
    icon: '💬',
    title: 'Desabafar',
    body: 'Você busca alguém com quem desabafar. Conectamos você a um voluntário disponível no momento.',
  },
  {
    icon: '❤️',
    title: 'Acolher',
    body: 'Você indica que está disponível para ouvir alguém. Ative sua chave Online quando puder acolher.',
  },
  {
    icon: '🔑',
    title: 'A chave Online',
    body: 'Ao ativar, você aparece como disponível na plataforma. Desative quando precisar de pausa.',
  },
  {
    icon: '🤝',
    title: 'Somos voluntários',
    body: 'O Meu Best é uma rede de apoio voluntário — não substitui acompanhamento profissional.',
  },
  {
    icon: '🆘',
    title: 'Emergências',
    body: 'Em crise, procure ajuda imediata: SAMU 192 ou CVV 188 (24h, gratuito).',
  },
] as const;

interface HowItWorksModalProps {
  visible: boolean;
  onClose: () => void;
}

export function HowItWorksModal({ visible, onClose }: HowItWorksModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={modal.overlay} activeOpacity={1} onPress={onClose}>
        <View style={modal.sheet} onStartShouldSetResponder={() => true}>
          <View style={modal.handle} />

          <View style={modal.topRow}>
            <View style={modal.iconWrap}>
              <ShieldCheck size={22} color={colors.primary} />
            </View>
            <Text style={modal.title}>Como funciona?</Text>
            <TouchableOpacity onPress={onClose} style={modal.closeBtn} accessibilityLabel="Fechar">
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={modal.content} showsVerticalScrollIndicator={false}>
            {HOW_IT_WORKS.map((item, i) => (
              <View key={i} style={modal.item}>
                <Text style={modal.itemIcon}>{item.icon}</Text>
                <View style={modal.itemText}>
                  <Text style={modal.itemTitle}>{item.title}</Text>
                  <Text style={modal.itemBody}>{item.body}</Text>
                </View>
              </View>
            ))}

            <View style={modal.emergency}>
              <Text style={modal.emergencyText}>
                🆘 Em crise?{' '}
                <Text style={modal.emergencyHighlight}>SAMU 192</Text>
                {' '}ou{' '}
                <Text style={modal.emergencyHighlight}>CVV 188</Text>
                {' '}(gratuito, 24h)
              </Text>
            </View>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26,26,26,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl + 16,
    paddingTop: spacing.sm,
    maxHeight: '80%',
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: typography.tracking.tight,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { gap: spacing.lg },
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  itemIcon: { fontSize: 24, lineHeight: 28 },
  itemText: { flex: 1, gap: 4 },
  itemTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: typography.tracking.tight,
  },
  itemBody: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 20,
  },
  emergency: {
    backgroundColor: '#FFFAED',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: '#F4C430',
    marginTop: spacing.sm,
  },
  emergencyText: {
    fontSize: typography.size.sm,
    color: '#6B5000',
    fontWeight: typography.weight.medium,
    lineHeight: 20,
  },
  emergencyHighlight: {
    fontWeight: typography.weight.black,
    color: '#9A7300',
  },
});
