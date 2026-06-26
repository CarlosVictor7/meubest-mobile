/**
 * SelectSheet — seletor reutilizável em bottom sheet com busca.
 * Usado para Estado, Cidade e Religião no ProfileForm.
 * - Modal nativo (slide), handle visual, busca opcional e FlatList rolável.
 * - KeyboardAvoidingView para o teclado não cobrir a busca/lista.
 * - Altura limitada (80%) para caber em telas pequenas (iPhone SE).
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, Check, ChevronDown } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@constants/theme';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectSheetProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  title?: string;
  searchable?: boolean;
  disabled?: boolean;
  disabledHint?: string;
}

/** Busca tolerante a acentos/caixa. */
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function SelectSheet({
  value,
  onChange,
  options,
  placeholder = 'Selecionar',
  title,
  searchable = true,
  disabled = false,
  disabledHint,
}: SelectSheetProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? '',
    [options, value]
  );

  const filtered = useMemo(() => {
    if (!searchable || !query) return options;
    const q = normalize(query);
    return options.filter((o) => normalize(o.label).includes(q));
  }, [options, query, searchable]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={[styles.trigger, disabled && styles.triggerDisabled]}
      >
        <Text
          style={[styles.triggerText, !selectedLabel && styles.triggerPlaceholder]}
          numberOfLines={1}
        >
          {disabled && disabledHint ? disabledHint : selectedLabel || placeholder}
        </Text>
        <ChevronDown size={18} color={colors.primary} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <View style={styles.container}>
          <Pressable style={styles.backdrop} onPress={close} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.kav}
          >
            <SafeAreaView edges={['bottom']} style={styles.sheet}>
              <View style={styles.handle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{title ?? placeholder}</Text>
                <TouchableOpacity onPress={close} style={styles.closeBtn} activeOpacity={0.7}>
                  <X size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {searchable && (
                <View style={styles.searchBox}>
                  <Search size={18} color={colors.textMutedValue} />
                  <TextInput
                    autoFocus
                    style={styles.searchInput}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Buscar..."
                    placeholderTextColor={colors.textMutedValue}
                  />
                </View>
              )}

              <FlatList
                data={filtered}
                keyExtractor={(item) => item.value}
                keyboardShouldPersistTaps="handled"
                style={styles.list}
                ListEmptyComponent={<Text style={styles.empty}>Nenhum resultado encontrado.</Text>}
                renderItem={({ item }) => {
                  const active = item.value === value;
                  return (
                    <TouchableOpacity
                      style={[styles.row, active && styles.rowActive]}
                      onPress={() => {
                        onChange(item.value);
                        close();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.rowText, active && styles.rowTextActive]}>{item.label}</Text>
                      {active && <Check size={18} color="#FFF" />}
                    </TouchableOpacity>
                  );
                }}
              />
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    height: 48,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  triggerDisabled: {
    opacity: 0.5,
  },
  triggerText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.text,
    fontWeight: typography.weight.medium,
  },
  triggerPlaceholder: {
    color: colors.textMutedValue,
  },

  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  kav: {
    width: '100%',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.primary,
  },
  closeBtn: {
    padding: 4,
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
    height: 44,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.text,
    fontWeight: typography.weight.medium,
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  empty: {
    textAlign: 'center',
    color: colors.textMutedValue,
    fontSize: typography.size.sm,
    paddingVertical: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    borderRadius: borderRadius.md,
    marginBottom: 4,
  },
  rowActive: {
    backgroundColor: colors.primary,
  },
  rowText: {
    fontSize: typography.size.sm,
    color: colors.text,
    fontWeight: typography.weight.medium,
  },
  rowTextActive: {
    color: '#FFF',
    fontWeight: typography.weight.bold,
  },
});
