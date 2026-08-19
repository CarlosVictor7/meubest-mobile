/**
 * TalkThemeSheet — "Sobre o que você quer conversar?"
 *
 * Passo obrigatório antes de FALAR AGORA: a categoria da sessão direcionada é
 * a escolha REAL da pessoa — nunca mais `SESSION_THEMES[0]` hardcoded, nunca
 * inferida dos interesses do acolhedor.
 *
 * Não usa o `SelectSheet` compartilhado porque a API dele é acoplada ao próprio
 * gatilho (`<Pressable>` interno) e não expõe abertura programática — e aqui o
 * sheet abre a partir do botão FALAR AGORA do card. Este componente espelha a
 * linguagem visual do SelectSheet (slide de baixo, handle, título, backdrop).
 *
 * O sheet também FAZ AS VEZES da confirmação: o subtítulo explica o que vai
 * acontecer, e escolher um tema é o gesto explícito de confirmar. Um Alert em
 * cima disso seria uma segunda pergunta para a mesma decisão.
 */
import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, borderRadius } from '@constants/theme';
import { SESSION_THEMES } from '@constants/config';

interface TalkThemeSheetProps {
  visible: boolean;
  /** Nome público do acolhedor — entra no subtítulo. */
  listenerName: string;
  onClose: () => void;
  /** Recebe o LABEL do tema (é o formato do campo `category` da sessão). */
  onSelect: (categoryLabel: string) => void;
}

export function TalkThemeSheet({
  visible,
  listenerName,
  onClose,
  onSelect,
}: TalkThemeSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.container}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        />

        <View
          style={[
            styles.sheet,
            {
              maxHeight: windowHeight * 0.8,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Sobre o que você quer conversar?</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
            >
              <X size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Escolha um tema e vamos avisar {listenerName} que você quer conversar
            agora. Se não puder atender, você pode agendar.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
            {SESSION_THEMES.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={styles.row}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onSelect(t.label);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Conversar sobre ${t.label}`}
              >
                <Text style={styles.rowEmoji}>{t.emoji}</Text>
                <Text style={styles.rowText}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
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
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.primary,
  },
  subtitle: {
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 17,
    marginBottom: spacing.md,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    marginBottom: 6,
  },
  rowEmoji: { fontSize: 20 },
  rowText: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
});
