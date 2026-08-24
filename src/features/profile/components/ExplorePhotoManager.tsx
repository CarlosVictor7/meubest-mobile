/**
 * ExplorePhotoManager — "Fotos do meu perfil" (galeria do Explorar, 3 slots).
 *
 * Por slot: thumbnail 9:16 (ou "ADICIONAR FOTO"), badge ATIVA/INATIVA (toggle),
 * TROCAR, REMOVER (confirm) e DEFINIR COMO PRINCIPAL (estrela na principal).
 *
 * Fonte de verdade é o `profile` do AuthProvider (onSnapshot): toda ação grava
 * no Firestore e a UI reflete pelo snapshot — sem estado local de metadata.
 * As URLs das thumbnails são lidas via getDownloadURL (dono autenticado) num
 * efeito, nunca em render. Zero writes em render.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Images, ImagePlus, RefreshCw, Trash2, Star, Eye, EyeOff, Compass } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { ExplorePhotoMeta, ExplorePhotoSlot } from '@models/user';
import {
  EXPLORE_PHOTO_SLOTS,
  effectivePrimarySlot,
  getSlotMeta,
  normalizeMeta,
} from '@shared/utils/explorePhotos';
import {
  pickExploreImage,
  processExploreImage,
  uploadExplorePhoto,
  setExplorePhotoActive,
  setExplorePrimaryPhoto,
  removeExplorePhoto,
  getExplorePhotoUrl,
  ExplorePhotoError,
  EXPLORE_UPLOAD_ERROR_MESSAGE,
  EXPLORE_REMOVE_ERROR_MESSAGE,
  EXPLORE_UPDATE_ERROR_MESSAGE,
} from '@shared/services/explorePhotoService';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';

interface ExplorePhotoManagerProps {
  uid: string;
  explorePhotos?: ExplorePhotoMeta[];
  explorePrimaryPhotoSlot?: ExplorePhotoSlot;
  /** "MEU PERFIL NO EXPLORAR" */
  onOpenPreview: () => void;
}

const THUMB_WIDTH = 84;
const THUMB_HEIGHT = Math.round((THUMB_WIDTH * 16) / 9);

function friendlyMessage(error: unknown, fallback: string): string {
  return error instanceof ExplorePhotoError ? error.message : fallback;
}

