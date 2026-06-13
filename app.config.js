const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = {
  name: IS_DEV ? 'Meu Best (Dev)' : 'Meu Best',
  slug: 'meubest',
  scheme: 'meubest',
  version: '1.0.1',
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
    bundleIdentifier: IS_DEV ? 'meu.best.dev' : 'meu.best',
    buildNumber: '1.0.4',
    infoPlist: {
      NSCameraUsageDescription: 'Meu Best usa sua câmera para sessões de apoio em vídeo.',
      NSMicrophoneUsageDescription: 'Meu Best usa seu microfone para sessões de apoio em áudio/vídeo.',
      NSPhotoLibraryUsageDescription: 'Meu Best usa sua galeria para você atualizar sua foto de perfil.',
      NSUserTrackingUsageDescription: 'Meu Best usa dados para melhorar sua experiência na plataforma.',
      ITSAppUsesNonExemptEncryption: false,
      UIBackgroundModes: ['audio'],
    },
    googleServicesFile: './GoogleService-Info.plist',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FDF8F5',
    },
    package: IS_DEV ? 'meu.best.dev' : 'meu.best',
    versionCode: 5,
    googleServicesFile: './google-services.json',
    permissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.INTERNET',
      'android.permission.VIBRATE',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.WAKE_LOCK',
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
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme: 'com.googleusercontent.apps.665557596754-7m76ie802scgi6edc338cs14u0ubt1sj'
      }
    ],
    [
      'expo-build-properties',
      {
        ios: {
          extraPods: [
            {
              name: 'GoogleUtilities',
              modular_headers: true
            },
            {
              name: 'RecaptchaInterop',
              modular_headers: true
            }
          ]
        }
      }
    ]
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
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    eas: {
      projectId: '95e68ac1-41fb-4954-b763-057c7f63c9c3',
    },
  },
};
