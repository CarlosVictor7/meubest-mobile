/**
 * TabHeader — Cabeçalho padrão reutilizável das abas principais
 *
 * Regras de exibição:
 * - Toggle Online/Offline → só aparece quando activeRole === 'listener' (modo Apoiar)
 * - Toggle Desabafar|Acolher com thumb animado e peek educativo nas 3
 *   primeiras aberturas (26/08: substituiu a seta SVG, que por sua vez havia
 *   substituído o bloco "Vire a chave aqui!"; "Como funciona" vive no Menu)
 * - Modo Ouvir: apenas SegmentedControl + NoticeCard (sem chave)
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc, collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@shared/services/firebase';
import { useAuth } from '@features/auth/hooks/useAuth';
import { Avatar, SegmentedControl } from '@shared/components';
import { NoticeStrip } from '@shared/components/NoticeStrip';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { NotificationsModal } from '@features/notifications/components/NotificationsModal';
import { EvolutionModal } from '@features/gamification/components/EvolutionModal';
import { COINS_FEATURES_ENABLED } from '@shared/constants/platformFeatures';
import { canActAsListener, isInListenerMode, needsListenerTraining } from '@shared/utils/listener';
import { ListenerTrainingSheet } from '@features/listener/components/ListenerTrainingSheet';
import { getDisplayName, getFirstName, getInitial } from '@shared/utils/displayName';
import { getDisplayPhotoUrl } from '@shared/utils/profilePhoto';


// Chave de persistência da preferência Online do modo Apoiar
const LISTENER_ONLINE_PREF_KEY = '@meubest:listenerOnlinePreference';

// ─── Opções de papel ──────────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  {
    value: 'speaker',
    label: 'Desabafar',
    icon: <Text style={{ fontSize: 13 }}>💬</Text>,
  },
  {
    value: 'listener',
    label: 'Acolher',
    icon: <Text style={{ fontSize: 13 }}>❤️</Text>,
  },
];

// ─────────────────────────────────────────────────────────────────────────────

interface TabHeaderProps {
  /** Oculta SegmentedControl e bloco de chave (para Carteira e Menu) */
  hideControls?: boolean;
  /**
   * Renderiza a faixa "Rede de voluntários — não use em emergências" ENTRE a
   * saudação e a chave. O aviso pertence SÓ à Home (decisão de 19/08): antes
   * ele vivia incondicional aqui dentro e ocupava o topo de quatro telas.
   */
  showNotice?: boolean;
  /** Callback extra quando o papel é alterado */
  onRoleChange?: (role: string) => void;
}

export function TabHeader({
  hideControls = false,
  showNotice = false,
  onRoleChange,
}: TabHeaderProps) {
  const { user, profile } = useAuth();

  // ── Estado local do papel — atualiza UI imediatamente ────────────
  const [activeRole, setActiveRole] = useState<string>(profile?.role ?? 'speaker');
  const [isOnline, setIsOnline]     = useState(profile?.isOnline ?? false);

  // Estados para as notificações (Task 8)
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Estado para o modal de Evolução (Task 11)
  const [evolutionVisible, setEvolutionVisible] = useState(false);

  // Tela explicativa de treinamento. So alcancavel com o enforcement ligado.
  const [trainingOpen, setTrainingOpen] = useState(false);

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

  const isListener = isInListenerMode({ role: activeRole });

  const name     = getFirstName(profile, 'amigo(a)');
  const initials = getInitial(profile);
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
        // lastSeenAt acompanha isOnline: ligar a chave e' tambem uma confirmacao
        // de presenca. Ver @shared/utils/presence.
        await updateDoc(doc(db, 'users', user.uid), {
          isOnline: value,
          lastSeenAt: new Date().toISOString(),
        });
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

      // ── Gate de acolhimento (Sprint 6) ───────────────────────────────────
      // Tocar em "Acolher" sem autorização NÃO troca o papel: abre a tela que
      // explica a seleção e oferece o treinamento. Com
      // LISTENER_APPROVAL_ENFORCED = false, `needsListenerTraining` devolve
      // sempre false e este bloco é inerte — nada muda para ninguém.
      if (newRole === 'listener' && needsListenerTraining(profile)) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setTrainingOpen(true);
        return;
      }

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
            lastSeenAt: new Date().toISOString(),
          }).catch(() => { /* silencia — UI já atualizada */ });
        }
      } else {
        // Modo Ouvir: offline — preferência do listener permanece salva
        setIsOnline(false);
        if (user) {
          updateDoc(doc(db, 'users', user.uid), {
            role: 'speaker',
            isOnline: false,
            lastSeenAt: new Date().toISOString(),
          }).catch(() => { /* silencia — UI já atualizada */ });
        }
      }
    },
    [activeRole, user, onRoleChange, profile]
  );


  return (
    <>
      {/* ── Header superior ──────────────────────────────────────── */}
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          {/* Avatar + saudação */}
          <View style={styles.avatarRow}>
            {getDisplayPhotoUrl(profile) ? (
              <Avatar profile={profile} name={getDisplayName(profile)} size="sm" />
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
              {COINS_FEATURES_ENABLED && <Text style={styles.miniStat}>🪙 {coins}</Text>}
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

      {/* ── Aviso de segurança — SÓ onde for pedido (Home) ────────── */}
      {/* Fica ENTRE a saudação e a chave, na ordem definida em 19/08:
          greeting → aviso → Desabafar|Acolher. A faixa abre o modal com
          CVV 188 e SAMU 192 discáveis. */}
      {showNotice && (
        <View style={styles.noticeWrap}>
          <NoticeStrip />
        </View>
      )}

      {/* ── Controles de papel ───────────────────────────────────── */}
      {!hideControls && (
        <View style={styles.controls}>
          {/* SegmentedControl — Desabafar / Acolher. O thumb animado + peek
              educativo (3 primeiras aberturas) substituem a seta SVG de 26/08. */}
          <SegmentedControl
            options={ROLE_OPTIONS}
            value={activeRole}
            onChange={handleRoleChange}
            educationalHint
          />

          {/* Bloco da chave Online — só em modo Apoiar */}
          {isListener && canActAsListener(profile) && (
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
        </View>
      )}

      {/* Tela de treinamento — inerte enquanto o enforcement estiver desligado */}
      <ListenerTrainingSheet
        visible={trainingOpen}
        onClose={() => setTrainingOpen(false)}
        uid={user?.uid}
        profile={profile}
      />

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

  // Faixa de aviso (NoticeStrip)
  noticeWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
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

