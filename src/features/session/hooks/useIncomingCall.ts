/**
 * useIncomingCall — Hook de chamados imediatos para apoiadores
 *
 * Escuta DUAS filas ao mesmo tempo:
 *
 *   broadcast    status='pending' + type='immediate' + listenerId=null
 *                qualquer acolhedor online pode atender
 *
 *   direcionada  status='pending' + type='immediate' + listenerId=<meu uid>
 *                alguém escolheu ESTA pessoa no Explorar
 *
 * A chamada direcionada não espera os 15 s de prioridade por tema: o alvo é
 * explícito, não há disputa a arbitrar.
 *
 * Original baseado na lógica do Web (Dashboard.tsx linhas 1018–1046):
 * - Escuta sessions com status='pending' e listenerId=null e type='immediate'
 * - Prioriza apoiadores com tema compatível (notifica imediato)
 * - Apoiadores online sem tema compatível recebem após 15s
 * - Recusa é apenas local (não altera Firestore)
 * - Aceite usa runTransaction para evitar race condition
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@shared/services/firebase';
import { SESSION_THEMES } from '@constants/config';
import type { User as FirebaseUser } from 'firebase/auth';
import type { UserProfile } from '@models/user';
import { getDisplayName } from '@shared/utils/displayName';
import { canActAsListener } from '@shared/utils/listener';

export interface IncomingCallSession {
  id: string;
  speakerId: string;
  speakerName?: string;
  category: string;
  type: string;
  duration?: number;
  listenerId: string | null;
  status: string;
  /** UIDs bloqueados pelo speaker (copiado do profile no momento da criação da sessão) */
  speakerBlockedUserIds?: string[];
  /** true quando o speaker escolheu este acolhedor pelo Explorar. */
  directed?: boolean;
}

interface UseIncomingCallResult {
  /** Sessão pending a ser exibida no modal. null = nenhum chamado ativo. */
  incomingSession: IncomingCallSession | null;
  /** Recusar localmente: adiciona ao Set ignorado, fecha modal. Não altera Firestore. */
  dismissSession: (sessionId: string) => void;
  /** Aceitar: runTransaction no Firestore → navega para a sessão. */
  acceptSession: (
    sessionId: string,
    onSuccess: (sessionId: string) => void
  ) => Promise<void>;
  /** true enquanto a transaction de aceite está em andamento */
  isAccepting: boolean;
}

