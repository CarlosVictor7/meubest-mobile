import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  Clipboard,
  Alert,
  Platform,
} from 'react-native';
import { Gift, Copy, CheckCircle, Heart, X, ChevronRight } from 'lucide-react-native';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { db } from '@shared/services/firebase';
import { useAuth } from '@features/auth/hooks/useAuth';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { createTipPixPayment, getTipStatus, TipPixResponse } from '@shared/services/paymentService';
import Toast from 'react-native-toast-message';

const MIN_TIP_AMOUNT = 10;
const POLLING_INTERVAL_MS = 3000;
const PAID_STATUSES = ['paid', 'confirmed', 'received'] as const;

type PaidStatus = typeof PAID_STATUSES[number];

function isPaidStatus(status: string): status is PaidStatus {
  return (PAID_STATUSES as readonly string[]).includes(status);
}

export function TipAfterSessionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId } = route.params;
  const { user } = useAuth();

  const [session, setSession] = useState<any>(null);
  const [supporterName, setSupporterName] = useState<string>('Acolhedor');
  const [loading, setLoading] = useState(true);

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
    if (__DEV__) console.log('[TipAfterSession] payment confirmed: setando estado de sucesso');
    setPaymentConfirmed(true);
  }, [cancelAllWatchers]);

  // ─── Iniciar detecção: Firestore onSnapshot + polling fallback ───────
  const startPaymentDetection = useCallback((tipId: string) => {
    if (__DEV__) console.log('[TipAfterSession] listening tip status:', tipId);

    // 1. Firestore onSnapshot (tempo real)
    try {
      const tipRef = doc(db, 'tips', tipId);
      const unsubscribe = onSnapshot(
        tipRef,
        (snap) => {
          if (!snap.exists()) return;
          const status = snap.data()?.status as string | undefined;
          if (__DEV__) console.log('[TipAfterSession] Firestore tip status:', status);
          if (status && isPaidStatus(status)) {
            handlePaymentConfirmed();
          }
        },
        (error) => {
          // Silencia o erro — o polling vai cobrir o fallback
          if (__DEV__) console.log('[TipAfterSession] Firestore onSnapshot error (usando polling como fallback):', error.code);
        }
      );
      unsubscribeFirestoreRef.current = unsubscribe;
    } catch (err) {
      if (__DEV__) console.log('[TipAfterSession] Erro ao configurar onSnapshot:', err);
    }

    // 2. Polling fallback a cada 3s via API
    pollingIntervalRef.current = setInterval(async () => {
      if (confirmedRef.current) return;
      try {
        if (__DEV__) console.log('[TipAfterSession] polling tip status:', tipId);
        const res = await getTipStatus(tipId);
        if (__DEV__) console.log('[TipAfterSession] tip status changed:', res.status);
        if (isPaidStatus(res.status)) {
          handlePaymentConfirmed();
        }
      } catch (err) {
        // Falha silenciosa — continua tentando
        if (__DEV__) console.log('[TipAfterSession] polling error (tentando novamente)');
      }
    }, POLLING_INTERVAL_MS);
  }, [handlePaymentConfirmed]);

  // ─── Cleanup ao desmontar ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAllWatchers();
    };
  }, [cancelAllWatchers]);

  // ─── Iniciar detecção quando pixData estiver disponível ─────────────
  useEffect(() => {
    if (pixData?.tipId && !confirmedRef.current) {
      confirmedRef.current = false;
      cancelAllWatchers();
      if (__DEV__) console.log('[TipAfterSession] pix created tipId:', pixData.tipId);
      startPaymentDetection(pixData.tipId);
    }

    return () => {
      // Quando pixData mudar (novo Pix gerado), reinicia watchers
      cancelAllWatchers();
    };
  }, [pixData?.tipId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Carregar dados da sessão e do apoiador ──────────────────────────
  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const sessionSnap = await getDoc(doc(db, 'sessions', sessionId));
        if (sessionSnap.exists() && active) {
          const data = sessionSnap.data();
          setSession({ id: sessionSnap.id, ...data });

          if (data.listenerId) {
            const userSnap = await getDoc(doc(db, 'users', data.listenerId));
            if (userSnap.exists() && active) {
              const userData = userSnap.data();
              setSupporterName(userData.name || 'Acolhedor');
            }
          }
        }
      } catch (err) {
        console.error('[TipAfterSession] Erro ao carregar dados:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [sessionId]);

  const handleSkip = () => {
    cancelAllWatchers();
    navigation.reset({
      index: 0,
      routes: [{ name: 'App' }],
    });
  };

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

    if (!session?.listenerId) {
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
        toUserId: session.listenerId,
        amount,
        relatedSessionId: sessionId,
        message: 'Agradecimento especial pelo acolhimento no MeuBest!',
      });
      // Resetar flag de confirmação para o novo Pix
      confirmedRef.current = false;
      setPaymentConfirmed(false);
      setPixData(response);
    } catch (error: any) {
      console.error('[TipAfterSession] Erro ao gerar Pix:', error);
      Alert.alert(
        'Erro ao Gerar Pix',
        error?.message || 'Ocorreu um problema ao gerar o pagamento. Tente novamente mais tarde.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando informações da sessão...</Text>
      </View>
    );
  }

  // ─── TELA 3: Pagamento Confirmado ────────────────────────────────────
  if (paymentConfirmed && pixData) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
              onPress={handleSkip}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>VOLTAR PARA O INÍCIO</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── TELA 2: Pix Gerado — Aguardando pagamento ───────────────────────
  if (pixData) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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

            {/* Exibir QR Code se disponível em Base64 */}
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

            {/* Copia e Cola */}
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
              onPress={handleSkip}
              activeOpacity={0.8}
            >
              <Text style={styles.laterBtnText}>Voltar para o Início</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── TELA 1: Escolher Valor da Gorjeta ──────────────────────────────
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {/* Botão Fechar no canto superior */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <X size={20} color={colors.textMutedValue} />
          </TouchableOpacity>

          <View style={styles.iconCircle}>
            <Gift size={32} color={colors.primary} />
          </View>

          <Text style={styles.title}>AGRADECER COM UMA GORJETA?</Text>
          <Text style={styles.subtitle}>
            Os acolhimentos no MeuBest são 100% voluntários. Se a conversa com <Text style={styles.boldText}>{supporterName}</Text> te ajudou, que tal retribuir o tempo dele com um incentivo?
          </Text>

          {/* Grid de Opções de Valor */}
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
                <Text
                  style={[
                    styles.optionSymbol,
                    selectedOption === val && styles.optionTextSelected,
                  ]}
                >
                  R$
                </Text>
                <Text
                  style={[
                    styles.optionVal,
                    selectedOption === val && styles.optionTextSelected,
                  ]}
                >
                  {val}
                </Text>
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
              <Text
                style={[
                  styles.optionCustomText,
                  selectedOption === 'custom' && styles.optionTextSelected,
                ]}
              >
                Outro Valor
              </Text>
            </TouchableOpacity>
          </View>

          {/* Campo de valor customizado */}
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
            Seu Pix vai direto para a carteira de {supporterName} (MeuBest retém apenas 15% de taxa de serviço para cobrir taxas do intermediador e manutenção).
          </Text>

          {/* Botão de envio */}
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
            onPress={handleSkip}
            activeOpacity={0.8}
          >
            <Text style={styles.laterBtnText}>Agora não, voltar ao início</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.lg,
    flexGrow: 1,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textMutedValue,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 3,
    borderColor: colors.primaryLight,
    padding: spacing.xl,
    alignItems: 'center',
    position: 'relative',
    ...shadows.sm,
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
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 4,
    borderColor: `${colors.primary}10`,
  },
  iconCircleSuccess: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 4,
    borderColor: '#D1FAE5',
  },
  title: {
    fontSize: typography.size.xxl - 2,
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
    marginBottom: spacing.xl,
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
    marginBottom: spacing.md,
  },
  optionCard: {
    flex: 1,
    minWidth: '28%',
    height: 60,
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
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.text,
  },
  optionCustomText: {
    fontSize: typography.size.sm + 1,
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
    marginBottom: spacing.md,
  },
  inputPrefix: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  customInput: {
    flex: 1,
    height: 50,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.text,
  },
  platformTaxInfo: {
    fontSize: 11,
    color: colors.textMutedValue,
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: spacing.xl,
    fontWeight: typography.weight.medium,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
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
    fontSize: typography.size.md - 1,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.widest,
  },
  laterBtn: {
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  laterBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textMutedValue,
  },
  qrCodeBox: {
    width: 180,
    height: 180,
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
    width: 180,
    height: 180,
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
    height: 50,
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
    marginTop: spacing.lg,
  },
  heartContainer: {
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
});
