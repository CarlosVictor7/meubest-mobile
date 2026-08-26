/**
 * directedSession — cria uma chamada imediata para UMA pessoa específica.
 *
 * É a mesma sessão `immediate` do fluxo de broadcast, com duas diferenças:
 *
 *   listenerId  preenchido desde a criação (em vez de `null`)
 *   directed    true, para telemetria e para a leitura do código ficar óbvia
 *
 * ── Segurança ────────────────────────────────────────────────────────────────
 * Nenhuma Rule precisou mudar:
 *   create  exige `speakerId == request.auth.uid`  → satisfeito
 *   read    permite `listenerId == request.auth.uid` → o alvo enxerga
 *   update  idem → o aceite funciona pela mesma transação de sempre
 *
 * `speakerBlockedUserIds` continua sendo copiado para a sessão, como no
 * broadcast: é o que permite ao lado do acolhedor filtrar bloqueio sem uma
 * leitura extra que as Rules negariam.
 */
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@shared/services/firebase';
import { getPublicExploreName } from '@shared/utils/displayName';
import type { UserProfile } from '@models/user';

export interface CreateDirectedSessionParams {
  speakerUid: string;
  speakerEmail?: string | null;
  speakerProfile: UserProfile | null;
  listenerId: string;
  listenerName?: string | null;
  /** Rótulo do tema, como em `SESSION_THEMES[].label`. */
  category: string;
  durationMinutes?: number;
}

export async function createDirectedSession(
  params: CreateDirectedSessionParams
): Promise<string> {
  const sessionData = {
    speakerId: params.speakerUid,
    speakerEmail: params.speakerEmail || '',
    // Nome PÚBLICO ("Ana S."): a sessão é lida pelo acolhedor — nunca o nome completo.
    speakerName: getPublicExploreName(params.speakerProfile, 'Usuário'),

    // A diferença que define a chamada direcionada.
    listenerId: params.listenerId,
    listenerEmail: null,
    listenerName: params.listenerName || 'Acolhedor',
    directed: true,

    status: 'pending',
    category: params.category,
    type: 'immediate',
    duration: params.durationMinutes ?? 15,
    price: 0,

    // Mesmo mecanismo do broadcast — ver nota no topo.
    speakerBlockedUserIds: params.speakerProfile?.blockedUserIds ?? [],

    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'sessions'), sessionData);
  return docRef.id;
}
