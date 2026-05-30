import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Heart,
  MessageCircle,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  LogOut,
  ChevronRight,
  Shield,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '@features/auth/hooks/useAuth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@shared/services/firebase';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { Button } from '@shared/components';

const { width } = Dimensions.get('window');

const GENDERS = [
  { id: 'feminino', label: 'Feminino' },
  { id: 'masculino', label: 'Masculino' },
  { id: 'não-binário', label: 'Não-binário' },
  { id: 'prefiro não dizer', label: 'Prefiro não informar' },
];

const AGE_RANGES = [
  { id: '18-25', label: '18-25 anos' },
  { id: '26-40', label: '26-40 anos' },
  { id: '41-60', label: '41-60 anos' },
  { id: '60+', label: '60+ anos' },
];

const INTERESTS = [
  { id: 'relacionamento', label: 'RELACIONAMENTO' },
  { id: 'carreira', label: 'CARREIRA' },
  { id: 'saude', label: 'SAÚDE MENTAL' },
  { id: 'luto', label: 'LUTO' },
  { id: 'espiritualidade', label: 'ESPIRITUALIDADE' },
  { id: 'estudos', label: 'ESTUDOS' },
  { id: 'familia', label: 'FAMÍLIA' },
  { id: 'ansiedade', label: 'ANSIEDADE' },
];

