/**
 * WalletScreen — Aba Carteira
 * Fiel ao PWA: card vermelho de saldo, 3 modais, transações, dados bancários
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import {
  CreditCard, X, Landmark, FileText, Wallet,
} from 'lucide-react-native';
import { TabHeader } from '@shared/components/TabHeader';
import { BOTTOM_NAV_SCROLL_PAD } from '@shared/components';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';

// ─── Credit amount options ────────────────────────────────────────────────────
const CREDIT_OPTIONS = [20, 50, 100];

export function WalletScreen() {
  // State
  const [creditsModal, setCreditsModal] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [statementModal, setStatementModal] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(50);
  const [pixKey, setPixKey] = useState('');
  const [bankName, setBankName] = useState('');

  // Dados locais (sem integração real ainda)
  const availableBalance = 0;
  const withdrawableBalance = 0;
  const transactions: any[] = [];
  const canWithdraw = withdrawableBalance >= 100;

  const handlePay = () => {
    Alert.alert(
      'Integração pendente',
      'A integração de pagamento será conectada na próxima etapa.',
      [{ text: 'OK' }]
    );
  };

  const handleWithdraw = () => {
    if (!canWithdraw) return;
    Alert.alert(
      'Integração pendente',
      'A integração de saque será conectada na próxima etapa.',
      [{ text: 'OK' }]
    );
  };

  const handleSaveBank = () => {
    if (!pixKey.trim() || !bankName.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha a chave PIX e o banco.');
      return;
    }
    Alert.alert(
      'Dados salvos',
      'Dados salvos localmente. A integração será conectada na próxima etapa.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} bounces>
        <TabHeader hideControls />

        {/* ── Card vermelho de saldo ─────────────────────────────── */}
        <View style={s.padded}>
          <View style={[s.balanceCard, shadows.primary]}>
            {/* Saldo disponível */}
            <Text style={s.balLabel}>SALDO DISPONÍVEL</Text>
            <Text style={s.balValue}>R$ {availableBalance}</Text>
            <TouchableOpacity style={s.btnWhite} onPress={() => setCreditsModal(true)} activeOpacity={0.85}>
              <Text style={s.btnWhiteText}>ADICIONAR CRÉDITOS</Text>
            </TouchableOpacity>

            {/* Separador */}
            <View style={s.separator} />

            {/* Saldo para resgate */}
            <Text style={s.balLabel}>SALDO PARA RESGATE</Text>
            <Text style={s.balValue}>R$ {withdrawableBalance}</Text>
            <TouchableOpacity style={s.btnBlack} onPress={() => setWithdrawModal(true)} activeOpacity={0.85}>
              <Text style={s.btnBlackText}>PEDIR SAQUE</Text>
            </TouchableOpacity>

            {/* Ver extrato */}
            <TouchableOpacity style={s.btnOutline} onPress={() => setStatementModal(true)} activeOpacity={0.85}>
              <Text style={s.btnOutlineText}>VER EXTRATO</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Transações Recentes ────────────────────────────────── */}
        <View style={s.padded}>
          <View style={[s.whiteCard, shadows.sm]}>
            <Text style={s.cardTitle}>{'TRANSAÇÕES\nRECENTES'}</Text>
            {transactions.length === 0 ? (
              <View style={s.emptyWrap}>
                <View style={s.emptyCircle}>
                  <CreditCard size={28} color={`${colors.primary}40`} strokeWidth={1.5} />
                </View>
                <Text style={s.emptyText}>{'NENHUMA TRANSAÇÃO\nRECENTE.'}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Dados Bancários ────────────────────────────────────── */}
        <View style={s.padded}>
          <View style={[s.whiteCard, shadows.sm]}>
            <View style={s.bankHeader}>
              <Text style={s.cardTitle}>{'DADOS\nBANCÁRIOS'}</Text>
              <View style={s.bankIconWrap}>
                <CreditCard size={22} color={colors.primary} strokeWidth={1.8} />
              </View>
            </View>
            <Text style={s.bankDesc}>
              Cadastre sua chave PIX para receber as gorjetas das suas sessões como ouvinte.
            </Text>
            {/* Chave PIX */}
            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>CHAVE PIX</Text>
              <TextInput
                style={s.input}
                placeholder="CPF, Email ou Celular"
                placeholderTextColor={colors.textMutedValue}
                value={pixKey}
                onChangeText={setPixKey}
                autoCapitalize="none"
              />
            </View>
            {/* Banco */}
            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>BANCO</Text>
              <TextInput
                style={s.input}
                placeholder="Nome do seu banco"
                placeholderTextColor={colors.textMutedValue}
                value={bankName}
                onChangeText={setBankName}
              />
            </View>
            <TouchableOpacity style={s.btnSave} onPress={handleSaveBank} activeOpacity={0.85}>
              <Text style={s.btnSaveText}>SALVAR DADOS</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: BOTTOM_NAV_SCROLL_PAD + 16 }} />
      </ScrollView>

      {/* ════════════════ MODAL: Adicionar Créditos ════════════════ */}
      <Modal visible={creditsModal} animationType="slide" transparent onRequestClose={() => setCreditsModal(false)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={() => setCreditsModal(false)}>
          <View style={m.sheet} onStartShouldSetResponder={() => true}>
            <View style={m.handle} />
            {/* Header */}
            <View style={m.headerRow}>
              <Text style={m.titleBig}>{'ADICIONAR\nCRÉDITOS'}</Text>
              <TouchableOpacity onPress={() => setCreditsModal(false)} style={m.closeBtn}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            {/* Amount pills */}
            <View style={m.pillRow}>
              {CREDIT_OPTIONS.map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[m.pill, selectedAmount === v && m.pillActive]}
                  onPress={() => setSelectedAmount(v)}
                  activeOpacity={0.8}
                >
                  <Text style={[m.pillText, selectedAmount === v && m.pillTextActive]}>
                    R$ {v}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Pagamento seguro */}
            <View style={m.secureCard}>
              <Text style={m.secureLabel}>PAGAMENTO SEGURO</Text>
              <View style={m.secureInner}>
                <CreditCard size={32} color={colors.primary} strokeWidth={1.5} />
                <Text style={m.secureName}>CARTÃO DE CRÉDITO</Text>
              </View>
              <Text style={m.stripeText}>PROCESSADO COM SEGURANÇA PELO STRIPE</Text>
            </View>
            {/* Botão pagar */}
            <TouchableOpacity style={m.payBtn} onPress={handlePay} activeOpacity={0.85}>
              <Text style={m.payBtnText}>PAGAR AGORA</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ════════════════ MODAL: Pedir Saque ═══════════════════════ */}
      <Modal visible={withdrawModal} animationType="slide" transparent onRequestClose={() => setWithdrawModal(false)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={() => setWithdrawModal(false)}>
          <View style={m.sheet} onStartShouldSetResponder={() => true}>
            <View style={m.handle} />
            {/* Icon + close */}
            <View style={m.headerRow}>
              <View style={m.wdIconWrap}>
                <Landmark size={24} color={colors.primary} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => setWithdrawModal(false)} style={m.closeBtn}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={m.wdTitle}>{'Resgate de\nRecompensas'}</Text>
            <Text style={m.wdDesc}>
              Você pode resgatar suas recompensas recebidas por acolhimentos diretamente para sua conta bancária.
            </Text>
            {/* Saldo card */}
            <View style={m.wdBalCard}>
              <View style={m.wdBalRow}>
                <Text style={m.wdBalLabel}>SALDO DISPONÍVEL</Text>
                <Text style={m.wdBalVal}>R$ {withdrawableBalance}</Text>
              </View>
              <View style={m.wdBalRow}>
                <Text style={m.wdBalLabel}>MÍNIMO PARA SAQUE</Text>
                <Text style={[m.wdBalVal, { color: colors.primary }]}>R$ 100</Text>
              </View>
            </View>
            {/* Warning */}
            {!canWithdraw && (
              <View style={m.wdWarn}>
                <Text style={m.wdWarnIcon}>⚠️</Text>
                <Text style={m.wdWarnText}>
                  Você ainda não atingiu o valor mínimo de R$ 100 para realizar o saque.
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[m.wdBtn, !canWithdraw && m.wdBtnDisabled]}
              onPress={handleWithdraw}
              activeOpacity={canWithdraw ? 0.85 : 1}
              disabled={!canWithdraw}
            >
              <Text style={[m.wdBtnText, !canWithdraw && m.wdBtnTextDisabled]}>CONTINUAR PARA SAQUE</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ════════════════ MODAL: Extrato Completo ═════════════════ */}
      <Modal visible={statementModal} animationType="slide" transparent onRequestClose={() => setStatementModal(false)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={() => setStatementModal(false)}>
          <View style={[m.sheet, { minHeight: 340 }]} onStartShouldSetResponder={() => true}>
            <View style={m.handle} />
            <View style={m.headerRow}>
              <Text style={m.titleBig}>{'EXTRATO\nCOMPLETO'}</Text>
              <TouchableOpacity onPress={() => setStatementModal(false)} style={m.closeBtn}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            {transactions.length === 0 ? (
              <View style={s.emptyWrap}>
                <Text style={s.emptyText}>{'NENHUMA TRANSAÇÃO\nENCONTRADA.'}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Screen styles ───────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  // Card vermelho
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  balLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: typography.tracking.wider,
    textTransform: 'uppercase',
  },
  balValue: {
    fontSize: 42,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    lineHeight: 46,
    marginBottom: spacing.xs,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: spacing.sm,
  },
  btnWhite: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btnWhiteText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: typography.tracking.wider,
  },
  btnBlack: {
    backgroundColor: colors.dark,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btnBlackText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.wider,
  },
  btnOutline: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btnOutlineText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.wider,
  },

  // Cards brancos (transações + dados bancários)
  whiteCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 3,
    borderColor: colors.primaryLight,
    padding: spacing.xl,
    gap: spacing.md,
  },
  cardTitle: {
    fontSize: 30,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: -0.5,
    lineHeight: 34,
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  emptyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${colors.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: 'rgba(26,26,26,0.2)',
    letterSpacing: typography.tracking.wider,
    textAlign: 'center',
    lineHeight: 20,
    textTransform: 'uppercase',
  },

  // Dados bancários
  bankHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bankIconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankDesc: {
    fontSize: typography.size.base,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 22,
  },
  fieldWrap: { gap: spacing.xs },
  fieldLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
    letterSpacing: typography.tracking.wider,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.text,
  },
  btnSave: {
    backgroundColor: colors.dark,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  btnSaveText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.wider,
  },
});

