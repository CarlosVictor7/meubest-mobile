/**
 * BottomNav — Barra fixa no rodapé
 *
 * Correção: botão COMEÇAR posicionado com cálculo correto relativo à safeArea.
 * Constantes exportadas para uso nas telas (paddingBottom do ScrollView).
 *
 * Abas por plataforma vêm de `tabsForPlatform` (./tabs.ts):
 *   Android → Início, Sessões | Carteira, Menu
 *   iOS     → Início, Sessões | Explorar, Menu   (Guideline 1.1.4: sem Carteira)
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, Calendar, CreditCard, Compass, Settings, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius, typography, shadows } from '@constants/theme';
import { FINANCIAL_FEATURES_ENABLED } from '@shared/constants/platformFeatures';
import { tabsForPlatform, type BottomNavTab } from './tabs';

export type { BottomNavTab } from './tabs';

// ── Constantes exportadas para padding das telas ──────────────────
export const BOTTOM_NAV_BAR_HEIGHT = 64;   // altura da barra
export const BOTTOM_NAV_BTN_SIZE   = 64;   // tamanho do botão COMEÇAR
export const BOTTOM_NAV_BTN_ELEV   = 16;   // quanto o botão sobressai acima da barra
// Espaço total a reservar no ScrollView: barra + elevação + margem
export const BOTTOM_NAV_SCROLL_PAD = BOTTOM_NAV_BAR_HEIGHT + BOTTOM_NAV_BTN_ELEV + 24;

interface BottomNavProps {
  activeTab: BottomNavTab;
  onTabChange: (tab: BottomNavTab) => void;
  onStartPress: () => void;
  hasBadge?: boolean;
}

interface TabItem {
  id: BottomNavTab;
  label: string;
  Icon: typeof User;
}

const TAB_ITEMS: Record<BottomNavTab, TabItem> = {
  home:     { id: 'home',     label: 'Início',   Icon: User       },
  sessions: { id: 'sessions', label: 'Sessões',  Icon: Calendar   },
  wallet:   { id: 'wallet',   label: 'Carteira', Icon: CreditCard },
  explore:  { id: 'explore',  label: 'Explorar', Icon: Compass    },
  menu:     { id: 'menu',     label: 'Menu',     Icon: Settings   },
};

// Sempre 4 abas: [0,1] à esquerda do COMEÇAR, [2,3] à direita.
const TABS: TabItem[] = tabsForPlatform(FINANCIAL_FEATURES_ENABLED).map((id) => TAB_ITEMS[id]);

export function BottomNav({ activeTab, onTabChange, onStartPress, hasBadge }: BottomNavProps) {
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1200, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const handleTabPress = (tab: BottomNavTab) => {
    if (tab === activeTab) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTabChange(tab);
  };

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStartPress();
  };

  // safeArea do iPhone (home indicator)
  const safeBottom = Math.max(insets.bottom, 0);

  /**
   * Posição do botão COMEÇAR (bottom, relativo ao wrapper):
   *
   *   NavBar top  = safeBottom + BOTTOM_NAV_BAR_HEIGHT
   *   Btn top     = NavBar top + BOTTOM_NAV_BTN_ELEV        (fica ELEV px acima da barra)
   *   Btn bottom  = Btn top    - BOTTOM_NAV_BTN_SIZE
   *              = safeBottom + BAR_HEIGHT + ELEV - BTN_SIZE
   */
  const btnBottom = safeBottom + BOTTOM_NAV_BAR_HEIGHT + BOTTOM_NAV_BTN_ELEV - BOTTOM_NAV_BTN_SIZE;

  const renderTab = (item: TabItem) => (
    <NavTab
      key={item.id}
      item={item}
      active={activeTab === item.id}
      onPress={() => handleTabPress(item.id)}
      badge={item.id === 'sessions' ? hasBadge : undefined}
    />
  );

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      {/* ── Botão COMEÇAR — fora do navBar para não ser clipado ── */}
      <Animated.View
        style={[
          styles.startWrap,
          { bottom: btnBottom, transform: [{ scale: pulseAnim }] },
        ]}
        pointerEvents="box-none"
      >
        <TouchableOpacity onPress={handleStart} activeOpacity={0.85} style={styles.startBtn}>
          <Zap size={26} color="#fff" fill="#fff" />
          <Text style={styles.startLabel}>COMEÇAR</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Barra de navegação ── */}
      <View style={[styles.navBar, { paddingBottom: safeBottom, height: BOTTOM_NAV_BAR_HEIGHT + safeBottom }]}>
        {/* Metade esquerda: Início e Sessões */}
        <View style={styles.half}>
          {TABS.slice(0, 2).map(renderTab)}
        </View>

        {/* Espaço central para o botão */}
        <View style={styles.centerGap} />

        {/* Metade direita: Carteira (Android) ou Explorar (iOS) + Menu */}
        <View style={styles.half}>
          {TABS.slice(2, 4).map(renderTab)}
        </View>
      </View>
    </View>
  );
}

// ── NavTab ────────────────────────────────────────────────────────
function NavTab({ item, active, onPress, badge }: {
  item: TabItem; active: boolean; onPress: () => void; badge?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View>
        <item.Icon
          size={22}
          color={active ? colors.primary : 'rgba(26,26,26,0.35)'}
          strokeWidth={active ? 2.5 : 2}
        />
        {badge && <View style={styles.badge} />}
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {item.label.toUpperCase()}
      </Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    zIndex: 200,
    alignItems: 'center',
  },

  // Botão COMEÇAR — position absolute no wrapper, fora do navBar
  startWrap: {
    position: 'absolute',
    zIndex: 10,
    alignSelf: 'center',
  },
  startBtn: {
    width: BOTTOM_NAV_BTN_SIZE,
    height: BOTTOM_NAV_BTN_SIZE,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 3,
    borderColor: colors.surface,
    ...shadows.primary,
  },
  startLabel: {
    fontSize: 8,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: 0.4,
  },

  // Barra de navegação
  navBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 10,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 32,
    borderWidth: 3,
    borderColor: colors.primaryLight,
    overflow: 'hidden',
    ...shadows.nav,
  },
  half: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  centerGap: {
    width: BOTTOM_NAV_BTN_SIZE + spacing.md,
  },

  // Tab
  tab: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    minWidth: 48,
  },
  tabActive: {
    backgroundColor: `${colors.primary}12`,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: typography.weight.black,
    color: 'rgba(26,26,26,0.35)',
    letterSpacing: 0.4,
  },
  tabLabelActive: {
    color: colors.primary,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
