# Auditoria Técnica — Migração Web → Mobile
## Meu Best · Staff Engineer Report · Abril 2026

---

## 1. RESUMO EXECUTIVO

### O que é o sistema

**Meu Best** é uma plataforma de apoio emocional entre pares (peer support), que conecta pessoas que precisam de escuta ativa ("speakers") com voluntários disponíveis para ouvir ("listeners"). O serviço é 100% gratuito, com gorjetas voluntárias como modelo de receita, e é complementado por gamificação, rankings e sessões de vídeo/áudio via Jitsi Meet.

### Domínios funcionais principais

| Domínio | Descrição |
|---|---|
| **Auth** | Login com Google (OAuth), perfis com dois papéis distintos |
| **Matching** | Match imediato (random) ou agendado com listener específico |
| **Sessão** | Sala de vídeo via Jitsi, transcrição por IA (Web Speech API), sugestões Gemini |
| **Gamificação** | Pontos, badges, streaks, moedas de gratidão, ranking de listeners |
| **Financeiro** | Gorjetas via Stripe Checkout, carteira, saque, histórico de transações |
| **Comunicação** | E-mails de lembrete via Resend, notificações in-app via toasts |
| **Admin** | Painel completo de moderação, IA, configuração financeira, chaves API |

### Blocos críticos para migrar

1. **Autenticação Firebase** — base de tudo, compatível mas requer adaptação
2. **Motor de Matching** — lógica de Firestore em tempo real, núcleo do negócio
3. **Sala de Sessão / Vídeo** — maior risco técnico; usa Jitsi via iframe + Web Speech API
4. **Sistema Financeiro** — Stripe Checkout usa `window.location.href`, incompatível com mobile
5. **Notificações** — hoje são toasts no browser; no mobile precisam de push notifications nativos

---

## 2. INVENTÁRIO TÉCNICO

### Frameworks e linguagens

| Item | Versão | Onde |
|---|---|---|
| React | 19.0.0 | Web |
| React Native | 0.74.1 | Mobile (atual) |
| Expo SDK | ~51.0.0 | Mobile (atual) |
| TypeScript | ~5.8.2 / ~5.3.3 | Web e Mobile |
| Vite | 6.2.0 | Web (build) |
| TailwindCSS | 4.x | Web (styling) |
| Express | 4.21.2 | Backend |

### Bibliotecas principais

| Biblioteca | Papel | Compatível com RN? |
|---|---|---|
| firebase (client SDK) | Auth + Firestore + Storage | ✅ Sim |
| framer-motion | Animações | ❌ Web only |
| react-router-dom v7 | Roteamento | ❌ Web only |
| sonner | Toasts | ❌ Web only |
| @google/genai | Gemini AI | ⚠️ Parcial (requer backend) |
| canvas-confetti | Efeitos visuais | ❌ Web only |
| d3 | Gráficos (Admin) | ❌ Web only |
| lucide-react | Ícones | ❌ Usar lucide-react-native |
| @react-navigation/native | Navegação mobile | ✅ Já no mobile atual |
| react-native-reanimated | Animações RN | ✅ Já no mobile atual |
| expo-haptics | Feedback tátil | ✅ Já no mobile atual |
| expo-linear-gradient | Gradientes | ✅ Já no mobile atual |
| stripe | Pagamentos | ❌ Usar @stripe/stripe-react-native |
| resend | E-mail | ✅ Backend apenas |

### Serviços externos

| Serviço | Finalidade | Impacto no mobile |
|---|---|---|
| Firebase Auth | Autenticação Google OAuth | Requer `@react-native-google-signin/google-signin` |
| Firestore | Banco de dados em tempo real | ✅ SDK funciona em RN |
| Firebase Storage | Upload de arquivos | ✅ SDK funciona em RN |
| Stripe | Pagamentos / Gorjetas | Requer `@stripe/stripe-react-native` + mudança de fluxo |
| Resend | E-mails transacionais | Permanece no backend, sem mudança |
| Gemini AI | Sugestões IA + análise sesões | Ao backend; não chamar direto do mobile |
| Jitsi Meet | Videochamada | ⚠️ Alto risco: usar `react-native-jitsi-meet-sdk` |

### Variáveis de ambiente mapeadas

```
GEMINI_API_KEY
APP_URL
RESEND_API_KEY
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_FIRESTORE_DATABASE_ID
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
VITE_STRIPE_PUBLISHABLE_KEY
```

> **No mobile:** Prefixo `VITE_` deve ser substituído por `EXPO_PUBLIC_` para variáveis públicas. Segredos devem permanecer exclusivamente no backend.

### Coleções Firestore identificadas

| Coleção | Uso |
|---|---|
| `users` | Perfis de usuários (speakers e listeners) |
| `sessions` | Sessões de apoio (pending / active / completed) |
| `sessions/{id}/transcripts` | Subcoleção de transcrições IA |
| `reviews` | Avaliações pós-sessão |
| `tips` | Gorjetas enviadas (criadas pelo backend via webhook) |
| `transactions` | Histórico financeiro por usuário |
| `withdrawals` | Solicitações de saque |
| `reports` | Denúncias de usuários |
| `admin_config/global` | Configuração global da plataforma |
| `admin_config/ai_settings` | Triggers e orientações para IA |
| `admin_config/secrets` | Chaves de API (acesso restrito) |
| `test/connection` | Documento de health check |

### Endpoints do backend (server.ts)

