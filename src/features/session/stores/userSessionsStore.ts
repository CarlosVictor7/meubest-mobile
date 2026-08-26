/**
 * userSessionsStore — o ÚLTIMO snapshot de `useUserSessions`, compartilhado.
 *
 * Por que existe: o `ScheduleRequestModal` vive no AppTabNavigator (sobrepõe
 * qualquer aba) e precisa das sessões em que sou `listenerId`. Abrir mais um
 * `onSnapshot` lá dobraria as leituras — a Home, que está sempre montada no
 * tab navigator, já mantém exatamente essa consulta. O hook publica aqui o
 * resultado mesclado; quem precisa lê do store. Zero listener novo.
 *
 * Não persiste: é um espelho em memória do Firestore, morre com o app.
 */
import { create } from 'zustand';
import type { SessionLike } from '@features/session/utils/sessionFilters';

interface UserSessionsState {
  /** uid dono do snapshot — sessões de outra conta nunca vazam após logout. */
  uid: string | null;
  sessions: SessionLike[];
  setSessions: (uid: string, sessions: SessionLike[]) => void;
  clear: () => void;
}

export const useUserSessionsStore = create<UserSessionsState>((set) => ({
  uid: null,
  sessions: [],
  setSessions: (uid, sessions) => set({ uid, sessions }),
  clear: () => set({ uid: null, sessions: [] }),
}));

/** Sessões do snapshot compartilhado, só se forem do `uid` informado. */
export function selectSessionsFor(uid: string | null | undefined) {
  return (state: UserSessionsState): SessionLike[] =>
    uid && state.uid === uid ? state.sessions : EMPTY;
}

const EMPTY: SessionLike[] = [];
