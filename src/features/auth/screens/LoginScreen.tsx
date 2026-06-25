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
import Svg, { Path } from 'react-native-svg';
import { Heart, MessageCircle, Shield } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { signInWithGoogle } from '@shared/services/googleAuth';
import { signInWithApple, isAppleSignInSupported } from '@shared/services/appleAuth';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';

// Necessário para fechar o browser ao retornar ao app (OAuth redirect)
WebBrowser.maybeCompleteAuthSession();

// ─── Logo Google oficial (G colorido) ─────────────────────────────────
// G oficial em SVG dentro de um chip branco discreto para contraste no
// botão vermelho. Sem letra "G" em texto.
function GoogleIcon() {
  return (
    <View style={gChip.wrap}>
      <Svg width={20} height={20} viewBox="0 0 48 48">
        <Path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <Path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <Path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <Path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </Svg>
    </View>
  );
}

const gChip = StyleSheet.create({
  wrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ─── Logo Apple oficial (maçã branca) ─────────────────────────────────
// Maçã em SVG dentro de um wrapper centralizado (mesma estrutura do ícone
// do Google), sem fundo. Garante que o ícone seja um item de tamanho fixo
// e fique colado ao texto via gap do botão.
function AppleIcon() {
  return (
    <View style={aWrap.wrap}>
      <Svg width={16.5} height={22} viewBox="0 0 384 512">
        <Path
          fill="#FFFFFF"
          d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
        />
      </Svg>
    </View>
  );
}

const aWrap = StyleSheet.create({
  wrap: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
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
    gap: 12,
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
    gap: 12,
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