// ─── Modal styles ────────────────────────────────────────────────────────────
const m = StyleSheet.create({
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
  },
  handle: {
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  titleBig: {
    fontSize: 30,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center', alignItems: 'center',
  },

  // Adicionar créditos
  pillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  pill: {
    flex: 1,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.text,
  },
  pillTextActive: { color: colors.textInverted },
  secureCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  secureLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
    letterSpacing: typography.tracking.wider,
  },
  secureInner: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    width: '70%',
  },
  secureName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: typography.tracking.wide,
  },
  stripeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary,
    letterSpacing: typography.tracking.wide,
    textAlign: 'center',
  },
  payBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    ...shadows.primary,
  },
  payBtnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.wider,
  },

  // Pedir saque
  wdIconWrap: {
    width: 56, height: 56, borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  wdTitle: {
    fontSize: 28,
    fontWeight: typography.weight.black,
    color: colors.text,
    lineHeight: 32,
    marginBottom: spacing.sm,
  },
  wdDesc: {
    fontSize: typography.size.base,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  wdBalCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  wdBalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wdBalLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
    letterSpacing: typography.tracking.wider,
  },
  wdBalVal: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.text,
  },
  wdWarn: {
    flexDirection: 'row',
    backgroundColor: '#FCE7E9',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  wdWarnIcon: { fontSize: 16 },
  wdWarnText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.medium,
    lineHeight: 18,
  },
  wdBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  wdBtnDisabled: {
    backgroundColor: '#FCE7E9',
  },
  wdBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.wider,
  },
  wdBtnTextDisabled: {
    color: 'rgba(225,48,29,0.4)',
  },
});
