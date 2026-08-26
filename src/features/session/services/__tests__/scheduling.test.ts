/**
 * Só a parte pura: a tradução de código HTTP em mensagem. As chamadas em si
 * dependem de Firebase Auth + fetch e ficam fora do jest (ver jest.config.js).
 */
jest.mock('@shared/services/paymentService', () => ({ getFirebaseIdToken: jest.fn() }));
jest.mock('@shared/services/api', () => ({ api: {}, isApiError: () => false }));

import { describeSchedulingError } from '../scheduling';

describe('describeSchedulingError', () => {
  it('409 tem mensagem específica por ação', () => {
    expect(describeSchedulingError('join', 409)).toMatch(/15 minutos antes/);
    expect(describeSchedulingError('accept', 409)).toMatch(/não está mais disponível/);
    expect(describeSchedulingError('reject', 409)).toMatch(/já foi respondida/);
    expect(describeSchedulingError('cancel', 409)).toMatch(/não pode ser cancelada/);
  });

  it('401/403/404 independem da ação', () => {
    for (const action of ['accept', 'reject', 'cancel', 'join'] as const) {
      expect(describeSchedulingError(action, 401)).toMatch(/Entre novamente/);
      expect(describeSchedulingError(action, 403)).toMatch(/não pode realizar/);
      expect(describeSchedulingError(action, 404)).toMatch(/não existe mais/);
    }
  });

  it('rede/desconhecido → genérica', () => {
    expect(describeSchedulingError('join', null)).toMatch(/Tente novamente/);
    expect(describeSchedulingError('join', 500)).toMatch(/Tente novamente/);
  });
});
