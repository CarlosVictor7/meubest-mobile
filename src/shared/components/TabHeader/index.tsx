/**
 * TabHeader — Cabeçalho padrão reutilizável das abas principais
 *
 * Regras de exibição:
 * - Toggle Online/Offline → só aparece quando activeRole === 'listener' (modo Apoiar)
 * - "Vire a chave aqui!" + "COMO FUNCIONA?" → centralizado, só no modo Apoiar
 * - Modo Ouvir: apenas SegmentedControl + NoticeCard (sem chave)
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, X, ShieldCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc, collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@shared/services/firebase';
import { useAuth } from '@features/auth/hooks/useAuth';
import { Avatar, NoticeCard, SegmentedControl } from '@shared/components';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { NotificationsModal } from '@features/notifications/components/NotificationsModal';
import { EvolutionModal } from '@features/gamification/components/EvolutionModal';

// Chave de persistência da preferência Online do modo Apoiar
const LISTENER_ONLINE_PREF_KEY = '@meubest:listenerOnlinePreference';

// ─── Opções de papel ──────────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  {
    value: 'speaker',
    label: 'Ouvir',
    icon: <Text style={{ fontSize: 13 }}>💬</Text>,
  },
  {
    value: 'listener',
    label: 'Apoiar',
    icon: <Text style={{ fontSize: 13 }}>❤️</Text>,
  },
];

// ─── Conteúdo do modal "Como funciona?" ──────────────────────────────────────
const HOW_IT_WORKS = [
  {
    icon: '💬',
    title: 'Ouvir',
    body: 'Você busca alguém com quem conversar. Conectamos você a um voluntário disponível no momento.',
  },
  {
    icon: '❤️',
    title: 'Apoiar',
    body: 'Você indica que está disponível para ouvir alguém. Ative sua chave Online quando puder acolher.',
  },
  {
    icon: '🔑',
    title: 'A chave Online',
    body: 'Ao ativar, você aparece como disponível na plataforma. Desative quando precisar de pausa.',
  },
  {
    icon: '🤝',
    title: 'Somos voluntários',
    body: 'O Meu Best é uma rede de apoio voluntário — não substitui acompanhamento profissional.',
  },
  {
    icon: '🆘',
    title: 'Emergências',
    body: 'Em crise, procure ajuda imediata: SAMU 192 ou CVV 188 (24h, gratuito).',
  },
];

// ─────────────────────────────────────────────────────────────────────────────

interface TabHeaderProps {
  /** Oculta SegmentedControl e bloco de chave (para Carteira e Menu) */
  hideControls?: boolean;
  /** Callback extra quando o papel é alterado */
  onRoleChange?: (role: string) => void;
}