export function ExplorePhotoManager({
  uid,
  explorePhotos,
  explorePrimaryPhotoSlot,
  onOpenPreview,
}: ExplorePhotoManagerProps) {
  const meta = normalizeMeta(explorePhotos);
  const primary = effectivePrimarySlot(meta, explorePrimaryPhotoSlot);

  // Loading por slot — cada slot trabalha sozinho.
  const [busySlot, setBusySlot] = useState<ExplorePhotoSlot | null>(null);
  // URLs das thumbnails (dono autenticado). `version` força re-leitura após
  // TROCAR: o path é o mesmo, então só o token novo do getDownloadURL muda.
  const [urls, setUrls] = useState<Partial<Record<ExplorePhotoSlot, string>>>({});
  const [version, setVersion] = useState(0);

  const presentKey = meta.map((m) => m.slot).join(',');
  useEffect(() => {
    let cancelled = false;
    const slots = presentKey ? (presentKey.split(',').map(Number) as ExplorePhotoSlot[]) : [];
    if (slots.length === 0) {
      setUrls({});
      return;
    }
    Promise.all(
      slots.map(async (slot) => {
        try {
          const url = await getExplorePhotoUrl(uid, slot);
          return [slot, url] as const;
        } catch (error) {
          console.warn(`[ExplorePhotoManager] Sem URL para o slot ${slot}:`, error);
          return [slot, undefined] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      const next: Partial<Record<ExplorePhotoSlot, string>> = {};
      for (const [slot, url] of entries) {
        if (url) next[slot] = url;
      }
      setUrls(next);
    });
    return () => {
      cancelled = true;
    };
  }, [uid, presentKey, version]);

  const runForSlot = async (
    slot: ExplorePhotoSlot,
    task: () => Promise<void>,
    fallbackMessage: string
  ) => {
    setBusySlot(slot);
    try {
      await task();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Não foi possível', friendlyMessage(error, fallbackMessage));
    } finally {
      setBusySlot(null);
    }
  };

  const handleAddOrReplace = async (slot: ExplorePhotoSlot) => {
    if (busySlot) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const picked = await pickExploreImage();
    if (picked.status === 'canceled') return;
    if (picked.status === 'denied') {
      Alert.alert(
        'Permissão necessária',
        'Autorize o acesso às suas fotos nas configurações do aparelho para escolher uma imagem.'
      );
      return;
    }
    if (picked.status === 'error') {
      Alert.alert('Não foi possível', picked.message);
      return;
    }

    await runForSlot(
      slot,
      async () => {
        const processedUri = await processExploreImage(picked.uri, {
          width: picked.width,
          height: picked.height,
        });
        await uploadExplorePhoto(uid, slot, processedUri, meta);
        setVersion((v) => v + 1);
      },
      EXPLORE_UPLOAD_ERROR_MESSAGE
    );
  };

  const handleToggleActive = (slot: ExplorePhotoSlot, active: boolean) => {
    if (busySlot) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void runForSlot(
      slot,
      async () => {
        await setExplorePhotoActive(uid, slot, active, meta);
      },
      EXPLORE_UPDATE_ERROR_MESSAGE
    );
  };

  const handleSetPrimary = (slot: ExplorePhotoSlot) => {
    if (busySlot) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void runForSlot(
      slot,
      async () => {
        await setExplorePrimaryPhoto(uid, slot, meta);
      },
      EXPLORE_UPDATE_ERROR_MESSAGE
    );
  };

  const handleRemove = (slot: ExplorePhotoSlot) => {
    if (busySlot) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Remover foto', 'Deseja remover esta foto do Explorar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () =>
          void runForSlot(
            slot,
            async () => {
              await removeExplorePhoto(uid, slot, meta, explorePrimaryPhotoSlot ?? null);
            },
            EXPLORE_REMOVE_ERROR_MESSAGE
          ),
      },
    ]);
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Images size={20} color={colors.primary} strokeWidth={2.5} />
        <Text style={styles.sectionTitle}>FOTOS DO MEU PERFIL</Text>
      </View>
      <Text style={styles.sectionHint}>
        Até 3 fotos verticais. Só as fotos ativas aparecem no Explorar — e só se
        você ativar "Exibir minhas fotos no Explorar".
      </Text>

      {EXPLORE_PHOTO_SLOTS.map((slot) => {
        const slotMeta = getSlotMeta(meta, slot);
        const isBusy = busySlot === slot;
        const isPrimary = primary === slot;
        const url = urls[slot];

        return (
          <View key={slot} style={styles.slotCard}>
            {/* Thumbnail 9:16 */}
            <View style={[styles.thumb, !slotMeta && styles.thumbEmpty]}>
              {slotMeta && url ? (
                <Image source={{ uri: url }} style={styles.thumbImage} resizeMode="cover" />
              ) : slotMeta ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <ImagePlus size={22} color={colors.textMutedValue} strokeWidth={2} />
              )}
              {isPrimary && (
                <View style={styles.primaryBadge} accessibilityLabel="Foto principal">
                  <Star size={12} color="#FFF" fill="#FFF" strokeWidth={2} />
                </View>
              )}
              {isBusy && (
                <View style={styles.busyOverlay}>
                  <ActivityIndicator size="small" color="#FFF" />
                </View>
              )}
            </View>

            {/* Ações */}
            <View style={styles.slotActions}>
              <View style={styles.slotTitleRow}>
                <Text style={styles.slotTitle}>FOTO {slot}</Text>
                {slotMeta && (
                  <TouchableOpacity
                    style={[styles.badge, slotMeta.active ? styles.badgeActive : styles.badgeInactive]}
                    onPress={() => handleToggleActive(slot, !slotMeta.active)}
                    disabled={!!busySlot}
                    activeOpacity={0.8}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: slotMeta.active }}
                    accessibilityLabel={`Foto ${slot} ${slotMeta.active ? 'ativa' : 'inativa'}`}
                  >
                    {slotMeta.active ? (
                      <Eye size={12} color="#059669" strokeWidth={2.5} />
                    ) : (
                      <EyeOff size={12} color={colors.textMutedValue} strokeWidth={2.5} />
                    )}
                    <Text style={[styles.badgeText, slotMeta.active ? styles.badgeTextActive : styles.badgeTextInactive]}>
                      {slotMeta.active ? 'ATIVA' : 'INATIVA'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {slotMeta ? (
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={styles.btn}
                    onPress={() => handleAddOrReplace(slot)}
                    disabled={!!busySlot}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Trocar foto ${slot}`}
                  >
                    <RefreshCw size={13} color={colors.primary} strokeWidth={2.5} />
                    <Text style={styles.btnText}>TROCAR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnRemove}
                    onPress={() => handleRemove(slot)}
                    disabled={!!busySlot}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remover foto ${slot}`}
                  >
                    <Trash2 size={13} color="#EF4444" strokeWidth={2.5} />
                    <Text style={styles.btnRemoveText}>REMOVER</Text>
                  </TouchableOpacity>
                  {!isPrimary && slotMeta.active && (
                    <TouchableOpacity
                      style={styles.btn}
                      onPress={() => handleSetPrimary(slot)}
                      disabled={!!busySlot}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Definir foto ${slot} como principal`}
                    >
                      <Star size={13} color={colors.primary} strokeWidth={2.5} />
                      <Text style={styles.btnText}>DEFINIR COMO PRINCIPAL</Text>
                    </TouchableOpacity>
                  )}
                  {isPrimary && <Text style={styles.primaryLabel}>★ PRINCIPAL</Text>}
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.btn, styles.btnAdd]}
                  onPress={() => handleAddOrReplace(slot)}
                  disabled={!!busySlot}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Adicionar foto ${slot}`}
                >
                  <ImagePlus size={13} color={colors.primary} strokeWidth={2.5} />
                  <Text style={styles.btnText}>ADICIONAR FOTO</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      <TouchableOpacity
        style={[styles.previewBtn, shadows.sm]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onOpenPreview();
        }}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Meu perfil no Explorar"
      >
        <Compass size={16} color={colors.textInverted} strokeWidth={2.5} />
        <Text style={styles.previewBtnText}>MEU PERFIL NO EXPLORAR</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: typography.tracking.tight,
    textTransform: 'uppercase',
  },
  sectionHint: {
    fontSize: 11,
    color: colors.textMutedValue,
    fontWeight: typography.weight.medium,
    lineHeight: 16,
    marginTop: -spacing.xs,
  },
  slotCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: spacing.md,
  },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  thumbEmpty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderDark,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  primaryBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,26,26,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotActions: {
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
  },
  slotTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  slotTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
    letterSpacing: typography.tracking.wider,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: borderRadius.full,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
  },
  badgeActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  badgeInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.borderDark,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: typography.weight.black,
    letterSpacing: 0.5,
  },
  badgeTextActive: { color: '#059669' },
  badgeTextInactive: { color: colors.textMutedValue },
  btnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing.sm - 2,
    paddingHorizontal: spacing.sm + 2,
  },
  btnAdd: {
    alignSelf: 'flex-start',
  },
  btnText: {
    fontSize: 10,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  btnRemove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: spacing.sm - 2,
    paddingHorizontal: spacing.sm + 2,
  },
  btnRemoveText: {
    fontSize: 10,
    fontWeight: typography.weight.black,
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  primaryLabel: {
    fontSize: 10,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 0.5,
    paddingHorizontal: spacing.xs,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dark,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  previewBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.wider,
  },
});
