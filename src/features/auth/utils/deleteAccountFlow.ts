/**
 * deleteAccountFlow — orquestração PURA da exclusão de conta (26/08).
 *
 * A exclusão é server-authoritative: o app chama `DELETE /me` e a API cuida de
 * `accountStatus:'deleted'`, anonimização, Storage e Firebase Auth. Aqui NÃO
 * existe deleteDoc(users/{uid}) nem `currentUser.delete()` — e o teste garante
 * isso: as dependências são injetadas e só as que o fluxo precisa existem.
 *
 * Ordem:
 *   1. token         → sem token = precisa reautenticar (auth/requires-recent-login)
 *   2. DELETE /me    → 401 vira auth/requires-recent-login (mantém o fluxo da UI)
 *   3. cleanup local → stores, AsyncStorage (presença/dismiss)
 *   4. signOut local → se ainda houver sessão (a API já derrubou o Auth; o SDK
 *                      pode demorar a perceber — signOut garante a UI coerente)
 */

export const REQUIRES_RECENT_LOGIN = 'auth/requires-recent-login';

export interface DeleteAccountDeps {
  /** idToken atual; null/undefined = sem sessão utilizável. */
  getIdToken: () => Promise<string | null | undefined>;
  /** `api.deleteMyAccount`. Deve lançar `{ statusCode }` em erro HTTP. */
  deleteMyAccount: (token: string) => Promise<{ ok: boolean; deleted: boolean }>;
  /** Limpeza local (stores + AsyncStorage). Falha aqui não desfaz a exclusão. */
  cleanupLocal: () => Promise<void>;
  /** signOut do SDK. Só chamado se `hasSession()` for true. */
  signOut: () => Promise<void>;
  hasSession: () => boolean;
}

export class ReauthRequiredError extends Error {
  code = REQUIRES_RECENT_LOGIN;
  constructor(message = 'Reautenticação necessária') {
    super(message);
    this.name = 'ReauthRequiredError';
  }
}

function statusOf(err: unknown): number | null {
  const s = (err as { statusCode?: unknown } | null)?.statusCode;
  return typeof s === 'number' ? s : null;
}

export async function runDeleteAccountFlow(deps: DeleteAccountDeps): Promise<void> {
  const token = await deps.getIdToken();
  if (!token) throw new ReauthRequiredError();

  try {
    await deps.deleteMyAccount(token);
  } catch (err) {
    if (statusOf(err) === 401) throw new ReauthRequiredError();
    throw err;
  }

  try {
    await deps.cleanupLocal();
  } catch (err) {
    console.warn('[deleteAccountFlow] cleanup local falhou (conta já excluída):', err);
  }

  if (deps.hasSession()) {
    try {
      await deps.signOut();
    } catch (err) {
      console.warn('[deleteAccountFlow] signOut local falhou (conta já excluída):', err);
    }
  }
}

/** Chaves de AsyncStorage que pertencem à conta e morrem com ela. */
export const ACCOUNT_SCOPED_STORAGE_KEYS = [
  '@meubest:listenerOnlinePreference',
  '@meubest:scheduleRequestsDismissed',
] as const;