export function TabHeader({ hideControls = false, onRoleChange }: TabHeaderProps) {
  const { user, profile } = useAuth();

  // ── Estado local do papel — atualiza UI imediatamente ────────────
  const [activeRole, setActiveRole] = useState<string>(profile?.role ?? 'speaker');
  const [isOnline, setIsOnline]     = useState(profile?.isOnline ?? false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  // Estados para as notificações (Task 8)
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Estado para o modal de Evolução (Task 11)
  const [evolutionVisible, setEvolutionVisible] = useState(false);

  // Sincroniza quando o profile do Firestore chegar
  useEffect(() => {
    if (profile?.role)    setActiveRole(profile.role);
    if (profile?.isOnline !== undefined) setIsOnline(profile.isOnline);
  }, [profile?.role, profile?.isOnline]);

  // Listener para contar notificações não lidas (Task 8)
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    console.log(`[TabHeader] listening unread notifications count for: ${user.uid}`);

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const count = snap.docs.filter((d) => !d.data().read).length;
        setUnreadCount(count);
      },
      (error) => {
        console.error('[TabHeader] error listening notifications:', error);
      }
    );

    return () => unsub();
  }, [user]);

  const isListener = activeRole === 'listener';

  const name     = profile?.name?.split(' ')[0] ?? 'amigo(a)';
  const initials = (profile?.name ?? 'U').charAt(0).toUpperCase();
  const coins    = profile?.gratitudeCoins ?? 0;
  const streak   = profile?.currentStreak  ?? 0;

  // ── Toggle Online ─────────────────────────────────────────────────────
  // Salva preferência no AsyncStorage ao alternar manualmente
  const toggleOnline = useCallback(
    async (value: boolean) => {
      if (!user) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsOnline(value);
      // Persiste a escolha manual para o modo Apoiar
      try {
        await AsyncStorage.setItem(LISTENER_ONLINE_PREF_KEY, String(value));
      } catch { /* silencia — não crítico */ }
      try {
        await updateDoc(doc(db, 'users', user.uid), { isOnline: value });
      } catch {
        setIsOnline(!value);
      }
    },
    [user]
  );

  // ── Toggle papel (Ouvir ↔ Apoiar) ───────────────────────────────────
  // Ao mudar para Apoiar: lê preferência salva (ou usa true na 1ª vez)
  // Ao mudar para Ouvir: vai offline (preferência salva permanece para próxima vez)
  const handleRoleChange = useCallback(
    async (newRole: string) => {
      if (newRole === activeRole) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setActiveRole(newRole);
      onRoleChange?.(newRole);

      if (newRole === 'listener') {
        // Lê preferência salva no AsyncStorage
        let preferredOnline = true; // padrão na primeira vez
        try {
          const saved = await AsyncStorage.getItem(LISTENER_ONLINE_PREF_KEY);
          if (saved !== null) {
            preferredOnline = saved === 'true';
          } else {
            // Primeira vez no modo Apoiar: salva o padrão true
            await AsyncStorage.setItem(LISTENER_ONLINE_PREF_KEY, 'true');
          }
        } catch { /* silencia */ }

        setIsOnline(preferredOnline);
        if (user) {
          updateDoc(doc(db, 'users', user.uid), {
            role: 'listener',
            isOnline: preferredOnline,
          }).catch(() => { /* silencia — UI já atualizada */ });
        }
      } else {
        // Modo Ouvir: offline — preferência do listener permanece salva
        setIsOnline(false);
        if (user) {
          updateDoc(doc(db, 'users', user.uid), {
            role: 'speaker',
            isOnline: false,
          }).catch(() => { /* silencia — UI já atualizada */ });
        }
      }
    },
    [activeRole, user, onRoleChange]
  );


  return (
    <>
      {/* ── Header superior ──────────────────────────────────────── */}
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          {/* Avatar + saudação */}
          <View style={styles.avatarRow}>
            {profile?.photoURL ? (
              <Avatar photoURL={profile.photoURL} name={profile.name} size="sm" />
            ) : (
              <View style={styles.avatarInitial}>
                <Text style={styles.avatarInitialText}>{initials}</Text>
              </View>
            )}
            <View style={styles.headerText}>
              <Text style={styles.greeting}>OLÁ, {name.toUpperCase()}!</Text>
              <Text style={styles.greetingSub}>O SEU MELHOR COMEÇA AQUI</Text>
            </View>
          </View>

          {/* Stats inline + Sino */}
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.miniStats}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setEvolutionVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.miniStat}>🔥 {streak}</Text>
              <Text style={styles.miniStat}>🪙 {coins}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setNotificationsVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Bell size={18} color={colors.text} strokeWidth={2} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* ── Controles de papel ───────────────────────────────────── */}
      {!hideControls && (
        <View style={styles.controls}>
          {/* SegmentedControl — Ouvir / Apoiar */}
          <SegmentedControl
            options={ROLE_OPTIONS}
            value={activeRole}
            onChange={handleRoleChange}
          />

          {/* Bloco da chave Online — só em modo Apoiar */}
          {isListener && (
            <View style={styles.onlineBlock}>
              <View style={styles.onlineRow}>
                <Switch
                  value={isOnline}
                  onValueChange={toggleOnline}
                  trackColor={{ false: 'rgba(26,26,26,0.12)', true: '#22C55E' }}
                  thumbColor={colors.surface}
                  ios_backgroundColor="rgba(26,26,26,0.12)"
                />
                <Text style={[styles.onlineLabel, isOnline && styles.onlineLabelActive]}>
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </Text>
              </View>
            </View>
          )}

          {/* "Vire a chave aqui!" + "COMO FUNCIONA?" — sempre visíveis */}
          <View style={styles.hintBlock}>
            <Text style={styles.hintText}>Vire a chave aqui!</Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setHowItWorksOpen(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.howLink}>COMO FUNCIONA?</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── NoticeCard — Aviso Importante ────────────────────────── */}
      <View style={[styles.noticeWrap, !hideControls && !isListener && styles.noticeWrapOuvir]}>
        <NoticeCard
          body="Somos uma rede de acolhimento formada por voluntários."
          highlight="Não use em emergências."
          footer="Busque ajuda profissional se necessário."
        />
      </View>

      {/* ── Modal "Como funciona?" ───────────────────────────────── */}
      <Modal
        visible={howItWorksOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setHowItWorksOpen(false)}
      >
        <TouchableOpacity
          style={modal.overlay}
          activeOpacity={1}
          onPress={() => setHowItWorksOpen(false)}
        >
          <View style={modal.sheet} onStartShouldSetResponder={() => true}>
            <View style={modal.handle} />

            <View style={modal.topRow}>
              <View style={modal.iconWrap}>
                <ShieldCheck size={22} color={colors.primary} />
              </View>
              <Text style={modal.title}>Como funciona?</Text>
              <TouchableOpacity
                onPress={() => setHowItWorksOpen(false)}
                style={modal.closeBtn}
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={modal.content}
              showsVerticalScrollIndicator={false}
            >
              {HOW_IT_WORKS.map((item, i) => (
                <View key={i} style={modal.item}>
                  <Text style={modal.itemIcon}>{item.icon}</Text>
                  <View style={modal.itemText}>
                    <Text style={modal.itemTitle}>{item.title}</Text>
                    <Text style={modal.itemBody}>{item.body}</Text>
                  </View>
                </View>
              ))}

              <View style={modal.emergency}>
                <Text style={modal.emergencyText}>
                  🆘 Em crise?{' '}
                  <Text style={modal.emergencyHighlight}>SAMU 192</Text>
                  {' '}ou{' '}
                  <Text style={modal.emergencyHighlight}>CVV 188</Text>
                  {' '}(gratuito, 24h)
                </Text>
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <NotificationsModal
        visible={notificationsVisible}
        onClose={() => setNotificationsVisible(false)}
        userId={user?.uid ?? ''}
      />

      <EvolutionModal
        visible={evolutionVisible}
        onClose={() => setEvolutionVisible(false)}
        profile={profile}
      />
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeTop: { backgroundColor: colors.surface },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.primaryLight,
  },

  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  avatarInitial: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '6deg' }],
    ...shadows.sm,
  },
  avatarInitialText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
  },
  headerText: { flex: 1 },
  greeting: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: typography.tracking.tight,
    lineHeight: 20,
  },
  greetingSub: {
    fontSize: 8,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
    letterSpacing: typography.tracking.widest,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  miniStats: { alignItems: 'flex-end', gap: 2 },
  miniStat: {
    fontSize: 11,
    fontWeight: typography.weight.bold,
    color: colors.textMutedValue,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Controls wrapper
  controls: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },

  // Bloco da chave — só em Apoiar
  onlineBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  onlineLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: 'rgba(26,26,26,0.4)',
    letterSpacing: typography.tracking.wider,
  },
  onlineLabelActive: { color: '#22C55E' },

  // "Vire a chave aqui!" + "COMO FUNCIONA?" — sempre visíveis
  hintBlock: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  hintText: {
    fontSize: 20,
    fontStyle: 'italic',
    fontWeight: '400',
    color: colors.primary,
    lineHeight: 26,
    textAlign: 'center',
  },
  howLink: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
    letterSpacing: typography.tracking.wider,
    textDecorationLine: 'underline',
    textDecorationColor: colors.textMutedValue,
    textAlign: 'center',
  },

  // NoticeCard
  noticeWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
  },
  // Modo Ouvir: NoticeCard mais próximo do segmented (sem espaço vazio da chave)
  noticeWrapOuvir: {
    paddingTop: spacing.lg,
  },
  // Badge de notificações (Task 8)
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    textAlign: 'center',
  },
});

// ─── Modal Styles ─────────────────────────────────────────────────────────────
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
    paddingBottom: spacing.xxl + 16,
    paddingTop: spacing.sm,
    maxHeight: '80%',
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: typography.tracking.tight,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { gap: spacing.lg },
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  itemIcon: { fontSize: 24, lineHeight: 28 },
  itemText: { flex: 1, gap: 4 },
  itemTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: typography.tracking.tight,
  },
  itemBody: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 20,
  },
  emergency: {
    backgroundColor: '#FFFAED',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: '#F4C430',
    marginTop: spacing.sm,
  },
  emergencyText: {
    fontSize: typography.size.sm,
    color: '#6B5000',
    fontWeight: typography.weight.medium,
    lineHeight: 20,
  },
  emergencyHighlight: {
    fontWeight: typography.weight.black,
    color: '#9A7300',
  },
});