| Endpoint | Método | Descrição |
|---|---|---|
| `POST /api/create-checkout-session` | POST | Cria sessão Stripe Checkout |
| `POST /api/webhook` | POST | Webhook Stripe (processa pagamentos) |
| `POST /api/admin/process-payout` | POST | Processa saque (admin) |
| `POST /api/send-email` | POST | Envia e-mail via Resend |
| `POST /api/analyze-session` | POST | Analisa transcrição com Gemini |

---

## 3. MAPA DE FUNCIONALIDADES

| Funcionalidade | Arquivo Web | Dependências Técnicas | Existe no Mobile Atual | Prioridade | Observações |
|---|---|---|---|---|---|
| Landing / Marketing | `LandingPage.tsx` | framer-motion, react-router | ❌ Não | Baixa | Substituto: onboarding screens nativas |
| Login Google OAuth | `LandingPage.tsx` | firebase/auth, signInWithPopup | ⚠️ Parcial (mock) | **Alta** | Requer `@react-native-google-signin` |
| Cadastro e escolha de papel | `LandingPage.tsx` | Firestore/users | ⚠️ Parcial (mock) | **Alta** | Lógica de onboarding precisa ser reconstruída |
| Dashboard principal | `Dashboard.tsx` | Auth, Firestore, múltiplos modais | ⚠️ Parcial | **Alta** | 217KB monolítico; exige refatoração total |
| Match imediato (busca) | `Dashboard.tsx` | Firestore sessions, Listeners query | ⚠️ Parcial (UI simples) | **Alta** | Lógica de priorização existe na web |
| Match agendado | `Dashboard.tsx` | Firestore, availability | ❌ Não implementado | **Alta** | Lógica de calendário e slots de hora |
| Lista de listeners filtrada | `Dashboard.tsx` | Firestore users, filtros | ❌ Não | Média | city, age, gender, theme filters |
| Sala de sessão (vídeo) | `SessionRoom.tsx` | Jitsi iframe, Web Speech API | ❌ Não | **Alta** | Maior risco técnico do projeto |
| Transcrição por IA | `SessionRoom.tsx` | Web Speech API (browser-only) | ❌ Não | Média | Requer alternativa nativa (expo-speech ou Whisper) |
| Sugestões Gemini em tempo real | `SessionRoom.tsx` | gemini API | ❌ Não | Média | Mover para backend; stream via WebSocket |
| Avaliação pós-sessão | `SessionRoom.tsx` | Firestore reviews | ❌ Não | **Alta** | Fluxo crítico do produto |
| Gorjeta (tip) | `SessionRoom.tsx`, `TipModal.tsx` | Stripe Checkout, fetch backend | ❌ Não | **Alta** | Stripe mobile requer abordagem diferente |
| Gamificação — pontos/badges | `Dashboard.tsx`, `SessionRoom.tsx` | Firestore users | ⚠️ Parcial (stub) | **Alta** | Lógica existe na web, precisa ser portada |
| Check-in diário | `Dashboard.tsx` | Firestore, gratitudeCoins | ❌ Não (mock de moedas) | Média | |
| Mood picker | `Dashboard.tsx` | UI local | ✅ Parcial (sem persistência) | Média | Sem persistência no Firestore |
| Loja de Gratidão | `Dashboard.tsx` | Firestore, moedas | ✅ Parcial (UI sem funcional.) | Média | Sem backend conectado |
| Notificações de sessão | `Dashboard.tsx` | sonner toasts, browser Audio | ❌ Não | **Alta** | Requer push notifications nativas |
| Lembretes por email | `Dashboard.tsx` | fetch /api/send-email | ❌ Não | Média | Backend mantido, trigger muda |
| Carteira / saldo | `Dashboard.tsx`, `WithdrawalModal.tsx` | Firestore transactions | ❌ Não | Média | |
| Saque (withdrawal) | `WithdrawalModal.tsx` | Firestore withdrawals | ❌ Não | Média | |
| Histórico de transações | `Dashboard.tsx` | Firestore transactions | ❌ Não | Média | |
| Ranking de listeners | `Dashboard.tsx` | Firestore users, orderBy points | ⚠️ Parcial (layout pronto) | Média | |
| Perfil do usuário | `ProfileForm.tsx` | Firestore users | ⚠️ Parcial (UI stub) | **Alta** | |
| Status online (toggle) | `Dashboard.tsx` | Firestore users.isOnline | ✅ Sim | **Alta** | |
| Denúncia de usuário | `SessionRoom.tsx` | Firestore reports | ❌ Não | **Alta** | |
| Admin — Painel | `AdminDashboard.tsx` | d3, Firestore | ❌ Não | Baixa | Manter apenas na web |
| Deep links / URL params | `Dashboard.tsx` | window.location, URLSearchParams | ❌ Não | Média | Requer Expo Linking |

---

## 4. MAPA DE TELAS E NAVEGAÇÃO

### Telas públicas (sem autenticação)
- Onboarding/Landing (equivalente à LandingPage)
- Escolha de papel (speaker / listener)
- Login com Google

### Telas autenticadas
- Home/Dashboard principal
- Busca de match imediato
- Perfil de listener (detalhe)
- Agendamento de sessão
- Sala de sessão (vídeo + IA)
- Pós-sessão: avaliação e gorjeta
- Minhas sessões (histórico)
- Carteira e transações
- Loja de Gratidão
- Gamificação / Minha Jornada
- Ranking de listeners
- Perfil próprio e configurações