export function ProfileFormScreen() {
  const { user, logout } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    role: '' as 'speaker' | 'listener' | '',
    gender: '',
    ageRange: '',
    city: '',
    religion: '',
    isAdult: false,
    interests: [] as string[],
  });

  // Animated scale for step transitions
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const changeStep = (nextStep: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleSelectRole = (role: 'speaker' | 'listener') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFormData((prev) => ({ ...prev, role }));
  };

  const toggleInterest = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.includes(id)
        ? prev.interests.filter((i) => i !== id)
        : [...prev.interests, id],
    }));
  };

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Sair do Cadastro',
      'Deseja realmente interromper o cadastro e sair da conta?',
      [
        { text: 'Continuar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (err) {
              Alert.alert('Erro', 'Não foi possível desconectar no momento.');
            }
          },
        },
      ]
    );
  };

  const handleFinalize = async () => {
    if (!user) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(
        userRef,
        {
          role: formData.role,
          gender: formData.gender,
          ageRange: formData.ageRange,
          city: formData.city.trim(),
          religion: formData.religion.trim() || null,
          interests: formData.interests,
          isAdult: true,
          isProfileComplete: true,
          showTutorial: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.error('[ProfileForm] Error saving profile:', e);
      Alert.alert('Erro ao salvar', 'Não foi possível finalizar seu cadastro no momento. Tente novamente.');
      setLoading(false);
    }
  };

  // Validations
  const isStep1Valid = formData.role !== '';
  const isStep2Valid =
    formData.gender !== '' &&
    formData.ageRange !== '' &&
    formData.city.trim().length > 0 &&
    formData.isAdult;
  const isStep3Valid = formData.interests.length > 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Background gradients */}
      <View style={styles.bgPink} />
      <View style={styles.bgCream} />

      <SafeAreaView style={styles.safe}>
        {/* Header com indicador de etapa e botão Sair */}
        <View style={styles.header}>
          <View style={styles.progressRow}>
            {[1, 2, 3].map((s) => (
              <View
                key={s}
                style={[
                  styles.progressBarItem,
                  step >= s ? styles.progressBarActive : styles.progressBarInactive,
                ]}
              />
            ))}
            <Text style={styles.progressText}>ETAPA {step} DE 3</Text>
          </View>

          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.7}>
            <LogOut size={16} color={colors.primary} strokeWidth={2.5} />
            <Text style={styles.logoutText}>SAIR</Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* ─── ETAPA 1: ROLE SELECTION ────────────────────────────── */}
            {step === 1 && (
              <View style={styles.stepContainer}>
                <View style={styles.headline}>
                  <Text style={styles.title}>Como você quer{'\n'}interagir hoje?</Text>
                  <Text style={styles.subtitle}>Escolha seu papel principal na nossa comunidade.</Text>
                </View>

                <View style={styles.roleContainer}>
                  {/* Card Speaker */}
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => handleSelectRole('speaker')}
                    style={[
                      styles.roleCard,
                      formData.role === 'speaker'
                        ? styles.roleCardActiveSpeaker
                        : styles.roleCardInactive,
                      shadows.sm,
                    ]}
                  >
                    <View
                      style={[
                        styles.roleIconWrap,
                        formData.role === 'speaker'
                          ? { backgroundColor: 'rgba(255,255,255,0.2)' }
                          : { backgroundColor: `${colors.primary}12` },
                      ]}
                    >
                      <MessageCircle
                        color={formData.role === 'speaker' ? '#FFF' : colors.primary}
                        size={26}
                        strokeWidth={2.2}
                      />
                    </View>
                    <View style={styles.roleTextWrap}>
                      <Text
                        style={[
                          styles.roleTitle,
                          formData.role === 'speaker' ? { color: '#FFF' } : { color: colors.primary },
                        ]}
                      >
                        QUERO FALAR
                      </Text>
                      <Text
                        style={[
                          styles.roleDesc,
                          formData.role === 'speaker' ? { color: 'rgba(255,255,255,0.85)' } : { color: colors.textMutedValue },
                        ]}
                      >
                        Preciso de alguém que me ouça com carinho e sem julgamentos.
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Card Listener */}
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => handleSelectRole('listener')}
                    style={[
                      styles.roleCard,
                      formData.role === 'listener'
                        ? styles.roleCardActiveListener
                        : styles.roleCardInactive,
                      shadows.sm,
                    ]}
                  >
                    <View
                      style={[
                        styles.roleIconWrap,
                        formData.role === 'listener'
                          ? { backgroundColor: 'rgba(255,255,255,0.2)' }
                          : { backgroundColor: `${colors.primary}12` },
                      ]}
                    >
                      <Heart
                        color={formData.role === 'listener' ? '#FFF' : colors.primary}
                        size={26}
                        strokeWidth={2.2}
                      />
                    </View>
                    <View style={styles.roleTextWrap}>
                      <Text
                        style={[
                          styles.roleTitle,
                          formData.role === 'listener' ? { color: '#FFF' } : { color: colors.primary },
                        ]}
                      >
                        QUERO DESABAFAR
                      </Text>
                      <Text
                        style={[
                          styles.roleDesc,
                          formData.role === 'listener' ? { color: 'rgba(255,255,255,0.85)' } : { color: colors.textMutedValue },
                        ]}
                      >
                        Tenho presença para oferecer e quero acolher quem precisa.
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                <View style={styles.actionRowSingle}>
                  <TouchableOpacity
                    style={[styles.nextButton, !isStep1Valid && styles.buttonDisabled, shadows.primary]}
                    disabled={!isStep1Valid}
                    onPress={() => changeStep(2)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.nextButtonText}>PRÓXIMO PASSO</Text>
                    <ArrowRight size={18} color="#FFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ─── ETAPA 2: DADOS PESSOAIS ────────────────────────────── */}
            {step === 2 && (
              <View style={styles.stepContainer}>
                <View style={styles.headline}>
                  <Text style={styles.title}>Conte um pouco{'\n'}sobre você</Text>
                  <Text style={styles.subtitle}>Isso nos ajuda a criar conexões mais verdadeiras.</Text>
                </View>

                <View style={styles.formCard}>
                  {/* Gênero */}
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>GÊNERO</Text>
                    <View style={styles.chipsRow}>
                      {GENDERS.map((g) => {
                        const isSelected = formData.gender === g.id;
                        return (
                          <TouchableOpacity
                            key={g.id}
                            style={[styles.chip, isSelected && styles.chipActive]}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setFormData((prev) => ({ ...prev, gender: g.id }));
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                              {g.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Faixa Etária */}
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>FAIXA ETÁRIA</Text>
                    <View style={styles.chipsRow}>
                      {AGE_RANGES.map((a) => {
                        const isSelected = formData.ageRange === a.id;
                        return (
                          <TouchableOpacity
                            key={a.id}
                            style={[styles.chip, isSelected && styles.chipActive]}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setFormData((prev) => ({ ...prev, ageRange: a.id }));
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                              {a.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Cidade */}
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>CIDADE</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Sua cidade e UF"
                      placeholderTextColor={colors.textMutedValue}
                      value={formData.city}
                      onChangeText={(city) => setFormData((prev) => ({ ...prev, city }))}
                      autoCapitalize="words"
                    />
                  </View>

                  {/* Religião (Opcional) */}
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>RELIGIÃO / CRENÇA (OPCIONAL)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Ex: Católica, Espírita, Agnóstica..."
                      placeholderTextColor={colors.textMutedValue}
                      value={formData.religion}
                      onChangeText={(religion) => setFormData((prev) => ({ ...prev, religion }))}
                      autoCapitalize="sentences"
                    />
                  </View>

                  {/* Checkbox Maior de 18 */}
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    activeOpacity={0.8}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setFormData((prev) => ({ ...prev, isAdult: !prev.isAdult }));
                    }}
                  >
                    <View style={[styles.checkboxOuter, formData.isAdult && styles.checkboxOuterActive]}>
                      {formData.isAdult && <CheckCircle size={16} color="#FFF" strokeWidth={2.5} />}
                    </View>
                    <Text style={styles.checkboxLabel}>POSSUO MAIS DE 18 ANOS</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.backButton} onPress={() => changeStep(1)} activeOpacity={0.7}>
                    <ArrowLeft size={16} color={colors.primary} strokeWidth={2.5} />
                    <Text style={styles.backButtonText}>VOLTAR</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.nextButtonHalf, !isStep2Valid && styles.buttonDisabled, shadows.primary]}
                    disabled={!isStep2Valid}
                    onPress={() => changeStep(3)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.nextButtonText}>CONTINUAR</Text>
                    <ArrowRight size={16} color="#FFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ─── ETAPA 3: TEMAS DE INTERESSE ────────────────────────── */}
            {step === 3 && (
              <View style={styles.stepContainer}>
                <View style={styles.headline}>
                  <Text style={styles.title}>O que te{'\n'}move?</Text>
                  <Text style={styles.subtitle}>Selecione os temas que você mais se identifica.</Text>
                </View>

                <View style={styles.interestsGrid}>
                  {INTERESTS.map((t) => {
                    const isSelected = formData.interests.includes(t.id);
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.interestCard, isSelected && styles.interestCardActive]}
                        onPress={() => toggleInterest(t.id)}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.interestIconWrap,
                            isSelected
                              ? { backgroundColor: 'rgba(255,255,255,0.25)' }
                              : { backgroundColor: `${colors.primary}12` },
                          ]}
                        >
                          <Sparkles
                            color={isSelected ? '#FFF' : colors.primary}
                            size={16}
                            strokeWidth={2}
                          />
                        </View>
                        <Text style={[styles.interestLabel, isSelected && styles.interestLabelActive]}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.backButton} onPress={() => changeStep(2)} activeOpacity={0.7}>
                    <ArrowLeft size={16} color={colors.primary} strokeWidth={2.5} />
                    <Text style={styles.backButtonText}>VOLTAR</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.nextButtonHalf, !isStep3Valid && styles.buttonDisabled, shadows.primary]}
                    disabled={!isStep3Valid || loading}
                    onPress={handleFinalize}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.nextButtonText}>
                      {loading ? 'FINALIZANDO...' : 'FINALIZAR PERFIL'}
                    </Text>
                    {!loading && <CheckCircle size={16} color="#FFF" strokeWidth={2.5} />}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safe: {
    flex: 1,
  },
  bgPink: {
    position: 'absolute',
    top: -200,
    right: -200,
    width: 450,
    height: 450,
    borderRadius: 225,
    backgroundColor: `${colors.primaryLight}44`,
  },
  bgCream: {
    position: 'absolute',
    bottom: -250,
    left: -250,
    width: 550,
    height: 550,
    borderRadius: 275,
    backgroundColor: '#F7EFE8',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.primaryLight}88`,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressBarItem: {
    width: 24,
    height: 6,
    borderRadius: 3,
  },
  progressBarActive: {
    backgroundColor: colors.primary,
  },
  progressBarInactive: {
    backgroundColor: colors.primaryLight,
  },
  progressText: {
    fontSize: 9,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 1,
    marginLeft: 6,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(225, 48, 29, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  logoutText: {
    fontSize: 9,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 1,
  },

  // Content
  content: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  stepContainer: {
    gap: spacing.lg,
  },

  // Headline
  headline: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 30,
    fontWeight: typography.weight.black,
    color: colors.primary,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    lineHeight: 18,
    fontWeight: typography.weight.medium,
  },

  // ─── ETAPA 1 ────────────────────────────────────────────────────────
  roleContainer: {
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  roleCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl - 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 2,
    minHeight: 104,
  },
  roleCardInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  roleCardActiveSpeaker: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleCardActiveListener: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  roleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleTextWrap: {
    flex: 1,
    gap: 3,
  },
  roleTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    letterSpacing: typography.tracking.tight,
  },
  roleDesc: {
    fontSize: typography.size.xs + 1,
    lineHeight: 16,
    fontWeight: typography.weight.medium,
  },

  // ─── ETAPA 2 ────────────────────────────────────────────────────────
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  fieldBlock: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 1,
    marginLeft: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 2,
  },
  chip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 11,
    color: colors.text,
    fontWeight: typography.weight.bold,
  },
  chipTextActive: {
    color: colors.textInverted,
  },
  textInput: {
    height: 48,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.sm,
    color: colors.text,
    fontWeight: typography.weight.medium,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingVertical: 4,
  },
  checkboxOuter: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOuterActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: 11,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
    letterSpacing: 0.2,
  },

  // ─── ETAPA 3 ────────────────────────────────────────────────────────
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  interestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm - 2,
    paddingHorizontal: spacing.md,
    gap: spacing.xs + 2,
    minWidth: '45%',
    flex: 1,
  },
  interestCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  interestIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  interestLabel: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.text,
    letterSpacing: 0.2,
  },
  interestLabelActive: {
    color: colors.textInverted,
  },

  // ─── ACTIONS ────────────────────────────────────────────────────────
  actionRowSingle: {
    marginTop: spacing.md,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  nextButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    width: '100%',
  },
  nextButtonHalf: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    flex: 2,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(26,26,26,0.12)',
    shadowOpacity: 0,
    elevation: 0,
  },
  nextButtonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.widest,
  },
  backButton: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flex: 1,
  },
  backButtonText: {
    fontSize: typography.size.xs + 1,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: typography.tracking.wide,
  },
});