export function useIncomingCall(
  user: FirebaseUser | null,
  profile: UserProfile | null
): UseIncomingCallResult {
  const [incomingSession, setIncomingSession] = useState<IncomingCallSession | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  // Set de IDs já vistos/ignorados — não persiste entre sessões do app (intencional)
  const seenIds = useRef<Set<string>>(new Set());
  // Ref de timeouts pendentes para limpeza no unmount
  const pendingTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Referência mutável do profile para contornar stale closure sem recriar o listener do Firebase
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // ─── Listener de chamados pendentes ────────────────────────────────────────
  useEffect(() => {
    // Só ativa para apoiadores (listener) online
    if (!user || !profile) return;
    // PREPARACAO Sprint 2: hoje o helper devolve exatamente `role === 'listener'`.
    // Na Sprint 6 ele passa a exigir listenerStatus === 'approved' e o
    // enforcement vale aqui sem tocar neste arquivo.
    if (!canActAsListener(profile)) {
      console.log('[IncomingCall] skipped (nao pode acolher)');
      return;
    }
    if (!profile.isOnline) {
      console.log('[IncomingCall] skipped (not online)');
      return;
    }

    console.log('[IncomingCall] listener active');

    /**
     * Uma única função para as duas filas. O `seenIds` é compartilhado, então
     * uma sessão nunca é exibida duas vezes mesmo se aparecesse nas duas.
     */
    const subscribe = (kind: 'broadcast' | 'directed') => {
      const q =
        kind === 'broadcast'
          ? query(
              collection(db, 'sessions'),
              where('status', '==', 'pending'),
              where('type', '==', 'immediate'),
              where('listenerId', '==', null)
            )
          : query(
              collection(db, 'sessions'),
              where('status', '==', 'pending'),
              where('type', '==', 'immediate'),
              where('listenerId', '==', user.uid)
            );

      let isInitialLoad = true;

      return onSnapshot(
        q,
        (snapshot) => {
          // Na primeira execução populamos o Set com os IDs existentes para não
          // notificar chamados antigos (espelha a técnica isInitialRandom do Web).
          if (isInitialLoad) {
            snapshot.docs.forEach((d) => seenIds.current.add(d.id));
            isInitialLoad = false;
            console.log(
              `[IncomingCall] ${kind}: ${snapshot.docs.length} pendente(s) na carga inicial, ignorando`
            );
            return;
          }

          snapshot.docChanges().forEach((change) => {
            if (change.type !== 'added') return;

            const session = {
              id: change.doc.id,
              ...(change.doc.data() as Omit<IncomingCallSession, 'id'>),
            } as IncomingCallSession;

            if (seenIds.current.has(session.id)) return;

            // Não mostrar chamado criado pelo próprio usuário.
            if (session.speakerId === user.uid) {
              seenIds.current.add(session.id);
              return;
            }

            // ── Filtro de bloqueio, nos dois sentidos ──────────────────────
            const myBlockedIds = profileRef.current?.blockedUserIds ?? [];
            if (myBlockedIds.includes(session.speakerId)) {
              console.log(`[IncomingCall] ignorado (bloqueei o speaker): ${session.id}`);
              seenIds.current.add(session.id);
              return;
            }

            const speakerBlockedInSession: string[] = session.speakerBlockedUserIds ?? [];
            if (speakerBlockedInSession.includes(user.uid)) {
              console.log(`[IncomingCall] ignorado (fui bloqueado pelo speaker): ${session.id}`);
              seenIds.current.add(session.id);
              return;
            }

            seenIds.current.add(session.id);

            /**
             * Revalida a sessão antes de exibir o modal.
             *
             * ┌── Por que as duas leituras são separadas ────────────────────┐
             * │ Antes isto era um `Promise.all([sessão, doc do speaker])`.   │
             * │ As Rules publicadas só permitem ler /users/{id} quando o doc │
             * │ tem `role == 'listener'` (ou o leitor é dono/admin). O       │
             * │ speaker tem `role == 'speaker'` — a leitura é NEGADA, e com  │
             * │ Promise.all isso derrubava tudo e o modal nunca aparecia.    │
             * └──────────────────────────────────────────────────────────────┘
             */
            const showIfStillPending = async () => {
              let data;
              try {
                const sessionSnap = await getDoc(doc(db, 'sessions', session.id));
                if (!sessionSnap.exists()) return;
                data = sessionSnap.data();
                if (data.status !== 'pending') return;
                // Broadcast: alguém pode ter aceitado no meio do caminho.
                // Direcionada: `listenerId` já é o meu uid desde a criação.
                if (kind === 'broadcast' && data.listenerId !== null) return;
                if (kind === 'directed' && data.listenerId !== user.uid) return;
              } catch (err) {
                console.warn('[IncomingCall] Falha ao revalidar a sessão:', err);
                return;
              }

              // Best-effort: confirmação ao vivo do bloqueio do lado do speaker.
              // Falha aqui NÃO impede o modal — ver bloco acima.
              try {
                const speakerSnap = await getDoc(doc(db, 'users', session.speakerId));
                if (speakerSnap.exists()) {
                  const speakerBlockedIds: string[] = speakerSnap.data().blockedUserIds ?? [];
                  if (speakerBlockedIds.includes(user.uid)) {
                    seenIds.current.add(session.id);
                    return;
                  }
                }
              } catch {
                console.log(
                  '[IncomingCall] verificacao ao vivo do bloqueio indisponivel — ' +
                    'seguindo com speakerBlockedUserIds da sessao'
                );
              }

              setIncomingSession(session);
            };

            if (kind === 'directed') {
              // Alvo explícito: sem espera de prioridade por tema.
              showIfStillPending();
              return;
            }

            const themeId = SESSION_THEMES.find((t) => t.label === session.category)?.id as
              | string
              | undefined;
            const hasCompatibleInterest =
              themeId !== undefined && (profileRef.current?.interests ?? []).includes(themeId);

            if (hasCompatibleInterest) {
              showIfStillPending();
            } else {
              // 15 s de vantagem para quem tem o tema compatível.
              const timeout = setTimeout(showIfStillPending, 15000);
              pendingTimeouts.current.push(timeout);
            }
          });
        },
        (error) => {
          console.error(`[IncomingCall] erro no listener ${kind}:`, error);
        }
      );
    };

    const unsubBroadcast = subscribe('broadcast');
    const unsubDirected = subscribe('directed');

    return () => {
      console.log('[IncomingCall] listener cleanup');
      unsubBroadcast();
      unsubDirected();
      pendingTimeouts.current.forEach(clearTimeout);
      pendingTimeouts.current = [];
    };
  }, [user?.uid, profile?.role, profile?.isOnline]);

  // ─── Fechar o modal quando a sessão atual for aceita por outro apoiador ────
  useEffect(() => {
    if (!incomingSession) return;

    const unsub = onSnapshot(doc(db, 'sessions', incomingSession.id), (snap) => {
      if (!snap.exists()) {
        setIncomingSession(null);
        return;
      }
      const data = snap.data();
      // Se outro apoiador aceitou ou a sessão foi cancelada/encerrada, fechar modal
      if (data.status !== 'pending' || data.listenerId !== null) {
        setIncomingSession(null);
      }
    });

    return () => unsub();
  }, [incomingSession?.id]);

  // ─── Recusa local ──────────────────────────────────────────────────────────
  const dismissSession = useCallback((sessionId: string) => {
    console.log(`[IncomingCall] session declined locally: ${sessionId}`);
    seenIds.current.add(sessionId);
    setIncomingSession((prev) => (prev?.id === sessionId ? null : prev));
  }, []);

  // ─── Aceitar com runTransaction ────────────────────────────────────────────
  const acceptSession = useCallback(
    async (sessionId: string, onSuccess: (sessionId: string) => void) => {
      if (!user || !profile) return;

      setIsAccepting(true);
      try {
        await runTransaction(db, async (transaction) => {
          const sessionRef = doc(db, 'sessions', sessionId);
          const sessionSnap = await transaction.get(sessionRef);

          if (!sessionSnap.exists()) {
            throw new Error('Sessão não encontrada');
          }

          const data = sessionSnap.data();

          // Revalidações atômicas dentro da transaction
          if (data.status !== 'pending') {
            throw new Error('Sessão não está mais disponível');
          }
          if (data.listenerId !== null) {
            throw new Error('Sessão já foi aceita por outro apoiador');
          }

          transaction.update(sessionRef, {
            listenerId: user.uid,
            listenerEmail: user.email ?? null,
            listenerName: getDisplayName(profile, 'Apoiador'),
            status: 'active',
            acceptedAt: serverTimestamp(),
          });
        });

        console.log(`[IncomingCall] session accepted: ${sessionId}`);
        setIncomingSession(null);
        onSuccess(sessionId);
      } catch (err: any) {
        console.log(`[IncomingCall] transaction failed: ${err?.message}`);
        // A sessão pode ter sido aceita por outro — fechar modal com aviso
        setIncomingSession(null);
        throw err;
      } finally {
        setIsAccepting(false);
      }
    },
    [user?.uid, profile?.name, profile?.preferredName, user?.email]
  );

  return { incomingSession, dismissSession, acceptSession, isAccepting };
}
