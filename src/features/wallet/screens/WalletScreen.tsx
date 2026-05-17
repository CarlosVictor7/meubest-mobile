/**
 * WalletScreen — Aba Carteira
 * Fiel ao PWA: card vermelho de saldo, 3 modais, transações, dados bancários
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  TouchableOpacity, Modal, TextInput, Alert, RefreshControl, ActivityIndicator
} from 'react-native';
import {
  CreditCard, X, Landmark, FileText, Wallet,
} from 'lucide-react-native';
import { TabHeader } from '@shared/components/TabHeader';
import { BOTTOM_NAV_SCROLL_PAD } from '@shared/components';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { getWalletSummary, getWalletTransactions, requestWithdrawal, type WalletSummary, type Transaction } from '@shared/services/paymentService';
import { detectPixKeyType } from '@shared/utils/pix';

export function WalletScreen() {
  // Modals state
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [statementModal, setStatementModal] = useState(false);
  const [bankModal, setBankModal] = useState(false);

  // Form state
  const [pixKey, setPixKey] = useState('');
  const [bankName, setBankName] = useState('');
  const [withdrawAmountStr, setWithdrawAmountStr] = useState('');

  // Data state
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const loadData = async () => {
    try {
      const [sum, trans] = await Promise.all([
        getWalletSummary(),
        getWalletTransactions()
      ]);
      setSummary(sum);
      setTransactions(trans);
    } catch (err: any) {
      console.error(err);
      // Evita alertar se a tela desmontou, mas num componente de aba pode alertar
    }
  };

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const availableBalance = summary?.balanceRewards || 0;
  const withdrawAmount = parseFloat(withdrawAmountStr.replace(',', '.')) || 0;
  const canWithdraw = withdrawAmount > 0 && withdrawAmount <= availableBalance && pixKey.trim().length > 0;

  const validTransactions = transactions.filter(tx => !['failed', 'cancelled'].includes(tx.status));
  const pendingWithdrawal = transactions.find(tx => tx.type === 'withdrawal' && ['requested', 'processing', 'pending'].includes(tx.status));

  const handleWithdraw = async () => {
    if (!canWithdraw) return;
    setWithdrawLoading(true);
    try {
      await requestWithdrawal({ amount: withdrawAmount, pixKey, bankName });
      Alert.alert('Sucesso', 'Saque solicitado com sucesso!');
      setWithdrawModal(false);
      setWithdrawAmountStr('');
      loadData();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Erro ao pedir saque');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleSaveBank = () => {
    if (!pixKey.trim() || !bankName.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha a chave PIX e o banco.');
      return;
    }
    Alert.alert(
      'Dados salvos',
      'Dados salvos localmente para o próximo saque.',
      [{ text: 'OK' }]
    );
    setBankModal(false);
  };

  const mapTransactionType = (type: string) => {
    const map: Record<string, string> = {
      tip_received: 'Gorjeta recebida',
      tip_sent: 'Gorjeta enviada',
      total_fee: 'Taxa total',
      withdrawal: 'Saque',
      refund: 'Reembolso'
    };
    return map[type] || type;
  };

  const mapTransactionStatus = (status: string) => {
    const map: Record<string, string> = {
      pending: 'Pendente',
      paid: 'Pago',
      failed: 'Falhou',
      canceled: 'Cancelado'
    };
    return map[status] || status;
  };

  if (loading) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={s.scroll} 
        bounces
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <TabHeader hideControls />

        {/* ── Card vermelho de saldo ─────────────────────────────── */}
        <View style={s.padded}>
          <View style={[s.balanceCard, shadows.primary]}>
            {/* Saldo disponível */}
            <Text style={s.balLabel}>GORJETAS RECEBIDAS</Text>
            <Text style={s.balValue}>R$ {availableBalance.toFixed(2)}</Text>
            
            {/* Informações extras */}
            <View style={s.extraInfoRow}>
              <View style={s.extraInfoCol}>
                <Text style={s.extraInfoLabel}>TOTAL RECEBIDO</Text>
                <Text style={s.extraInfoVal}>R$ {(summary?.totalTipsReceived || 0).toFixed(2)}</Text>
              </View>
              <View style={s.extraInfoCol}>
                <Text style={s.extraInfoLabel}>TOTAL SACADO</Text>
                <Text style={s.extraInfoVal}>R$ {(summary?.totalWithdrawn || 0).toFixed(2)}</Text>
              </View>
            </View>
            <View style={s.extraInfoRow}>
               <View style={s.extraInfoCol}>
                <Text style={s.extraInfoLabel}>SAQUES PENDENTES</Text>
                <Text style={s.extraInfoVal}>R$ {(summary?.pendingWithdrawals || 0).toFixed(2)}</Text>
              </View>
            </View>

            <TouchableOpacity style={s.btnWhite} onPress={() => setBankModal(true)} activeOpacity={0.85}>
              <Text style={s.btnWhiteText}>DADOS DE RECEBIMENTO</Text>
            </TouchableOpacity>

            {/* Separador */}
            <View style={s.separator} />

            <TouchableOpacity style={[s.btnBlack, pendingWithdrawal && { opacity: 0.5 }]} onPress={() => { if (!pendingWithdrawal) setWithdrawModal(true); }} activeOpacity={0.85}>
              <Text style={s.btnBlackText}>{pendingWithdrawal ? 'SAQUE EM ANDAMENTO' : 'PEDIR SAQUE'}</Text>
            </TouchableOpacity>

            {/* Ver extrato */}
            <TouchableOpacity style={s.btnOutline} onPress={() => setStatementModal(true)} activeOpacity={0.85}>
              <Text style={s.btnOutlineText}>VER EXTRATO</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Saque Pendente ─────────────────────────────────────── */}
        {pendingWithdrawal && (
          <View style={s.padded}>
            <View style={[s.pendingCard, shadows.sm]}>
              <View style={s.pendingHeaderRow}>
                <View style={s.pendingIconWrap}>
                  <Landmark size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.pendingTitle}>SAQUE EM PROCESSAMENTO</Text>
                  <Text style={s.pendingDesc}>Previsão de até 10 dias.</Text>
                </View>
                <Text style={s.pendingAmount}>R$ {Math.abs(pendingWithdrawal.amount).toFixed(2)}</Text>
              </View>
              <View style={s.pendingDivider} />
              <View style={s.pendingFooterRow}>
                <Text style={s.pendingLabel}>Data da solicitação</Text>
                <Text style={s.pendingVal}>{new Date(pendingWithdrawal.createdAt as any).toLocaleDateString('pt-BR')}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Transações Recentes ────────────────────────────────── */}
        <View style={s.padded}>
          <View style={[s.whiteCard, shadows.sm]}>
            <Text style={s.cardTitle}>{'TRANSAÇÕES\nRECENTES'}</Text>
            {validTransactions.length === 0 ? (
              <View style={s.emptyWrap}>
                <View style={s.emptyCircle}>
                  <CreditCard size={28} color={`${colors.primary}40`} strokeWidth={1.5} />
                </View>
                <Text style={s.emptyText}>{'NENHUMA TRANSAÇÃO\nRECENTE.'}</Text>
              </View>
            ) : (
              <View style={s.txList}>
                {validTransactions.slice(0, 5).map((tx) => (
                  <View key={tx.id} style={s.txItem}>
                    <View style={s.txIcon}>
                      <FileText size={20} color={colors.primary} />
                    </View>
                    <View style={s.txInfo}>
                      <Text style={s.txType}>{mapTransactionType(tx.type)}</Text>
                      <Text style={s.txStatus}>{mapTransactionStatus(tx.status)}</Text>
                    </View>
                    <Text style={[s.txAmount, tx.amount > 0 ? s.txAmountPos : s.txAmountNeg]}>
                      {tx.amount > 0 ? '+' : ''}R$ {Math.abs(tx.amount).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={{ height: BOTTOM_NAV_SCROLL_PAD + 16 }} />
      </ScrollView>

      {/* ════════════════ MODAL: Dados de Recebimento ════════════════ */}
      <Modal visible={bankModal} animationType="slide" transparent onRequestClose={() => setBankModal(false)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={() => setBankModal(false)}>
          <View style={m.sheet} onStartShouldSetResponder={() => true}>
            <View style={m.handle} />
            {/* Header */}
            <View style={m.headerRow}>
              <Text style={m.titleBig}>{'DADOS DE\nRECEBIMENTO'}</Text>
              <TouchableOpacity onPress={() => setBankModal(false)} style={m.closeBtn}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={s.bankDesc}>
              Cadastre sua chave PIX para receber as gorjetas das suas sessões.
            </Text>
            {/* Chave PIX */}
            <View style={[s.fieldWrap, { marginTop: spacing.md }]}>
              <Text style={s.fieldLabel}>CHAVE PIX</Text>
              <TextInput
                style={s.input}
                placeholder="CPF, Email ou Celular"
                placeholderTextColor={colors.textMutedValue}
                value={pixKey}
                onChangeText={setPixKey}
                autoCapitalize="none"
              />
              {pixKey.trim().length > 0 && (
                <View style={s.pixTypeBadge}>
                  <Text style={s.pixTypeText}>Tipo identificado: {detectPixKeyType(pixKey)}</Text>
                </View>
              )}
            </View>
            {/* Banco */}
            <View style={[s.fieldWrap, { marginTop: spacing.md }]}>
              <Text style={s.fieldLabel}>BANCO (Opcional)</Text>
              <TextInput
                style={s.input}
                placeholder="Nome do seu banco"
                placeholderTextColor={colors.textMutedValue}
                value={bankName}
                onChangeText={setBankName}
              />
            </View>
            <TouchableOpacity style={[s.btnSave, { marginTop: spacing.xl }]} onPress={handleSaveBank} activeOpacity={0.85}>
              <Text style={s.btnSaveText}>SALVAR DADOS</Text>
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
            <Text style={m.wdTitle}>{'Resgate de\nGorjetas'}</Text>
            <Text style={m.wdDesc}>
              Você pode resgatar suas gorjetas diretamente para sua conta bancária PIX.
            </Text>

            {/* Saldo card */}
            <View style={m.wdBalCard}>
              <View style={m.wdBalRow}>
                <Text style={m.wdBalLabel}>SALDO DISPONÍVEL</Text>
                <Text style={m.wdBalVal}>R$ {availableBalance.toFixed(2)}</Text>
              </View>
            </View>

            {/* Input Valor */}
            <View style={[s.fieldWrap, { marginBottom: spacing.md }]}>
              <Text style={s.fieldLabel}>VALOR DO SAQUE</Text>
              <TextInput
                style={s.input}
                placeholder="0,00"
                placeholderTextColor={colors.textMutedValue}
                value={withdrawAmountStr}
                onChangeText={setWithdrawAmountStr}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Warning missing PIX */}
            {pixKey.trim().length === 0 && (
              <View style={m.wdWarn}>
                <Text style={m.wdWarnIcon}>⚠️</Text>
                <Text style={m.wdWarnText}>
                  Você precisa configurar uma chave PIX antes de sacar.
                </Text>
              </View>
            )}

            {/* Warning amount */}
            {withdrawAmountStr.length > 0 && withdrawAmount > availableBalance && (
              <View style={m.wdWarn}>
                <Text style={m.wdWarnIcon}>⚠️</Text>
                <Text style={m.wdWarnText}>
                  Saldo insuficiente para este valor.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[m.wdBtn, (!canWithdraw || withdrawLoading) && m.wdBtnDisabled]}
              onPress={handleWithdraw}
              activeOpacity={canWithdraw ? 0.85 : 1}
              disabled={!canWithdraw || withdrawLoading}
            >
              {withdrawLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={[m.wdBtnText, !canWithdraw && m.wdBtnTextDisabled]}>SOLICITAR SAQUE</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ════════════════ MODAL: Extrato Completo ═════════════════ */}
      <Modal visible={statementModal} animationType="slide" transparent onRequestClose={() => setStatementModal(false)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={() => setStatementModal(false)}>
          <View style={[m.sheet, { minHeight: '80%' }]} onStartShouldSetResponder={() => true}>
            <View style={m.handle} />
            <View style={m.headerRow}>
              <Text style={m.titleBig}>{'EXTRATO\nCOMPLETO'}</Text>
              <TouchableOpacity onPress={() => setStatementModal(false)} style={m.closeBtn}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {validTransactions.length === 0 ? (
                <View style={s.emptyWrap}>
                  <Text style={s.emptyText}>{'NENHUMA TRANSAÇÃO\nENCONTRADA.'}</Text>
                </View>
              ) : (
                <View style={s.txList}>
                  {validTransactions.map((tx) => (
                    <View key={tx.id} style={s.txItem}>
                      <View style={s.txIcon}>
                        <FileText size={20} color={colors.primary} />
                      </View>
                      <View style={s.txInfo}>
                        <Text style={s.txType}>{mapTransactionType(tx.type)}</Text>
                        <Text style={s.txStatus}>{mapTransactionStatus(tx.status)}</Text>
                      </View>
                      <Text style={[s.txAmount, tx.amount > 0 ? s.txAmountPos : s.txAmountNeg]}>
                        {tx.amount > 0 ? '+' : ''}R$ {Math.abs(tx.amount).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
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
  extraInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  extraInfoCol: {
    flex: 1,
  },
  extraInfoLabel: {
    fontSize: typography.size.xs - 2,
    fontWeight: typography.weight.bold,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: typography.tracking.wide,
  },
  extraInfoVal: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textInverted,
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
    marginTop: spacing.xs,
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

  // Pending Card
  pendingCard: {
    backgroundColor: '#FFF0F0',
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: '#FFD6D9',
    padding: spacing.lg,
    marginBottom: spacing.xs,
  },
  pendingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pendingIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(225,48,29,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  pendingTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: typography.tracking.wider,
  },
  pendingDesc: {
    fontSize: typography.size.xs,
    color: colors.primary,
    opacity: 0.7,
    fontWeight: typography.weight.bold,
  },
  pendingAmount: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.primary,
  },
  pendingDivider: {
    height: 1, backgroundColor: 'rgba(225,48,29,0.1)', marginVertical: spacing.sm,
  },
  pendingFooterRow: {
    flexDirection: 'row', justifyContent: 'space-between',
  },
  pendingLabel: {
    fontSize: typography.size.xs,
    color: colors.primary,
    opacity: 0.7,
    fontWeight: typography.weight.bold,
  },
  pendingVal: {
    fontSize: typography.size.xs,
    color: colors.primary,
    fontWeight: typography.weight.bold,
  },

  // Pix Badge
  pixTypeBadge: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  pixTypeText: {
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    fontWeight: typography.weight.bold,
  },

  // Cards brancos
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

  // Tx List
  txList: {
    gap: spacing.md,
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txInfo: {
    flex: 1,
  },
  txType: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  txStatus: {
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
  },
  txAmount: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.black,
  },
  txAmountPos: {
    color: colors.success,
  },
  txAmountNeg: {
    color: colors.text,
  },

  // Inputs e labels (do modal bancário e saque)
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
