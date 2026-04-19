import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/features/auth/services/AuthProvider';
import { RootNavigator } from './src/navigation/RootNavigator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 60_000, // 1 minuto
    },
  },
});

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="auto" />
          <RootNavigator />
          <Toast />
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
