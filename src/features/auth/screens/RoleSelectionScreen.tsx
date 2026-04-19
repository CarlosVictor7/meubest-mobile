import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
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

export function RoleSelectionScreen() {
  const navigation = useNavigation<Nav>();

  const handleSelect = (role: 'speaker' | 'listener') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Login', { role });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.header}>
        <Text style={styles.logo}>Meu Best</Text>
        <Text style={styles.tagline}>Você consegue! 🧡</Text>
      </View>

      <Text style={styles.question}>Como você quer participar?</Text>
      <Text style={styles.hint}>Você poderá mudar isso depois nas configurações.</Text>

      <View style={styles.cards}>
        {/* Speaker Card */}
        <TouchableOpacity
          onPress={() => handleSelect('speaker')}
          activeOpacity={0.88}
          style={[styles.card, shadows.md]}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardIcon}>
              <MessageCircle color="#FFF" size={40} />
            </View>
            <Text style={[styles.cardTitle, { color: '#FFF' }]}>
              Preciso ser ouvido
            </Text>
            <Text style={[styles.cardDesc, { color: 'rgba(255,255,255,0.85)' }]}>
              Estou passando por algo difícil e quero conversar com alguém que entende.
            </Text>
            <View style={styles.cardCta}>
              <Text style={styles.ctaText}>Entrar como Speaker</Text>
              <ArrowRight color="#FFF" size={18} />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Listener Card */}
        <TouchableOpacity
          onPress={() => handleSelect('listener')}
          activeOpacity={0.88}
          style={[styles.card, styles.cardOutline, shadows.sm]}
        >
          <View style={styles.cardInner}>
            <View style={[styles.cardIcon, { backgroundColor: colors.primaryLight }]}>
              <Heart color={colors.primary} size={40} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Quero apoiar alguém
            </Text>
            <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
              Já superei desafios e quero oferecer minha escuta e experiência para ajudar.
            </Text>
            <View style={[styles.cardCta, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.ctaText, { color: colors.primary }]}>Entrar como Listener</Text>
              <ArrowRight color={colors.primary} size={18} />
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.disclaimer}>
        ⚠️ O Meu Best é uma rede de voluntários, não um serviço de saúde mental profissional.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  logo: {
    fontSize: typography.size.xxxl,
    fontWeight: typography.weight.black,
    color: colors.primary,
  },
  tagline: {
    fontSize: typography.size.base,
    color: colors.textMuted,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.xs,
  },
  question: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  cards: {
    gap: spacing.md,
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  cardGradient: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  cardOutline: {
    borderWidth: 2,
    borderColor: colors.border,
  },
  cardInner: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  cardIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
  },
  cardDesc: {
    fontSize: typography.size.base,
    lineHeight: 22,
    fontWeight: typography.weight.medium,
  },
  cardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  ctaText: {
    color: '#FFF',
    fontWeight: typography.weight.bold,
    fontSize: typography.size.sm,
  },
  disclaimer: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
    lineHeight: 18,
    paddingHorizontal: spacing.md,
  },
});
