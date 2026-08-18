/**
 * SelectSheet — seletor reutilizável em bottom sheet com busca.
 * Usado para Estado, Cidade e Religião no ProfileForm (e reaproveitável em qualquer lista).
 *
 * ┌── Por que a altura é calculada em JS e não em porcentagem ──────────────────┐
 * │ `maxHeight: '80%'` só funciona quando o pai tem altura resolvida. O pai      │
 * │ aqui é um KeyboardAvoidingView sem altura, então o percentual não resolvia   │
 * │ e o sheet crescia além da viewport. Agora a altura vem de                    │
 * │ useWindowDimensions() menos safe area e menos o teclado — determinística.    │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Decisões deliberadas:
 * - `statusBarTranslucent` + `navigationBarTranslucent`: sem isso o Modal ignora
 *   o edge-to-edge do Android 15 (`edgeToEdgeEnabled=true`) e o conteúdo desloca.
 * - Sem `autoFocus`: o foco é dado depois da animação de slide, senão o teclado
 *   sobe no meio da transição e a lista inicia deslocada.
 * - O teclado é medido por listener: a altura dele é descontada do sheet E
 *   usada para levantar o sheet do rodapé. Com `statusBarTranslucent` a janela
 *   do Modal NÃO redimensiona sozinha, então só encolher deixaria o sheet
 *   ancorado atrás do teclado — verificado no Pixel 8 / API 35.
 * - A FlatList é a única região elástica (`flex: 1`); tudo acima dela tem altura
 *   própria. Assim o scroll sempre funciona e o botão X nunca sai da tela.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  Keyboard,
  Platform,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  type KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X, Check, ChevronDown } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@constants/theme';
import { normalize } from './normalize';

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
  /** Rótulo acessível do gatilho. Cai no `title`/`placeholder` quando ausente. */
  accessibilityLabel?: string;
}

// ── Métricas fixas ───────────────────────────────────────────────────────────
/** Altura de uma linha da lista. Fixa para permitir `getItemLayout`. */
const ROW_HEIGHT = 44;
const ROW_GAP = 4;
const ROW_TOTAL = ROW_HEIGHT + ROW_GAP;

/** Fração da tela que o sheet ocupa quando não há teclado. */
const SHEET_MAX_RATIO = 0.8;
/** Folga mínima entre o topo do sheet e o topo da tela. */
const TOP_GAP = 24;
/** Altura mínima aceitável — abaixo disso o sheet vira uma faixa inútil. */
const SHEET_MIN_HEIGHT = 220;

export function SelectSheet({
  value,
  onChange,
  options,
  placeholder = 'Selecionar',
  title,
  searchable = true,
  disabled = false,
  disabledHint,
  accessibilityLabel,
}: SelectSheetProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const searchRef = useRef<TextInput>(null);

  // ── Teclado ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates?.height ?? 0);
    const onHide = () => setKeyboardHeight(0);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [open]);

  // ── Altura determinística ──────────────────────────────────────────────────
  const sheetHeight = useMemo(() => {
    const ceiling = Math.min(
      windowHeight * SHEET_MAX_RATIO,
      windowHeight - insets.top - TOP_GAP
    );
    // Com o teclado aberto, o sheet encolhe em vez de ser empurrado para fora.
    const available = ceiling - keyboardHeight;
    return Math.max(SHEET_MIN_HEIGHT, Math.min(ceiling, available));
  }, [windowHeight, insets.top, keyboardHeight]);

  // Quando o teclado está aberto ele já ocupa a área inferior — o padding da
  // safe area só é necessário sem teclado.
  const bottomPadding = keyboardHeight > 0 ? spacing.sm : Math.max(insets.bottom, spacing.sm);

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? '',
    [options, value]
  );

  const filtered = useMemo(() => {
    if (!searchable || !query) return options;
    const q = normalize(query);
    if (!q) return options;
    return options.filter((o) => normalize(o.label).includes(q));
  }, [options, query, searchable]);

  const close = useCallback(() => {
    Keyboard.dismiss();
    setOpen(false);
    setQuery('');
    setKeyboardHeight(0);
  }, []);

  /**
   * Foco só depois de o Modal estar apresentado. `onShow` dispara quando a
   * apresentação começa; o timeout curto cobre o resto da animação de slide.
   */
  const handleShow = useCallback(() => {
    if (!searchable) return;
    const t = setTimeout(() => searchRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [searchable]);

  const getItemLayout = useCallback(
    (_data: ArrayLike<SelectOption> | null | undefined, index: number) => ({
      length: ROW_TOTAL,
      offset: ROW_TOTAL * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: SelectOption }) => {
      const active = item.value === value;
      return (
        <TouchableOpacity
          style={[styles.row, active && styles.rowActive]}
          onPress={() => {
            onChange(item.value);
            close();
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
        >
          <Text style={[styles.rowText, active && styles.rowTextActive]} numberOfLines={1}>
            {item.label}
          </Text>
          {active && <Check size={18} color="#FFF" />}
        </TouchableOpacity>
      );
    },
    [value, onChange, close]
  );

  const triggerLabel = disabled && disabledHint ? disabledHint : selectedLabel || placeholder;

  return (
    <>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title ?? placeholder}
        accessibilityValue={{ text: selectedLabel || 'nenhum item selecionado' }}
        accessibilityState={{ disabled }}
      >
        <Text
          style={[styles.triggerText, !selectedLabel && styles.triggerPlaceholder]}
          numberOfLines={1}
        >
          {triggerLabel}
        </Text>
        <ChevronDown size={18} color={colors.primary} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={close}
        onShow={handleShow}
        statusBarTranslucent
        navigationBarTranslucent
      >
        {/* `paddingBottom` levanta o sheet acima do teclado. Sem isso ele fica
            ancorado no rodapé da tela, atrás do teclado. */}
        <View style={[styles.container, { paddingBottom: keyboardHeight }]}>
          <Pressable
            style={styles.backdrop}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
          />

          <View style={[styles.sheet, { height: sheetHeight, paddingBottom: bottomPadding }]}>
            <View style={styles.handle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {title ?? placeholder}
              </Text>
              <TouchableOpacity
                onPress={close}
                style={styles.closeBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
              >
                <X size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {searchable && (
              <View style={styles.searchBox}>
                <Search size={18} color={colors.textMutedValue} />
                <TextInput
                  ref={searchRef}
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar..."
                  placeholderTextColor={colors.textMutedValue}
                  returnKeyType="search"
                  autoCorrect={false}
                  autoCapitalize="none"
                  accessibilityLabel="Buscar na lista"
                />
              </View>
            )}

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              style={styles.list}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={<Text style={styles.empty}>Nenhum resultado encontrado.</Text>}
              renderItem={renderItem}
              getItemLayout={getItemLayout}
              initialNumToRender={14}
              maxToRenderPerBatch={20}
              windowSize={9}
              removeClippedSubviews={Platform.OS === 'android'}
            />
          </View>
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
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    // `height` e `paddingBottom` vêm do cálculo em runtime.
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
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    flex: 1,
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
    // A lista é a única região elástica do sheet.
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.sm,
    flexGrow: 1,
  },
  empty: {
    textAlign: 'center',
    color: colors.textMutedValue,
    fontSize: typography.size.sm,
    paddingVertical: spacing.xl,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: ROW_GAP,
  },
  rowActive: {
    backgroundColor: colors.primary,
  },
  rowText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.text,
    fontWeight: typography.weight.medium,
  },
  rowTextActive: {
    color: '#FFF',
    fontWeight: typography.weight.bold,
  },
});
