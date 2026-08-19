/**
 * availability — regras puras da disponibilidade programada.
 *
 * Três conceitos que este módulo mantém separados (GO de 19/08, §6):
 *
 *   A. PRESENÇA AO VIVO      isOnline + lastSeenAt fresco  → popup em tempo real
 *   B. OPT-IN MANUAL         isOnline === true             → "quero receber push"
 *   C. AGENDA PROGRAMADA     users/{uid}.availability      → "nesses horários, sim"
 *
 * O schema é o MESMO que a web já usa (auditoria de 19/08, §2):
 *
 *   { "YYYY-MM-DD": ["09:00", "20:00"] }
 *
 * ┌── A chave de data é LOCAL, nunca UTC ───────────────────────────────────────┐
 * │ A web gera a chave com `toISOString().split('T')[0]` — UTC. No Brasil       │
 * │ (UTC−3), a partir das 21:00 a chave aponta para o dia SEGUINTE enquanto o   │
 * │ botão mostra o dia de hoje: a pessoa marca disponibilidade para o dia       │
 * │ errado sem ter como perceber. `localDateKey` usa os componentes locais e    │
 * │ é a única forma correta de gerar/comparar essas chaves no aparelho.         │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Elegibilidade para PUSH (decisão de produto do GO, §7 — diferente da
 * presença ao vivo): quem deixou a chave ligada e fechou o app SEM sair da
 * conta CONTINUA elegível. `lastSeenAt` velho não cancela sozinho o opt-in.
 * O que cancela é o logout explícito, que zera `isOnline` e apaga o token.
 *
 * Funções puras, sem React nem Firebase — espelhadas em
 * `meubest-api/src/utils/availability.ts`. Se uma mudar, a outra muda junto.
 */
import { isAvailableNow, type PresenceSource } from './presence';
import { canActAsListener, type ListenerSource } from './listener';

/** Mapa data local → horários "HH:mm". O mesmo formato que a web grava. */
export type AvailabilityMap = { [date: string]: string[] };

/** Duração implícita de cada slot — a semântica real da web (1 h, nunca gravada). */
export const AVAILABILITY_SLOT_MINUTES = 60;

/** Os 12 horários fixos da web, preservados byte a byte para compatibilidade. */
export const AVAILABILITY_TIMES = [
  '09:00', '10:00', '11:00', '14:00', '15:00', '16:00',
  '17:00', '18:00', '19:00', '20:00', '21:00', '22:00',
] as const;

/** Janela de escolha: hoje + 6 dias, como no modal da web. */
export const AVAILABILITY_DAYS_AHEAD = 7;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Chave YYYY-MM-DD em hora LOCAL do aparelho.
 * NUNCA usar `toISOString()` aqui — ver o quadro no topo do arquivo.
 */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "HH:mm" → minutos desde a meia-noite, ou null se malformado. */
