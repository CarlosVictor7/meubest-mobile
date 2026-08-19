/**
 * ExploreFiltersSheet — filtros do Explorar em bottom sheet.
 *
 * No redesign do pager fullscreen os filtros saíram da tela (roubavam altura
 * do card) e vieram para cá. A APLICAÇÃO continua client-side, sobre os docs
 * já paginados, via `buildExploreList` — este sheet só edita o estado.
 *
 * Os seletores de Estado e Tema reusam o `SelectSheet` compartilhado: o Modal
 * dele abre por cima deste Modal (RN empilha modais aninhados sem problema —
 * o SelectSheet é filho da hierarquia deste sheet).
 *
 * Mudança de filtro aplica na hora (custo zero — é filtro em memória); o botão
 * do rodapé só fecha, mostrando quantos resultados a pessoa vai encontrar.
 */
import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { SelectSheet } from '@shared/components/SelectSheet';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { BR_STATES } from '@constants/brazilLocations';
import { SESSION_THEMES } from '@constants/config';

interface ExploreFiltersSheetProps {
  visible: boolean;
  onClose: () => void;

  search: string;
  onSearchChange: (v: string) => void;
  state: string;
  onStateChange: (v: string) => void;
  themeId: string;
  onThemeChange: (v: string) => void;
  onlyOnline: boolean;
  onOnlyOnlineChange: (v: boolean) => void;

  /** Zera todos os filtros de uma vez. */
  onClear: () => void;
  /** Quantos acolhedores a lista filtrada tem agora — vai para o botão do rodapé. */
  resultCount: number;
  /** Há algum filtro ativo? Controla a visibilidade do LIMPAR FILTROS. */
  hasActiveFilters: boolean;
}

export function ExploreFiltersSheet({
  visible,
  onClose,
  search,
  onSearchChange,
  state,
  onStateChange,
  themeId,
  onThemeChange,
  onlyOnline,
  onOnlyOnlineChange,
  onClear,
  resultCount,
  hasActiveFilters,
}: ExploreFiltersSheetProps) {
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
          accessibilityLabel="Fechar filtros"
        />

        <View
          style={[
            styles.sheet,
            {
              maxHeight: windowHeight * 0.85,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>FILTRAR ACOLHEDORES</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Fechar filtros"
            >
              <X size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Search size={18} color={colors.textMutedValue} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={onSearchChange}
              placeholder="Buscar por nome ou tema"
              placeholderTextColor={colors.textMutedValue}
              autoCorrect={false}
              accessibilityLabel="Buscar acolhedores"
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => onSearchChange('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Limpar busca"
              >
                <X size={16} color={colors.textMutedValue} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.fieldLabel}>ESTADO</Text>
          <SelectSheet
            value={state}
            onChange={onStateChange}
            options={[
              { value: '', label: 'Todos os estados' },
              ...BR_STATES.map((s) => ({ value: s.uf, label: `${s.name} (${s.uf})` })),
            ]}
            placeholder="Todos os estados"
            title="Filtrar por estado"
          />

          <Text style={styles.fieldLabel}>TEMA</Text>
          <SelectSheet
            value={themeId}
            onChange={onThemeChange}
            options={[
              { value: '', label: 'Todos os temas' },
              ...SESSION_THEMES.map((t) => ({ value: t.id, label: `${t.emoji} ${t.label}` })),
            ]}
            placeholder="Todos os temas"
            title="Filtrar por tema"
            searchable={false}
          />

          <TouchableOpacity
            style={[styles.onlineToggle, onlyOnline && styles.onlineToggleActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onOnlyOnlineChange(!onlyOnline);
            }}
            activeOpacity={0.85}
            accessibilityRole="switch"
            accessibilityState={{ checked: onlyOnline }}
            accessibilityLabel="Somente disponíveis agora"
          >
            <View style={[styles.onlineDot, onlyOnline && styles.onlineDotActive]} />
            <Text
              style={[styles.onlineToggleText, onlyOnline && styles.onlineToggleTextActive]}
            >
              SOMENTE DISPONÍVEIS AGORA
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            {hasActiveFilters && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onClear();
                }}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Limpar todos os filtros"
              >
                <Text style={styles.clearText}>LIMPAR FILTROS</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={onClose}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Ver resultados"
            >
              <Text style={styles.applyText}>
                {resultCount === 1 ? 'VER 1 ACOLHEDOR' : `VER ${resultCount} ACOLHEDORES`}
              </Text>
            </TouchableOpacity>
          </View>
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
    marginBottom: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.text,
    fontWeight: typography.weight.medium,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  onlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  onlineToggleActive: { borderColor: colors.success, backgroundColor: 'rgba(34,197,94,0.08)' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  onlineDotActive: { backgroundColor: colors.success },
  onlineToggleText: {
    fontSize: 10,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
    letterSpacing: 0.6,
  },
  onlineToggleTextActive: { color: '#16A34A' },
  footer: { gap: spacing.sm, marginTop: spacing.lg },
  clearBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
  },
  clearText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 0.6,
  },
  applyBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm + 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    ...shadows.primary,
  },
  applyText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: '#FFF',
    letterSpacing: 0.6,
  },
});
