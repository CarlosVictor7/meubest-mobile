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
  Linking,
  ActivityIndicator,
} from 'react-native';
import {
  User,
  CreditCard,
  Sparkles,
  Bell,
  Info,
  LogOut,
  ShieldCheck,
  Phone,
  Mail,
  FileText,
  Lock,
  Trash2,
  Camera,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@features/auth/hooks/useAuth';
import { TabHeader } from '@shared/components/TabHeader';
import { Avatar, BOTTOM_NAV_SCROLL_PAD } from '@shared/components';
import {
  pickProfileImage,
  processProfileImage,
  uploadProfilePhoto,
  removeProfilePhoto,
  ProfilePhotoError,
  UPLOAD_ERROR_MESSAGE,
  REMOVE_ERROR_MESSAGE,
} from '@shared/services/profilePhotoService';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { FINANCIAL_FEATURES_ENABLED } from '@shared/constants/platformFeatures';
import { getDisplayName, BIO_MAX_LENGTH, PREFERRED_NAME_MAX_LENGTH } from '@shared/utils/displayName';

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
  const { user, profile, logout, deleteAccount } = useAuth();


  // Estados locais para edição
  // `preferredName` é o nome PÚBLICO editável. O `name` do provider nunca é tocado aqui.
  const [preferredName, setPreferredName] = useState('');
  const [bio, setBio] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [bankName, setBankName] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  // Foto: pick → process → upload acontecem juntos; o onSnapshot do AuthProvider
  // atualiza `profile` e a UI reflete sozinha — nenhum estado local de URL.
  const [photoBusy, setPhotoBusy] = useState(false);


  // Inicializa dados do usuário a partir do Firestore
  useEffect(() => {
    if (profile) {
      // Pré-preenche com o nome público atual: preferredName, ou name como fallback.
      setPreferredName(getDisplayName(profile, ''));
      setBio(profile.bio || '');
      setPixKey(profile.bankDetails?.pix || '');
      setBankName(profile.bankDetails?.bankName || '');
      
      // Normalização dos temas (aceita aliases antigos por segurança)
      const topics = profile.interests || (profile as any).selectedTopics || (profile as any).temasInteresse || [];
      setSelectedTopics(topics);
      
      if (typeof (profile as any).emailNotifications === 'boolean') {
        setEmailNotifications((profile as any).emailNotifications);
      }
    } else if (user) {
      setPreferredName(user.displayName || '');
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

  const handleChangePhoto = async () => {
    const uid = user?.uid;
    if (!uid || photoBusy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const picked = await pickProfileImage();
    if (picked.status === 'canceled') return;
    if (picked.status === 'denied') {
      Alert.alert(
        'Permissão necessária',
        'Autorize o acesso às suas fotos nas configurações do aparelho para escolher uma imagem.'
      );
      return;
    }
    if (picked.status === 'error') {
      Alert.alert('Não foi possível', picked.message);
      return;
    }

    setPhotoBusy(true);
    try {
      const processedUri = await processProfileImage(picked.uri, {
        width: picked.width,
        height: picked.height,
      });
      await uploadProfilePhoto(uid, processedUri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      // ProfilePhotoError carrega mensagem segura para a UI; o resto cai no genérico.
      Alert.alert(
        'Não foi possível',
        error instanceof ProfilePhotoError ? error.message : UPLOAD_ERROR_MESSAGE
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleRemovePhoto = () => {
    const uid = user?.uid;
    const currentPath = profile?.profilePhotoPath;
    if (!uid || !currentPath || photoBusy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Remover foto', 'Deseja remover sua foto de perfil?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          setPhotoBusy(true);
          try {
            await removeProfilePhoto(uid, currentPath);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            Alert.alert(
              'Não foi possível',
              error instanceof ProfilePhotoError ? error.message : REMOVE_ERROR_MESSAGE
            );
          } finally {
            setPhotoBusy(false);
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!preferredName.trim()) {
      Alert.alert('Atenção', 'O nome não pode estar vazio.');
      return;
    }

    if (bio.length > BIO_MAX_LENGTH) {
      Alert.alert('Atenção', `O texto "Sobre você" pode ter no máximo ${BIO_MAX_LENGTH} caracteres.`);
      return;
    }
    
    if (!user?.uid) {
      Alert.alert('Erro', 'Usuário não autenticado.');
      return;
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      // No iOS, não salvar bankDetails para não sobrescrever dados válidos
      // que o usuário possa ter inserido no Android (campo não exibido no iOS).
      const updatePayload: Record<string, any> = {
        // `name` fica FORA do payload de propósito: ele pertence ao provider
        // (Google/Apple) e nenhuma tela de perfil pode sobrescrevê-lo. Ver ADR-003.
        preferredName: preferredName.trim(),
        bio: bio.trim() || null,
        interests: selectedTopics,
        emailNotifications,
      };
      if (FINANCIAL_FEATURES_ENABLED) {
        updatePayload.bankDetails = {
          pix: pixKey.trim(),
          bankName: bankName.trim(),
        };
      }
      await setDoc(userRef, updatePayload, { merge: true });

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
            } catch (error: any) {
              // LogoutCleanupError traz a explicação real (limpeza de push/presença
              // não confirmada no servidor). Sem mensagem específica, cai no genérico.
              Alert.alert(
                'Erro',
                error?.name === 'LogoutCleanupError' && error?.message
                  ? error.message
                  : 'Não foi possível sair da conta.'
              );
            }
          }
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Excluir Conta Permanente ⚠️',
      'Esta ação é irreversível. Todos os seus dados de perfil, histórico e conexões serão excluídos permanentemente de forma imediata.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirmação Final',
              'Você tem certeza absoluta de que deseja excluir sua conta permanentemente? Seus dados não poderão ser recuperados.',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Excluir Permanentemente',
                  style: 'destructive',
                  onPress: async () => {
                    setIsDeleting(true);
                    try {
                      await deleteAccount();
                    } catch (error: any) {
                      console.error('[ProfileScreen] Erro ao excluir conta:', error);
                      if (error?.code === 'auth/requires-recent-login') {
                        Alert.alert(
                          'Ação Requerida',
                          'Por segurança, a exclusão de conta exige um login recente. Por favor, saia e entre novamente no aplicativo para concluir a exclusão da sua conta.',
                          [
                            {
                              text: 'Sair e Reautenticar',
                              onPress: async () => {
                                try {
                                  await logout();
                                } catch (e) {
                                  console.error('Logout error during delete redirect:', e);
                                }
                              }
                            },
                            { text: 'Cancelar', style: 'cancel' }
                          ]
                        );
                      } else {
                        Alert.alert('Erro', 'Não foi possível excluir sua conta. Tente novamente mais tarde.');
                      }
                    } finally {
                      setIsDeleting(false);
                    }
                  }
                }
              ]
            );
          }
        }
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
        {/* Menu é Configurações/Perfil: sem Desabafar|Acolher, sem chave,
            sem "Vire a chave aqui" e sem aviso — tudo isso pertence à Home. */}
        <TabHeader hideControls />

        <View style={styles.padded}>
          {/* Card Principal de Formulário */}
          <View style={[styles.mainCard, shadows.sm]}>

            {/* ─── PERFIL PESSOAL ────────────────────────────────────── */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <User size={20} color={colors.primary} strokeWidth={2.5} />
                <Text style={styles.sectionTitle}>PERFIL PESSOAL</Text>
              </View>

              {/* ─── Foto de perfil ─────────────────────────────────── */}
              {/* O Avatar resolve a prioridade profilePhotoURL → photoURL →
                  inicial. REMOVER só existe para foto enviada no Meu Best
                  (profilePhotoPath) — a do provider não é gerenciada aqui. */}
              <View style={styles.photoSection}>
                <View style={styles.photoWrap}>
                  <Avatar profile={profile} name={getDisplayName(profile, '')} size="xl" />
                  {photoBusy && (
                    <View style={styles.photoBusyOverlay}>
                      <ActivityIndicator size="small" color="#FFF" />
                    </View>
                  )}
                </View>
                <View style={styles.photoButtons}>
                  <TouchableOpacity
                    style={styles.photoBtn}
                    onPress={handleChangePhoto}
                    disabled={photoBusy}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Alterar foto de perfil"
                  >
                    <Camera size={16} color={colors.primary} strokeWidth={2.5} />
                    <Text style={styles.photoBtnText}>ALTERAR FOTO</Text>
                  </TouchableOpacity>
                  {!!profile?.profilePhotoPath && (
                    <TouchableOpacity
                      style={styles.photoBtnRemove}
                      onPress={handleRemovePhoto}
                      disabled={photoBusy}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Remover foto de perfil"
                    >
                      <Trash2 size={16} color="#EF4444" strokeWidth={2.5} />
                      <Text style={styles.photoBtnRemoveText}>REMOVER FOTO</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>COMO VOCÊ QUER SER CHAMADO?</Text>
                <TextInput
                  style={styles.input}
                  value={preferredName}
                  onChangeText={setPreferredName}
                  placeholder="Ex.: Ana"
                  placeholderTextColor={colors.textMutedValue}
                  maxLength={PREFERRED_NAME_MAX_LENGTH}
                  autoCapitalize="words"
                  autoCorrect={false}
                  accessibilityLabel="Como você quer ser chamado"
                />
                <Text style={styles.fieldHint}>
                  É assim que as outras pessoas vão te ver no app.
                </Text>
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>SOBRE VOCÊ (OPCIONAL)</Text>
                <TextInput
                  style={styles.textArea}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Conte um pouco sobre você, seus interesses ou o que gostaria que outras pessoas soubessem."
                  placeholderTextColor={colors.textMutedValue}
                  maxLength={BIO_MAX_LENGTH}
                  multiline
                  textAlignVertical="top"
                  autoCapitalize="sentences"
                  accessibilityLabel="Sobre você"
                />
                <Text style={styles.charCounter}>
                  {bio.length}/{BIO_MAX_LENGTH}
                </Text>
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>EMAIL</Text>
                <View style={[styles.input, styles.inputDisabled]}>
                  <Text style={styles.inputDisabledText}>{userEmail}</Text>
                </View>
              </View>
            </View>

            {/* ─── DADOS PARA RECEBIMENTO ───────────────────────── */}
            {/* Oculto no iOS (Apple Guideline 1.1.4 — sem financeiro) */}
            {FINANCIAL_FEATURES_ENABLED && (
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

            </View>
            )}

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
              <TouchableOpacity style={styles.btnSave} onPress={handleSave} activeOpacity={0.85} disabled={isDeleting}>
                <Text style={styles.btnSaveText}>SALVAR ALTERAÇÕES</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnLogout} onPress={handleLogout} activeOpacity={0.85} disabled={isDeleting}>
                <LogOut size={18} color={colors.primary} style={{ marginRight: spacing.sm }} />
                <Text style={styles.btnLogoutText}>SAIR DA CONTA</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnDelete} onPress={handleDeleteAccount} activeOpacity={0.85} disabled={isDeleting}>
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#EF4444" style={{ marginRight: spacing.sm }} />
                ) : (
                  <Trash2 size={18} color="#EF4444" style={{ marginRight: spacing.sm }} />
                )}
                <Text style={styles.btnDeleteText}>EXCLUIR MINHA CONTA</Text>
              </TouchableOpacity>
            </View>


          </View>

          {/* ─── SUPORTE E SEGURANÇA ────────────────────────────── */}
          <View style={[styles.mainCard, styles.safetyCard, shadows.sm]}>
            <View style={styles.sectionHeader}>
              <ShieldCheck size={20} color="#10B981" strokeWidth={2.5} />
              <Text style={[styles.sectionTitle, { color: '#10B981' }]}>SUPORTE E SEGURANÇA</Text>
            </View>

            {/* Aviso de emergência */}
            <View style={styles.emergencyBanner}>
              <Text style={styles.emergencyTitle}>🆘 Em caso de emergência</Text>
              <Text style={styles.emergencyText}>
                Se você ou alguém estiver em perigo imediato, ligue para o <Text style={styles.emergencyHighlight}>SAMU 192</Text> ou vá ao pronto-socorro mais próximo.
              </Text>
              <Text style={styles.emergencyText}>
                <Text style={styles.emergencyHighlight}>CVV 188</Text> — Centro de Valorização da Vida, apoio emocional 24h, gratuito.
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL('tel:188')}
                style={styles.emergencyCallBtn}
                accessibilityLabel="Ligar para o CVV 188"
              >
                <Phone size={16} color="#fff" strokeWidth={2} />
                <Text style={styles.emergencyCallText}>Ligar para CVV 188</Text>
              </TouchableOpacity>
            </View>

            {/* Links de suporte */}
            <TouchableOpacity
              style={styles.supportRow}
              onPress={() => Linking.openURL('mailto:fillipelustman@gmail.com')}
              accessibilityLabel="Contato com suporte"
            >
              <Mail size={18} color={colors.primary} strokeWidth={2} />
              <Text style={styles.supportRowText}>fillipelustman@gmail.com</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.supportRow}
              onPress={() => Linking.openURL('https://meu.best/termos')}
              accessibilityLabel="Termos de uso"
            >
              <FileText size={18} color={colors.primary} strokeWidth={2} />
              <Text style={styles.supportRowText}>Termos de Uso</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.supportRow}
              onPress={() => Linking.openURL('https://meu.best/privacidade')}
              accessibilityLabel="Política de privacidade"
            >
              <Lock size={18} color={colors.primary} strokeWidth={2} />
              <Text style={styles.supportRowText}>Política de Privacidade</Text>
            </TouchableOpacity>
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
  // `gap` separa os cards irmãos (PERFIL PESSOAL e SUPORTE E SEGURANÇA) —
  // sem ele os dois se tocavam. Folga inferior para o card respirar antes
  // do BottomNav flutuante.
  padded: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.xl,
  },

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

  // ── Foto de perfil ───────────────────────────────────────────────
  photoSection: {
    alignItems: 'center',
    gap: spacing.md,
  },
  photoWrap: {
    position: 'relative',
  },
  photoBusyOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 50, // Avatar xl = 100px
    backgroundColor: 'rgba(26,26,26,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  photoBtnText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  photoBtnRemove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: '#EF4444',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  photoBtnRemoveText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: '#EF4444',
    letterSpacing: 0.5,
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
  textArea: {
    minHeight: 110,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.text,
    lineHeight: 22,
  },
  fieldHint: {
    fontSize: 11,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    marginLeft: 4,
    marginTop: 2,
  },
  charCounter: {
    fontSize: 11,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    textAlign: 'right',
    marginRight: 4,
    marginTop: 2,
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
  btnDelete: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: '#EF4444',
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDeleteText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: '#EF4444',
    letterSpacing: typography.tracking.wider,
  },


  // ── Suporte e Segurança ──────────────────────────────────────────
  safetyCard: {
    borderColor: 'rgba(16,185,129,0.25)',
    gap: spacing.md,
  },
  emergencyBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  emergencyTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: '#DC2626',
    letterSpacing: typography.tracking.tight,
  },
  emergencyText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: '#7F1D1D',
    lineHeight: 20,
  },
  emergencyHighlight: {
    fontWeight: typography.weight.black,
    color: '#DC2626',
  },
  emergencyCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: '#DC2626',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  emergencyCallText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: '#fff',
    letterSpacing: typography.tracking.tight,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryLight,
  },
  supportRowText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.primary,
  },
});
