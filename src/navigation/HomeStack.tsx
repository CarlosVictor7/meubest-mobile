import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { HomeStackParamList } from './types';
import { HomeScreen } from '@features/matching/screens/HomeScreen';
import { MatchSearchScreen } from '@features/matching/screens/MatchSearchScreen';
import { ListenerProfileScreen } from '@features/matching/screens/ListenerProfileScreen';
import { ScheduleMatchScreen } from '@features/matching/screens/ScheduleMatchScreen';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="MatchSearch" component={MatchSearchScreen} />
      <Stack.Screen name="ListenerProfile" component={ListenerProfileScreen} />
      <Stack.Screen name="ScheduleMatch" component={ScheduleMatchScreen} />
    </Stack.Navigator>
  );
}
