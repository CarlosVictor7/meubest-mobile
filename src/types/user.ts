// Core types shared across web and mobile
// Ported from src/AuthContext.tsx in the web repo

export type UserRole = 'speaker' | 'listener' | 'admin';

export interface BankDetails {
  pix?: string;
  bankName?: string;
  accountNumber?: string;
  pixKeyType?: string;
}


export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  bio?: string;
  city?: string;
  religion?: string;
  gender?: string;
  ageRange?: string;
  interests?: string[];
  cameraPreference?: string;
  balance?: number;
  totalEarnings?: number;
  rating?: number;
  isProfileComplete?: boolean;
  showTutorial?: boolean;
  isOnline?: boolean;
  gratitudeCoins?: number;
  currentStreak?: number;
  lastCheckIn?: string;
  badges?: string[];
  points?: number;
  level?: number;
  sessionsCount?: number;
  referralCount?: number;
  referralCode?: string;
  rewardBalance?: number;
  availability?: { [date: string]: string[] };
  bankDetails?: BankDetails;
  photoURL?: string;
  createdAt?: string;
  updatedAt?: string;
  isAdult?: boolean;
  pushToken?: string;
  pushTokenPlatform?: string;
  pushTokenUpdatedAt?: string;
}
