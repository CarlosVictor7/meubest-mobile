import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// ─── Auth Stack ───────────────────────────────────────────────────
export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
};

// ─── App Tabs ─────────────────────────────────────────────────────
export type AppTabParamList = {
  HomeTab: undefined;
  SessionsTab: undefined;
  WalletTab: undefined;
  ProfileTab: undefined;
};

// ─── Home Stack ───────────────────────────────────────────────────
export type HomeStackParamList = {
  Home: undefined;
  MatchSearch: { category: string };
  ListenerProfile: { listenerId: string };
  ScheduleMatch: { listenerId?: string };
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
  Store: undefined;
  Settings: undefined;
};

// ─── Root ─────────────────────────────────────────────────────────
export type RootStackParamList = {
  Auth: undefined;
  ProfileForm: undefined;
  App: undefined;
  Session: { sessionId: string }; // Modal
};

// Screen props helpers
export type AuthScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;
export type HomeScreenProps<T extends keyof HomeStackParamList> =
  NativeStackScreenProps<HomeStackParamList, T>;
export type ProfileScreenProps<T extends keyof ProfileStackParamList> =
  NativeStackScreenProps<ProfileStackParamList, T>;