### Telas administrativas
> **Recomendação:** O painel admin permanece exclusivamente na versão web. Não migrar.

### Estrutura de navegação proposta para o app

```
Root Stack
├── AuthStack (não autenticado)
│   ├── OnboardingScreen
│   ├── RoleSelectionScreen
│   └── LoginScreen
│
└── AppTabs (autenticado)
    ├── HomeTab (Stack)
    │   ├── HomeScreen
    │   ├── MatchSearchScreen
    │   ├── ListenerProfileScreen
    │   ├── ScheduleMatchScreen
    │   └── SessionRoomScreen (Modal Stack)
    │       ├── ConsentScreen
    │       ├── VideoRoomScreen
    │       └── PostSessionScreen (Rating + Tip)
    │
    ├── SessionsTab (Stack)
    │   ├── SessionsListScreen
    │   └── SessionDetailScreen
    │
    ├── WalletTab (Stack)
    │   ├── WalletScreen
    │   ├── TransactionsScreen
    │   ├── TipScreen
    │   └── WithdrawalScreen
    │
    └── ProfileTab (Stack)
        ├── ProfileScreen
        ├── GamificationScreen
        ├── RankingScreen
        ├── StoreScreen
        └── SettingsScreen
```

> **Regras de navegação:**
> - Sessão ativa deve ser un modal de tela cheia (Stack Modal) para bloquear navegação
> - Chat/notificação de chamado recebido: usar Modal overlay ou bottom sheet
> - Deep links via Expo Linking para abrir sessão específica a partir de push notification

---

## 5. ANÁLISE CRÍTICA DA PASTA MOBILE EXISTENTE

### O que serve como base conceitual ✅

- **Paleta de cores e identidade visual** — usa corretamente `#FF8C61`, `#333`, `#FFF5F0` etc.
- **Estrutura de navegação** — uso correto de Stack + Bottom Tabs via `@react-navigation`
- **Componentes de UI atômicos** — `MoodPicker`, `AuraCard`, `IncomingCallModal`, `QuickActions` são conceitualmente corretos
- **Uso de Haptics** — `expo-haptics` implementado no lugar certo (ações importantes)
- **LinearGradient** — uso correto para botões primários
- **Nomenclatura de telas** — `HomeScreen`, `ScheduleScreen`, `ProfileScreen`, `GamificationScreen`, `StoreScreen` são bons nomes

### O que é mock / protótipo e não é funcional ⚠️

- **Firebase config com placeholders** — `"SUA_API_KEY"`, `"SEU_PROJECT_ID"` etc. hardcoded, sem `.env`
- **Moedas de Gratidão (1,250)** — valor hardcoded, sem conexão Firestore
- **Streak (5 dias)** — hardcoded, sem leitura do `profile.currentStreak`
- **Auras da comunidade** — array estático, sem leitura do Firestore
- **Sessões agendadas** — dados fake (`sessions` array local), sem Firestore query
- **Perfil de usuário** — nome "Seu Nome", membro desde "Abril 2024", estatísticas (12, 4.9, 3) hardcodadas
- **Gamification stats** — "Nível 5", "700/1000 pts", "12.5 horas", "48 pessoas" — tudo hardcoded
- **IncomingCallModal** — dispara após 5s de timer local, sem Firestore listener real
- **InstantMatchScreen** — apenas loading visual, sem lógica de match real
- **StoreScreen** — UI sem integração com backend
- **handleConfirm** — mostra `Alert.confirm`, sem persistência

### O que não está pronto para produção ❌

- **Autenticação**: sem Firebase Auth integrado (sem `signInWithPopup` móvel, sem token persistence)
- **Sem persistência local**: não usa `AsyncStorage` ou `SecureStore` para cache offline
- **`framer-motion` no package.json**: completamente incompatível com React Native, nunca funcionará
- **Firebase v10 vs v12**: mobile usa Firebase `^10.11.0`, web usa `^12.11.0` — inconsistência
- **Expo SDK 51**: desatualizado (Expo 52/53 disponíveis); dependências inconsistentes
- **Sem `app.json`/`app.config.js`**: sem configuração de bundle ID, ícones, splash, permissões
- **Sem `expo.json`/`eas.json`**: sem configuração de build para stores
- **`react-native-reanimated`** importada mas configurado sem o babel plugin necessário
- **Sem tratamento de erro**: nenhuma tela de erro, sem feedback ao usuário em falhas de rede
- **Sem loading states reais**: `ActivityIndicator` apenas decorativo em `InstantMatchScreen`
- **Sem logout**: função de sair não faz nada (sem `signOut(auth)`)
- **Sem tipagem**: quase tudo é `any`, sem interfaces compartilhadas

### O que pode ser reaproveitado 🔁

- **StyleSheet** — boa parte dos estilos visuais pode ser portada para o design system do novo repo
- **Nomes de componentes e telas** como referência conceitual
- **Lógica do `IncomingCallModal`** como rascunho do fluxo de UX de chamado

### O que deve ser descartado 🗑️

- **Todo o conteúdo hardcoded** (mocks de dados)
- **Firebase config inline** com valores falsos
- **`framer-motion`** como dependência de animation
- **A ausência de `app.json`** — precisa ser criado do zero

### Riscos de manter este arquivo como base ⚠️