export function parseTimeToMinutes(time: string): number | null {
  const match = typeof time === 'string' ? TIME_RE.exec(time) : null;
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Núcleo puro: o relógio de parede (dateKey + minutos do dia) está dentro de
 * algum slot do mapa? Um slot vale de HH:mm inclusive até HH:mm+slot exclusivo,
 * SEMPRE dentro da própria chave de data — um slot às 23:00 não vaza para o
 * dia seguinte.
 */
export function isWallClockInSlot(
  availability: AvailabilityMap | null | undefined,
  dateKey: string,
  minutesOfDay: number,
  slotMinutes: number = AVAILABILITY_SLOT_MINUTES
): boolean {
  if (!availability) return false;
  const slots = availability[dateKey];
  if (!Array.isArray(slots)) return false;

  return slots.some((time) => {
    const start = parseTimeToMinutes(time);
    if (start === null) return false;
    return minutesOfDay >= start && minutesOfDay < start + slotMinutes;
  });
}

/**
 * A pessoa está dentro de um horário agendado AGORA, no relógio do aparelho?
 * (No aparelho o fuso do usuário é o fuso do `Date` — a versão da API recebe
 * o timezone do perfil e monta o relógio de parede por conta própria.)
 */
export function isScheduledAvailableNow(
  availability: AvailabilityMap | null | undefined,
  now: Date = new Date(),
  slotMinutes: number = AVAILABILITY_SLOT_MINUTES
): boolean {
  return isWallClockInSlot(
    availability,
    localDateKey(now),
    now.getHours() * 60 + now.getMinutes(),
    slotMinutes
  );
}

/**
 * Remove do mapa as datas definitivamente passadas (e entradas vazias).
 *
 * Aplicada NA ESCRITA do CONCLUÍDO — nunca em job, polling ou write extra.
 * Em produção há documentos carregando chaves de maio/2026 que nada expurga;
 * esta poda resolve na primeira vez que a pessoa salvar de novo.
 *
 * Conservadora de propósito: chaves que não parecem YYYY-MM-DD são PRESERVADAS
 * — este helper limpa datas velhas, não decide o que fazer com dado que não
 * reconhece.
 */
export function pruneAvailability(
  availability: AvailabilityMap | null | undefined,
  todayKey: string
): AvailabilityMap {
  const pruned: AvailabilityMap = {};
  if (!availability) return pruned;

  for (const [key, slots] of Object.entries(availability)) {
    if (DATE_KEY_RE.test(key)) {
      if (key < todayKey) continue; // passado: poda
      if (!Array.isArray(slots) || slots.length === 0) continue; // vazio: poda
    }
    pruned[key] = slots;
  }
  return pruned;
}

/** Perfil mínimo que as decisões de disponibilidade precisam enxergar. */
export interface AvailabilitySource extends PresenceSource, ListenerSource {
  availability?: AvailabilityMap | null;
}

/**
 * PRESENÇA AO VIVO — para o fluxo em tempo real dentro do app (popup de
 * chamada, selo "disponível agora"). Exige intenção declarada E presença
 * fresca: alguém com o app morto há uma hora não está com um modal aberto.
 */
export function isListenerLiveNow(
  profile: AvailabilitySource | null | undefined,
  now: number = Date.now()
): boolean {
  return canActAsListener(profile) && isAvailableNow(profile, now);
}

/**
 * ELEGIBILIDADE PARA PUSH — a regra final do GO (§7):
 *
 *   canActAsListener ∧ ( opt-in manual ∨ agenda programada agora )
 *
 * SEM exigir `lastSeenAt` fresco: deixar a chave ligada e fechar o app é
 * exatamente o cenário em que a push precisa chegar. O logout explícito
 * derruba o opt-in (isOnline: false) e o token — é ele que desliga a push,
 * não o app fechado.
 *
 * É `OR`, nunca `AND`: este helper só amplia quem é elegível em relação ao
 * comportamento antigo — nunca pode esvaziar a lista de acolhedores.
 */
export function isListenerPushEligibleNow(
  profile: AvailabilitySource | null | undefined,
  now: Date = new Date()
): boolean {
  if (!canActAsListener(profile)) return false;
  if (profile?.isOnline === true) return true;
  return isScheduledAvailableNow(profile?.availability, now);
}

/** Quantos horários futuros (de hoje em diante) a agenda tem — para a UI do card. */
export function countUpcomingSlots(
  availability: AvailabilityMap | null | undefined,
  now: Date = new Date(),
  slotMinutes: number = AVAILABILITY_SLOT_MINUTES
): number {
  if (!availability) return 0;
  const todayKey = localDateKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let count = 0;
  for (const [key, slots] of Object.entries(availability)) {
    if (!DATE_KEY_RE.test(key) || !Array.isArray(slots)) continue;
    if (key < todayKey) continue;
    for (const time of slots) {
      const start = parseTimeToMinutes(time);
      if (start === null) continue;
      // Hoje: conta o slot enquanto ele ainda não terminou.
      if (key === todayKey && start + slotMinutes <= nowMinutes) continue;
      count++;
    }
  }
  return count;
}
