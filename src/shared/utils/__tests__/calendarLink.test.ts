import { googleCalendarUrl, toCalendarStamp } from '../calendarLink';

describe('toCalendarStamp', () => {
  it('ISO → formato compacto UTC do Google', () => {
    expect(toCalendarStamp(Date.parse('2026-08-26T13:00:00.000Z'))).toBe('20260826T130000Z');
  });
});

describe('googleCalendarUrl', () => {
  it('monta o deep link com título, datas e detalhes codificados', () => {
    const url = googleCalendarUrl({
      title: 'Meu Best — Conversa com Ana S.',
      start: '2026-08-26T13:00:00.000Z',
      end: '2026-08-26T13:30:00.000Z',
      details: 'Tema: Ansiedade\nEntre no app 15 min antes.',
    });
    expect(url).toBe(
      'https://calendar.google.com/calendar/render?action=TEMPLATE' +
        '&text=Meu%20Best%20%E2%80%94%20Conversa%20com%20Ana%20S.' +
        '&dates=20260826T130000Z/20260826T133000Z' +
        '&details=Tema%3A%20Ansiedade%0AEntre%20no%20app%2015%20min%20antes.'
    );
  });

  it('sem end usa durationMinutes (padrão 30)', () => {
    expect(
      googleCalendarUrl({ title: 'x', start: '2026-08-26T13:00:00.000Z', durationMinutes: 60 })
    ).toContain('dates=20260826T130000Z/20260826T140000Z');
    expect(googleCalendarUrl({ title: 'x', start: '2026-08-26T13:00:00.000Z' })).toContain(
      'dates=20260826T130000Z/20260826T133000Z'
    );
  });

  it('aceita epoch ms e Date', () => {
    const ms = Date.parse('2026-08-26T13:00:00.000Z');
    expect(googleCalendarUrl({ title: 'x', start: ms })).toContain('20260826T130000Z');
    expect(googleCalendarUrl({ title: 'x', start: new Date(ms) })).toContain('20260826T130000Z');
  });

  it('omite details/location ausentes e inclui location quando há', () => {
    const noExtra = googleCalendarUrl({ title: 'x', start: '2026-08-26T13:00:00.000Z' })!;
    expect(noExtra).not.toContain('details=');
    expect(noExtra).not.toContain('location=');
    expect(
      googleCalendarUrl({ title: 'x', start: '2026-08-26T13:00:00.000Z', location: 'Meu Best' })
    ).toContain('location=Meu%20Best');
  });

  it('título vazio cai em "Meu Best"', () => {
    expect(googleCalendarUrl({ title: '', start: '2026-08-26T13:00:00.000Z' })).toContain(
      'text=Meu%20Best'
    );
  });

  it('start inválido ou end antes do start → null', () => {
    expect(googleCalendarUrl({ title: 'x', start: 'ontem' })).toBeNull();
    expect(
      googleCalendarUrl({
        title: 'x',
        start: '2026-08-26T13:00:00.000Z',
        end: '2026-08-26T12:00:00.000Z',
      })
    ).toBeNull();
  });
});