> **Veredicto:** usar `mobile/App.tsx` como base direta é **arriscado e contra-producente**. O arquivo é um monolito de 821 linhas misturando todos os componentes, telas, estilos e dados mock numa única função. Isso replica o problema mais grave da versão web (`Dashboard.tsx` com 4.365 linhas). Recomendo usar o arquivo apenas como **referência de UX e estilo**, e construir o repositório mobile do zero com arquitetura modular por features.

---

## 6. BACKEND E DADOS

### Fluxo de dados atual

```
Mobile App → Firebase SDK → Firestore (real-time)
Mobile App → fetch('/api/...') → Express Backend → Stripe / Resend / Gemini / Firebase Admin
```

### Endpoints críticos para o mobile

| Endpoint | Necessário no mobile? | Adaptação necessária |
|---|---|---|
| `POST /api/create-checkout-session` | ✅ Sim | Resposta muda: mobile usa `paymentSheet` em vez de redirect URL |
| `POST /api/webhook` | ✅ Sim (transparente) | Sem mudança — permanece no backend |
| `POST /api/admin/process-payout` | ⚠️ Apenas admin | Manter na web |
| `POST /api/send-email` | ✅ Sim | Sem mudança — mobile chama o mesmo endpoint |
| `POST /api/analyze-session` | ✅ Sim | Sem mudança — mobile chama o mesmo endpoint |

### Pontos de dependência crítica do mobile com o backend

1. **Criação de checkout Stripe**: a web hoje usa `window.location.href = data.url` (redirect). No mobile, a resposta precisa retornar o `paymentIntent.client_secret` para uso com `@stripe/stripe-react-native`'s Payment Sheet. **Requer nova rota ou adaptação do endpoint existente.**

2. **Firebase Admin no backend**: saldo de usuário só é alterado pelo backend via Firestore Admin SDK (webhook). Essa arquitetura está correta e deve ser mantida.

3. **Análise de sessão via Gemini**: o endpoint `/api/analyze-session` depende de transcrições salvas em Firestore. No mobile, a coleta de transcrições muda (Web Speech API → alternativa nativa). O endpoint de análise não muda.

### Inconsistências entre web e mobile

| Ponto | Web | Mobile atual | Risco |
|---|---|---|---|
| Firebase SDK version | `^12.11.0` | `^10.11.0` | Alto — APIs podem diferir |
| Auth provider | `signInWithPopup` (Google) | Não implementado | Alto |
| Firestore database ID | Custom (via env `VITE_FIREBASE_FIRESTORE_DATABASE_ID`) | `(default)` hardcoded | Alto — pode conectar no banco errado |
| Firestore queries | Queries compostas com índices | Não feitas | Alto |

---

## 7. RISCOS E DÍVIDA TÉCNICA

### ⛔ Críticos

1. **`Dashboard.tsx` com 4.365 linhas** — único arquivo com 30+ estados locais, 10+ useEffects, lógica de match, gamificação, financeiro, notificações e UI. Impossível migrar diretamente; necessita decomposição em services + hooks + components antes de qualquer migração.

2. **`SessionRoom.tsx` usa `window.SpeechRecognition`** — API exclusiva de browser. React Native não tem equivalente nativo padrão. Alternativas: `expo-speech` (limitado), `react-native-voice`, ou processamento server-side com Whisper.

3. **Jitsi Meet via `<iframe>`** — impossível no React Native. Requer `react-native-jitsi-meet-sdk` ou alternativa (Daily.co, LiveKit, Agora, 100ms). A troca de provider de vídeo é uma decisão arquitetural de alto impacto.

4. **Stripe Checkout via redirect** — usa `window.location.href` e URLs de sucesso/cancelamento. Profundamente incompatível com o modelo mobile. Deve ser reescrito com Stripe Payment Sheet nativo.

5. **Autenticação Google sem SDK nativo** — `signInWithPopup` abre uma janela popup do browser. Em React Native isso deve ser `@react-native-google-signin/google-signin` com `idToken` passado ao Firebase.

### ⚠️ Significativos

6. **Ausência de tipagem forte**: quase todo estado é `any[]`. Em React Native, erro de tipo em tempo de execução não aparece até o crash. Tipagem shared entre web e mobile é essencial.

7. **`sonner` para notificações**: a biblioteca não existe no React Native. Todo o sistema de notificações in-app (accept session, check-in, gorjeta recebida) precisa ser replanejaado com `react-native-toast-message` e push notifications reais.

8. **`confetti` e `framer-motion`**: ambas são dependências web-only. Animações de celebração devem usar `react-native-reanimated` ou `lottie-react-native`.

9. **Admin hardcoded por email**: `user?.email === 'fillipelustman@gmail.com'` está hardcoded tanto no `AuthContext.tsx` quanto nas Firestore rules. Funciona, mas é uma dívida de segurança que deve ser documentada.

10. **Gemini chamado diretamente do cliente**: `SessionRoom.tsx` linha 29 instancia `GoogleGenAI` com `process.env.GEMINI_API_KEY` diretamente no frontend. Isso expõe a chave no bundle. Em mobile isso seria pior — o bundle APK/IPA é extractável. **A chave deve estar apenas no backend.**

### ℹ️ Menores mas relevantes para mobile

11. `window.location`, `window.history`, `URLSearchParams` — usados em múltiplos lugares do Dashboard
12. Lembretes de sessão implementados via `setInterval` no cliente; no mobile isso não funciona em background
13. Seed aleatório para "Aura da Comunidade" é gerada localmente sem real-time sync real

---

## 8. GAP DE MIGRAÇÃO WEB → MOBILE

