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

  it('transições de agendamento → SessionDetail, NUNCA VideoRoom', () => {
    for (const type of [
      'session_accepted',
      'session_rejected',
      'session_cancelled',
      'session_expired',
      'session_started',
    ]) {
      expect(buildNotificationRoute({ type, sessionId: 's9' })).toEqual({
        kind: 'sessionDetail',
        sessionId: 's9',
      });
    }
  });

  it('session_started sem sessionId → null (o ENTRAR do detalhe valida a janela via /join)', () => {
    expect(buildNotificationRoute({ type: 'session_started' })).toBeNull();
    expect(buildNotificationRoute({ type: 'session_accepted', sessionId: '' })).toBeNull();
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

  it('listener_status → Home (o estado verdadeiro mora no perfil, não no payload)', () => {
    expect(
      buildNotificationRoute({ type: 'listener_status', status: 'in_training' })
    ).toEqual({ kind: 'home' });
    expect(
      buildNotificationRoute({ type: 'listener_status', status: 'approved' })
    ).toEqual({ kind: 'home' });
    // Sem `status` ainda vai para a Home: a navegação não depende do payload.
    expect(buildNotificationRoute({ type: 'listener_status' })).toEqual({ kind: 'home' });
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
