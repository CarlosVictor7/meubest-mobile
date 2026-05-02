# Google Sign-In — Development Build (Nativo)

> Por que o Google Sign-In não funciona no Expo Go e como gerar um build de desenvolvimento com a biblioteca nativa.

---

## Por que não funciona no Expo Go?

O pacote oficial `@react-native-google-signin/google-signin` possui **código nativo** (Java/Kotlin no Android, Swift/Objective-C no iOS) que interage diretamente com o Google Play Services e as bibliotecas da Apple.
O Expo Go é um aplicativo pré-compilado e **não** possui o código nativo de terceiros embutido.

**Resultado:** Se você tentar usar o Google Sign-In rodando no app Expo Go, ocorrerá um erro ou o código bloqueará a ação. O código atual do Meu Best detecta o Expo Go e exibe um alerta amigável.

**Solução:** É obrigatório gerar um **Development Build** (EAS Build) que compila o aplicativo junto com a biblioteca nativa e as credenciais (`google-services.json` / `GoogleService-Info.plist`).

---

## Pré-requisitos Obrigatórios

Antes de tentar compilar o app para desenvolvimento ou produção, garanta que você possui:

1. **Conta Expo** configurada e `eas-cli` instalado (`npm install -g eas-cli`).
2. **Google Cloud Console:** Client IDs nativos criados (iOS e Web).
3. **Arquivos do Firebase Console na raiz da pasta `mobile`:**
   - `google-services.json` (para Android)
   - `GoogleService-Info.plist` (para iOS)
   
> **ATENÇÃO:** O arquivo `app.config.js` está preparado para ler esses arquivos. Se você for rodar um build nativo, deverá baixar esses arquivos do seu projeto no Firebase (seção Project Settings > General) e colocá-los na mesma pasta que o `app.config.js`. Depois, basta descomentar as linhas `googleServicesFile` correspondentes.

---

## 1. Variáveis de Ambiente (`.env`)

Você precisa preencher seu arquivo `.env` (baseando-se no `.env.example`) com as variáveis exigidas.
As variáveis essenciais para o Google Sign-In são:

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=seu-client-id-web
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=seu-client-id-ios
EXPO_PUBLIC_ENABLE_DEV_EMAIL_LOGIN=true # Apenas para poder logar via email no Expo Go enquanto não gera a build nativa
```

*Nota: O `googleWebClientId` é obrigatório mesmo no Android, pois é ele quem fornece o token aceito pelo Firebase.*

---

## 2. Configurar Firebase e Google Cloud

### Android
- Adicione o App Android no Firebase Console.
- **Importante:** Cadastre o SHA-1 e o SHA-256 da sua chave de assinatura (debug/release) no Firebase. Sem isso, o pop-up nativo do Google fechará sozinho com erro `12501` ou `DEVELOPER_ERROR`.
- Baixe o `google-services.json` e coloque na raiz.

### iOS
- Adicione o App iOS no Firebase Console com o `bundleIdentifier` correto.
- No Google Cloud Console, verifique se o Client ID do iOS corresponde ao mesmo bundle.
- Baixe o `GoogleService-Info.plist` e coloque na raiz.

---

## 3. Gerar o Development Build via EAS

Com os arquivos de credencial na pasta correta e as linhas descomentadas no `app.config.js`, siga com a compilação.

```bash
# Login no EAS (se ainda não fez)
npx eas-cli login

# Configurar o projeto EAS (primeira vez)
npx eas-cli build:configure

# Build para Android (APK ou AAB)
npx eas-cli build --profile development --platform android

# Build para simulador iOS (mais rápido, não exige conta Apple paga)
npx eas-cli build --profile development --platform ios
```

---

## 4. Instalar e Executar o Dev Build

```bash
# Executa o Metro Server (bundler) direcionando para o dev-client
npx expo start --dev-client
```
Abra o app compilado no emulador ou dispositivo físico. O botão "Continuar com Google" agora invocará as telas nativas do sistema em vez de um navegador web.

---

## Checklist de Troubleshooting

| Problema | Causa | Solução |
|---|---|---|
| Alerta informando que precisa de Development Build | Tentando logar pelo Expo Go | Instale o app compilado via `eas build` |
| Pop-up do Google fecha logo após abrir (Android) | SHA-1 ausente ou incorreto | Gere o SHA-1 do keystore usado pelo EAS e cadastre no Firebase |
| `DEVELOPER_ERROR` / `12501` | Client ID ou SHA-1 inconsistentes | Verifique se o pacote/bundle no app.config bate com o Firebase |
| Erro de compilação EAS | Falta do `.json` ou `.plist` | Baixe do Firebase e descomente no `app.config.js` |

---

## Referências

- [@react-native-google-signin/google-signin Github](https://github.com/react-native-google-signin/google-signin)
- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Firebase Sign in with Google na Web e Native](https://firebase.google.com/docs/auth/web/google-signin)
