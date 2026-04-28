/**
 * LoginScreen — Tela de autenticação
 *
 * Fluxo de auth:
 * 1. Botão principal: "Continuar com Google"
 *    - Se Expo Go: mostra alert amigável explicando que precisa de development build
 *    - Se Dev Build: executa Google Sign-In real
 * 2. E-mail/Senha: APENAS se EXPO_PUBLIC_ENABLE_DEV_EMAIL_LOGIN === 'true'
 *    - Toggle discreto para não confundir usuário real
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  StatusBar,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, MessageCircle, Heart, Globe } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import Constants from 'expo-constants';
import { auth, db } from '@shared/services/firebase';
import { appConfig } from '@constants/appConfig';
import type { AuthStackParamList } from '@navigation/types';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { Button } from '@shared/components';
import type { UserProfile } from '@models/user';

// Necessário para fechar o browser ao retornar ao app
WebBrowser.maybeCompleteAuthSession();

type RouteProps = RouteProp<AuthStackParamList, 'Login'>;
type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

// ─── Flag de dev — email/senha visível apenas em dev build com env var ──────
const DEV_EMAIL_LOGIN_ENABLED =
  process.env.EXPO_PUBLIC_ENABLE_DEV_EMAIL_LOGIN === 'true';

// ─── Detecta Expo Go ─────────────────────────────────────────────────────────
function isExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

// ─── Conteúdo contextual por papel ──────────────────────────────────────────
const ROLE_CONTENT = {
  speaker: {
    badge: 'Quero ser ouvido',
    badgeBg: `${colors.primary}18`,
    badgeColor: colors.primary,
    Icon: MessageCircle,
    iconBg: `${colors.primary}12`,
    iconColor: colors.primary,
    illustrationGradient: [colors.background, '#FFE8DC'] as [string, string],
    headline: 'Você deu o\nprimeiro passo.',
    subheadline:
      'Conectamos você a alguém que já passou pelo que você está vivendo — presente, sem julgamento.',
    switchLabel: 'Na verdade, quero apoiar alguém →',
    switchRole: 'listener' as const,
    motivational: '🤍  Você não está sozinho. Estamos aqui.',
  },
  listener: {
    badge: 'Quero apoiar alguém',
    badgeBg: '#E8F5E9',
    badgeColor: '#388E3C',
    Icon: Heart,
    iconBg: '#E8F5E9',
    iconColor: '#388E3C',
    illustrationGradient: ['#F0FFF4', '#E8F5E9'] as [string, string],
    headline: 'A comunidade\nprecisa de você.',
    subheadline:
      'Sua experiência tem valor. Cada conversa que você oferece muda a trajetória de alguém.',
    switchLabel: 'Na verdade, preciso ser ouvido →',
    switchRole: 'speaker' as const,
    motivational: '💚  Seu tempo e presença são um presente.',
  },
} as const;

// ────────────────────────────────────────────────────────────────────────────
export function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const role = route.params?.role ?? 'speaker';
  const content = ROLE_CONTENT[role];

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showDevEmailForm, setShowDevEmailForm] = useState(false);

  // ── Google Auth Session ────────────────────────────────────────────
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: appConfig.googleWebClientId || undefined,
    iosClientId: appConfig.googleIosClientId || undefined,
    redirectUri: makeRedirectUri({ scheme: 'meubest' }),
    scopes: ['openid', 'profile', 'email'],
  });

  // ── Processa resposta do Google ────────────────────────────────────
  useEffect(() => {
    if (!response) return;

    if (response.type === 'success') {
      const { id_token } = response.params;
      if (id_token) {
        handleFirebaseGoogleLogin(id_token);
      } else {
        setLoading(false);
        Alert.alert('Erro', 'Token de autenticação inválido.');
      }
    } else if (response.type === 'error') {
      setLoading(false);
      Alert.alert('Erro', 'Não foi possível autenticar com o Google. Tente novamente.');
    } else if (response.type === 'dismiss' || response.type === 'cancel') {
      setLoading(false);
    }
  }, [response]);

  // ── Firebase Google Login ──────────────────────────────────────────
  const handleFirebaseGoogleLogin = async (idToken: string) => {
    try {
      setStatus('Autenticando...');
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);

      const userRef = doc(db, 'users', result.user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        setStatus('Criando perfil...');
        const newProfile: Partial<UserProfile> = {
          uid: result.user.uid,
          name: result.user.displayName ?? 'Usuário',
          email: result.user.email ?? '',
          photoURL: result.user.photoURL ?? '',
          role,
          balance: 0,
          totalEarnings: 0,
          rating: 5.0,
          isOnline: role === 'listener',
          isProfileComplete: false,
          showTutorial: true,
          gratitudeCoins: 0,
          points: 0,
          level: 1,
          currentStreak: 0,
          badges: [],
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, newProfile);
      }

      setStatus('');
    } catch (error: any) {
      console.error('[LoginScreen] Google Firebase error:', error);
      setStatus('');
      setLoading(false);
      Alert.alert('Erro ao entrar', error?.message ?? 'Não foi possível autenticar.');
    }
  };

  // ── Botão "Continuar com Google" ──────────────────────────────────
  const handleGooglePress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isExpoGo()) {
      // Expo Go não suporta custom scheme OAuth
      Alert.alert(
        'Google Sign-In',
        'O login com Google requer um Development Build.\n\nPara testes, use e-mail e senha abaixo, ou gere um build de desenvolvimento com:\n\neas build --profile development',
        [
          { text: 'Entendi', style: 'default' },
          {
            text: 'Usar e-mail',
            onPress: () => setShowDevEmailForm(true),
          },
        ]
      );
      return;
    }

    // Dev Build — dispara o fluxo real
    if (!request) return;
    setLoading(true);
    await promptAsync();
  };

  // ── Email/Senha (dev only) ─────────────────────────────────────────
  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert('Campos obrigatórios', 'Preencha e-mail e senha.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setStatus('Entrando...');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setStatus('');
    } catch (error: any) {
      console.error('[LoginScreen] Email login error:', error);
      setStatus('');
      setLoading(false);
      Alert.alert('Erro ao entrar', 'E-mail ou senha incorretos.', [{ text: 'OK' }]);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleSwitch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.replace('Login', { role: content.switchRole });
  };

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <LinearGradient colors={[colors.background, '#FFF5EF']} style={styles.gradient}>
        <SafeAreaView style={styles.safe}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ─── Top bar ──────────────────────────────────────────── */}
            <View style={styles.topBar}>
              <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
                <ChevronLeft size={24} color={colors.text} strokeWidth={2.5} />
              </TouchableOpacity>

              <View style={[styles.badge, { backgroundColor: content.badgeBg }]}>
                <content.Icon size={13} color={content.badgeColor} strokeWidth={2.5} />
                <Text style={[styles.badgeText, { color: content.badgeColor }]}>
                  {content.badge}
                </Text>
              </View>

              <View style={{ width: 40 }} />
            </View>

            {/* ─── Ilustração ───────────────────────────────────────── */}
            <LinearGradient colors={content.illustrationGradient} style={styles.illustration}>
              <View style={[styles.illustrationIcon, { backgroundColor: content.iconBg }]}>
                <content.Icon size={40} color={content.iconColor} strokeWidth={1.8} />
              </View>
              <Text style={styles.motivational}>{content.motivational}</Text>
            </LinearGradient>

            {/* ─── Headline ─────────────────────────────────────────── */}
            <View style={styles.textBlock}>
              <Text style={styles.headline}>{content.headline}</Text>
              <Text style={styles.subheadline}>{content.subheadline}</Text>
            </View>

            {/* ─── Ações ────────────────────────────────────────────── */}
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.actions}
            >
              {/* Botão PRINCIPAL — Google */}
              {!showDevEmailForm && (
                <TouchableOpacity
                  onPress={handleGooglePress}
                  style={[styles.googleBtn, shadows.primary]}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  <View style={styles.googleIconWrap}>
                    <Globe size={22} color={colors.textInverted} />
                  </View>
                  <Text style={styles.googleBtnText}>
                    {loading ? (status || 'Aguarde...') : 'Continuar com Google'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Formulário email/senha — dev only */}
              {(DEV_EMAIL_LOGIN_ENABLED || showDevEmailForm) && (
                <View style={styles.emailSection}>
                  {!showDevEmailForm ? (
                    // Toggle discreto (só quando flag dev ativa)
                    <TouchableOpacity
                      onPress={() => setShowDevEmailForm(true)}
                      style={styles.devToggle}
                    >
                      <Text style={styles.devToggleText}>Entrar com e-mail</Text>
                    </TouchableOpacity>
                  ) : (
                    // Formulário completo
                    <View style={styles.emailForm}>
                      <TextInput
                        style={styles.input}
                        placeholder="E-mail"
                        placeholderTextColor={colors.textMutedValue}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoCorrect={false}
                        editable={!loading}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Senha"
                        placeholderTextColor={colors.textMutedValue}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        editable={!loading}
                      />
                      <Button
                        label={loading ? (status || 'Aguarde...') : 'Entrar'}
                        onPress={handleEmailLogin}
                        size="lg"
                        fullWidth
                        loading={loading}
                        style={shadows.primary}
                      />
                      <TouchableOpacity
                        onPress={() => setShowDevEmailForm(false)}
                        style={styles.switchBtn}
                        activeOpacity={0.65}
                      >
                        <Text style={styles.switchText}>← Voltar ao Google</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* Trocar papel */}
              <TouchableOpacity onPress={handleSwitch} activeOpacity={0.65} style={styles.switchBtn}>
                <Text style={styles.switchText}>{content.switchLabel}</Text>
              </TouchableOpacity>
            </KeyboardAvoidingView>

            {/* ─── Rodapé ───────────────────────────────────────────── */}
            <View style={styles.footer}>
              <Text style={styles.terms}>
                Ao continuar, você concorda com os{' '}
                <Text style={styles.termsLink}>Termos de Uso</Text> e a{' '}
                <Text style={styles.termsLink}>Política de Privacidade</Text>.
              </Text>

              <View style={styles.safetyBox}>
                <Text style={styles.safetyText}>
                  🤝  O Meu Best é uma rede de apoio voluntário — não substitui atendimento
                  profissional. Em crise:{' '}
                  <Text style={styles.safetyHighlight}>CVV 188</Text> ou{' '}
                  <Text style={styles.safetyHighlight}>SAMU 192</Text>.
                </Text>
              </View>
            </View>

          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  gradient: { flex: 1 },
  safe: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.1,
  },
  illustration: {
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  illustrationIcon: {
    width: 80,
    height: 80,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  motivational: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
  },
  textBlock: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  headline: {
    fontSize: 34,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  subheadline: {
    fontSize: typography.size.base,
    color: colors.textMutedValue,
    lineHeight: 22,
    fontWeight: typography.weight.medium,
  },
  actions: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },

  // ── Botão Google (principal)
  googleBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  googleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleBtnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.wide,
    textTransform: 'uppercase',
  },

  // ── Email (dev only)
  emailSection: { gap: spacing.sm },
  devToggle: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  devToggleText: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    fontWeight: typography.weight.semibold,
    textDecorationLine: 'underline',
  },
  emailForm: { gap: spacing.md },
  input: {
    height: 52,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.base,
    color: colors.text,
    fontWeight: typography.weight.medium,
  },

  // ── Misc
  switchBtn: { alignSelf: 'center', paddingVertical: spacing.xs },
  switchText: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
    textDecorationLine: 'underline',
    textDecorationColor: `${colors.primary}60`,
  },
  footer: { gap: spacing.sm },
  terms: {
    fontSize: 11,
    color: colors.textMutedValue,
    textAlign: 'center',
    lineHeight: 17,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: typography.weight.bold,
    textDecorationLine: 'underline',
  },
  safetyBox: {
    backgroundColor: '#FFFAED',
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: '#F4C430',
  },
  safetyText: {
    fontSize: 11,
    color: '#6B5000',
    lineHeight: 17,
    fontWeight: typography.weight.medium,
  },
  safetyHighlight: {
    fontWeight: typography.weight.bold,
    color: '#9A7300',
  },
});
