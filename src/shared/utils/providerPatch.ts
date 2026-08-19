/**
 * providerPatch — o que um login social PODE gravar no perfil existente.
 *
 * O bug que este módulo corrige (auditoria 19/08, §18):
 *
 *   setDoc(ref, { name: displayName, photoURL, email }, { merge: true })
 *
 * `merge: true` mescla CHAVES, não valores. Uma chave presente com `null`
 * SOBRESCREVE o dado bom:
 *
 *   • `displayName: null`  → apaga o nome de quem já usava o app
 *   • `email: null`        → viola `isValidUser` nas Rules → a escrita INTEIRA
 *                            é negada e o login quebra sem mensagem útil
 *
 * A Apple é o caso mais exposto: ela só devolve nome/e-mail no PRIMEIRO
 * consentimento — todo login subsequente vem com tudo nulo.
 *
 * Regras absolutas:
 *   • `preferredName` NUNCA aparece aqui — é escolha do usuário, provider não toca
 *   • nenhuma chave entra com null / undefined / '' / só espaços
 *   • payload vazio → o chamador NÃO escreve nada
 *
 * Função pura e exaustivamente testada; googleAuth/appleAuth apenas a chamam.
 */

export interface ProviderProfileInput {
  displayName?: string | null;
  photoURL?: string | null;
  email?: string | null;
}

export function buildProviderPatch(
  input: ProviderProfileInput
): Record<string, string> {
  const s = (v: unknown): string | null =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;

  const patch: Record<string, string> = {};
  const name = s(input.displayName);
  const photoURL = s(input.photoURL);
  const email = s(input.email);

  if (name) patch.name = name;
  if (photoURL) patch.photoURL = photoURL;
  if (email) patch.email = email;
  return patch;
}
