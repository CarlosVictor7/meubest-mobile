import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from './types';
import { ProfileScreen } from '@features/profile/screens/ProfileScreen';
import { GamificationScreen } from '@features/gamification/screens/GamificationScreen';
import { RankingScreen } from '@features/gamification/screens/RankingScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Gamification" component={GamificationScreen} />
      <Stack.Screen name="Ranking" component={RankingScreen} />
    </Stack.Navigator>
  );
}
