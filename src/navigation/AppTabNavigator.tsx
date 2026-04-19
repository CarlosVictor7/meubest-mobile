import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MessageCircle, Calendar, Coins, User } from 'lucide-react-native';
import { colors, typography } from '@constants/theme';
import type { AppTabParamList } from './types';

// Tab stacks
import { HomeStack } from './HomeStack';
import { SessionsStack } from './SessionsStack';
import { WalletStack } from './WalletStack';
import { ProfileStack } from './ProfileStack';

const Tab = createBottomTabNavigator<AppTabParamList>();

export function AppTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          height: 72,
          paddingBottom: 16,
          paddingTop: 10,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        },
        tabBarLabelStyle: {
          fontSize: typography.size.xs,
          fontWeight: typography.weight.bold,
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          tabBarLabel: 'Início',
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="SessionsTab"
        component={SessionsStack}
        options={{
          tabBarLabel: 'Sessões',
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="WalletTab"
        component={WalletStack}
        options={{
          tabBarLabel: 'Carteira',
          tabBarIcon: ({ color, size }) => <Coins color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}
