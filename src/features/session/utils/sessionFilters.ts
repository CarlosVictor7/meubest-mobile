/**
 * sessionFilters — junção e filtragem das sessões do usuário.
 *
 * ┌── O bug que isto corrige ───────────────────────────────────────────────────┐
 * │ A consulta escolhia o campo pelo papel ATUAL:                               │
 * │                                                                             │
 * │   const field = profile.role === 'speaker' ? 'speakerId' : 'listenerId';    │
 * │                                                                             │
 * │ Quem alternava entre Desabafar e Acolher via metade do próprio histórico    │
 * │ desaparecer — as sessões continuavam lá, só não eram consultadas.           │
 * │ O mesmo defeito existia em HomeScreen e em SessionsListScreen.              │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * A solução é duas consultas independentes (`speakerId == uid` e
 * `listenerId == uid`) unidas aqui. Escolhida em vez de mudar o modelo de dados
 * (ex.: `participantIds: string[]` com `array-contains`) porque não exige migrar
 * nenhuma sessão existente — e os dois índices já são exercitados hoje, cada um
 * em um ramo do ternário que estamos removendo.
 *
 * Funções puras, sem React nem Firebase.
 */

export interface SessionLike {
  id: string;
  status?: string;
  type?: string;
  selectedTime?: string | null;
  /** Firestore Timestamp, Date, número ou string ISO — normalizado aqui. */
  createdAt?: any;
  [key: string]: any;
}

/**
 * Converte o `createdAt` do Firestore em milissegundos.
 * Aceita Timestamp, Date, número e string ISO, porque o campo passou por
 * formatos diferentes ao longo da vida do projeto.
 */
export function toMillis(value: any): number {
  if (value == null) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  return 0;
}

/**
 * Une os resultados das duas consultas.
 *
 * Deduplica por `id` — uma sessão em que o usuário é speaker E listener ao mesmo
 * tempo não deveria existir, mas se existir aparece uma vez só.
 * Ordena por `createdAt` decrescente.
 */
export function mergeSessions(...groups: (SessionLike[] | null | undefined)[]): SessionLike[] {
  const byId = new Map<string, SessionLike>();

  for (const group of groups) {
    if (!group) continue;
    for (const session of group) {
      if (!session?.id) continue;
      if (!byId.has(session.id)) byId.set(session.id, session);
    }
  }

  return Array.from(byId.values()).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

/**
 * Histórico: **somente** sessões concluídas.
 *
 * Antes a lista mostrava tudo, e para `cancelled`/`rejected` o card renderizava
 * a palavra "CANCELADA" no rodapé E no badge — o famoso "CANCELADA CANCELADA".
 * Filtrar na origem elimina o caminho inteiro.
 */
export function filterHistory(sessions: SessionLike[] | null | undefined): SessionLike[] {
  if (!sessions) return [];
  return sessions.filter((s) => s.status === 'completed');
}

/**
 * Próximas sessões: agendadas que ainda vão acontecer, em ordem cronológica
 * crescente — a mais próxima primeiro, ao contrário do histórico.
 */
export function filterUpcoming(
  sessions: SessionLike[] | null | undefined,
  isUpcoming: (s: SessionLike) => boolean
): SessionLike[] {
  if (!sessions) return [];
  return sessions
    .filter(isUpcoming)
    .sort((a, b) => toMillis(a.selectedTime) - toMillis(b.selectedTime));
}

/**
 * A contraparte da sessão, do ponto de vista de quem está olhando.
 * Devolve `null` quando a sessão ainda não tem apoiador.
 */
export function getCounterpart(
  session: SessionLike | null | undefined,
  uid: string | null | undefined
): { id: string; name: string; role: 'speaker' | 'listener' } | null {
  if (!session || !uid) return null;

  if (session.speakerId === uid) {
    if (!session.listenerId) return null;
    return {
      id: session.listenerId,
      name: session.listenerName || 'Acolhedor',
      role: 'listener',
    };
  }

  if (session.listenerId === uid) {
    if (!session.speakerId) return null;
    return {
      id: session.speakerId,
      name: session.speakerName || 'Pessoa acolhida',
      role: 'speaker',
    };
  }

  return null;
}