### ✅ Pode ser reaproveitado diretamente

| Item | Observação |
|---|---|
| Coleções e schema Firestore | Exatamente os mesmos |
| Regras de segurança Firestore | Compartilhadas |
| Endpoints do backend (server.ts) | Mantidos com adaptação mínima (Stripe) |
| Lógica de check-in diário | Portável 1:1 para um hook useCheckIn |
| Lógica de badges e gamificação | Portável 1:1 para um service de gamificação |
| `SESSION_THEMES` (constants.ts) | Compartilhável como pacote ou constant file |
| Mensagens motivacionais | Array portável |
| `UserProfile` interface | Portável como shared type |
| Lógica de priorização de match | Portável para um hook useMatchQueue |

### ⚠️ Pode ser reaproveitado parcialmente

| Item | O que muda |
|---|---|
| Lógica de Firestore queries | Remover partes web-específicas; manter queries |
| `AuthContext.tsx` | Remover `toast` (sonner), adaptar para contexto RN |
| `handleFirestoreError` | Trocar toast por logger + alert nativo |
| Sistema de lembretes | Do `setInterval` cliente para push notifications |
| Lógica de gorjeta | Trocar Stripe redirect por Payment Sheet |
| MoodPicker (mobile/App.tsx) | Adicionar persistência Firestore |

### 🔴 Precisa ser refeito do zero

| Item | Motivo |
|---|---|
| Autenticação Google | API nativa diferente |
| Sala de sessão / vídeo | Jitsi `<iframe>` → SDK nativo ou outro provider |
| Sistema de notificações | Browser toasts → push notifications nativas |
| Transcrição por IA | Web Speech API → alternativa nativa |
| Pagamentos Stripe | Checkout redirect → Payment Sheet SDK |
| Roteamento e navegação | react-router → react-navigation |
| Styling/CSS | Tailwind → StyleSheet + design system |
| Landing page | Não existe no mobile (substituída por onboarding) |

### 🔵 Precisa de validação com cliente antes de migrar

| Item | Por quê precisa de validação |
|---|---|
| Provider de videochamada | Jitsi (free) vs Daily.co/LiveKit/Agora (custo) |
| Push notifications | Firebase Cloud Messaging vs Expo Notifications |
| Transcr. IA em sessão | Feature essencial ou pode ser v2? |
| Sugestões Gemini em tempo real | Latência e custo em mobile |
| Painel admin no mobile? | Decidir se admin mobile é necessário |
| Disponibilidade para saque | Integração completa Stripe Connect vs manual? |

---

## 9. REQUISITOS MOBILE NATIVOS

### Permissões nativas necessárias

| Permissão | Para quê | iOS | Android |
|---|---|---|---|
| `NSMicrophoneUsageDescription` | Áudio da sessão | Obrigatório | Obrigatório |
| `NSCameraUsageDescription` | Vídeo da sessão | Obrigatório | Obrigatório |
| `NSUserNotificationsUsage` | Push notifications | Obrigatório | Obrigatório |
| `NSPhotoLibraryUsageDescription` | Upload de foto de perfil | Opcional | Opcional |

### Funcionalidades nativas necessárias

| Funcionalidade | Biblioteca recomendada | Prioridade |
|---|---|---|
| Push Notifications | `expo-notifications` | **Alta** |
| Google Sign-In | `@react-native-google-signin/google-signin` | **Alta** |
| Secure Storage (token Firebase) | `expo-secure-store` | **Alta** |
| Videochamada | `react-native-jitsi-meet-sdk` ou substituto | **Alta** |
| Stripe Payment Sheet | `@stripe/stripe-react-native` | **Alta** |
| Deep Linking | `expo-linking` | **Alta** |
| Haptic feedback | `expo-haptics` (já no repo) | Média |
| Background task (lembretes) | `expo-task-manager` + `expo-background-fetch` | Média |
| Image Picker | `expo-image-picker` | Média |
| Speech Recognition | `react-native-voice` ou `expo-speech` | Média |
| Analytics | `@react-native-firebase/analytics` | Média |
| Crash Reporting | `@react-native-firebase/crashlytics` | Média |
| In-App Review | `expo-store-review` | Baixa |
| App Tracking Transparency | `expo-tracking-transparency` | **Obrigatório iOS** |

### Compliance App Store / Google Play

| Requisito | Status atual | Ação necessária |
|---|---|---|
| `app.json` com `bundleIdentifier` e `package` | ❌ Ausente | Definir com cliente |
| Ícone 1024x1024 | ❌ Ausente | Gerar assets |
| Splash screen | ❌ Ausente | Criar |
| Privacy Policy URL | ⚠️ Indefinida | Criar página pública |
| App Tracking Transparency (iOS 14.5+) | ❌ Ausente | Para analytics |
| Data Safety Form (Google Play) | ❌ Ausente | Declarar uso de câmera, microfone, dados financeiros |
| Conteúdo de saúde mental | ⚠️ Atenção especial | Apple revisa apps de saúde mental com critérios extras |
| Página de suporte | ❌ Ausente | URL obrigatória nas stores |

> **⚠️ Alerta**: Apps de saúde mental recebem escrutínio maior na App Store (guideline 1.4.2). O Meu Best deve ter um disclaimer claro que **não é um serviço de saúde mental profissional**. Isso já existe na web e deve estar explícito no onboarding do app.

---

## 10. ARQUITETURA RECOMENDADA PARA O NOVO REPOSITÓRIO

