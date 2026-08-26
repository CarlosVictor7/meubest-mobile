import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';

// ─── Auth Stack ───────────────────────────────────────────────────
export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
};

// ─── App Tabs ─────────────────────────────────────────────────────
// Os params aninhados existem para a navegação por notificação poder
// apontar uma tela dentro de uma aba (ex.: SessionsTab → SessionDetail).
export type AppTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  SessionsTab: NavigatorScreenParams<SessionsStackParamList> | undefined;
  /** Android apenas (FINANCIAL_FEATURES_ENABLED). */
  WalletTab: undefined;
  /** iOS apenas — ocupa o slot da Carteira no BottomNav (24/08). */
  ExploreTab: undefined;
  ProfileTab: undefined;
};

// ─── Explore Stack (aba do iOS) ───────────────────────────────────
export type ExploreStackParamList = {
  Explore: undefined;
};

// ─── Home Stack ───────────────────────────────────────────────────
export type HomeStackParamList = {
  Home: undefined;
  MatchSearch: {
    category: string;
    /** Chamada direcionada criada pelo Explorar — a sessão já existe. */
    directedSessionId?: string;
    /** Alvo da chamada direcionada — permite "tentar novamente" criar NOVA sessão. */
    listenerId?: string;
    /** Nome PÚBLICO do alvo ("Ana S."). */
    listenerName?: string;
  };
  /**
   * Descoberta de acolhedores. No Android é rota do HomeStack (aberta pelo
   * card da Home); no iOS a mesma tela vive na aba `ExploreTab` — ver ADR-006.
   */
  Explore: undefined;
  ListenerProfile: { listenerId: string };
  /**
   * `rebook` chega do "AGENDAR NOVAMENTE" no detalhe de uma sessão concluída.
   * Carrega os papéis ORIGINAIS: quem desabafou continua desabafando e quem
   * acolheu continua acolhendo, independentemente de quem apertou o botão.
   */
  ScheduleMatch: {
    listenerId?: string;
    rebook?: {
      sessionId: string;
      speakerId: string;
      listenerId: string;
      listenerName?: string;
      category?: string;
      duration?: number;
    };
  };
};

// ─── Session Modal Stack ──────────────────────────────────────────
export type SessionStackParamList = {
  Consent: { sessionId: string };
  VideoRoom: { sessionId: string };
  PostSession: { sessionId: string };
  TipAfterSession: { sessionId: string; fromCall?: boolean };
};

// ─── Sessions Tab Stack ───────────────────────────────────────────
export type SessionsStackParamList = {
  SessionsList: undefined;
  SessionDetail: { sessionId: string };
};

// ─── Wallet Stack ─────────────────────────────────────────────────
export type WalletStackParamList = {
  Wallet: undefined;
  Transactions: undefined;
  Tip: { sessionId: string; listenerId: string };
  Withdrawal: undefined;
};

// ─── Profile Stack ────────────────────────────────────────────────
export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Gamification: undefined;
  Ranking: undefined;
  /** Prévia do próprio perfil como terceiros o veem no Explorar (24/08). */
  ExplorePreview: undefined;
  Store: undefined;
  Settings: undefined;
};

// ─── Root ─────────────────────────────────────────────────────────
export type RootStackParamList = {
  /** Splash do gate de bootstrap — ver `useBootstrap`. */
  Bootstrap: undefined;
  Auth: undefined;
  ProfileForm: undefined;
  ProfileError: undefined;  // Tela de erro quando Firestore falha transitoriamente
  App: NavigatorScreenParams<AppTabParamList> | undefined;
  Session: { sessionId: string }; // Modal
};

// Screen props helpers
export type AuthScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;
export type HomeScreenProps<T extends keyof HomeStackParamList> =
  NativeStackScreenProps<HomeStackParamList, T>;
export type ProfileScreenProps<T extends keyof ProfileStackParamList> =
  NativeStackScreenProps<ProfileStackParamList, T>;
