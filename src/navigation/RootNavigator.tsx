import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useAuthStore } from '@shared/stores/authStore';
import { AuthNavigator } from './AuthNavigator';
import { AppTabNavigator } from './AppTabNavigator';
import { SessionNavigator } from './SessionNavigator';
import type { RootStackParamList } from './types';
import { ProfileFormScreen } from '../features/auth/screens/ProfileFormScreen';
import { colors, spacing, typography, borderRadius } from '@constants/theme';

const Root = createNativeStackNavigator<RootStackParamList>();

/**
 * Tela exibida quando o Firestore retorna erro ao carregar o perfil.
 * Instrui o usuário a tentar novamente sem forçar um novo cadastro.
 */
function ProfileErrorScreen() {
  const { clear } = useAuthStore();

  return (
    <View style={errorStyles.container}>
      <Text style={errorStyles.emoji}>⚠️</Text>
      <Text style={errorStyles.title}>Não foi possível carregar seu perfil</Text>
      <Text style={errorStyles.message}>
        Ocorreu um erro temporário ao acessar o servidor.{'\n'}
        Isso pode ser causado por instabilidade na conexão ou limite de uso momentâneo.
      </Text>
      <TouchableOpacity
        style={errorStyles.retryBtn}
        onPress={() => {
          // Limpa o estado — o AuthProvider vai reinscrever o listener automaticamente
          // quando o usuário reabrir o app ou o estado de auth mudar.
          // Para forçar retry: fazemos signOut e o usuário loga novamente.
          clear();
        }}
        activeOpacity={0.8}
      >
        <Text style={errorStyles.retryText}>Sair e tentar novamente</Text>
      </TouchableOpacity>
      <Text style={errorStyles.hint}>
        Se o problema persistir, aguarde alguns minutos e tente novamente.
      </Text>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emoji: {
    fontSize: 56,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 28,
  },
  message: {
    fontSize: typography.size.base,
    color: colors.textMutedValue,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: typography.weight.medium,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md + 4,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  retryText: {
    color: colors.textInverted,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.md,
  },
  hint: {
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export function RootNavigator() {
  const loading = useAuthStore((s) => s.loading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const profile = useAuthStore((s) => s.profile);
  const profileError = useAuthStore((s) => s.profileError);

  // Enquanto carrega (ou autenticado mas sem resposta do Firestore ainda)
  if (loading || (isAuthenticated && !profile && !profileError)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          // Não autenticado → fluxo de login/onboarding
          <Root.Screen name="Auth" component={AuthNavigator} />
        ) : profileError ? (
          // Autenticado, mas Firestore retornou erro transitório
          // NÃO vai para ProfileForm — mostra tela de erro
          <Root.Screen name="ProfileError" component={ProfileErrorScreen} />
        ) : (!profile || profile.isProfileComplete !== true) ? (
          // Autenticado, leitura do Firestore bem-sucedida, doc.exists()===false
          // OU perfil incompleto: vai para cadastro/conclusão de perfil
          <Root.Screen name="ProfileForm" component={ProfileFormScreen} />
        ) : (
          // Autenticado + perfil completo → app principal
          <>
            <Root.Screen name="App" component={AppTabNavigator} />
            <Root.Screen
              name="Session"
              component={SessionNavigator}
              options={{ presentation: 'fullScreenModal' }}
            />
          </>
        )}
      </Root.Navigator>
    </NavigationContainer>
  );
}
