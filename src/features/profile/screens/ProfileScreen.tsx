import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  User,
  CreditCard,
  Sparkles,
  Bell,
  Info,
  LogOut,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@features/auth/hooks/useAuth';
import { TabHeader } from '@shared/components/TabHeader';
import { BOTTOM_NAV_SCROLL_PAD } from '@shared/components';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';

import { doc, setDoc } from 'firebase/firestore';
import { db } from '@shared/services/firebase';
import { TIP_FEE_MESSAGE } from '@shared/constants/fees';

const TOPICS = [
  { id: 'relacionamento', label: 'RELACIONAMENTO' },
  { id: 'carreira', label: 'CARREIRA' },
  { id: 'saude', label: 'SAÚDE MENTAL' },
  { id: 'luto', label: 'LUTO' },
  { id: 'espiritualidade', label: 'ESPIRITUALIDADE' },
  { id: 'estudos', label: 'ESTUDOS' },
  { id: 'familia', label: 'FAMÍLIA' },
  { id: 'ansiedade', label: 'ANSIEDADE' },
  { id: 'outras', label: 'OUTRAS' },
];

export function ProfileScreen() {
  const { user, profile, logout } = useAuth();

  // Estados locais para edição
  const [displayName, setDisplayName] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [bankName, setBankName] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [emailNotifications, setEmailNotifications] = useState(true);

  // Inicializa dados do usuário a partir do Firestore
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.name || user?.displayName || 'Amigo(a)');
      setPixKey(profile.bankDetails?.pix || '');
      setBankName(profile.bankDetails?.bankName || '');
      
      // Normalização dos temas (aceita aliases antigos por segurança)
      const topics = profile.interests || (profile as any).selectedTopics || (profile as any).temasInteresse || [];
      setSelectedTopics(topics);
      
      if (typeof (profile as any).emailNotifications === 'boolean') {
        setEmailNotifications((profile as any).emailNotifications);
      }
    } else if (user) {
      setDisplayName(user.displayName || 'Amigo(a)');
    }
  }, [profile, user]);

  const userEmail = profile?.email || user?.email || 'Nenhum e-mail cadastrado';

  const toggleTopic = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const toggleNotifications = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEmailNotifications((prev) => !prev);
  };

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!displayName.trim()) {
      Alert.alert('Atenção', 'O nome de exibição não pode estar vazio.');
      return;
    }
    
    if (!user?.uid) {
      Alert.alert('Erro', 'Usuário não autenticado.');
      return;
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        name: displayName.trim(),
        interests: selectedTopics,
        bankDetails: {
          pix: pixKey.trim(),
          bankName: bankName.trim(),
        },
        emailNotifications,
      }, { merge: true });

      Alert.alert(
        'Alterações Salvas',
        'Suas informações foram sincronizadas com sucesso.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('[ProfileScreen] Erro ao salvar:', error);
      Alert.alert('Erro', 'Não foi possível salvar suas informações.');
    }
  };

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Sair da Conta',
      'Deseja realmente sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sair', 
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível sair da conta.');
            }
          }
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        bounces
      >
        {/* Cabeçalho global */}
        <TabHeader />

        <View style={styles.padded}>
          {/* Card Principal de Formulário */}
          <View style={[styles.mainCard, shadows.sm]}>

            {/* ─── PERFIL PESSOAL ────────────────────────────────────── */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <User size={20} color={colors.primary} strokeWidth={2.5} />
                <Text style={styles.sectionTitle}>PERFIL PESSOAL</Text>
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>NOME DE EXIBIÇÃO</Text>
                <TextInput
                  style={styles.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Seu nome"
                  placeholderTextColor={colors.textMutedValue}
                />
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>EMAIL</Text>
                <View style={[styles.input, styles.inputDisabled]}>
                  <Text style={styles.inputDisabledText}>{userEmail}</Text>
                </View>
              </View>
            </View>

            {/* ─── DADOS PARA RECEBIMENTO ────────────────────────────── */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <CreditCard size={20} color={colors.primary} strokeWidth={2.5} />
                <Text style={styles.sectionTitle}>DADOS PARA RECEBIMENTO</Text>
              </View>

              <View style={styles.infoCard}>
                <View style={styles.infoIconWrap}>
                  <Info size={20} color={colors.primary} />
                </View>
                <Text style={styles.infoText}>
                  {TIP_FEE_MESSAGE}
                </Text>
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>CHAVE PIX</Text>
                <TextInput
                  style={styles.input}
                  value={pixKey}
                  onChangeText={setPixKey}
                  placeholder="CPF, Email ou Celular"
                  placeholderTextColor={colors.textMutedValue}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>INSTITUIÇÃO BANCÁRIA</Text>
                <TextInput
                  style={styles.input}
                  value={bankName}
                  onChangeText={setBankName}
                  placeholder="Ex: Nubank, Itaú, Bradesco..."
                  placeholderTextColor={colors.textMutedValue}
                />
              </View>
            </View>

            {/* ─── MEUS TEMAS DE INTERESSE ───────────────────────────── */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Sparkles size={20} color={colors.primary} strokeWidth={2.5} />
                <Text style={styles.sectionTitle}>MEUS TEMAS DE INTERESSE</Text>
              </View>

              <View style={styles.topicsGrid}>
                {TOPICS.map((topic) => {
                  const isSelected = selectedTopics.includes(topic.id);
                  return (
                    <TouchableOpacity
                      key={topic.id}
                      activeOpacity={0.8}
                      onPress={() => toggleTopic(topic.id)}
                      style={[styles.topicPill, isSelected && styles.topicPillActive]}
                    >
                      <Text style={[styles.topicPillText, isSelected && styles.topicPillTextActive]}>
                        {topic.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ─── PREFERÊNCIAS ──────────────────────────────────────── */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Bell size={20} color={colors.primary} strokeWidth={2.5} />
                <Text style={styles.sectionTitle}>PREFERÊNCIAS</Text>
              </View>

              <View style={styles.preferenceCard}>
                <View style={styles.preferenceTextWrap}>
                  <Text style={styles.preferenceTitle}>NOTIFICAÇÕES POR EMAIL</Text>
                  <Text style={styles.preferenceDesc}>
                    Receba alertas sobre novas sessões e mensagens.
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={toggleNotifications}
                  style={[styles.toggleOuter, emailNotifications && styles.toggleOuterActive]}
                >
                  <View style={[styles.toggleInner, emailNotifications && styles.toggleInnerActive]} />
                </TouchableOpacity>
              </View>
            </View>

            {/* ─── BOTÕES DE AÇÃO ────────────────────────────────────── */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.btnSave} onPress={handleSave} activeOpacity={0.85}>
                <Text style={styles.btnSaveText}>SALVAR ALTERAÇÕES</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnLogout} onPress={handleLogout} activeOpacity={0.85}>
                <LogOut size={18} color={colors.primary} style={{ marginRight: spacing.sm }} />
                <Text style={styles.btnLogoutText}>SAIR DA CONTA</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>

        {/* Espaçamento para a BottomNav fixa */}
        <View style={{ height: BOTTOM_NAV_SCROLL_PAD + 16 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  // Card principal
  mainCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 3,
    borderColor: colors.primaryLight,
    padding: spacing.xl,
    gap: spacing.xxl,
  },

  // Seções genéricas
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: typography.tracking.tight,
    textTransform: 'uppercase',
  },

  // Inputs
  fieldWrap: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
    letterSpacing: typography.tracking.wider,
    marginLeft: 4,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.text,
  },
  inputDisabled: {
    backgroundColor: 'rgba(253, 246, 240, 0.5)', // creme com opacidade
    borderColor: 'transparent',
    justifyContent: 'center',
  },
  inputDisabledText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.textMutedValue,
  },

  // Card Info Taxa (15%)
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 20,
  },
  infoHighlight: {
    color: colors.primary,
    fontWeight: typography.weight.black,
  },

  // Temas de Interesse
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  topicPill: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  topicPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.sm,
  },
  topicPillText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.text,
    letterSpacing: 0.5,
  },
  topicPillTextActive: {
    color: colors.textInverted,
  },

  // Preferências
  preferenceCard: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  preferenceTextWrap: {
    flex: 1,
    gap: 2,
  },
  preferenceTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: typography.tracking.tight,
  },
  preferenceDesc: {
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 18,
  },
  // Custom Toggle visual
  toggleOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleOuterActive: {
    borderColor: colors.primary,
  },
  toggleInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  toggleInnerActive: {
    backgroundColor: colors.primary,
  },

  // Botões de Ação
  actionButtons: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  btnSave: {
    backgroundColor: colors.dark,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  btnSaveText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.wider,
  },
  btnLogout: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLogoutText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: typography.tracking.wider,
  },
});