### Estrutura de pastas

```
meubest-mobile/
├── app.json                    # Configuração Expo
├── app.config.ts               # Config dinâmica (env vars)
├── eas.json                    # EAS Build config
├── babel.config.js
├── tsconfig.json
├── .env                        # Variáveis locais (não commitado)
├── .env.example
│
├── src/
│   ├── app/                    # Ponto de entrada e providers
│   │   ├── index.tsx           # Root component
│   │   └── providers.tsx       # AuthProvider, ThemeProvider, etc.
│   │
│   ├── navigation/             # Configuração de rotas
│   │   ├── RootNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   ├── AppTabNavigator.tsx
│   │   └── types.ts            # RootStackParamList
│   │
│   ├── features/               # Módulos por domínio (feature-first)
│   │   ├── auth/
│   │   │   ├── screens/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── types.ts
│   │   │
│   │   ├── session/
│   │   │   ├── screens/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── types.ts
│   │   │
│   │   ├── matching/
│   │   ├── wallet/
│   │   ├── gamification/
│   │   ├── profile/
│   │   └── notifications/
│   │
│   ├── shared/                 # Código compartilhado entre features
│   │   ├── components/         # UI primitivos reutilizáveis
│   │   │   ├── Button/
│   │   │   ├── Card/
│   │   │   ├── Avatar/
│   │   │   ├── Badge/
│   │   │   └── ...
│   │   ├── hooks/              # Hooks genéricos (useDebounce, etc.)
│   │   ├── services/           # Firebase, API client
│   │   │   ├── firebase.ts
│   │   │   ├── api.ts          # fetch wrapper para o backend
│   │   │   └── notifications.ts
│   │   ├── stores/             # Estado global (Zustand)
│   │   └── utils/
│   │
│   ├── constants/
│   │   ├── themes.ts           # SESSION_THEMES portado da web
│   │   ├── config.ts           # APP_ENV e outras constantes
│   │   └── badges.ts           # BADGES_DATA portado da web
│   │
│   └── types/                  # Tipos compartilhados
│       ├── user.ts             # UserProfile (portado do AuthContext)
│       ├── session.ts
│       └── ...
│
├── assets/
│   ├── icon.png
│   ├── splash.png
│   └── adaptive-icon.png
```

### Gerenciamento de estado

| Escopo | Solução recomendada |
|---|---|
| Estado global leve (auth, profile) | **Zustand** — simples, sem boilerplate |
| Queries Firestore | **React hooks customizados** com `onSnapshot` |
| Cache de dados | **Zustand persist** com `AsyncStorage` |
| Estado local de UI | `useState` local por componente |
| Dados do servidor (REST) | **React Query (TanStack Query)** |

> Não recomendo Redux — overhead excessivo para esse tamanho de projeto.

### Estratégia de navegação

- **Stack Navigator** para fluxos lineares (auth, post-sessão)
- **Bottom Tab Navigator** para seções principais
- **Modal Stack** para a Sala de Sessão (tela cheia, bloqueia navegação)
- **`expo-linking`** para deep links a partir de push notifications

### Estratégia de tema / design system

```ts
// src/shared/theme.ts
export const theme = {
  colors: {
    primary: '#FF8C61',
    primaryDark: '#FF5C35',
    background: '#FDF8F5',
    surface: '#FFFFFF',
    dark: '#2D2D2D',
    text: '#333333',
    textMuted: '#999999',
    border: '#EAD7CC',
    success: '#4CAF50',
    danger: '#FF5252',
    info: '#64B5F6',
    warning: '#FFD54F',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  borderRadius: { sm: 12, md: 20, lg: 28, xl: 40 },
  typography: {
    title: { fontSize: 28, fontWeight: '900' },
    subtitle: { fontSize: 18, fontWeight: '800' },
    body: { fontSize: 15, fontWeight: '500' },
    caption: { fontSize: 12, fontWeight: '600' },
  }
}
```

### Tratamento de autenticação

```
App inicia → verificar token Firebase em SecureStore
  → token válido? → restaurar sessão → AppNavigator
  → sem token? → AuthNavigator
  → onAuthStateChanged → atualizar store Zustand
```

### Integração com Firebase

- SDK Firebase v12+ (alinhar com a versão web)
- Configuração via `app.config.ts` lendo variáveis de ambiente `EXPO_PUBLIC_*`
- Sem `firebase-admin` no mobile — toda operação privilegiada via backend
- `onSnapshot` encapsulado em hooks customizados com cleanup automático

---

## 11. PLANO DE EXECUÇÃO EM SPRINTS

### Sprint 0 — Auditoria e Definição (Esta entrega)
**Objetivo:** Alinhar decisões técnicas e arquiteturais antes de escrever código. 

**Tasks:**
- [x] Auditoria técnica completa do repositório atual
- [ ] Decisão sobre provider de videochamada (Jitsi vs alternativa)
- [ ] Definição de bundleIdentifier (iOS) e applicationId (Android)
- [ ] Definição de política de privacidade e página de suporte
- [ ] Confirmação do account Apple Developer e Google Play Console
- [ ] Alinhamento sobre feature scope do MVP mobile

**Dependências:** Aprovação do cliente nas decisões arquiteturais críticas.

**Riscos:** Sem decisão sobre videochamada, Sprint 4 não pode ser estimado.

**Critérios de pronto:** Todas as decisões acima respondidas e documentadas.

---

