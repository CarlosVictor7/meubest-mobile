/**
 * scheduleTime — do "dia + hora de parede" escolhido na tela para o instante
 * ISO UTC gravado em `selectedTime`.
 *
 * O instante é sempre correto (ISO com `Z`); o fuso em que a pessoa escolheu
 * vai separado em `scheduledTz` para a API montar a copy no fuso certo.
 *
 * Funções puras. `buildSelectedTime` aceita um IANA explícito para os testes
 * não dependerem do fuso do runner; sem `tz`, usa o relógio local do device —
 * exatamente o que a tela de agendamento sempre fez.
 */

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

function parseParts(dateKey: string, time: string) {
  const d = DATE_KEY_RE.exec(dateKey);
  const t = TIME_RE.exec(time);
  if (!d || !t) return null;
  const year = Number(d[1]);
  const month = Number(d[2]);
  const day = Number(d[3]);
  const hour = Number(t[1]);
  const minute = Number(t[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { year, month, day, hour, minute };
}

/**
 * Offset (ms) de `tz` em relação ao UTC no instante `utcMs`.
 * Positivo a leste de Greenwich (ex.: Lisboa no verão = +1h),
 * negativo a oeste (São Paulo = −3h).
 */
function tzOffsetMs(utcMs: number, tz: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, number> = {};
  for (const p of fmt.formatToParts(new Date(utcMs))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour === 24 ? 0 : parts.hour,
    parts.minute,
    parts.second
  );
  return asUtc - utcMs;
}

/**
 * `('2026-08-26', '10:00')` → ISO UTC do instante em que o relógio local (ou
 * o de `tz`) marca 26/08/2026 10:00. `null` para entrada inválida.
 */
export function buildSelectedTime(
  dateKey: string,
  time: string,
  tz?: string | null
): string | null {
  const p = parseParts(dateKey, time);
  if (!p) return null;

  if (!tz) {
    const local = new Date(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0);
    return Number.isNaN(local.getTime()) ? null : local.toISOString();
  }

  // Chute em UTC, corrige pelo offset do fuso; segunda passada cobre a borda
  // de horário de verão (o offset muda entre o chute e a resposta).
  const guess = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0);
  let utc = guess - tzOffsetMs(guess, tz);
  utc = guess - tzOffsetMs(utc, tz);
  return new Date(utc).toISOString();
}

/** O slot já passou (ou é agora)? Slots `<= now` não podem ser solicitados. */
export function isSlotInPast(
  dateKey: string,
  time: string,
  now: number = Date.now(),
  tz?: string | null
): boolean {
  const iso = buildSelectedTime(dateKey, time, tz);
  if (!iso) return true;
  return Date.parse(iso) <= now;
}

/** IANA do device; `null` quando o runtime não expõe (nunca lança). */
export function getDeviceTimeZone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === 'string' && tz.length > 0 ? tz : null;
  } catch {
    return null;
  }
}
