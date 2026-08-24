/**
 * ExploreStack — stack da aba Explorar (iOS apenas).
 *
 * No iOS o slot da Carteira no BottomNav é ocupado pelo Explorar
 * (Guideline 1.1.4: sem recursos financeiros). No Android o Explorar continua
 * sendo uma rota do HomeStack, aberta pelo card da tela inicial.
 *
 * FALAR AGORA/AGENDAR navegam para `HomeTab → MatchSearch/ScheduleMatch`
 * (nested navigate), então este stack só precisa da tela do Explorar.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ExploreStackParamList } from './types';
import { ExploreScreen } from '@features/explore/screens/ExploreScreen';

const Stack = createNativeStackNavigator<ExploreStackParamList>();

export function ExploreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Explore" component={ExploreScreen} />
    </Stack.Navigator>
  );
}
