/**
 * useIncomingCall — Hook de chamados imediatos para apoiadores
 *
 * Replicado da lógica do Web (Dashboard.tsx linhas 1018–1046):
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

export interface IncomingCallSession {
  id: string;
  speakerId: string;
  speakerName?: string;
  category: string;
  type: string;
  duration?: number;
  listenerId: string | null;
  status: string;
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
    if (profile.role !== 'listener') {
      console.log('[IncomingCall] skipped (not listener)');
      return;
    }
    if (!profile.isOnline) {
      console.log('[IncomingCall] skipped (not online)');
      return;
    }

    console.log('[IncomingCall] listener active');

    const q = query(
      collection(db, 'sessions'),
      where('status', '==', 'pending'),
      where('listenerId', '==', null),
      where('type', '==', 'immediate')
    );

    let isInitialLoad = true;

    const unsub = onSnapshot(q, (snapshot) => {
      // Na primeira execução, populamos o Set com IDs existentes para não notificar
      // chamados antigos (espelha a técnica isInitialRandom do Web)
      if (isInitialLoad) {
        snapshot.docs.forEach((d) => seenIds.current.add(d.id));
        isInitialLoad = false;
        console.log(
          `[IncomingCall] pending sessions found: ${snapshot.docs.length} (initial load, skipping)`
        );
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added') return;

        const session = {
          id: change.doc.id,
          ...(change.doc.data() as Omit<IncomingCallSession, 'id'>),
        } as IncomingCallSession;

        // Já visto ou recusado localmente
        if (seenIds.current.has(session.id)) {
          console.log(`[IncomingCall] skipped (already seen): ${session.id}`);
          return;
        }

        // Não mostrar chamado criado pelo próprio usuário
        if (session.speakerId === user.uid) {
          console.log(`[IncomingCall] skipped (own session): ${session.id}`);
          seenIds.current.add(session.id);
          return;
        }

        // Marcar como visto para evitar duplicação
        seenIds.current.add(session.id);

        // ── Verificar compatibilidade de tema ─────────────────────────────
        const themeId = SESSION_THEMES.find(
          (t) => t.label === session.category
        )?.id as string | undefined;

        const hasCompatibleInterest =
          themeId !== undefined &&
          (profileRef.current?.interests ?? []).includes(themeId);

        console.log(
          `[IncomingCall] compatible session: ${session.id} | theme: ${session.category} | match: ${hasCompatibleInterest}`
        );

        // Revalidar no Firestore antes de exibir (garante que ainda está pending)
        const showIfStillPending = () => {
          getDoc(doc(db, 'sessions', session.id)).then((docSnap) => {
            if (!docSnap.exists()) return;
            const data = docSnap.data();
            if (data.status === 'pending' && data.listenerId === null) {
              setIncomingSession(session);
            }
          });
        };

        if (hasCompatibleInterest) {
          // Notifica imediatamente para quem tem o tema compatível
          showIfStillPending();
        } else {
          // Aguarda 15s — dá prioridade aos apoiadores com matching de tema
          const timeout = setTimeout(showIfStillPending, 15000);
          pendingTimeouts.current.push(timeout);
        }
      });
    });

    return () => {
      console.log('[IncomingCall] listener cleanup');
      unsub();
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
            listenerName: profile.name ?? 'Apoiador',
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
    [user?.uid, profile?.name, user?.email]
  );

  return { incomingSession, dismissSession, acceptSession, isAccepting };
}
