/**
 * calendarLink — deep link do Google Calendar para "Adicionar ao calendário".
 *
 * Sem OAuth, sem dependência nativa: abre
 *   https://calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=…
 * no navegador/app do Google Agenda. Funciona em mobile (`Linking.openURL`)
 * e web. `expo-calendar` (calendário do device) fica para depois — exige
 * novo build nativo.
 *
 * Função pura.
 */

export interface CalendarEventInput {
  title: string;
  /** ISO 8601 ou epoch ms. */
  start: string | number | Date;
  /** ISO 8601 ou epoch ms. Se ausente, `start + durationMinutes` (padrão 30). */
  end?: string | number | Date;
  durationMinutes?: number;
  details?: string;
  location?: string;
}

function toMs(value: string | number | Date): number | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/** `2026-08-26T13:00:00.000Z` → `20260826T130000Z` */
export function toCalendarStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function googleCalendarUrl(input: CalendarEventInput): string | null {
  const start = toMs(input.start);
  if (start === null) return null;

  const end =
    input.end !== undefined
      ? toMs(input.end)
      : start + (input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : 30) * 60_000;
  if (end === null || end < start) return null;

  const params: string[] = [
    'action=TEMPLATE',
    `text=${encodeURIComponent(input.title || 'Meu Best')}`,
    `dates=${toCalendarStamp(start)}/${toCalendarStamp(end)}`,
  ];
  if (input.details) params.push(`details=${encodeURIComponent(input.details)}`);
  if (input.location) params.push(`location=${encodeURIComponent(input.location)}`);

  return `https://calendar.google.com/calendar/render?${params.join('&')}`;
}
