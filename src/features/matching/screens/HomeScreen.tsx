import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MessageCircle,
  Coins,
  Calendar,
  Flame,
  Bell,
  Search,
  Zap,
} from 'lucide-react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '@navigation/types';
import { db } from '@shared/services/firebase';
import { useAuth } from '@features/auth/hooks/useAuth';
import { Avatar, Card } from '@shared/components';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { MOTIVATIONAL_PHRASES } from '@constants/config';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Home'>;

const MOODS = ['😔', '😕', '😐', '🙂', '😁'];

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user, profile } = useAuth();
  const [isOnline, setIsOnline] = useState(profile?.isOnline ?? false);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [dailyPhrase] = useState(
    () => MOTIVATIONAL_PHRASES[Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)]
  );

  const isListener = profile?.role === 'listener';

  useEffect(() => {
    setIsOnline(profile?.isOnline ?? false);
  }, [profile?.isOnline]);

  const toggleOnlineStatus = async (value: boolean) => {
    if (!user) return;
    setIsOnline(value);
    try {
      await updateDoc(doc(db, 'users', user.uid), { isOnline: value });
    } catch (e) {
      console.error('[HomeScreen] toggleOnline error:', e);
      setIsOnline(!value); // rollback
    }
  };

  const name = profile?.name?.split(' ')[0] ?? 'amigo(a)';
  const coins = profile?.gratitudeCoins ?? 0;
  const streak = profile?.currentStreak ?? 0;
  const points = profile?.points ?? 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <ScrollView showsVerticalScrollIndicator={false} bounces>

        {/* ── Header ── */}
        <LinearGradient
          colors={[colors.surface, colors.background]}
          style={styles.header}
        >
          <SafeAreaView>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.greeting}>
                  Olá, {name} 👋
                </Text>
                <Text style={styles.subGreeting}>{dailyPhrase}</Text>
              </View>
              <View style={styles.headerRight}>
                <TouchableOpacity style={styles.bellBtn}>
                  <Bell size={22} color={colors.text} />
                </TouchableOpacity>
                <Avatar
                  photoURL={profile?.photoURL}
                  name={profile?.name}
                  size="sm"
                />
              </View>
            </View>

            {/* Stats bar */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Coins size={16} color={colors.coins} />
                <Text style={styles.statValue}>{coins.toLocaleString('pt-BR')}</Text>
                <Text style={styles.statLabel}>moedas</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statItem}>
                <Flame size={16} color={colors.primary} />
                <Text style={styles.statValue}>{streak}</Text>
                <Text style={styles.statLabel}>dias streak</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statItem}>
                <Zap size={16} color="#64B5F6" />
                <Text style={styles.statValue}>{points}</Text>
                <Text style={styles.statLabel}>pontos</Text>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.content}>

          {/* ── Status Online (Listener only) ── */}
          {isListener && (
            <Card style={styles.statusCard}>
              <View style={styles.statusRow}>
                <View>
                  <Text style={styles.statusTitle}>Status online</Text>
                  <Text style={styles.statusSub}>
                    {isOnline ? '✅ Visível para speakers' : '⭕ Indisponível para chamados'}
                  </Text>
                </View>
                <Switch
                  value={isOnline}
                  onValueChange={toggleOnlineStatus}
                  trackColor={{ false: colors.borderLight, true: `${colors.primary}60` }}
                  thumbColor={isOnline ? colors.primary : '#CCC'}
                />
              </View>
            </Card>
          )}

          {/* ── CTA Principal ── */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => {
              const role = profile?.role === 'listener' ? 'listener' : 'speaker';
              navigation.navigate('MatchSearch', { role });
            }}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.mainCta, shadows.primary]}
            >
              <View style={styles.ctaIcon}>
                {isListener ? <Search size={40} color="#FFF" /> : <MessageCircle size={40} color="#FFF" />}
              </View>
              <View style={styles.ctaText}>
                <Text style={styles.ctaTitle}>
                  {isListener ? 'Ver chamados disponíveis' : 'Encontrar alguém para ouvir'}
                </Text>
                <Text style={styles.ctaSubtitle}>
                  {isListener
                    ? 'Veja quem precisa de apoio agora'
                    : 'Converse agora com um voluntário'}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Mood Picker ── */}
          <Card>
            <Text style={styles.sectionTitle}>Como você está hoje?</Text>
            <View style={styles.moods}>
              {MOODS.map((emoji, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.moodBtn,
                    selectedMood === i && styles.moodBtnActive,
                  ]}
                  onPress={() => setSelectedMood(i)}
                >
                  <Text style={styles.moodEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedMood !== null && (
              <Text style={styles.moodFeedback}>
                {selectedMood <= 1
                  ? 'Tudo bem. Estamos aqui com você. 🤍'
                  : selectedMood === 2
                  ? 'Cada dia é uma oportunidade. Vai ficar bem! 💛'
                  : 'Que bom! Continue assim. 🧡'}
              </Text>
            )}
          </Card>

          {/* ── Quick Actions ── */}
          <Text style={styles.sectionTitle}>Acesso rápido</Text>
          <View style={styles.quickGrid}>
            <QuickAction
              emoji="📅"
              label="Agendar"
              color="#64B5F6"
              onPress={() => navigation.navigate('ScheduleMatch', {})}
            />
            <QuickAction
              emoji="🏆"
              label="Ranking"
              color="#FFD54F"
              onPress={() => {
                // navigation to profile tab ranking
              }}
            />
            <QuickAction
              emoji="🎁"
              label="Loja"
              color="#81C784"
              onPress={() => {}}
            />
            <QuickAction
              emoji="🔥"
              label="Minha Jornada"
              color={colors.primary}
              onPress={() => {}}
            />
          </View>

          <View style={{ height: spacing.xxxl }} />
        </View>
      </ScrollView>
    </View>
  );
}

function QuickAction({
  emoji,
  label,
  color,
  onPress,
}: {
  emoji: string;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.quickIcon, { backgroundColor: `${color}20` }]}>
        <Text style={styles.quickEmoji}>{emoji}</Text>
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: spacing.md,
  },
  greeting: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.text,
  },
  subGreeting: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    fontWeight: typography.weight.medium,
    marginTop: spacing.xs,
    maxWidth: 200,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.text,
  },
  statLabel: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    fontWeight: typography.weight.semibold,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  statusCard: {
    padding: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  statusSub: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  mainCta: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ctaIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: { flex: 1 },
  ctaTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: '#FFF',
    lineHeight: 24,
  },
  ctaSubtitle: {
    fontSize: typography.size.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
    fontWeight: typography.weight.medium,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.extrabold,
    color: colors.text,
  },
  moods: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  moodBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  moodBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  moodEmoji: {
    fontSize: 28,
  },
  moodFeedback: {
    marginTop: spacing.md,
    fontSize: typography.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: typography.weight.medium,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickAction: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  quickIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickEmoji: { fontSize: 28 },
  quickLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
});
