# Google Sign-In — Development Build

> Por que o Google Sign-In não funciona no Expo Go e como gerar um build de desenvolvimento.

---

## Por que não funciona no Expo Go?

O Google OAuth exige um **custom URI scheme** nativo (ex: `meubest://`).
O Expo Go usa seu próprio scheme (`exp://`), que o Google não aceita como redirect autorizado.

**Resultado:** O flow abre o browser, mas ao tentar redirecionar de volta ao app, falha silenciosamente ou retorna erro.

**Solução:** Um **development build** (EAS Build) que usa o scheme correto registrado no Google Cloud Console.

---

## Pré-requisitos

1. **Conta Expo** com acesso ao projeto (`expo login`)
2. **EAS CLI** instalado: `npm install -g eas-cli`
3. **Apple Developer Account** (para build iOS)
4. **Configurações no Firebase Console e Google Cloud Console** (veja abaixo)

---

## 1. Configurar `app.config.js`

Verifique que o arquivo tem:

```js
// app.config.js
export default ({ config }) => ({
  ...config,
  scheme: 'meubest',           // ← URI scheme do app
  ios: {
    bundleIdentifier: 'com.fillipelustman.meubest',
    ...config.ios,
  },
  android: {
    package: 'com.fillipelustman.meubest',
    ...config.android,
  },
  plugins: [
    // ... outros plugins
  ],
});
```

---

## 2. Configurar Google Cloud Console

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Projeto: `gen-lang-client-0736917841`
3. APIs & Services → Credentials → OAuth 2.0 Client IDs

### Client ID Web (já existente)
- Tipo: **Aplicativo da Web**
- ID: `665557596754-q7vo61f0vronp2ddtaqljdp4cpc04rtt.apps.googleusercontent.com`
- **URIs de redirecionamento autorizados** deve incluir:
  - `https://auth.expo.io/@fillipelustman/meubest` (para Expo proxy)
  - `https://auth.expo.io/@<seu-username>/meubest`

### Client ID iOS (já existente)
- Tipo: **iOS**
- ID: `665557596754-56d27ol8c022b0j7kdlnhte5c568nel0.apps.googleusercontent.com`
- **Bundle ID:** `com.fillipelustman.meubest`
- **URI scheme gerado:** `com.googleusercontent.apps.665557596754-56d27ol8c022b0j7kdlnhte5c568nel0`

---

## 3. Configurar Firebase Console

1. Firebase Console → projeto `gen-lang-client-0736917841`
2. Authentication → Sign-in method → Google → Ativado ✅
3. Authentication → Settings → Authorized domains:
   - `meu.best` ✅
   - `localhost` ✅

---

## 4. Gerar o Development Build (iOS Simulator)

```bash
# Login no EAS (se ainda não fez)
npx eas-cli login

# Configurar o projeto EAS (primeira vez)
npx eas-cli build:configure

# Build para simulador iOS (mais rápido, sem Apple Developer)
npx eas-cli build --profile development --platform ios

# OU build para dispositivo físico iOS
npx eas-cli build --profile development --platform ios
```

### `eas.json` necessário:

```json
{
  "cli": {
    "version": ">= 14.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

---

## 5. Instalar e Executar o Dev Build

```bash
# Após o build concluir, instale no simulador
npx eas-cli build:run --platform ios

# Execute o Metro com dev client
npx expo start --dev-client
```

---

## 6. Checklist antes de testar

- [ ] `scheme: 'meubest'` no `app.config.js`
- [ ] `bundleIdentifier` correto no iOS
- [ ] Client ID iOS no Google Cloud Console com bundle ID correto
- [ ] Client ID iOS configurado no `.env` como `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- [ ] `EXPO_PUBLIC_ENABLE_DEV_EMAIL_LOGIN=false` no `.env` (remova o form de email)
- [ ] Dev build instalado no simulador/dispositivo
- [ ] Metro rodando com `--dev-client`

---

## Troubleshooting

| Erro | Causa | Solução |
|---|---|---|
| `redirect_uri_mismatch` | URI scheme não cadastrado no Google | Adicionar nos authorized URIs |
| `invalid_client` | Client ID errado | Verificar `.env` e Google Console |
| App não abre após OAuth | Scheme não registrado no `app.config.js` | Adicionar `scheme: 'meubest'` |
| Token inválido no Firebase | id_token ausente na resposta | Verificar scopes: `['openid', 'profile', 'email']` |

---

## Referências

- [Expo Google Auth Guide](https://docs.expo.dev/guides/google-authentication/)
- [expo-auth-session Docs](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Firebase Auth - Sign in with Google](https://firebase.google.com/docs/auth/web/google-signin)
- [EAS Build Docs](https://docs.expo.dev/build/introduction/)
