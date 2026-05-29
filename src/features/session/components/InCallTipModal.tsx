import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Image,
  Clipboard,
  Alert,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Gift, Copy, CheckCircle, Heart, X, ChevronRight } from 'lucide-react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@shared/services/firebase';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { createTipPixPayment, getTipStatus, TipPixResponse } from '@shared/services/paymentService';
import Toast from 'react-native-toast-message';
import { TIP_FEE_MESSAGE } from '@shared/constants/fees';

const MIN_TIP_AMOUNT = 10;
const POLLING_INTERVAL_MS = 3000;
const PAID_STATUSES = ['paid', 'confirmed', 'received'] as const;

type PaidStatus = typeof PAID_STATUSES[number];

function isPaidStatus(status: string): status is PaidStatus {
  return (PAID_STATUSES as readonly string[]).includes(status);
}

interface InCallTipModalProps {
  visible: boolean;
  onClose: () => void;
  sessionId: string;
  listenerId: string;
  supporterName: string;
}

export function InCallTipModal({
  visible,
  onClose,
  sessionId,
  listenerId,
  supporterName,
}: InCallTipModalProps) {
  // Estados do fluxo de gorjeta
  const [selectedOption, setSelectedOption] = useState<number | 'custom'>(10);
  const [customValue, setCustomValue] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Estados pós-geração do Pix
  const [pixData, setPixData] = useState<TipPixResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  // Refs para controle de detecção de pagamento
  const confirmedRef = useRef(false);
  const unsubscribeFirestoreRef = useRef<(() => void) | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Limpar listeners e polling ──────────────────────────────────────
  const cancelAllWatchers = useCallback(() => {
    if (unsubscribeFirestoreRef.current) {
      unsubscribeFirestoreRef.current();
      unsubscribeFirestoreRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // ─── Confirmar pagamento (chamado por qualquer fonte) ────────────────
  const handlePaymentConfirmed = useCallback(() => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    cancelAllWatchers();
    if (__DEV__) console.log('[InCallTipModal] payment confirmed: setando estado de sucesso');
    setPaymentConfirmed(true);
  }, [cancelAllWatchers]);

  // ─── Iniciar detecção: Firestore onSnapshot + polling fallback ───────
  const startPaymentDetection = useCallback((tipId: string) => {
    if (__DEV__) console.log('[InCallTipModal] listening tip status:', tipId);

    // 1. Firestore onSnapshot (tempo real)
    try {
      const tipRef = doc(db, 'tips', tipId);
      const unsubscribe = onSnapshot(
        tipRef,
        (snap) => {
          if (!snap.exists()) return;
          const status = snap.data()?.status as string | undefined;
          if (__DEV__) console.log('[InCallTipModal] Firestore tip status:', status);
          if (status && isPaidStatus(status)) {
            handlePaymentConfirmed();
          }
        },
        (error) => {
          if (__DEV__) console.log('[InCallTipModal] Firestore onSnapshot error:', error.code);
        }
      );
      unsubscribeFirestoreRef.current = unsubscribe;
    } catch (err) {
      if (__DEV__) console.log('[InCallTipModal] Erro ao configurar onSnapshot:', err);
    }

    // 2. Polling fallback a cada 3s via API
    pollingIntervalRef.current = setInterval(async () => {
      if (confirmedRef.current) return;
      try {
        if (__DEV__) console.log('[InCallTipModal] polling tip status:', tipId);
        const res = await getTipStatus(tipId);
        if (__DEV__) console.log('[InCallTipModal] tip status changed:', res.status);
        if (isPaidStatus(res.status)) {
          handlePaymentConfirmed();
        }
      } catch (err) {
        if (__DEV__) console.log('[InCallTipModal] polling error (tentando novamente)');
      }
    }, POLLING_INTERVAL_MS);
  }, [handlePaymentConfirmed]);

  // ─── Cleanup ao desmontar ou fechar ──────────────────────────────────
  useEffect(() => {
    if (!visible) {
      cancelAllWatchers();
      // Resetar estado ao fechar
      setPixData(null);
      setPaymentConfirmed(false);
      confirmedRef.current = false;
      setSelectedOption(10);
      setCustomValue('');
    }
    return () => {
      cancelAllWatchers();
    };
  }, [visible, cancelAllWatchers]);

  // ─── Iniciar detecção quando pixData estiver disponível ─────────────
  useEffect(() => {
    if (pixData?.tipId && !confirmedRef.current && visible) {
      confirmedRef.current = false;
      cancelAllWatchers();
      if (__DEV__) console.log('[InCallTipModal] pix created tipId:', pixData.tipId);
      startPaymentDetection(pixData.tipId);
    }
    return () => {
      cancelAllWatchers();
    };
  }, [pixData?.tipId, visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopyPix = () => {
    if (pixData?.pixCopyPaste) {
      Clipboard.setString(pixData.pixCopyPaste);
      setCopied(true);
      Toast.show({
        type: 'success',
        text1: 'Código Copiado!',
        text2: 'Cole no aplicativo do seu banco para pagar.',
      });
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleCreatePix = async () => {
    let amount = 0;
    if (selectedOption === 'custom') {
      const parsed = parseFloat(customValue.replace(',', '.'));
      if (isNaN(parsed) || parsed < MIN_TIP_AMOUNT) {
        Toast.show({
          type: 'error',
          text1: 'Valor Inválido',
          text2: `O valor mínimo para gorjeta via Pix é R$ ${MIN_TIP_AMOUNT},00.`,
        });
        return;
      }
      amount = parsed;
    } else {
      amount = selectedOption;
    }

    if (!listenerId) {
      Toast.show({
        type: 'error',
        text1: 'Apoiador Indisponível',
        text2: 'Não foi possível identificar o recebedor da gorjeta.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await createTipPixPayment({
        toUserId: listenerId,
        amount,
        relatedSessionId: sessionId,
        message: 'Agradecimento especial pelo acolhimento no MeuBest!',
      });
      confirmedRef.current = false;
      setPaymentConfirmed(false);
      setPixData(response);
    } catch (error: any) {
      console.error('[InCallTipModal] Erro ao gerar Pix:', error);
      Alert.alert(
        'Erro ao Gerar Pix',
        error?.message || 'Ocorreu um problema ao gerar o pagamento. Tente novamente mais tarde.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderContent = () => {
    // ─── TELA 3: Pagamento Confirmado ────────────────────────────────────
    if (paymentConfirmed && pixData) {
      return (
        <View style={styles.card}>
          <View style={styles.iconCircleSuccess}>
            <CheckCircle size={32} color="#10B981" />
          </View>
          <Text style={styles.title}>PAGAMENTO CONFIRMADO! 🎉</Text>
          <Text style={styles.subtitle}>
            Obrigado por apoiar este acolhedor. Sua gorjeta de{' '}
            <Text style={styles.boldText}>R$ {pixData.amountGross.toFixed(2).replace('.', ',')}</Text>{' '}
            foi recebida com sucesso por{' '}
            <Text style={styles.boldText}>{supporterName}</Text>.
          </Text>
          <View style={styles.heartContainer}>
            <Heart size={60} color="#EF4444" fill="#EF4444" />
          </View>
          <TouchableOpacity
            style={[styles.button, styles.confirmBtn, shadows.primary]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>FECHAR E VOLTAR PARA CHAMADA</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // ─── TELA 2: Pix Gerado — Aguardando pagamento ───────────────────────
    if (pixData) {
      return (
        <View style={styles.card}>
          <View style={styles.iconCircleSuccess}>
            <CheckCircle size={32} color="#10B981" />
          </View>
          <Text style={styles.title}>CÓDIGO PIX GERADO</Text>
          <Text style={styles.subtitle}>
            Escaneie o QR Code ou copie o código abaixo para enviar a gorjeta de{' '}
            <Text style={styles.boldText}>R$ {pixData.amountGross.toFixed(2).replace('.', ',')}</Text>{' '}
            para <Text style={styles.boldText}>{supporterName}</Text>.
          </Text>

          {pixData.pixQrCodeBase64 ? (
            <View style={styles.qrCodeBox}>
              <Image
                source={{ uri: `data:image/png;base64,${pixData.pixQrCodeBase64}` }}
                style={styles.qrCodeImage}
              />
            </View>
          ) : (
            <View style={styles.qrCodeFallback}>
              <Gift size={48} color={colors.primary} />
              <Text style={styles.qrCodeFallbackText}>Pix Gerado</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.copyBox}
            activeOpacity={0.8}
            onPress={handleCopyPix}
          >
            <Text style={styles.copyText} numberOfLines={1}>
              {pixData.pixCopyPaste || 'Código copia e cola'}
            </Text>
            <View style={styles.copyIconBox}>
              <Copy size={16} color={colors.primary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, shadows.primary]}
            onPress={handleCopyPix}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>{copied ? 'CÓDIGO COPIADO!' : 'COPIAR CÓDIGO PIX'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.laterBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.laterBtnText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // ─── TELA 1: Escolher Valor da Gorjeta ──────────────────────────────
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <X size={20} color={colors.textMutedValue} />
        </TouchableOpacity>

        <View style={styles.iconCircle}>
          <Gift size={32} color={colors.primary} />
        </View>

        <Text style={styles.title}>AGRADECER COM UMA GORJETA?</Text>
        <Text style={styles.subtitle}>
          Os acolhimentos no MeuBest são voluntários. Se a conversa com <Text style={styles.boldText}>{supporterName}</Text> te ajudou, que tal retribuir o tempo dele com um incentivo?
        </Text>

        <View style={styles.grid}>
          {[10, 20, 50].map((val) => (
            <TouchableOpacity
              key={val}
              style={[
                styles.optionCard,
                selectedOption === val && styles.optionCardSelected,
              ]}
              onPress={() => setSelectedOption(val)}
              activeOpacity={0.8}
            >
              <Text style={[styles.optionSymbol, selectedOption === val && styles.optionTextSelected]}>R$</Text>
              <Text style={[styles.optionVal, selectedOption === val && styles.optionTextSelected]}>{val}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[
              styles.optionCard,
              selectedOption === 'custom' && styles.optionCardSelected,
              styles.customOptionCard,
            ]}
            onPress={() => setSelectedOption('custom')}
            activeOpacity={0.8}
          >
            <Text style={[styles.optionCustomText, selectedOption === 'custom' && styles.optionTextSelected]}>
              Outro Valor
            </Text>
          </TouchableOpacity>
        </View>

        {selectedOption === 'custom' && (
          <View style={styles.customInputContainer}>
            <Text style={styles.inputPrefix}>R$</Text>
            <TextInput
              style={styles.customInput}
              placeholder="0,00"
              keyboardType="numeric"
              value={customValue}
              onChangeText={setCustomValue}
              maxLength={6}
              autoFocus
            />
          </View>
        )}

        <Text style={styles.platformTaxInfo}>
          {TIP_FEE_MESSAGE}
        </Text>

        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled, shadows.primary]}
          onPress={handleCreatePix}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.textInverted} />
          ) : (
            <View style={styles.btnContent}>
              <Text style={styles.buttonText}>ENVIAR GORJETA VIA PIX</Text>
              <ChevronRight size={18} color={colors.textInverted} />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.laterBtn}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Text style={styles.laterBtnText}>Agora não, fechar</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderContent()}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: 3,
    borderColor: colors.primaryLight,
    padding: spacing.xl,
    alignItems: 'center',
    position: 'relative',
    ...shadows.sm,
    maxHeight: '90%',
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 4,
    borderColor: `${colors.primary}10`,
  },
  iconCircleSuccess: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 4,
    borderColor: '#D1FAE5',
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: typography.weight.medium,
    marginBottom: spacing.lg,
  },
  boldText: {
    fontWeight: typography.weight.black,
    color: colors.primary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    width: '100%',
    marginBottom: spacing.sm,
  },
  optionCard: {
    flex: 1,
    minWidth: '28%',
    height: 50,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: '#EAD7CC',
    backgroundColor: '#FDF8F5',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customOptionCard: {
    flex: 1.2,
  },
  optionCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionSymbol: {
    fontSize: typography.size.xs + 1,
    fontWeight: typography.weight.bold,
    color: colors.textMutedValue,
    marginRight: 2,
  },
  optionVal: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.text,
  },
  optionCustomText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.text,
  },
  optionTextSelected: {
    color: colors.textInverted,
  },
  customInputContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF8F5',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  inputPrefix: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  customInput: {
    flex: 1,
    height: 46,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.text,
  },
  platformTaxInfo: {
    fontSize: 11,
    color: colors.textMutedValue,
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: spacing.md,
    fontWeight: typography.weight.medium,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  buttonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.widest,
  },
  laterBtn: {
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  laterBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textMutedValue,
  },
  qrCodeBox: {
    width: 160,
    height: 160,
    padding: spacing.xs,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#EAD7CC',
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  qrCodeImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  qrCodeFallback: {
    width: 160,
    height: 160,
    backgroundColor: '#FDF8F5',
    borderWidth: 2,
    borderColor: '#EAD7CC',
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  qrCodeFallbackText: {
    marginTop: spacing.xs,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textMutedValue,
  },
  copyBox: {
    width: '100%',
    height: 46,
    backgroundColor: '#FDF8F5',
    borderWidth: 2,
    borderColor: '#EAD7CC',
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  copyText: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  copyIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  confirmBtn: {
    backgroundColor: '#10B981',
  },
  heartContainer: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
});
