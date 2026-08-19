/**
 * exploreQuery — leitura PAGINADA por cursor dos acolhedores do Explorar.
 *
 * Sempre `getDocs` one-shot, NUNCA `onSnapshot`: o Explorar é navegação, não
 * monitoramento — um listener aberto numa coleção de usuários cobraria reads
 * a cada mudança de presença de qualquer acolhedor.
 *
 * ┌── Por que a query NÃO tem `orderBy` ────────────────────────────────────────┐
 * │ Com `LISTENER_APPROVAL_ENFORCED` ligada a query terá DUAS igualdades        │
 * │ (role == 'listener' ∧ listenerStatus == 'approved'). Igualdade + igualdade  │
 * │ + orderBy('name') exigiria um índice composto (role+listenerStatus+name)    │
 * │ que NÃO pode ser criado neste projeto (permissão negada no console).        │
 * │                                                                             │
 * │ Sem orderBy, o Firestore serve as igualdades com merge de índices           │
 * │ single-field e ordena implicitamente por `__name__` (id do documento).      │
 * │ Essa ordem é estável, então `startAfter(ultimoDocumentSnapshot)` continua   │
 * │ funcionando como cursor. A ordem de EXIBIÇÃO (disponíveis primeiro, nome)   │
 * │ é aplicada client-side por `buildExploreList`, página a página.             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Flag de enforcement: com `LISTENER_APPROVAL_ENFORCED === false` (hoje) o
 * único WHERE é `role == 'listener'` — o que as Rules publicadas permitem
 * listar. Quando a flag ligar, `buildExploreQueryConstraintSpecs` acrescenta
 * `listenerStatus == 'approved'` automaticamente: a regra de leitura publicada
 * para o enforcement exige as duas igualdades para a query ser provável.
 */
import {
  collection,
  getDocs,
  limit,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@shared/services/firebase';
import {
  buildExploreQueryConstraintSpecs,
  EXPLORE_PAGE_SIZE,
} from '../utils/explorePaging';
import type { ExploreCandidate } from '../utils/exploreFilters';

/** O cursor É o último DocumentSnapshot da página — exigência do startAfter sem orderBy. */
export type ExploreCursor = QueryDocumentSnapshot<DocumentData>;

export interface ExplorePage {
  items: ExploreCandidate[];
  /** Cursor para a próxima página; null quando nada foi lido ainda. */
  cursor: ExploreCursor | null;
  /** Página cheia ⇒ provavelmente há mais. Página curta ⇒ acabou. */
  hasMore: boolean;
}

export interface FetchListenersPageParams {
  cursor?: ExploreCursor | null;
  pageSize?: number;
}

/** Specs puras → QueryConstraints reais. Testado via `buildExploreQueryConstraintSpecs`. */
export function buildExploreQueryConstraints(): QueryConstraint[] {
  return buildExploreQueryConstraintSpecs().map(([field, op, value]) =>
    where(field, op, value)
  );
}

export async function fetchListenersPage({
  cursor = null,
  pageSize = EXPLORE_PAGE_SIZE,
}: FetchListenersPageParams = {}): Promise<ExplorePage> {
  const constraints: QueryConstraint[] = [...buildExploreQueryConstraints()];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize));

  const snap = await getDocs(query(collection(db, 'users'), ...constraints));

  const items = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as ExploreCandidate
  );

  return {
    items,
    cursor: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : cursor,
    hasMore: snap.docs.length === pageSize,
  };
}
