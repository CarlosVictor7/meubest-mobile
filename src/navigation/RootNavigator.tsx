import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '@shared/stores/authStore';
import { AuthNavigator } from './AuthNavigator';
import { AppTabNavigator } from './AppTabNavigator';
import type { RootStackParamList } from './types';
import { colors } from '@constants/theme';

const Root = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const loading = useAuthStore((s) => s.loading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Root.Screen name="App" component={AppTabNavigator} />
        ) : (
          <Root.Screen name="Auth" component={AuthNavigator} />
        )}
      </Root.Navigator>
    </NavigationContainer>
  );
}
