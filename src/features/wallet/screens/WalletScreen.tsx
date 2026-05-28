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
import { detectPixKeyType, maskPixKey, PixKeyType, getPixValidationError, formatCpf, formatCnpj, formatPhoneBr, normalizePixKey, getFriendlyPixTypeLabel } from '@shared/utils/pix';
import { formatTransactionDate, getTransactionDate } from '@shared/utils/date';
import { useAuth } from '@features/auth/hooks/useAuth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@shared/services/firebase';

export function WalletScreen() {
  // Modals state
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [statementModal, setStatementModal] = useState(false);
  const [bankModal, setBankModal] = useState(false);

  // Form state
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>('CPF');
  const [bankName, setBankName] = useState('');
  const [withdrawAmountStr, setWithdrawAmountStr] = useState('');

  // Data state
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const { user, profile } = useAuth();
  const hasBankDetails = Boolean(profile?.bankDetails?.pix);
  const [isEditingBankDetails, setIsEditingBankDetails] = useState(false);

  // Initialize pixKey, bankName and pixKeyType from profile when not editing
  useEffect(() => {
    if (!isEditingBankDetails && profile?.bankDetails) {
      const initialPix = profile.bankDetails.pix || '';
      setBankName(profile.bankDetails.bankName || '');
      
      const savedType = profile.bankDetails.pixKeyType as PixKeyType;
      let detectedType: PixKeyType = 'CPF';
      if (savedType) {
        detectedType = savedType;
      } else if (initialPix.trim().length > 0) {
        const detected = detectPixKeyType(initialPix);
        if (detected === 'CPF') detectedType = 'CPF';
        else if (detected === 'CNPJ') detectedType = 'CNPJ';
        else if (detected === 'E-mail') detectedType = 'EMAIL';
        else if (detected === 'Celular') detectedType = 'PHONE';
        else detectedType = 'EVP';
      }
      setPixKeyType(detectedType);

      let formatted = initialPix;
      if (detectedType === 'CPF') formatted = formatCpf(initialPix);
      else if (detectedType === 'CNPJ') formatted = formatCnpj(initialPix);
      else if (detectedType === 'PHONE') formatted = formatPhoneBr(initialPix);
      setPixKey(formatted);
    }
  }, [isEditingBankDetails, profile?.bankDetails]);

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
  const pixValidationError = pixKey.trim().length > 0 ? getPixValidationError(pixKeyType, pixKey) : '';
  const canWithdraw = withdrawAmount > 0 && withdrawAmount <= availableBalance && pixKey.trim().length > 0 && !pixValidationError;

  const validTransactions = (transactions || []).filter(tx => {
    if (!tx) return false;
    if (['failed', 'cancelled', 'rejected', 'refunded', 'error'].includes(tx.status)) {
      return false;
    }
    if (tx.type === 'withdrawal' && (tx as any).metadata?.provider === 'manual' && ['requested', 'processing', 'pending'].includes(tx.status)) {
      return false;
    }
    return true;
  });

  const validPendingWithdrawal = (transactions || []).find(tx => {
    const isPending = tx.type === 'withdrawal' && ['requested', 'processing', 'pending'].includes(tx.status);
    if (!isPending) return false;
    
    const txDateRaw = getTransactionDate(tx);
    let txDate = new Date();
    if (txDateRaw) {
      if (txDateRaw instanceof Date) {
        txDate = txDateRaw;
      } else if (typeof txDateRaw === 'object') {
        if ('seconds' in txDateRaw) txDate = new Date(txDateRaw.seconds * 1000);
        else if ('_seconds' in txDateRaw) txDate = new Date(txDateRaw._seconds * 1000);
        else if ('toDate' in txDateRaw && typeof (txDateRaw as any).toDate === 'function') txDate = (txDateRaw as any).toDate();
      } else if (typeof txDateRaw === 'string' || typeof txDateRaw === 'number') {
        const d = new Date(txDateRaw);
        if (!isNaN(d.getTime())) txDate = d;
      }
    }
    
    if (isNaN(txDate.getTime())) return false;
    const diffDays = (new Date().getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 10) return false;

    if ((tx as any).metadata?.provider === 'manual') return false;

    return true;
  });

  const handleWithdraw = async () => {
    if (!canWithdraw) return;
    setWithdrawLoading(true);
    try {
      // Remover bankName do payload de saque no mobile (Task 12A)
      await requestWithdrawal({ amount: withdrawAmount, pixKey, pixKeyType });
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

  const handleSaveBank = async () => {
    if (!pixKey.trim()) {
      Alert.alert('Chave PIX obrigatória', 'Preencha a chave PIX.');
      return;
    }
    const validationError = getPixValidationError(pixKeyType, pixKey);
    if (validationError) {
      Alert.alert('Erro de validação', validationError);
      return;
    }
    if (!user?.uid) return;
    try {
      const normalizedPix = normalizePixKey(pixKeyType, pixKey);
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        bankDetails: {
          pix: normalizedPix,
          bankName: bankName.trim(),
          pixKeyType: pixKeyType,
        }
      }, { merge: true });
      Alert.alert('Sucesso', 'Dados salvos com sucesso.');
      setIsEditingBankDetails(false);
      setBankModal(false);
    } catch (err: any) {
      Alert.alert('Erro', 'Não foi possível salvar os dados bancários.');
    }
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

            <TouchableOpacity style={[s.btnBlack, validPendingWithdrawal && { opacity: 0.5 }]} onPress={() => { if (!validPendingWithdrawal) setWithdrawModal(true); }} activeOpacity={0.85}>
              <Text style={s.btnBlackText}>{validPendingWithdrawal ? 'SAQUE EM ANDAMENTO' : 'PEDIR SAQUE'}</Text>
            </TouchableOpacity>

            {/* Ver extrato */}
            <TouchableOpacity style={s.btnOutline} onPress={() => setStatementModal(true)} activeOpacity={0.85}>
              <Text style={s.btnOutlineText}>VER EXTRATO</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Saque Pendente ─────────────────────────────────────── */}
        {validPendingWithdrawal && (() => {
          const txDateRaw = getTransactionDate(validPendingWithdrawal);
          let requestDate = new Date();
          if (txDateRaw) {
            if (txDateRaw instanceof Date) {
              requestDate = txDateRaw;
            } else if (typeof txDateRaw === 'object') {
              if ('seconds' in txDateRaw) requestDate = new Date(txDateRaw.seconds * 1000);
              else if ('_seconds' in txDateRaw) requestDate = new Date(txDateRaw._seconds * 1000);
              else if ('toDate' in txDateRaw && typeof (txDateRaw as any).toDate === 'function') requestDate = (txDateRaw as any).toDate();
            } else if (typeof txDateRaw === 'string' || typeof txDateRaw === 'number') {
              const d = new Date(txDateRaw);
              if (!isNaN(d.getTime())) requestDate = d;
            }
          }
          const limitDate = new Date(requestDate);
          limitDate.setDate(limitDate.getDate() + 10);
          
          const pixKeyUsed = validPendingWithdrawal.metadata?.pixKey || profile?.bankDetails?.pix || '';
          const bankNameUsed = validPendingWithdrawal.metadata?.bankName || profile?.bankDetails?.bankName || '-';
          
          return (
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
                  <Text style={s.pendingAmount}>R$ {Math.abs(validPendingWithdrawal.amount).toFixed(2)}</Text>
                </View>
                <View style={s.pendingDivider} />
                <View style={s.pendingFooterRow}>
                  <Text style={s.pendingLabel}>Data da solicitação</Text>
                  <Text style={s.pendingVal}>{formatTransactionDate(txDateRaw)}</Text>
                </View>
                <View style={[s.pendingFooterRow, { marginTop: 4 }]}>
                  <Text style={s.pendingLabel}>Prazo limite</Text>
                  <Text style={s.pendingVal}>{limitDate.toLocaleDateString('pt-BR')}</Text>
                </View>
                <View style={[s.pendingFooterRow, { marginTop: 4 }]}>
                  <Text style={s.pendingLabel}>Chave PIX</Text>
                  <Text style={s.pendingVal}>{maskPixKey(pixKeyUsed, detectPixKeyType(pixKeyUsed))}</Text>
                </View>
                {bankNameUsed && bankNameUsed !== '-' && (
                  <View style={[s.pendingFooterRow, { marginTop: 4 }]}>
                    <Text style={s.pendingLabel}>Banco</Text>
                    <Text style={s.pendingVal}>{bankNameUsed}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })()}

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
                {validTransactions.slice(0, 5).map((tx) => {
                  const dateStr = formatTransactionDate(getTransactionDate(tx));
                  const payerName = tx.metadata?.fromUserName || tx.metadata?.fromUserEmail;
                  return (
                    <View key={tx.id} style={s.txItem}>
                      <View style={s.txIcon}>
                        <FileText size={20} color={colors.primary} />
                      </View>
                      <View style={s.txInfo}>
                        <Text style={s.txType}>{mapTransactionType(tx.type)}</Text>
                        <Text style={s.txStatus}>
                          {dateStr}
                          {tx.type === 'tip_received' && payerName ? `\nDe: ${payerName}` : ''}
                        </Text>
                      </View>
                      <Text style={[s.txAmount, tx.amount > 0 ? s.txAmountPos : s.txAmountNeg]}>
                        {tx.amount > 0 ? '+' : ''}R$ {Math.abs(tx.amount).toFixed(2)}
                      </Text>
                    </View>
                  );
                })}
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
            {/* Tipo de chave Pix */}
            <View style={[s.fieldWrap, { marginTop: spacing.md }]}>
              <Text style={s.fieldLabel}>TIPO DE CHAVE PIX</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'] as PixKeyType[]).map((t) => {
                  const isSelected = pixKeyType === t;
                  const labelMap: Record<PixKeyType, string> = {
                    CPF: 'CPF',
                    CNPJ: 'CNPJ',
                    EMAIL: 'E-mail',
                    PHONE: 'Telefone',
                    EVP: 'Chave Aleatória',
                  };
                  return (
                    <TouchableOpacity
                      key={t}
                      onPress={() => {
                        setPixKeyType(t);
                        setPixKey(''); // Limpa a chave
                      }}
                      style={{
                        backgroundColor: isSelected ? colors.primary : colors.background,
                        borderWidth: 2,
                        borderColor: isSelected ? colors.primary : colors.primaryLight,
                        borderRadius: 20,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={{
                        fontSize: 11,
                        fontWeight: 'bold',
                        color: isSelected ? colors.textInverted : colors.text,
                      }}>
                        {labelMap[t]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Chave PIX */}
            <View style={[s.fieldWrap, { marginTop: spacing.md }]}>
              <Text style={s.fieldLabel}>CHAVE PIX</Text>
              <TextInput
                style={s.input}
                placeholder={
                  pixKeyType === 'CPF' ? '000.000.000-00' :
                  pixKeyType === 'CNPJ' ? '00.000.000/0000-00' :
                  pixKeyType === 'EMAIL' ? 'seuemail@exemplo.com' :
                  pixKeyType === 'PHONE' ? '(00) 00000-0000' :
                  'Cole a chave aleatória do seu banco'
                }
                placeholderTextColor={colors.textMutedValue}
                value={pixKey}
                onChangeText={(val) => {
                  let formatted = val;
                  if (pixKeyType === 'CPF') formatted = formatCpf(val);
                  else if (pixKeyType === 'CNPJ') formatted = formatCnpj(val);
                  else if (pixKeyType === 'PHONE') formatted = formatPhoneBr(val);
                  setPixKey(formatted);
                }}
                autoCapitalize="none"
              />
              <View style={s.pixTypeBadge}>
                <Text style={s.pixTypeText}>Tipo selecionado: {getFriendlyPixTypeLabel(pixKeyType)}</Text>
              </View>
              {pixKey.trim().length > 0 && (() => {
                const err = getPixValidationError(pixKeyType, pixKey);
                if (err) {
                  return (
                    <Text style={{ fontSize: 11, color: colors.primary, fontWeight: 'bold', marginTop: 4 }}>
                      {err}
                    </Text>
                  );
                }
                return null;
              })()}
            </View>
            {/* O campo Banco foi ocultado no mobile para simplificar o Pix (Task 12A) */}
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
                  {validTransactions.map((tx) => {
                    const dateStr = formatTransactionDate(getTransactionDate(tx));
                    const payerName = tx.metadata?.fromUserName || tx.metadata?.fromUserEmail;
                    const message = tx.metadata?.message;
                    const bank = tx.metadata?.bankName;
                    const pix = tx.metadata?.pixKey;
                    const shortId = tx.id ? `ID: ${tx.id.substring(0, 8).toUpperCase()}` : '';
                    
                    return (
                      <View key={tx.id} style={[s.txItem, { flexDirection: 'column', alignItems: 'stretch', gap: 6, paddingVertical: 12 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                            <View style={s.txIcon}>
                              <FileText size={20} color={colors.primary} />
                            </View>
                            <View>
                              <Text style={s.txType}>{mapTransactionType(tx.type)}</Text>
                              <Text style={s.txStatus}>{dateStr}</Text>
                            </View>
                          </View>
                          <Text style={[s.txAmount, tx.amount > 0 ? s.txAmountPos : s.txAmountNeg]}>
                            {tx.amount > 0 ? '+' : ''}R$ {Math.abs(tx.amount).toFixed(2)}
                          </Text>
                        </View>
                        
                        {/* Detalhes específicos */}
                        <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(26,26,26,0.06)', paddingTop: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flex: 1 }}>
                            {tx.type === 'tip_received' && (
                              <Text style={{ fontSize: 10, color: colors.textMutedValue, fontWeight: 'bold' }}>
                                De: {payerName || 'Usuário Apoiador'}
                              </Text>
                            )}
                            {tx.type === 'withdrawal' && (
                              <Text style={{ fontSize: 10, color: colors.textMutedValue, fontWeight: 'bold' }}>
                                {bank ? `Banco: ${bank} | ` : ''}Pix: {pix ? maskPixKey(pix, detectPixKeyType(pix)) : '-'}
                              </Text>
                            )}
                            {tx.metadata?.provider && (
                              <Text style={{ fontSize: 9, color: colors.textMutedValue, opacity: 0.8, textTransform: 'uppercase', fontWeight: 'bold', marginTop: 2 }}>
                                Canal: {tx.metadata.provider}
                              </Text>
                            )}
                          </View>
                          <Text style={{ fontSize: 9, color: 'rgba(26,26,26,0.25)', fontWeight: 'bold' }}>{shortId}</Text>
                        </View>
                        
                        {tx.type === 'tip_received' && message ? (
                          <View style={{ backgroundColor: 'rgba(26,26,26,0.02)', padding: 6, borderRadius: borderRadius.md, borderWidth: 1, borderColor: 'rgba(26,26,26,0.04)', marginTop: 2 }}>
                            <Text style={{ fontSize: 11, fontStyle: 'italic', color: 'rgba(26,26,26,0.7)' }}>
                              "{message}"
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
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
