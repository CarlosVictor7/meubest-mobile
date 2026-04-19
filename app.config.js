const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = {
  name: IS_DEV ? 'Meu Best (Dev)' : 'Meu Best',
  slug: 'meubest',
  scheme: 'meubest',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#FDF8F5',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: IS_DEV ? 'br.com.meubest.app.dev' : 'br.com.meubest.app',
    infoPlist: {
      NSCameraUsageDescription: 'Meu Best usa sua câmera para sessões de apoio em vídeo.',
      NSMicrophoneUsageDescription: 'Meu Best usa seu microfone para sessões de apoio em áudio/vídeo.',
      NSPhotoLibraryUsageDescription: 'Meu Best usa sua galeria para você atualizar sua foto de perfil.',
      NSUserTrackingUsageDescription: 'Meu Best usa dados para melhorar sua experiência na plataforma.',
    },
    // googleServicesFile: './GoogleService-Info.plist',  // Uncomment when file is added
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FDF8F5',
    },
    package: IS_DEV ? 'br.com.meubest.app.dev' : 'br.com.meubest.app',
    // googleServicesFile: './google-services.json',  // Uncomment when file is added
    permissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.INTERNET',
      'android.permission.VIBRATE',
      'android.permission.RECEIVE_BOOT_COMPLETED',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-secure-store',
    'expo-web-browser',
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#FF8C61',
        sounds: [],
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'O Meu Best precisa de acesso à sua galeria para atualizar sua foto de perfil.',
      },
    ],
  ],
  extra: {
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    firebaseFirestoreDatabaseId: process.env.EXPO_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID || '(default)',
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
    stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    },
  },
};
