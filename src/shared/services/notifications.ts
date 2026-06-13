import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Configura o comportamento padrão das notificações quando o app está em primeiro plano (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Solicita permissões de notificação e obtém o Expo Push Token.
 * Retorna a string do token ou null em caso de falha, emulador ou negação de permissão.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    // 1. Verificar permissões de notificação existentes
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // 2. Se não concedido previamente, solicita a permissão ao usuário
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // 3. Se a permissão foi negada, encerra graciosamente
    if (finalStatus !== 'granted') {
      console.log('[NotificationsService] Permissão de notificações negada.');
      return null;
    }

    // 4. Obtém o EAS Project ID configurado no app.config.js
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('[NotificationsService] EAS Project ID não encontrado em Constants.');
    }

    // 5. Solicita o token do Expo
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    console.log('[NotificationsService] Expo Push Token obtido:', tokenData.data);
    return tokenData.data;
  } catch (error) {
    // Evita crashes em emuladores/simuladores sem suporte a Push
    console.error('[NotificationsService] Erro ao obter Expo Push Token:', error);
    return null;
  }
}

/**
 * Registra um listener para capturar cliques/interações do usuário com a notificação
 */
export function registerNotificationResponseListener() {
  if (Platform.OS === 'web') {
    return null;
  }

  return Notifications.addNotificationResponseReceivedListener((response) => {
    try {
      const data = response.notification.request.content.data;
      console.log('[NotificationsService] Notificação aberta pelo usuário:', data);
      
      if (!data) return;

      const type = data.type;
      const sessionId = data.sessionId;

      if (type === 'incoming_support_request' && sessionId) {
        console.log(`[NotificationsService] Usuário clicou em um chamado de acolhimento. Sessão: ${sessionId}`);
      } else if (type === 'scheduled_session_reminder' && sessionId) {
        console.log(`[NotificationsService] Usuário clicou no lembrete de sessão agendada. Sessão: ${sessionId}`);
      }
    } catch (err) {
      console.error('[NotificationsService] Erro ao processar clique na notificação:', err);
    }
  });
}
