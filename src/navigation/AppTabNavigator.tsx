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
 */
import React, { useState, useCallback } from 'react';
import { Alert, Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Zap, X } from 'lucide-react-native';
import { BottomNav, type BottomNavTab } from '@shared/components';
import { colors, spacing, borderRadius, typography, shadows } from '@constants/theme';
import type { AppTabParamList } from './types';
import { SESSION_THEMES } from '@constants/config';
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

// ─── Modal COMEÇAR ──────────────────────────────────────────────────
function StartModal({
  visible,
  onClose,
  onSelectTheme,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectTheme: (theme: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          {/* Handle */}
          <View style={modal.handle} />

          {/* Header */}
          <View style={modal.header}>
            <View style={modal.headerLeft}>
              <View style={modal.headerIcon}>
                <Zap size={22} color={colors.textInverted} fill={colors.textInverted} />
              </View>
              <View>
                <Text style={modal.headerTitle}>COMEÇAR</Text>
                <Text style={modal.headerSub}>Sobre o que você quer conversar?</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
              <X size={20} color={colors.textMutedValue} />
            </TouchableOpacity>
          </View>

          {/* Temas */}
          <ScrollView
            contentContainerStyle={modal.grid}
            showsVerticalScrollIndicator={false}
          >
            {SESSION_THEMES.map((theme) => (
              <TouchableOpacity
                key={theme.id}
                style={[
                  modal.themeCard,
                  selected === theme.label && modal.themeCardActive,
                ]}
                onPress={() => setSelected(theme.label)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    modal.themeLabel,
                    selected === theme.label && modal.themeLabelActive,
                  ]}
                >
                  {theme.label.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* CTA */}
          <TouchableOpacity
            style={[modal.cta, !selected && modal.ctaDisabled]}
            onPress={() => selected && onSelectTheme(selected)}
            activeOpacity={0.85}
            disabled={!selected}
          >
            <Text style={modal.ctaText}>
              {selected ? 'BUSCAR ACOLHEDOR →' : 'SELECIONE UM TEMA'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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

// ─── Estilos do Modal ───────────────────────────────────────────────
const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26,26,26,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
    maxHeight: '85%',
    ...shadows.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: typography.tracking.tight,
  },
  headerSub: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  themeCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    minWidth: '45%',
    flex: 1,
    alignItems: 'center',
  },
  themeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  themeLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textMutedValue,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  themeLabelActive: {
    color: colors.textInverted,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    ...shadows.primary,
    marginTop: spacing.sm,
  },
  ctaDisabled: {
    backgroundColor: 'rgba(26,26,26,0.12)',
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.widest,
  },
});
