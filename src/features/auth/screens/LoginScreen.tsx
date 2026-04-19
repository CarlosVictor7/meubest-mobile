import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@shared/services/firebase';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { AuthStackParamList } from '@navigation/types';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { Button } from '@shared/components';
import type { UserProfile } from '@models/user';

// NOTE: Google Sign-In requires @react-native-google-signin/google-signin
// Install in Sprint 2: npx expo install @react-native-google-signin/google-signin
// For now we show the correct UI with a placeholder auth handler

type RouteProps = RouteProp<AuthStackParamList, 'Login'>;

export function LoginScreen() {
  const route = useRoute<RouteProps>();
  const role = route.params?.role ?? 'speaker';
  const [loading, setLoading] = useState(false);

  // TODO Sprint 2: Replace with real GoogleSignin.signIn()
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // Placeholder — real implementation requires @react-native-google-signin
      Alert.alert(
        'Configuração necessária',
        'Para habilitar o login com Google, adicione o arquivo GoogleService-Info.plist (iOS) e google-services.json (Android) ao projeto.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('[LoginScreen] Login error:', error);
      Alert.alert('Erro', error.message ?? 'Erro ao realizar login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Real implementation for Sprint 2:
  // const handleGoogleLogin = async () => {
  //   setLoading(true);
  //   try {
  //     await GoogleSignin.hasPlayServices();
  //     const { idToken } = await GoogleSignin.signIn();
  //     const credential = GoogleAuthProvider.credential(idToken);
  //     const result = await signInWithCredential(auth, credential);
  //     const userRef = doc(db, 'users', result.user.uid);
  //     const snap = await getDoc(userRef);
  //     if (!snap.exists()) {
  //       const profile: Partial<UserProfile> = {
  //         uid: result.user.uid,
  //         name: result.user.displayName ?? 'Usuário',
  //         email: result.user.email ?? '',
  //         role,
  //         balance: 0,
  //         rating: 5,
  //         isProfileComplete: false,
  //         showTutorial: true,
  //         createdAt: new Date().toISOString(),
  //       };
  //       await setDoc(userRef, profile);
  //     }
  //   } catch (error: any) {
  //     // handle
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const roleLabel = role === 'speaker' ? 'Speaker' : 'Listener';
  const roleColor = role === 'speaker' ? colors.primary : '#64B5F6';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[colors.background, '#FFE8DC']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safe}>
          <View style={styles.top}>
            <View style={[styles.roleBadge, { backgroundColor: `${roleColor}20` }]}>
              <Text style={[styles.roleBadgeText, { color: roleColor }]}>
                Entrando como {roleLabel}
              </Text>
            </View>

            <Text style={styles.title}>Boas-vindas ao{'\n'}Meu Best</Text>
            <Text style={styles.subtitle}>
              Entre com sua conta Google para começar sua jornada de acolhimento.
            </Text>
          </View>

          <View style={styles.bottom}>
            <Button
              label={loading ? 'Entrando...' : 'Continuar com Google'}
              onPress={handleGoogleLogin}
              size="xl"
              fullWidth
              loading={loading}
              style={shadows.primary}
            />

            <Text style={styles.terms}>
              Ao continuar, você concorda com nossos{' '}
              <Text style={styles.termsLink}>Termos de Uso</Text> e{' '}
              <Text style={styles.termsLink}>Política de Privacidade</Text>.
            </Text>

            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                🤝 O Meu Best é uma rede de apoio entre pares. Nossos voluntários não são
                profissionais de saúde. Em emergências, procure o SAMU (192) ou CVV (188).
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
  },
  top: {
    paddingTop: spacing.xxxl,
    gap: spacing.lg,
  },
  roleBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  roleBadgeText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  title: {
    fontSize: 42,
    fontWeight: typography.weight.black,
    color: colors.text,
    lineHeight: 48,
  },
  subtitle: {
    fontSize: typography.size.md,
    color: colors.textMuted,
    lineHeight: 24,
    fontWeight: typography.weight.medium,
  },
  bottom: {
    gap: spacing.lg,
  },
  terms: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: typography.weight.bold,
    textDecorationLine: 'underline',
  },
  disclaimer: {
    backgroundColor: '#FFF3E0',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  disclaimerText: {
    fontSize: typography.size.xs,
    color: '#795548',
    lineHeight: 18,
    fontWeight: typography.weight.medium,
  },
});
