/**
 * deleteAccountFlow — a exclusão passa pela API (`DELETE /me`) e NUNCA por
 * deleteDoc / currentUser.delete() no cliente.
 */
import {
  runDeleteAccountFlow,
  ReauthRequiredError,
  REQUIRES_RECENT_LOGIN,
  ACCOUNT_SCOPED_STORAGE_KEYS,
  type DeleteAccountDeps,
} from '../deleteAccountFlow';

function makeDeps(over: Partial<DeleteAccountDeps> = {}): DeleteAccountDeps {
  return {
    getIdToken: jest.fn().mockResolvedValue('tok'),
    deleteMyAccount: jest.fn().mockResolvedValue({ ok: true, deleted: true }),
    cleanupLocal: jest.fn().mockResolvedValue(undefined),
    signOut: jest.fn().mockResolvedValue(undefined),
    hasSession: jest.fn().mockReturnValue(true),
    ...over,
  };
}

describe('runDeleteAccountFlow', () => {
  it('chama DELETE /me com o Bearer, limpa local e faz signOut', async () => {
    const deps = makeDeps();
    await runDeleteAccountFlow(deps);
    expect(deps.deleteMyAccount).toHaveBeenCalledWith('tok');
    expect(deps.cleanupLocal).toHaveBeenCalledTimes(1);
    expect(deps.signOut).toHaveBeenCalledTimes(1);
  });

  it('as dependências NÃO incluem deleteDoc nem delete() do Auth', () => {
    const deps = makeDeps();
    expect(Object.keys(deps).sort()).toEqual(
      ['cleanupLocal', 'deleteMyAccount', 'getIdToken', 'hasSession', 'signOut'].sort()
    );
  });

  it('sem sessão restante (API já derrubou o Auth) não chama signOut', async () => {
    const deps = makeDeps({ hasSession: jest.fn().mockReturnValue(false) });
    await runDeleteAccountFlow(deps);
    expect(deps.signOut).not.toHaveBeenCalled();
    expect(deps.cleanupLocal).toHaveBeenCalled();
  });

  it('sem token → auth/requires-recent-login e nada é chamado', async () => {
    const deps = makeDeps({ getIdToken: jest.fn().mockResolvedValue(null) });
    await expect(runDeleteAccountFlow(deps)).rejects.toMatchObject({ code: REQUIRES_RECENT_LOGIN });
    expect(deps.deleteMyAccount).not.toHaveBeenCalled();
    expect(deps.cleanupLocal).not.toHaveBeenCalled();
  });

  it('401 da API → auth/requires-recent-login (mantém o fluxo de reautenticação)', async () => {
    const deps = makeDeps({
      deleteMyAccount: jest.fn().mockRejectedValue({ statusCode: 401, message: 'x' }),
    });
    await expect(runDeleteAccountFlow(deps)).rejects.toBeInstanceOf(ReauthRequiredError);
    expect(deps.cleanupLocal).not.toHaveBeenCalled();
    expect(deps.signOut).not.toHaveBeenCalled();
  });

  it('outros erros da API propagam como estão e não limpam nada', async () => {
    const boom = { statusCode: 500, message: 'down' };
    const deps = makeDeps({ deleteMyAccount: jest.fn().mockRejectedValue(boom) });
    await expect(runDeleteAccountFlow(deps)).rejects.toBe(boom);
    expect(deps.cleanupLocal).not.toHaveBeenCalled();
  });

  it('falha no cleanup local não desfaz a exclusão (não lança)', async () => {
    const deps = makeDeps({ cleanupLocal: jest.fn().mockRejectedValue(new Error('disk')) });
    await expect(runDeleteAccountFlow(deps)).resolves.toBeUndefined();
    expect(deps.signOut).toHaveBeenCalled();
  });

  it('idempotência: alreadyDeleted:true segue como sucesso', async () => {
    const deps = makeDeps({
      deleteMyAccount: jest.fn().mockResolvedValue({ ok: true, deleted: true, alreadyDeleted: true }),
    });
    await expect(runDeleteAccountFlow(deps)).resolves.toBeUndefined();
  });

  it('chaves de AsyncStorage da conta incluem presença e dismiss', () => {
    expect(ACCOUNT_SCOPED_STORAGE_KEYS).toContain('@meubest:listenerOnlinePreference');
    expect(ACCOUNT_SCOPED_STORAGE_KEYS).toContain('@meubest:scheduleRequestsDismissed');
  });
});
