/**
 * scheduleFormat — data/hora de uma sessão agendada no fuso do DEVICE.
 *
 * `selectedTime` é um instante ISO UTC; quem está do outro lado pode estar em
 * outro fuso. Formatamos sempre no relógio de quem está olhando.
 *
 * Funções puras (recebem `timeZone` opcional para os testes não dependerem do
 * fuso do runner).
 */

export interface ScheduleWhen {
  /** "26/08/2026" */
  day: string;
  /** "10:00" */
  time: string;
  /** "26/08/2026 10:00" */
  full: string;
  /** "quarta-feira, 26 de agosto" */
  long: string;
}

export function formatScheduleWhen(
  selectedTime: string | null | undefined,
  timeZone?: string
): ScheduleWhen | null {
  if (!selectedTime) return null;
  const t = Date.parse(selectedTime);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const tz = timeZone ? { timeZone } : {};

  const day = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', ...tz });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', ...tz });
  const long = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', ...tz });

  return { day, time, full: `${day} ${time}`, long };
}

/** "30 min" / "1h" / "1h30" */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '30 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}
