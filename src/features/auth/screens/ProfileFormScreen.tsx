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
  KeyboardAvoidingView,
  Platform,
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
  Camera,
  Trash2,
} from 'lucide-react-native';
import { useAuth } from '@features/auth/hooks/useAuth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@shared/services/firebase';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { Avatar, Button } from '@shared/components';
import {
  pickProfileImage,
  processProfileImage,
  uploadProfilePhoto,
} from '@shared/services/profilePhotoService';
import { SelectSheet } from '@shared/components/SelectSheet';
import { BR_STATES, CITIES_BY_UF } from '@constants/brazilLocations';
import { RELIGION_OPTIONS, RELIGION_OTHER } from '@constants/religions';
import {
  suggestPreferredName,
  BIO_MAX_LENGTH,
  PREFERRED_NAME_MAX_LENGTH,
} from '@shared/utils/displayName';

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
  const { user, profile, logout } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    role: '' as 'speaker' | 'listener' | '',
    // Sugestão inicial vinda do provider (Google/Apple). O usuário pode trocar.
    // `profile` pode não ter chegado ainda no primeiro render — o efeito abaixo cobre isso.
    preferredName: suggestPreferredName(profile) || suggestPreferredName({ name: user?.displayName }),
    bio: '',
    gender: '',
    ageRange: '',
    state: '',
    cityName: '',
    religionChoice: '',
    religionOther: '',
    isAdult: false,
    interests: [] as string[],
  });

  // Foto de perfil OPCIONAL. Fica só local (URI do picker) até o finalize:
  // o upload no Storage acontece junto da conclusão, quando o UID já existe
  // (a pessoa se autenticou com Google/Apple antes de chegar aqui).
  const [photo, setPhoto] = useState<{ uri: string; width?: number; height?: number } | null>(
    null
  );

  /**
   * Preenche a sugestão de nome quando o perfil chega depois do primeiro render.
   * Só age enquanto o campo estiver vazio — nunca sobrescreve o que o usuário digitou.
   */
  const nameSuggestionApplied = useRef(false);
  React.useEffect(() => {
    if (nameSuggestionApplied.current) return;
    const suggestion =
      suggestPreferredName(profile) || suggestPreferredName({ name: user?.displayName });
    if (!suggestion) return;
    setFormData((prev) => {
      if (prev.preferredName.trim()) {
        nameSuggestionApplied.current = true;
        return prev;
      }
      nameSuggestionApplied.current = true;
      return { ...prev, preferredName: suggestion };
    });
  }, [profile?.name, profile?.preferredName, user?.displayName]);

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

  const handlePickPhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const picked = await pickProfileImage();
    if (picked.status === 'canceled') return;
    if (picked.status === 'denied') {
      Alert.alert(
        'Permissão necessária',
        'Autorize o acesso às suas fotos nas configurações do aparelho para escolher uma imagem. Você também pode concluir o cadastro sem foto.'
      );
      return;
    }
    if (picked.status === 'error') {
      Alert.alert('Não foi possível', picked.message);
      return;
    }
    setPhoto({ uri: picked.uri, width: picked.width, height: picked.height });
  };

  const handleRemovePhoto = () => {
    // Só descarta a escolha local — nada foi enviado ainda.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhoto(null);
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
      const city =
        formData.state && formData.cityName
          ? `${formData.cityName} - ${formData.state}`
          : formData.cityName.trim();
      const religion =
        formData.religionChoice === RELIGION_OTHER
          ? formData.religionOther.trim() || null
          : formData.religionChoice || null;

      const bio = formData.bio.trim();

      // Foto ANTES do write final: se o upload falhar, o cadastro segue —
      // foto nunca bloqueia a conta. (Depois do write o AuthProvider troca de
      // tela via isProfileComplete, então esta é a última chance na ordem.)
      let photoUploadFailed = false;
      if (photo) {
        try {
          const processedUri = await processProfileImage(photo.uri, {
            width: photo.width,
            height: photo.height,
          });
          await uploadProfilePhoto(user.uid, processedUri);
        } catch (photoError) {
          console.error('[ProfileForm] Falha no upload da foto (cadastro segue):', photoError);
          photoUploadFailed = true;
        }
      }

      await setDoc(
        userRef,
        {
          role: formData.role,
          // `preferredName` é o nome público escolhido pelo usuário.
          // `name` NÃO entra no payload — ele pertence ao provider (Google/Apple)
          // e nenhuma tela de perfil pode sobrescrevê-lo.
          preferredName: formData.preferredName.trim(),
          bio: bio || null,
          gender: formData.gender,
          ageRange: formData.ageRange,
          state: formData.state || null,
          city,
          religion,
          interests: formData.interests,
          isAdult: true,
          isProfileComplete: true,
          showTutorial: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (photoUploadFailed) {
        // Cadastro concluído; o aviso aparece sobre a tela seguinte.
        Alert.alert(
          'Cadastro concluído',
          'Não foi possível enviar a sua foto agora. Você pode adicionar depois na tela de Perfil.'
        );
      }
    } catch (e) {
      console.error('[ProfileForm] Error saving profile:', e);
      Alert.alert('Erro ao salvar', 'Não foi possível finalizar seu cadastro no momento. Tente novamente.');
      setLoading(false);
    }
  };

  // Validations
  const isStep1Valid = formData.role !== '';
  // `preferredName` é obrigatório APENAS aqui, na validação de etapa do cadastro novo.
  // Não é obrigatório no tipo nem em `isProfileComplete` — usuário antigo nunca
  // volta ao onboarding por causa dele. Ver ADR-003.
  const isStep2Valid =
    formData.preferredName.trim().length > 0 &&
    formData.bio.length <= BIO_MAX_LENGTH &&
    formData.gender !== '' &&
    formData.ageRange !== '' &&
    formData.state !== '' &&
    formData.cityName !== '' &&
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
          <KeyboardAvoidingView
            style={styles.kav}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
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
                        QUERO DESABAFAR
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
                        QUERO ACOLHER
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
                  {/* Foto de perfil — OPCIONAL. Preview local; o upload só
                      acontece no finalize. Sem foto o placeholder mostra a
                      inicial do nome escolhido. */}
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>FOTO DE PERFIL (OPCIONAL)</Text>
                    <View style={styles.photoRow}>
                      <Avatar
                        photoURL={photo?.uri ?? null}
                        name={formData.preferredName || undefined}
                        size="xl"
                      />
                      <View style={styles.photoActions}>
                        {photo ? (
                          <>
                            <TouchableOpacity
                              style={styles.photoActionBtn}
                              onPress={handlePickPhoto}
                              activeOpacity={0.8}
                              accessibilityRole="button"
                              accessibilityLabel="Trocar foto"
                            >
                              <Camera size={14} color={colors.primary} strokeWidth={2.5} />
                              <Text style={styles.photoActionText}>TROCAR</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.photoActionBtnRemove}
                              onPress={handleRemovePhoto}
                              activeOpacity={0.8}
                              accessibilityRole="button"
                              accessibilityLabel="Remover foto"
                            >
                              <Trash2 size={14} color="#EF4444" strokeWidth={2.5} />
                              <Text style={styles.photoActionTextRemove}>REMOVER</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <TouchableOpacity
                            style={styles.photoActionBtn}
                            onPress={handlePickPhoto}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel="Adicionar foto"
                          >
                            <Camera size={14} color={colors.primary} strokeWidth={2.5} />
                            <Text style={styles.photoActionText}>ADICIONAR FOTO</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Nome preferido — obrigatório no cadastro novo */}
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>COMO VOCÊ QUER SER CHAMADO?</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Ex.: Ana"
                      placeholderTextColor={colors.textMutedValue}
                      value={formData.preferredName}
                      onChangeText={(preferredName) =>
                        setFormData((prev) => ({ ...prev, preferredName }))
                      }
                      maxLength={PREFERRED_NAME_MAX_LENGTH}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="next"
                      accessibilityLabel="Como você quer ser chamado"
                    />
                    <Text style={styles.fieldHint}>
                      É assim que as outras pessoas vão te ver no app.
                    </Text>
                  </View>

                  {/* Sobre você — opcional */}
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>SOBRE VOCÊ (OPCIONAL)</Text>
                    <TextInput
                      style={styles.textArea}
                      placeholder="Conte um pouco sobre você, seus interesses ou o que gostaria que outras pessoas soubessem."
                      placeholderTextColor={colors.textMutedValue}
                      value={formData.bio}
                      onChangeText={(bio) => setFormData((prev) => ({ ...prev, bio }))}
                      maxLength={BIO_MAX_LENGTH}
                      multiline
                      textAlignVertical="top"
                      autoCapitalize="sentences"
                      accessibilityLabel="Sobre você"
                    />
                    <Text style={styles.charCounter}>
                      {formData.bio.length}/{BIO_MAX_LENGTH}
                    </Text>
                  </View>

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

                  {/* Estado */}
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>ESTADO</Text>
                    <SelectSheet
                      value={formData.state}
                      onChange={(uf) => setFormData((prev) => ({ ...prev, state: uf, cityName: '' }))}
                      options={BR_STATES.map((s) => ({ value: s.uf, label: `${s.name} (${s.uf})` }))}
                      placeholder="Selecione o estado"
                      title="Selecione o estado"
                    />
                  </View>

                  {/* Cidade */}
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>CIDADE</Text>
                    <SelectSheet
                      value={formData.cityName}
                      onChange={(city) => setFormData((prev) => ({ ...prev, cityName: city }))}
                      options={(CITIES_BY_UF[formData.state] || []).map((c) => ({ value: c, label: c }))}
                      placeholder="Selecione a cidade"
                      title="Selecione a cidade"
                      disabled={!formData.state}
                      disabledHint="Escolha o estado primeiro"
                    />
                  </View>

                  {/* Religião (Opcional) */}
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>RELIGIÃO / CRENÇA (OPCIONAL)</Text>
                    <SelectSheet
                      value={formData.religionChoice}
                      onChange={(r) => setFormData((prev) => ({ ...prev, religionChoice: r }))}
                      options={RELIGION_OPTIONS.map((r) => ({ value: r, label: r }))}
                      placeholder="Selecione (opcional)"
                      title="Religião / Crença"
                      searchable={false}
                    />
                    {formData.religionChoice === RELIGION_OTHER && (
                      <TextInput
                        style={[styles.textInput, { marginTop: spacing.xs }]}
                        placeholder="Qual?"
                        placeholderTextColor={colors.textMutedValue}
                        value={formData.religionOther}
                        onChangeText={(religionOther) =>
                          setFormData((prev) => ({ ...prev, religionOther }))
                        }
                        autoCapitalize="sentences"
                      />
                    )}
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
          </KeyboardAvoidingView>
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
  kav: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    // Folga generosa: com o teclado aberto o Android reduz a janela
    // (`windowSoftInputMode="adjustResize"`) e o iOS usa o KeyboardAvoidingView.
    // Em ambos os casos é este padding que permite rolar o último campo
    // para acima do teclado. A etapa 2 cresceu com nome preferido e bio.
    paddingBottom: spacing.xxl + spacing.lg,
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
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: 2,
  },
  photoActions: {
    flex: 1,
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  photoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing.sm - 2,
    paddingHorizontal: spacing.md,
  },
  photoActionText: {
    fontSize: 11,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  photoActionBtnRemove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: spacing.sm - 2,
    paddingHorizontal: spacing.md,
  },
  photoActionTextRemove: {
    fontSize: 11,
    fontWeight: typography.weight.black,
    color: '#EF4444',
    letterSpacing: 0.5,
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
  textArea: {
    minHeight: 96,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    fontSize: typography.size.sm,
    color: colors.text,
    fontWeight: typography.weight.medium,
    lineHeight: 20,
  },
  fieldHint: {
    fontSize: 11,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    marginLeft: 4,
  },
  charCounter: {
    fontSize: 11,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    textAlign: 'right',
    marginRight: 4,
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
