import Constants from 'expo-constants';

interface AppConfig {
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    firestoreDatabaseId: string;
  };
  apiUrl: string;
  stripePublishableKey: string;
  googleWebClientId: string;
  easProjectId: string;
}

const extra = Constants.expoConfig?.extra ?? {};

export const appConfig: AppConfig = {
  firebase: {
    apiKey: extra.firebaseApiKey ?? '',
    authDomain: extra.firebaseAuthDomain ?? '',
    projectId: extra.firebaseProjectId ?? '',
    storageBucket: extra.firebaseStorageBucket ?? '',
    messagingSenderId: extra.firebaseMessagingSenderId ?? '',
    appId: extra.firebaseAppId ?? '',
    firestoreDatabaseId: extra.firebaseFirestoreDatabaseId ?? '(default)',
  },
  apiUrl: extra.apiUrl ?? 'http://localhost:3000',
  stripePublishableKey: extra.stripePublishableKey ?? '',
  googleWebClientId: extra.googleWebClientId ?? '',
  easProjectId: extra.eas?.projectId ?? '',
};
