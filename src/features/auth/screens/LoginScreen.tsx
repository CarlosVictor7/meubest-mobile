import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, MessageCircle, Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { AuthStackParamList } from '@navigation/types';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { Button } from '@shared/components';

type RouteProps = RouteProp<AuthStackParamList, 'Login'>;
type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

// ─── Conteúdo contextual por papel ────────────────────────────────
const ROLE_CONTENT = {
  speaker: {
    badge: 'Quero ser ouvido',
    badgeBg: `${colors.primary}18`,
    badgeColor: colors.primary,
    Icon: MessageCircle,
    iconBg: `${colors.primary}12`,
    iconColor: colors.primary,
    illustrationGradient: [colors.primaryLight, '#FFE8DC'] as [string, string],
    headline: 'Você deu o\nprimeiro passo.',
    subheadline:
      'Conectamos você a alguém que já passou pelo que você está vivendo — presente, sem julgamento.',
    googleBtnLabel: 'Entrar com o Google',
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
    googleBtnLabel: 'Entrar com o Google',
    switchLabel: 'Na verdade, preciso ser ouvido →',
    switchRole: 'speaker' as const,
    motivational: '💚  Seu tempo e presença são um presente.',
  },
} as const;

export function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const role = route.params?.role ?? 'speaker';
  const [loading, setLoading] = useState(false);

  const content = ROLE_CONTENT[role];

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleSwitch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.replace('Login', { role: content.switchRole });
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      Alert.alert(
        'Configuração pendente',
        'Para ativar o login com Google, adicione o GoogleService-Info.plist (iOS) e google-services.json (Android) ao projeto — isso será feito no Sprint 2.',
        [{ text: 'Entendi' }]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <LinearGradient
        colors={[colors.background, '#FFF5EF']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safe}>

          {/* ─── Barra superior ───────────────────────────────────── */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <ChevronLeft size={24} color={colors.text} strokeWidth={2.5} />
            </TouchableOpacity>

            {/* Badge de papel */}
            <View style={[styles.badge, { backgroundColor: content.badgeBg }]}>
              <content.Icon size={13} color={content.badgeColor} strokeWidth={2.5} />
              <Text style={[styles.badgeText, { color: content.badgeColor }]}>
                {content.badge}
              </Text>
            </View>

            {/* Espaçador para centralizar o badge */}
            <View style={{ width: 40 }} />
          </View>

          {/* ─── Área de ilustração / contexto ────────────────────── */}
          <LinearGradient
            colors={content.illustrationGradient}
            style={styles.illustration}
          >
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
          <View style={styles.actions}>
            <Button
              label={content.googleBtnLabel}
              onPress={handleGoogleLogin}
              size="lg"
              fullWidth
              loading={loading}
              style={shadows.primary}
            />

            <TouchableOpacity
              onPress={handleSwitch}
              activeOpacity={0.65}
              style={styles.switchBtn}
            >
              <Text style={styles.switchText}>{content.switchLabel}</Text>
            </TouchableOpacity>
          </View>

          {/* ─── Termos e aviso ───────────────────────────────────── */}
          <View style={styles.footer}>
            <Text style={styles.terms}>
              Ao continuar, você concorda com os{' '}
              <Text style={styles.termsLink}>Termos de Uso</Text> e a{' '}
              <Text style={styles.termsLink}>Política de Privacidade</Text>.
            </Text>

            <View style={styles.safetyBox}>
              <Text style={styles.safetyText}>
                🤝  O Meu Best é uma rede de apoio voluntário — não substitui atendimento
                profissional. Em crise, ligue{' '}
                <Text style={styles.safetyHighlight}>CVV 188</Text> ou{' '}
                <Text style={styles.safetyHighlight}>SAMU 192</Text>.
              </Text>
            </View>
          </View>

        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gradient: { flex: 1 },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },

  // ── Barra superior
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

  // ── Ilustração contextual
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
    color: colors.textMuted,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
  },

  // ── Headline
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
    color: colors.textMuted,
    lineHeight: 22,
    fontWeight: typography.weight.medium,
  },

  // ── Ações
  actions: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  switchBtn: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  switchText: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
    textDecorationLine: 'underline',
    textDecorationColor: `${colors.primary}60`,
  },

  // ── Footer
  footer: {
    gap: spacing.sm,
  },
  terms: {
    fontSize: 11,
    color: colors.textMuted,
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
