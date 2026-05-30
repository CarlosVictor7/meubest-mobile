/**
 * StartModal — Modal de seleção de tema para início de sessão imediata
 *
 * Extraído do AppTabNavigator para ser reutilizável na HomeScreen e em
 * qualquer outro ponto de entrada do fluxo de busca por acolhedor.
 *
 * Uso:
 *   <StartModal
 *     visible={visible}
 *     onClose={() => setVisible(false)}
 *     onSelectTheme={(theme) => navigation.navigate('MatchSearch', { category: theme })}
 *   />
 */
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Zap, X } from 'lucide-react-native';
import { SESSION_THEMES } from '@constants/config';
import { colors, spacing, borderRadius, typography, shadows } from '@constants/theme';

// ─── Props ────────────────────────────────────────────────────────────────────
interface StartModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectTheme: (theme: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function StartModal({ visible, onClose, onSelectTheme }: StartModalProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleClose = () => {
    setSelected(null);
    onClose();
  };

  const handleSelect = (label: string) => {
    setSelected(label);
  };

  const handleConfirm = () => {
    if (!selected) return;
    const theme = selected;
    setSelected(null);
    onSelectTheme(theme);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          {/* Handle */}
          <View style={modal.handle} />

          {/* Header */}
          <View style={modal.header}>
            <View style={modal.headerLeft}>
              <View style={modal.headerIcon}>
                <Zap size={22} color={colors.textInverted} fill={colors.textInverted} />
              </View>
              <View>
                <Text style={modal.headerTitle}>COMEÇAR</Text>
                <Text style={modal.headerSub}>Sobre o que você quer desabafar?</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={modal.closeBtn}>
              <X size={20} color={colors.textMutedValue} />
            </TouchableOpacity>
          </View>

          {/* Temas */}
          <ScrollView
            contentContainerStyle={modal.grid}
            showsVerticalScrollIndicator={false}
          >
            {SESSION_THEMES.map((theme) => (
              <TouchableOpacity
                key={theme.id}
                style={[
                  modal.themeCard,
                  selected === theme.label && modal.themeCardActive,
                ]}
                onPress={() => handleSelect(theme.label)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    modal.themeLabel,
                    selected === theme.label && modal.themeLabelActive,
                  ]}
                >
                  {theme.label.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* CTA */}
          <TouchableOpacity
            style={[modal.cta, !selected && modal.ctaDisabled]}
            onPress={handleConfirm}
            activeOpacity={0.85}
            disabled={!selected}
          >
            <Text style={modal.ctaText}>
              {selected ? 'BUSCAR ACOLHEDOR →' : 'SELECIONE UM TEMA'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
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
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
    maxHeight: '85%',
    ...shadows.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: typography.tracking.tight,
  },
  headerSub: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  themeCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    minWidth: '45%',
    flex: 1,
    alignItems: 'center',
  },
  themeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  themeLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textMutedValue,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  themeLabelActive: {
    color: colors.textInverted,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    ...shadows.primary,
    marginTop: spacing.sm,
  },
  ctaDisabled: {
    backgroundColor: 'rgba(26,26,26,0.12)',
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.widest,
  },
});
