import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Bell, X, Check, MailOpen } from 'lucide-react-native';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@shared/services/firebase';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import * as Haptics from 'expo-haptics';

export interface NotificationItem {
  id: string;
  userId: string;
  title?: string;
  message?: string;
  type?: string;
  read?: boolean;
  link?: string;
  createdAt?: any;
}

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
}

// Mapeamento simples de ícones/emojis por tipo de notificação
const getNotificationEmoji = (type?: string): string => {
  switch (type) {
    case 'call':
      return '📞';
    case 'session_scheduled':
    case 'session_accepted':
      return '🗓️';
    case 'session_cancelled':
      return '❌';
    case 'tip':
      return '🪙';
    case 'match':
      return '🤝';
    case 'system':
    default:
      return '🔔';
  }
};

// Helper seguro para formatar a data/hora da notificação
const formatNotificationDate = (createdAt: any): string => {
  if (!createdAt) return 'Agora';

  try {
    let date: Date;

    // Se for string ISO
    if (typeof createdAt === 'string') {
      date = new Date(createdAt);
    } 
    // Se for Firestore Timestamp
    else if (createdAt && typeof createdAt.toDate === 'function') {
      date = createdAt.toDate();
    } 
    // Se for outro objeto de data ou número
    else {
      date = new Date(createdAt);
    }

    if (isNaN(date.getTime())) {
      return 'Agora';
    }

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_) {
    return 'Agora';
  }
};

export function NotificationsModal({ visible, onClose, userId }: NotificationsModalProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!visible || !userId) {
      setNotifications([]);
      setLoading(true);
      return;
    }

    console.log(`[NotificationsModal] listener active for user: ${userId}`);

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as NotificationItem[];
        setNotifications(items);
        setLoading(false);
      },
      (error) => {
        console.error('[NotificationsModal] Fetch error:', error);
        setLoading(false);
      }
    );

    return () => {
      console.log('[NotificationsModal] listener cleanup');
      unsub();
    };
  }, [visible, userId]);

  // Ação: Marcar notificação individual como lida
  const handleMarkAsRead = useCallback(async (item: NotificationItem) => {
    if (item.read) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await updateDoc(doc(db, 'notifications', item.id), { read: true });
    } catch (err) {
      console.error('[NotificationsModal] Erro ao marcar como lida:', err);
    }
  }, []);

  // Ação: Marcar todas como lidas
  const handleMarkAllAsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsUpdating(true);
    try {
      await Promise.all(
        unread.map((n) => updateDoc(doc(db, 'notifications', n.id), { read: true }))
      );
    } catch (err) {
      console.error('[NotificationsModal] Erro ao marcar todas como lidas:', err);
    } finally {
      setIsUpdating(false);
    }
  }, [notifications]);

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          {/* Alça visual de bottom sheet */}
          <View style={styles.handle} />

          {/* Cabeçalho */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.bellIconWrap}>
                <Bell size={20} color={colors.primary} />
              </View>
              <Text style={styles.title}>Notificações</Text>
            </View>

            <View style={styles.headerActions}>
              {hasUnread && (
                <TouchableOpacity
                  onPress={handleMarkAllAsRead}
                  disabled={isUpdating}
                  style={styles.markAllBtn}
                  activeOpacity={0.7}
                >
                  <MailOpen size={14} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.markAllText}>Ler todas</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Lista de Notificações */}
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Carregando notificações...</Text>
            </View>
          ) : notifications.length === 0 ? (
            // Empty State
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconCircle}>
                <Bell size={32} color="rgba(26,26,26,0.18)" />
              </View>
              <Text style={styles.emptyTitle}>Tudo limpo por aqui!</Text>
              <Text style={styles.emptyDesc}>
                Nenhuma notificação por enquanto. Avisaremos você sobre novas chamadas, agendamentos e retribuições.
              </Text>
            </View>
          ) : (
            // Listagem de notificações
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const emoji = getNotificationEmoji(item.type);
                const dateStr = formatNotificationDate(item.createdAt);

                return (
                  <TouchableOpacity
                    activeOpacity={item.read ? 1 : 0.82}
                    onPress={() => handleMarkAsRead(item)}
                    style={[styles.itemCard, !item.read && styles.itemCardUnread]}
                  >
                    {/* Indicador de não lida (bolinha vermelha) */}
                    {!item.read && <View style={styles.unreadDot} />}

                    {/* Ícone por Emoji */}
                    <View style={[styles.emojiWrap, item.read && styles.emojiWrapRead]}>
                      <Text style={styles.emojiText}>{emoji}</Text>
                    </View>

                    {/* Textos */}
                    <View style={styles.itemBody}>
                      <View style={styles.itemHeader}>
                        <Text style={[styles.itemTitle, !item.read && styles.itemTitleUnread]} numberOfLines={1}>
                          {item.title || 'Notificação'}
                        </Text>
                        <Text style={styles.itemDate}>{dateStr}</Text>
                      </View>
                      <Text style={styles.itemMessage} numberOfLines={2}>
                        {item.message || 'Sem descrição.'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Rodapé informativo */}
          {notifications.length > 0 && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>Mostrando as últimas 50 notificações</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxHeight: '75%',
    minHeight: '40%',
  },
  handle: {
    width: 44,
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
    marginBottom: spacing.md,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bellIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: typography.tracking.tight,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: borderRadius.full,
  },
  markAllText: {
    fontSize: 10,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Loading
  loadingWrap: {
    paddingVertical: 64,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    fontWeight: typography.weight.bold,
  },

  // Empty State
  emptyWrap: {
    paddingVertical: 56,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyDesc: {
    fontSize: typography.size.xs + 1,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 18,
    textAlign: 'center',
  },

  // List content
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },

  // Item card
  itemCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
    position: 'relative',
  },
  itemCardUnread: {
    backgroundColor: '#FFF8F5',
    borderColor: `${colors.primary}33`,
    ...shadows.sm,
  },
  unreadDot: {
    position: 'absolute',
    left: 8,
    top: '50%',
    marginTop: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  emojiWrap: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    backgroundColor: '#FFE9E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  emojiWrapRead: {
    backgroundColor: colors.background,
  },
  emojiText: {
    fontSize: 20,
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  itemTitleUnread: {
    color: colors.primary,
    fontWeight: typography.weight.black,
  },
  itemDate: {
    fontSize: 9,
    color: colors.textMutedValue,
    fontWeight: typography.weight.bold,
  },
  itemMessage: {
    fontSize: typography.size.xs + 1,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 18,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.primaryLight,
  },
  footerText: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.textMutedValue,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
