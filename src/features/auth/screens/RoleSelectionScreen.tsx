import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { MessageCircle, Heart, ArrowRight } from 'lucide-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@navigation/types';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'RoleSelection'>;

// ─── Copy 100% PT-BR ──────────────────────────────────────────────
const ROLES = [
  {
    id: 'speaker' as const,
    Icon: MessageCircle,
    title: 'Preciso ser ouvido',
    description:
      'Estou passando por algo difícil e quero conversar com alguém que entende, sem julgamento.',
    cta: 'Quero ser ouvido',
    gradient: [colors.primary, '#F97B45'] as [string, string],
    accentColor: '#FFF',
  },
  {
    id: 'listener' as const,
    Icon: Heart,
    title: 'Quero apoiar alguém',
    description:
      'Já superei desafios e quero oferecer minha escuta e presença para quem precisa.',
    cta: 'Quero ser voluntário',
    gradient: ['#FFFFFF', '#FFFFFF'] as [string, string],
    accentColor: colors.primary,
    outline: true,
  },
] as const;

export function RoleSelectionScreen() {
  const navigation = useNavigation<Nav>();

  // Animated scale para feedback de toque
  const scales = useRef(ROLES.map(() => new Animated.Value(1))).current;

  const handlePressIn = (i: number) => {
    Animated.spring(scales[i], {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const handlePressOut = (i: number) => {
    Animated.spring(scales[i], {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
    }).start();
  };

  const handleSelect = (role: 'speaker' | 'listener', i: number) => {
    handlePressOut(i);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Login', { role });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <SafeAreaView>

          {/* ─── Branding ─────────────────────────────────────────── */}
          <View style={styles.brand}>
            <Text style={styles.logo}>Meu Best</Text>
            <View style={styles.taglineRow}>
              <Text style={styles.tagline}>Você consegue </Text>
              <Text style={styles.taglineEmoji}>🧡</Text>
            </View>
          </View>

          {/* ─── Headline ─────────────────────────────────────────── */}
          <View style={styles.headline}>
            <Text style={styles.question}>Como você quer{'\n'}participar?</Text>
            <Text style={styles.hint}>
              Você pode mudar isso a qualquer momento nas configurações.
            </Text>
          </View>

          {/* ─── Cards ────────────────────────────────────────────── */}
          <View style={styles.cards}>
            {ROLES.map((role, i) => (
              <Animated.View
                key={role.id}
                style={{ transform: [{ scale: scales[i] }] }}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  onPressIn={() => handlePressIn(i)}
                  onPressOut={() => handlePressOut(i)}
                  onPress={() => handleSelect(role.id, i)}
                >
                  {role.id === 'listener' ? (
                    // ── Card outline (listener) ──
                    <View style={[styles.card, styles.cardOutline, shadows.md]}>
                      <View style={styles.cardContent}>
                        <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}15` }]}>
                          <role.Icon color={colors.primary} size={28} strokeWidth={2} />
                        </View>
                        <View style={styles.cardText}>
                          <Text style={[styles.cardTitle, { color: colors.text }]}>
                            {role.title}
                          </Text>
                          <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
                            {role.description}
                          </Text>
                        </View>
                        <View style={[styles.ctaPill, { backgroundColor: colors.primaryLight }]}>
                          <Text style={[styles.ctaLabel, { color: colors.primary }]}>
                            {role.cta}
                          </Text>
                          <ArrowRight size={15} color={colors.primary} strokeWidth={2.5} />
                        </View>
                      </View>
                    </View>
                  ) : (
                    // ── Card gradient (speaker) ──
                    <LinearGradient
                      colors={role.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.card, shadows.primary]}
                    >
                      <View style={styles.cardContent}>
                        <View style={[styles.iconWrap, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                          <role.Icon color="#FFF" size={28} strokeWidth={2} />
                        </View>
                        <View style={styles.cardText}>
                          <Text style={[styles.cardTitle, { color: '#FFF' }]}>
                            {role.title}
                          </Text>
                          <Text style={[styles.cardDesc, { color: 'rgba(255,255,255,0.82)' }]}>
                            {role.description}
                          </Text>
                        </View>
                        <View style={[styles.ctaPill, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
                          <Text style={[styles.ctaLabel, { color: '#FFF' }]}>
                            {role.cta}
                          </Text>
                          <ArrowRight size={15} color="#FFF" strokeWidth={2.5} />
                        </View>
                      </View>
                    </LinearGradient>
                  )}
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>

          {/* ─── Disclaimer ───────────────────────────────────────── */}
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              ⚠️{'  '}O Meu Best é uma rede de apoio entre pares, não um serviço de saúde mental
              profissional. Em emergências ligue{' '}
              <Text style={styles.disclaimerHighlight}>CVV 188</Text>.
            </Text>
          </View>

        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },

  // ── Branding
  brand: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  logo: {
    fontSize: 38,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  tagline: {
    fontSize: typography.size.base,
    color: colors.textMuted,
    fontWeight: typography.weight.semibold,
  },
  taglineEmoji: {
    fontSize: typography.size.base,
  },

  // ── Headline
  headline: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  question: {
    fontSize: 30,
    fontWeight: typography.weight.black,
    color: colors.text,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  hint: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    lineHeight: 20,
    fontWeight: typography.weight.medium,
  },

  // ── Cards
  cards: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  card: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  cardOutline: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  cardContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: {
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  cardDesc: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    fontWeight: typography.weight.medium,
  },
  ctaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
  ctaLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },

  // ── Disclaimer
  disclaimer: {
    backgroundColor: '#FFF8F0',
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: '#FFB347',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#7A5C3A',
    lineHeight: 18,
    fontWeight: typography.weight.medium,
  },
  disclaimerHighlight: {
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
});
