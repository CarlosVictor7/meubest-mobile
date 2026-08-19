/**
 * logoutCleanup — SAIR DA CONTA nunca conclui em silêncio deixando push ativa.
 */
import {
  runLogoutCleanup,
  LogoutCleanupError,
  LOGOUT_CLEANUP_ATTEMPTS,
  LOGOUT_CLEANUP_FAILED_MESSAGE,
} from '../logoutCleanup';

const noDelay = async () => {};

describe('runLogoutCleanup', () => {
  it('sucesso na primeira: uma execução, sem retry', async () => {
    const op = jest.fn().mockResolvedValue(undefined);
    await runLogoutCleanup(op, 2, noDelay);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('falha e depois sucesso: o retry salva o logout', async () => {
    const op = jest
      .fn()
      .mockRejectedValueOnce(new Error('rede caiu'))
      .mockResolvedValueOnce(undefined);
    await runLogoutCleanup(op, 2, noDelay);
    expect(op).toHaveBeenCalledTimes(2);
  });

  it('todas as tentativas falham → LogoutCleanupError com mensagem para a UI', async () => {
    const op = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(runLogoutCleanup(op, 2, noDelay)).rejects.toThrow(LogoutCleanupError);
    await expect(runLogoutCleanup(op, 2, noDelay)).rejects.toThrow(
      LOGOUT_CLEANUP_FAILED_MESSAGE
    );
  });

  it('retry é LIMITADO — nunca infinito', async () => {
    const op = jest.fn().mockRejectedValue(new Error('offline'));
    await runLogoutCleanup(op, 3, noDelay).catch(() => {});
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('attempts inválido (0) ainda executa ao menos uma vez', async () => {
    const op = jest.fn().mockResolvedValue(undefined);
    await runLogoutCleanup(op, 0, noDelay);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('a causa original é preservada para diagnóstico', async () => {
    const original = new Error('permission-denied');
    const op = jest.fn().mockRejectedValue(original);
    const err = await runLogoutCleanup(op, 1, noDelay).catch((e) => e);
    expect((err as any).cause).toBe(original);
  });

  it('default de tentativas é pequeno e finito', () => {
    expect(LOGOUT_CLEANUP_ATTEMPTS).toBeGreaterThanOrEqual(1);
    expect(LOGOUT_CLEANUP_ATTEMPTS).toBeLessThanOrEqual(3);
  });
});
