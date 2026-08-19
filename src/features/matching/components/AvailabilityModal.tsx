/**
 * AvailabilityModal — MINHA DISPONIBILIDADE (agenda programada).
 *
 * O equivalente mobile do modal da web, com as duas correções que a auditoria
 * de 19/08 mandou NÃO copiar de lá:
 *
 *   • A web grava UM WRITE POR TOQUE em horário. Aqui a seleção vive em
 *     memória e o CONCLUÍDO faz EXATAMENTE UM updateDoc — marcar e desmarcar
 *     seis vezes custa zero. Fechar no X descarta tudo: zero writes.
 *   • A web gera a chave do dia com toISOString() (UTC) — a partir das 21:00
 *     no Brasil ela grava no dia errado. Aqui é `localDateKey`, sempre local.
 *
 * O mesmo write ainda:
 *   • poda datas passadas (produção carrega chaves de maio/2026 que nada
 *     expurga) — sem job, sem polling, sem write extra;
 *   • grava `availabilityTimezone` (IANA, ex. America/Sao_Paulo) para a API
 *     interpretar a agenda no fuso do usuário. Capturado SÓ aqui, num write
 *     que já ia acontecer — nunca em heartbeat.
 *
 * Schema idêntico ao da web: { "YYYY-MM-DD": ["09:00", ...] } — os dois
 * clientes leem e escrevem a mesma agenda.
 */
import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { X, Calendar } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@shared/services/firebase';
import { colors, spacing, borderRadius, typography, shadows } from '@constants/theme';
import {
  AVAILABILITY_TIMES,
  AVAILABILITY_DAYS_AHEAD,
  localDateKey,
  pruneAvailability,
  type AvailabilityMap,
} from '@shared/utils/availability';
import { DayStrip } from './DayStrip';
import { TimeGrid } from './TimeGrid';

interface AvailabilityModalProps {
  visible: boolean;
  onClose: () => void;
  uid: string | null | undefined;
  /** A agenda atual do perfil — já está em memória, o modal não lê nada. */
  availability: AvailabilityMap | null | undefined;
}

/** Draft mutável da seleção: chave de dia → Set de horários. */
type Draft = Map<string, Set<string>>;

function draftFromAvailability(availability: AvailabilityMap | null | undefined): Draft {
  const draft: Draft = new Map();
  if (!availability) return draft;
  for (const [key, slots] of Object.entries(availability)) {
    if (Array.isArray(slots) && slots.length > 0) {
      draft.set(key, new Set(slots));
    }
  }
  return draft;
}

function draftToAvailability(draft: Draft): AvailabilityMap {
  const map: AvailabilityMap = {};
  for (const [key, slots] of draft.entries()) {
    if (slots.size > 0) {
      // Ordena para o documento ficar estável e legível no Console.
      map[key] = Array.from(slots).sort();
    }
  }
  return map;
}

export function AvailabilityModal({
  visible,
  onClose,
  uid,
  availability,
}: AvailabilityModalProps) {
  // Os próximos 7 dias, como na web. Recalculado a cada abertura do modal —
  // um modal aberto na virada da meia-noite não pode mostrar ontem.
  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < AVAILABILITY_DAYS_AHEAD; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => draftFromAvailability(availability));
  const [saving, setSaving] = useState(false);

  // Reidrata o draft a cada abertura: o que ficou de uma edição descartada
  // (fechada no X) não pode vazar para a próxima.
  const [hydratedFor, setHydratedFor] = useState(false);
  if (visible && !hydratedFor) {
    setDraft(draftFromAvailability(availability));
    setSelectedKey(localDateKey(new Date()));
    setHydratedFor(true);
  } else if (!visible && hydratedFor) {
    setHydratedFor(false);
  }

  const selectedTimes = (selectedKey && draft.get(selectedKey)) || new Set<string>();
  const markedKeys = useMemo(
    () => new Set(Array.from(draft.entries()).filter(([, s]) => s.size > 0).map(([k]) => k)),
    [draft]
  );

  const toggleTime = (time: string) => {
    if (!selectedKey) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // ZERO writes aqui — só memória. O Firestore só é tocado no CONCLUÍDO.
    setDraft((prev) => {
      const next: Draft = new Map(prev);
      const slots = new Set(next.get(selectedKey) ?? []);
      if (slots.has(time)) {
        slots.delete(time);
      } else {
        slots.add(time);
      }
      if (slots.size > 0) {
        next.set(selectedKey, slots);
      } else {
        next.delete(selectedKey);
      }
      return next;
    });
  };

  const handleClose = () => {
    // X: descarta o draft. Zero writes.
    onClose();
  };

  const handleConfirm = async () => {
    if (!uid) {
      onClose();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    try {
      const todayKey = localDateKey(new Date());
      const pruned = pruneAvailability(draftToAvailability(draft), todayKey);

      // O ÚNICO write de toda a interação.
      //
      // ⚠️ updateDoc, NUNCA setDoc({merge:true}): merge faz fusão PROFUNDA de
      // mapas — as chaves antigas (maio/2026) sobreviveriam à poda, como foi
      // verificado no emulador em 19/08. updateDoc substitui o campo inteiro,
      // que é exatamente o que a poda precisa.
      //
      // O timezone IANA viaja no mesmo write — a API precisa dele para saber
      // "que horas são" na agenda do usuário; perfis antigos sem o campo caem
      // no fallback America/Sao_Paulo do lado do servidor.
      await updateDoc(doc(db, 'users', uid), {
        availability: pruned,
        availabilityTimezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/Sao_Paulo',
      });
      onClose();
    } catch (error) {
      console.warn('[AvailabilityModal] Falha ao salvar a agenda:', error);
      Alert.alert(
        'Não foi possível salvar',
        'Confira sua conexão e tente de novo. Sua seleção continua aqui.'
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedDate = days.find((d) => localDateKey(d) === selectedKey);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, shadows.lg]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            activeOpacity={0.7}
            accessibilityLabel="Fechar sem salvar"
          >
            <X size={22} color={colors.textMutedValue} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Calendar size={26} color={colors.primary} strokeWidth={2.2} />
            </View>
            <Text style={styles.title}>MINHA DISPONIBILIDADE</Text>
            <Text style={styles.subtitle}>
              Selecione os horários que você deseja ficar disponível para acolher.
            </Text>
          </View>

          <ScrollView
            style={styles.body}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing.md }}
          >
            <DayStrip
              days={days}
              selectedKey={selectedKey}
              onSelect={(_, key) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedKey(key);
              }}
              markedKeys={markedKeys}
            />

            {selectedKey && (
              <View style={styles.timesBlock}>
                <Text style={styles.timesLabel}>
                  HORÁRIOS DISPONÍVEIS EM{' '}
                  {selectedDate?.toLocaleDateString('pt-BR') ?? selectedKey}:
                </Text>
                <TimeGrid
                  times={AVAILABILITY_TIMES}
                  selected={selectedTimes}
                  onToggle={toggleTime}
                />
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.confirmBtn, saving && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmText}>
              {saving ? 'SALVANDO…' : 'CONCLUÍDO'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26,26,26,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    maxHeight: '88%',
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 2,
    padding: spacing.xs,
  },
  header: {
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  body: {
    flexGrow: 0,
  },
  timesBlock: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.primaryLight,
    gap: spacing.xs,
  },
  timesLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 1,
  },
  confirmBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.text,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md + 4,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmText: {
    color: colors.textInverted,
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    letterSpacing: 2,
  },
});
