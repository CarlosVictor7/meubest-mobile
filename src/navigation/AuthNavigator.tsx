import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';

// Screens (serão implementadas no Sprint 2)
import { OnboardingScreen } from '@features/auth/screens/OnboardingScreen';
import { RoleSelectionScreen } from '@features/auth/screens/RoleSelectionScreen';
import { LoginScreen } from '@features/auth/screens/LoginScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Onboarding"
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}
