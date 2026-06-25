/**
 * LoginScreen — Tela única de autenticação do Meu Best
 *
 * Fluxo:
 * - iOS: "Continuar com Apple" (primário, guideline Apple) + "Continuar com Google"
 * - Android/Web: "Continuar com Google" (primário) + "Continuar com Apple"
 * - Usuário existente: mantém perfil salvo no Firestore
 * - Novo usuário: cria perfil mínimo
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  StatusBar,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, MessageCircle, Shield } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { signInWithGoogle } from '@shared/services/googleAuth';
import { signInWithApple, isAppleSignInSupported } from '@shared/services/appleAuth';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';

// Necessário para fechar o browser ao retornar ao app (OAuth redirect)
WebBrowser.maybeCompleteAuthSession();

// ─── Ícone Google SVG inline ──────────────────────────────────────────
function GoogleIcon() {
  return (
    <View style={gIcon.wrap}>
      <Text style={gIcon.text}>G</Text>
    </View>
  );
}

const gIcon = StyleSheet.create({
  wrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 15,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
  },
});

// ─── Ícone Apple inline ───────────────────────────────────────────────
function AppleIcon() {
  return (
    <View style={aIcon.wrap}>
      {/* Logo Apple simplificado em texto — sem dependência de ícone externo */}
      <Text style={aIcon.text}></Text>
    </View>
  );
}

const aIcon = StyleSheet.create({
  wrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
    color: '#fff',
    lineHeight: 22,
  },
});

