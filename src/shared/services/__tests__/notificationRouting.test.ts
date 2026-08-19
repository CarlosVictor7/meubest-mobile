/**
 * notificationRouting — o toque numa push leva para onde?
 *
 * A decisão é pura de propósito: o cold start — o cenário mais difícil de
 * reproduzir num emulador — fica provado aqui em milissegundos.
 */
import { buildNotificationRoute } from '../notificationRouting';

describe('buildNotificationRoute', () => {
  it('chamada imediata → Home (NUNCA VideoRoom direto)', () => {
    // A Home revalida a sessão via useIncomingCall — entre a push e o toque
    // a chamada pode ter expirado, sido aceita ou cancelada.
    expect(
      buildNotificationRoute({ type: 'incoming_support_request', sessionId: 'abc' })
    ).toEqual({ kind: 'home' });
  });

  it('chamada imediata sem sessionId ainda vai para a Home', () => {
    expect(buildNotificationRoute({ type: 'incoming_support_request' })).toEqual({
      kind: 'home',
    });
  });

  it('sessão agendada criada → SessionDetail da sessão', () => {
    expect(
      buildNotificationRoute({ type: 'scheduled_session_created', sessionId: 's1' })
    ).toEqual({ kind: 'sessionDetail', sessionId: 's1' });
  });

  it('lembrete de sessão → SessionDetail da sessão', () => {
    expect(
      buildNotificationRoute({ type: 'scheduled_session_reminder', sessionId: 's2' })
    ).toEqual({ kind: 'sessionDetail', sessionId: 's2' });
  });

  it('agendada/lembrete SEM sessionId → null (não navega às cegas)', () => {
    expect(buildNotificationRoute({ type: 'scheduled_session_created' })).toBeNull();
    expect(
      buildNotificationRoute({ type: 'scheduled_session_reminder', sessionId: '' })
    ).toBeNull();
    expect(
      buildNotificationRoute({ type: 'scheduled_session_created', sessionId: 42 })
    ).toBeNull();
  });

  it('type desconhecido → null', () => {
    expect(buildNotificationRoute({ type: 'marketing_blast', sessionId: 'x' })).toBeNull();
  });

  it('payload ausente/malformado → null, nunca lança', () => {
    expect(buildNotificationRoute(undefined)).toBeNull();
    expect(buildNotificationRoute(null)).toBeNull();
    expect(buildNotificationRoute('string')).toBeNull();
    expect(buildNotificationRoute(42)).toBeNull();
    expect(buildNotificationRoute({})).toBeNull();
    expect(buildNotificationRoute([])).toBeNull();
  });
});
