import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SessionsStackParamList } from './types';
import { SessionsListScreen } from '@features/session/screens/SessionsListScreen';
import { SessionDetailScreen } from '@features/session/screens/SessionDetailScreen';

const Stack = createNativeStackNavigator<SessionsStackParamList>();

export function SessionsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SessionsList" component={SessionsListScreen} />
      <Stack.Screen name="SessionDetail" component={SessionDetailScreen} />
    </Stack.Navigator>
  );
}
