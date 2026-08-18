import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import { LoginScreen } from '@features/auth/screens/LoginScreen';
import { OnboardingScreen } from '@features/auth/screens/OnboardingScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

interface AuthNavigatorProps {
  /**
   * Resolvido pelo `useBootstrap` antes de qualquer navigator ser montado.
   *
   * Antes este componente lia o AsyncStorage por conta própria e mostrava um
   * segundo spinner enquanto decidia. Agora chega pronto: o gate de bootstrap
   * já esperou essa leitura junto com as outras duas.
   */
  isFirstLaunch: boolean;
}

export function AuthNavigator({ isFirstLaunch }: AuthNavigatorProps) {
  return (
    <Stack.Navigator
      initialRouteName={isFirstLaunch ? 'Onboarding' : 'Login'}
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}