// ────────────────────────────────────────────────────────────────────────────
export function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState('');

  // ── Login Google ─────────────────────────────────────────────────
  const handleGooglePress = async () => {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setStatus('Autenticando…');

    const result = await signInWithGoogle('speaker');

    if (result.type === 'expoGoLimitation') {
      setLoading(false);
      setStatus('');
      Alert.alert(
        'Google Sign-In Nativo',
        'O login com Google requer um Development Build (EAS).\n\nGere um build com:\n\neas build --profile development',
        [{ text: 'Entendi', style: 'default' }]
      );
      return;
    }

    if (result.type === 'cancelled') {
      setLoading(false);
      setStatus('');
      return;
    }

    if (result.type === 'error') {
      setLoading(false);
      setStatus('');
      Alert.alert('Erro ao entrar', result.message);
      return;
    }

    // Success — RootNavigator cuida da transição de estado automaticamente
    setStatus('');
  };

  // ── Login Apple ──────────────────────────────────────────────────
  const handleApplePress = async () => {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setStatus('Autenticando com Apple…');

    const result = await signInWithApple('speaker');

    if (result.type === 'notAvailable') {
      setLoading(false);
      setStatus('');
      Alert.alert(
        'Apple Sign-In indisponível',
        'O login com Apple requer iOS 13 ou superior em um dispositivo físico.',
        [{ text: 'Entendi', style: 'default' }]
      );
      return;
    }

    if (result.type === 'cancelled') {
      setLoading(false);
      setStatus('');
      return;
    }

    if (result.type === 'error') {
      setLoading(false);
      setStatus('');
      Alert.alert('Erro ao entrar com Apple', result.message);
      return;
    }

    // Success — RootNavigator cuida da transição automaticamente
    setStatus('');
  };

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <LinearGradient
        colors={[colors.background, '#FFF5EF', '#FFF9F6']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safe}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >

            {/* ─── Branding ─────────────────────────────────────────── */}
            <View style={styles.brand}>
              <Text style={styles.logo}>Meu Best</Text>
              <Text style={styles.tagline}>Você não está sozinho.</Text>
            </View>

            {/* ─── Ilustração / Hero ────────────────────────────────── */}
            <LinearGradient
              colors={[colors.primaryLight, '#FFE8DC']}
              style={styles.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {/* Decorative background circles */}
              <View style={styles.heroBgCircle1} />
              <View style={styles.heroBgCircle2} />

              {/* Ícones flutuantes */}
              <View style={styles.heroIcons}>
                <View style={[styles.iconBubble, styles.iconBubbleLg]}>
                  <Heart size={30} color={colors.primary} strokeWidth={1.8} fill={`${colors.primary}22`} />
                </View>
                <View style={[styles.iconBubble, styles.iconBubbleMd, { marginTop: -20 }]}>
                  <MessageCircle size={22} color={colors.primary} strokeWidth={2} />
                </View>
                <View style={[styles.iconBubble, styles.iconBubbleSm, { marginTop: 8 }]}>
                  <Shield size={16} color={colors.primary} strokeWidth={2} />
                </View>
              </View>

              <Text style={styles.heroText}>
                Conectamos você a alguém que já{'\n'}
                passou pelo que você está vivendo{'\n'}
                — presente, sem julgamento.
              </Text>
            </LinearGradient>

            {/* ─── Ações ────────────────────────────────────────────── */}
            <View style={styles.actions}>

              {/*
               * Botão Apple — visível SOMENTE no iOS.
               * No iOS fica acima do Google (obrigatório pela Apple Guideline 4.8).
               * No Android está oculto (Apple Sign-In via popup/redirect não funciona
               * em React Native — depende de window.open que não existe no ambiente nativo).
               * Fase 2: implementar Android via AuthSession + deep link.
               */}
              {isAppleSignInSupported() && (
                <TouchableOpacity
                  onPress={handleApplePress}
                  style={[styles.appleBtn, loading && styles.btnLoading]}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  <AppleIcon />
                  <Text style={styles.appleBtnText}>
                    {loading && status.includes('Apple') ? (status || 'Aguarde…') : 'Continuar com Apple'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Botão Google — disponível em todas as plataformas */}
              <TouchableOpacity
                onPress={handleGooglePress}
                style={[styles.googleBtn, loading && styles.btnLoading, shadows.primary]}
                activeOpacity={0.85}
                disabled={loading}
              >
                <GoogleIcon />
                <Text style={styles.googleBtnText}>
                  {loading && !status.includes('Apple') ? (status || 'Aguarde…') : 'Continuar com Google'}
                </Text>
              </TouchableOpacity>

              {/* Separador decorativo */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>acesso gratuito</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Trust badges */}
              <View style={styles.trustRow}>
                <View style={styles.trustBadge}>
                  <Text style={styles.trustEmoji}>🔒</Text>
                  <Text style={styles.trustText}>100% seguro</Text>
                </View>
                <View style={styles.trustBadge}>
                  <Text style={styles.trustEmoji}>💛</Text>
                  <Text style={styles.trustText}>Voluntários reais</Text>
                </View>
                <View style={styles.trustBadge}>
                  <Text style={styles.trustEmoji}>✨</Text>
                  <Text style={styles.trustText}>Gratuito</Text>
                </View>
              </View>
            </View>

            {/* ─── Rodapé ───────────────────────────────────────────── */}
            <View style={styles.footer}>
              <Text style={styles.terms}>
                Ao continuar, você concorda com os{' '}
                <Text style={styles.termsLink}>Termos de Uso</Text> e a{' '}
                <Text style={styles.termsLink}>Política de Privacidade</Text>.
              </Text>

              <View style={styles.safetyBox}>
                <Text style={styles.safetyText}>
                  🤝{'  '}O Meu Best é uma rede de apoio voluntário — não substitui atendimento
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
  root:     { flex: 1 },
  gradient: { flex: 1 },
  safe:     { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // ── Branding
  brand: {
    alignItems: 'center',
    paddingTop: spacing.xl + 4,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  logo: {
    fontSize: 42,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: typography.size.md,
    color: colors.textMutedValue,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.2,
  },

  // ── Hero card
  hero: {
    borderRadius: borderRadius.xxl ?? 28,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    overflow: 'hidden',
    alignItems: 'center',
    gap: spacing.lg,
    ...shadows.sm,
  },
  heroBgCircle1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: `${colors.primary}10`,
  },
  heroBgCircle2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${colors.primary}08`,
  },
  heroIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  iconBubble: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  iconBubbleLg: { width: 64, height: 64 },
  iconBubbleMd: { width: 48, height: 48 },
  iconBubbleSm: { width: 36, height: 36 },
  heroText: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: typography.weight.medium,
  },

  // ── Ações
  actions: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },

  // Botão Apple — preto conforme HIG da Apple
  appleBtn: {
    backgroundColor: '#000',
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 4,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    ...shadows.sm,
  },
  appleBtnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: '#fff',
    letterSpacing: typography.tracking.wide,
    textTransform: 'uppercase',
  },

  // Botão Google — cor primária do app
  googleBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 4,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  googleBtnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.wide,
    textTransform: 'uppercase',
  },

  btnLoading: {
    opacity: 0.75,
  },

  // ── Divisor
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.textMutedValue,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // ── Trust badges
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  trustBadge: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    gap: 4,
  },
  trustEmoji: { fontSize: 18 },
  trustText: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.textMutedValue,
    letterSpacing: 0.3,
    textAlign: 'center',
  },

  // ── Rodapé
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
