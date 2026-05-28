/**
 * AppTabNavigator — Navegação por abas com BottomNav custom
 *
 * Estratégia: usamos o `tabBar` prop do react-navigation para substituir
 * a tab bar nativa pelo nosso componente BottomNav flutuante.
 * O mapeamento de tabs:
 *   home      → HomeTab (HomeStack)
 *   sessions  → SessionsTab (SessionsStack)
 *   wallet    → WalletTab (WalletStack)
 *   menu      → ProfileTab (ProfileStack)
 *
 * StartModal foi extraído para src/shared/components/StartModal/index.tsx
 * e é reutilizado aqui e na HomeScreen (card "Início Rápido").
 */
import React, { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { BottomNav, StartModal, type BottomNavTab } from '@shared/components';
import type { AppTabParamList } from './types';
import { useAuth } from '@features/auth/hooks/useAuth';
import { useIncomingCall } from '@features/session/hooks/useIncomingCall';
import { IncomingCallModal } from '@features/session/components/IncomingCallModal';

// Tab stacks
import { HomeStack } from './HomeStack';
import { SessionsStack } from './SessionsStack';
import { WalletStack } from './WalletStack';
import { ProfileStack } from './ProfileStack';

const Tab = createBottomTabNavigator<AppTabParamList>();

// ─── Mapeamento tab id → route name ────────────────────────────────
const TAB_TO_ROUTE: Record<BottomNavTab, keyof AppTabParamList> = {
  home: 'HomeTab',
  sessions: 'SessionsTab',
  wallet: 'WalletTab',
  menu: 'ProfileTab',
};

const ROUTE_TO_TAB: Record<string, BottomNavTab> = {
  HomeTab: 'home',
  SessionsTab: 'sessions',
  WalletTab: 'wallet',
  ProfileTab: 'menu',
};

// ─── TabBar customizada ─────────────────────────────────────────────
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const [startModalVisible, setStartModalVisible] = useState(false);

  const activeRouteName = state.routes[state.index].name;
  const activeTab: BottomNavTab = ROUTE_TO_TAB[activeRouteName] ?? 'home';

  const handleTabChange = useCallback(
    (tab: BottomNavTab) => {
      const routeName = TAB_TO_ROUTE[tab];
      const targetRoute = state.routes.find((r) => r.name === routeName);
      if (!targetRoute) return;
      const event = navigation.emit({
        type: 'tabPress',
        target: targetRoute.key,
        canPreventDefault: true,
      });
      if (!event.defaultPrevented) {
        navigation.navigate(routeName);
      }
    },
    [state, navigation]
  );

  return (
    <>
      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onStartPress={() => setStartModalVisible(true)}
      />

      {/* ── Modal de seleção de tema (COMEÇAR) ── */}
      <StartModal
        visible={startModalVisible}
        onClose={() => setStartModalVisible(false)}
        onSelectTheme={(theme) => {
          setStartModalVisible(false);
          // Navega para busca com o tema selecionado no stack interno
          navigation.navigate('HomeTab', {
            screen: 'MatchSearch',
            params: { category: theme }
          } as any);
        }}
      />
    </>
  );
}

// ─── Navigator ─────────────────────────────────────────────────────
export function AppTabNavigator() {
  const { user, profile } = useAuth();
  const navigation = useNavigation<any>();

  const { incomingSession, dismissSession, acceptSession, isAccepting } =
    useIncomingCall(user, profile);

  const handleAccept = useCallback(
    async (sessionId: string) => {
      try {
        await acceptSession(sessionId, (sid) => {
          // Navega para o fluxo da sessão (ConsentScreen → VideoRoom)
          navigation.navigate('Session', { sessionId: sid });
        });
      } catch (err: any) {
        Alert.alert(
          'Chamado Indisponível',
          err?.message || 'Este chamado já foi aceito por outro apoiador ou foi cancelado.',
          [{ text: 'OK' }]
        );
      }
    },
    [acceptSession, navigation]
  );

  return (
    <>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          // Impede que o navigator reserve espaço para a tab bar nativa
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tab.Screen name="HomeTab" component={HomeStack} />
        <Tab.Screen name="SessionsTab" component={SessionsStack} />
        <Tab.Screen name="WalletTab" component={WalletStack} />
        <Tab.Screen name="ProfileTab" component={ProfileStack} />
      </Tab.Navigator>

      {/* Modal global de chamado — sobrepõe qualquer aba */}
      <IncomingCallModal
        session={incomingSession}
        isAccepting={isAccepting}
        onAccept={handleAccept}
        onDecline={dismissSession}
      />
    </>
  );
}