### Sprint 1 — Fundação do App (1 semana)
**Objetivo:** Repositório mobile funcionando com design system e CI básico.

**Tasks:**
- [ ] Criar repositório `meubest-mobile` em `C:\Users\carlo\OneDrive\Documentos\meubest-mobile`
- [ ] Inicializar com `npx create-expo-app` (template TypeScript)
- [ ] Configurar `babel.config.js` com `react-native-reanimated` plugin
- [ ] Criar `app.config.ts` com variáveis de ambiente via `EXPO_PUBLIC_*`
- [ ] Implementar design system (`theme.ts`) com todas as cores, espaçamentos e tipografia
- [ ] Criar componentes primitivos: `Button`, `Card`, `Avatar`, `Badge`, `Text`, `Input`
- [ ] Configurar Zustand e store base
- [ ] Configurar `tsconfig.json` com path aliases (`@features`, `@shared`, etc.)
- [ ] Instalar dependências core e verificar build no iOS Simulator e Android Emulator
- [ ] Criar assets: ícone, splash screen

**Dependências:** Decisões do Sprint 0.

**Riscos:** Compatibilidade de dependências com a versão do Expo SDK escolhida.

**Critérios de pronto:** `expo start` funciona, componentes primitivos renderizam no simulador.

---

### Sprint 2 — Autenticação e Navegação (1 semana)
**Objetivo:** Fluxo completo de autenticação com Firebase e navegação base funcionando.

**Tasks:**
- [ ] Integrar Firebase SDK v12 com configuração via env vars
- [ ] Implementar `@react-native-google-signin/google-signin`
- [ ] Criar `AuthNavigator` e `AppTabNavigator`
- [ ] Implementar `OnboardingScreen` (3 slides institucionais)
- [ ] Implementar `RoleSelectionScreen` (speaker ou listener)
- [ ] Implementar `LoginScreen` com botão Google Sign-In
- [ ] Criar `AuthContext` / Zustand auth store
- [ ] Implementar persistência de sessão com `expo-secure-store`
- [ ] Hook `useAuth()` e `useUserProfile()`
- [ ] Implementar logout com limpeza de store

**Dependências:** Sprint 1.

**Riscos:** Configuração do Google OAuth para iOS (requer GoogleService-Info.plist e URL scheme) e Android (requer google-services.json).

**Critérios de pronto:** Login com Google funciona, usuário persiste ao fechar o app, papel é selecionado e salvo no Firestore.

---

### Sprint 3 — Dashboard e Funcionalidades Core (2 semanas)
**Objetivo:** Telas principais funcionando com dados reais do Firestore.

**Tasks:**
- [ ] `HomeScreen` com dados reais: saldo de moedas, streak, mood picker (com persistência)
- [ ] `ProfileScreen` com dados reais do Firestore
- [ ] `SettingsScreen` com edição de perfil
- [ ] Toggle de status online (Firestore `users.isOnline`)
- [ ] `GamificationScreen` com pontos e badges reais
- [ ] `RankingScreen` com query top listeners ordenada
- [ ] `SessionsListScreen` com histórico de sessões
- [ ] `NotificationsService` com `expo-notifications` configurado
- [ ] Push token registrado no Firestore por usuário
- [ ] Afirmação diária e aura da comunidade (Firestore ou geração local)

**Dependências:** Sprint 2.

**Riscos:** Queries compostas Firestore podem exigir criação de índices no Console Firebase.

**Critérios de pronto:** Um listener e um speaker conseguem ver suas telas principais com dados reais.

---

### Sprint 4 — Sessões, Agendamento e Match (2 semanas)
**Objetivo:** Fluxo core de matching e sessão funcionando end-to-end.

**Tasks:**
- [ ] `MatchSearchScreen` — solicitar sessão imediata
- [ ] Listener de Firestore para `sessions pendentes` (role listener)
- [ ] `IncomingCallModal` com aceite/recusa real
- [ ] `ScheduleMatchScreen` — agendar com listener específico (calendário + slots)
- [ ] `ListenerProfileScreen` — detalhe de perfil antes de agendar
- [ ] `ConsentScreen` — termos de uso antes de entrar na sessão
- [ ] `VideoRoomScreen` — integração com provider de vídeo (Jitsi SDK ou alternativo)
- [ ] Controles de microfone e câmera nativos
- [ ] `PostSessionScreen` — avaliação com 5 estrelas + comentário
- [ ] Salvar review no Firestore
- [ ] Lógica de pontos/badges ao encerrar sessão (portada da web)
- [ ] Push notification para "sessão aceita" e "sua sessão começa em X"

**Dependências:** Sprint 3 + decisão sobre provider de vídeo (Sprint 0).

**Riscos:** O maior risco do projeto. Integração com SDK de videochamada pode levar mais tempo que estimado. Transcrição por IA é desconsiderada neste sprint (v2).

**Critérios de pronto:** Dois usuários conseguem realizar uma sessão de vídeo completa — do match ao pós-sessão — no dispositivo real.

---

### Sprint 5 — Recursos Nativos e Hardening (1 semana)
**Objetivo:** Sistema financeiro mobile, gorjetas e polimento de UX.

