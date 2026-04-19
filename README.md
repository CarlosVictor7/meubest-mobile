# Meu Best — Mobile

App mobile da plataforma **Meu Best**, uma rede de apoio emocional entre pares (peer support) que conecta pessoas que precisam de escuta com voluntários dispostos a ouvir.

Construído com **React Native + Expo** (SDK 54).

---

## Stack

| Tecnologia | Uso |
|---|---|
| Expo SDK 54 | Base do projeto |
| React Native 0.81 | Core |
| TypeScript (strict) | Tipagem |
| Firebase v12 | Auth + Firestore |
| Zustand | Estado global |
| React Navigation | Navegação |
| TanStack Query | Cache de dados |
| Lucide React Native | Ícones |
| Expo Linear Gradient | Gradientes |

---

## Pré-requisitos

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Expo Go no celular ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779))

---

## Como rodar localmente

```bash
# 1. Clone o repositório
git clone https://github.com/CarlosVictor7/meubest-mobile.git
cd meubest-mobile

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Preencha com os valores reais do Firebase

# 4. Inicie o Metro Bundler
npm run start

# 5. Escaneie o QR code com o Expo Go
```

---

## Estrutura de Pastas

```
src/
├── constants/       # Design system, configurações, dados estáticos
├── features/        # Módulos por domínio (auth, matching, session, wallet, gamification, profile)
├── navigation/      # Navigators e tipos de rota
├── shared/          # Componentes, hooks, services e stores reutilizáveis
└── types/           # Definições de tipos TypeScript (UserProfile, Session, etc.)
```

---

## Variáveis de Ambiente

Crie um `.env` baseado no `.env.example`:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID=(default)
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

> ⚠️ **Nunca commite o arquivo `.env` com chaves reais.**

---

## Status do Projeto

| Sprint | Descrição | Status |
|---|---|---|
| Sprint 0 | Auditoria técnica | ✅ Concluído |
| Sprint 1 | Fundação (design system, estrutura, nav, auth) | ✅ Concluído |
| Sprint 2 | Login Google, persistência de sessão | 🔜 Próximo |
| Sprint 3 | Dashboard e funcionalidades core | ⏳ Planejado |
| Sprint 4 | Sala de sessão e matching | ⏳ Planejado |
| Sprint 5 | Financeiro (Stripe) e recursos nativos | ⏳ Planejado |
| Sprint 6 | Store readiness e publicação | ⏳ Planejado |

---

## Licença

Proprietário — Meu Best © 2026