**Tasks:**
- [ ] Integrar `@stripe/stripe-react-native` com Payment Sheet
- [ ] Adaptar backend endpoint `/api/create-checkout-session` para retornar `paymentIntentClientSecret`
- [ ] `WalletScreen` com saldo e histórico de transações reais
- [ ] `TipScreen` — fluxo de gorjeta com Payment Sheet nativo
- [ ] `WithdrawalScreen` — solicitação de saque
- [ ] `StoreScreen` — loja de gratidão com moedas reais
- [ ] Background fetch para lembretes de sessão (expo-task-manager)
- [ ] Tratamento de estados offline (mensagem amigável)
- [ ] Crash reporting com Firebase Crashlytics
- [ ] Analytics básico (Firebase Analytics)
- [ ] App Tracking Transparency (iOS)
- [ ] Deep links configurados (Expo Linking)

**Dependências:** Sprint 4.

**Riscos:** Apple pode rejeitar app se o fluxo de gorjeta não atender às guidelines de In-App Purchase (verificar se se aplica).

**Critérios de pronto:** Fluxo financeiro completo funciona em dispositivo real. App não crasha em cenários comuns de erro.

---

### Sprint 6 — Store Readiness e Publicação (1 semana)
**Objetivo:** App publicado nas stores de forma técnica e de compliance.

**Tasks:**
- [ ] Configurar EAS Build (`eas.json`) para `preview` e `production`
- [ ] Build iOS com certificados Apple (Distribuição + Push)
- [ ] Build Android com keystore assinado
- [ ] Criar página de Política de Privacidade (URL pública)
- [ ] Criar página de Suporte (URL pública)
- [ ] Preencher Data Safety form (Google Play)
- [ ] Capturas de tela para as stores (pelo menos 3 por plataforma)
- [ ] Metadados das stores (descrição, keywords, categoria)
- [ ] Submeter para revisão TestFlight (iOS) e Google Play Internal Testing
- [ ] Homologação com grupo de usuários reais
- [ ] Submissão para produção nas stores

**Dependências:** Sprint 5.

**Riscos:** Apple pode levar 24-72h para revisão; pode pedir ajustes no disclaimer de saúde mental.

**Critérios de pronto:** App aprovado e publicado nas duas stores.

---

## 12. DECISÕES ARQUITETURAIS RECOMENDADAS

### ✅ O que recomendo FAZER

| Decisão | Justificativa |
|---|---|
| Criar repositório separado (`meubest-mobile`) | Evitar conflitos de dependência com a versão web |
| Usar Expo SDK mais recente (52 ou 53) | SDK 51 já está com suporte reduzido |
| Feature-first folder structure | Escala melhor que structure-first em projetos de médio porte |
| Zustand para estado global | Simples, performático, sem boilerplate excessivo |
| TypeScript estrito com interfaces compartilhadas | Evitar regressões em produção |
| Firebase SDK v12+ (alinhar com web) | Consistência de APIs |
| Mover Gemini API call para o backend | Segurança — nunca expor chaves no bundle mobile |
| `expo-notifications` para push | Mais simples que Firebase FCM direto em Expo |
| Stripe Payment Sheet nativo | Experiência superior + compliance PCI |
| Manter painel admin exclusivamente na web | Admin em mobile tem ROI baixo e alto custo de implementação |

### ❌ O que recomendo NÃO FAZER

| Decisão | Justificativa |
|---|---|
| Usar `mobile/App.tsx` como base direta | Monolito; replica o problema principal da web |
| Usar `framer-motion` em React Native | Completamente incompatível |
| Chamar Gemini API diretamente do mobile | Expõe chave de API no bundle |
| Usar `window.*`, `document.*` em código mobile | APIs não existem em React Native |
| Usar Stripe Checkout redirect em mobile | Fluxo quebra a UX nativa |
| Implementar painel admin no mobile | Custo vs benefício desfavorável |
| Usar `any` como tipo padrão | Anula os benefícios do TypeScript |
| Lógica de lembrete em `setInterval` | Não funciona em background no mobile |

### 🔵 Decisões que precisam de alinhamento com o cliente

| Decisão | Opções | Impacto |
|---|---|---|
| **Provider de videochamada** | Jitsi (grátis, SDK instável) vs Daily.co/LiveKit/Agora (pago) | Impacto direto no Sprint 4 e custo operacional |
| **Transcrição IA** | MVP sem IA → v2 com IA, ou incluir desde o início | Scope e complexidade do Sprint 4 |
| **Apple Developer Account** | Conta individual ($99/ano) ou empresa ($299/ano) | Requisito para publicação iOS |
| **Bundle IDs** | `br.com.meubest.app` (sugestão) | Não pode ser alterado após publicação |
| **Stripe Connect** | Saque manual (atual) vs Stripe Connect (automático) | Impacto no Sprint 5 e modelo financeiro |
| **In-App Purchase** | Apple pode exigir IAP para gorjetas em iOS (30% taxa) | Antes de desenvolver o fluxo de gorjetas |

### ⛔ Pontos que bloqueiam o início da implementação

1. **Decisão sobre provider de videochamada** — sem isso, a principal feature do app (sessão) não pode ser arquitetada
2. **Google Services files** — `GoogleService-Info.plist` (iOS) e `google-services.json` (Android) precisam ser gerados no Firebase Console e compartilhados com o desenvolvedor
3. **Firebase config real para o mobile** — o arquivo atual usa placeholders; a configuração real deve ser fornecida via variáveis de ambiente
4. **Apple Developer Account** — sem ela, não é possível testar em dispositivo real nem publicar

---

*Auditoria elaborada por Antigravity · Staff Engineer · Abril 2026*
*Repositório analisado: `fillipelustman/meubest` · Versão web + mobile/App.tsx*
