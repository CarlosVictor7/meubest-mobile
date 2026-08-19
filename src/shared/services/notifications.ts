/**
 * notifications — permissão, token, canais Android e toque em notificação.
 *
 * O que mudou em 19/08 (auditoria + GO):
 *
 *   • Canais Android com importância alta — sem canal, o Android 8+ joga tudo
 *     no default: sem heads-up, sem som de prioridade, e uma CHAMADA de
 *     acolhimento em tempo real aparecia silenciosamente na gaveta.
 *   • O toque passou a NAVEGAR (antes só imprimia no console) — inclusive no
 *     cold start, via `getLastNotificationResponseAsync`.
 *   • O token NUNCA mais aparece completo em log — é credencial de envio.
 */
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { maskToken } from '@shared/utils/maskToken';
import { buildNotificationRoute } from './notificationRouting';
import { requestNotificationNavigation } from '../../navigation/notificationNavigation';

/** Canal de chamadas imediatas — heads-up + som. */
export const CHANNEL_INCOMING_CALLS = 'acolhimento-chamadas';
/** Canal de sessões agendadas (criação + lembretes). */
export const CHANNEL_SCHEDULED_SESSIONS = 'acolhimento-sessoes';

// Comportamento em primeiro plano: banner + som, sem badge.
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
 * Cria os canais Android. Idempotente (o Android trata create como upsert de
 * mesmo id) e no-op em iOS/web — nenhuma API de canal é chamada fora do
 * Android, então o iOS segue exatamente como antes.
 */
export async function ensureNotificationChannelsAsync(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_INCOMING_CALLS, {
      name: 'Chamados de acolhimento',
      description: 'Alguém precisa conversar agora.',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_SCHEDULED_SESSIONS, {
      name: 'Sessões agendadas',
      description: 'Novas conversas agendadas e lembretes.',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  } catch (error) {
    // Canal é melhoria de entrega, não pré-requisito: sem ele a push ainda
    // chega (no canal default). Nunca derrubar o boot por isso.
    console.warn('[NotificationsService] Falha ao criar canais Android:', error);
  }
}

/**
 * Solicita permissões de notificação e obtém o Expo Push Token.
 * Retorna a string do token ou null em caso de falha, emulador ou negação.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    await ensureNotificationChannelsAsync();

    // 1. Verificar permissões existentes
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // 2. Se não concedido previamente, solicita ao usuário
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // 3. Permissão negada: encerra graciosamente
    if (finalStatus !== 'granted') {
      console.log('[NotificationsService] Permissão de notificações negada.');
      return null;
    }

    // 4. EAS Project ID do app.config.js
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('[NotificationsService] EAS Project ID não encontrado em Constants.');
    }

    // 5. Token do Expo — NUNCA logar o valor completo (credencial de envio).
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

    console.log(
      `[NotificationsService] Expo Push Token obtido: ${maskToken(tokenData.data)}`
    );
    return tokenData.data;
  } catch (error) {
    // Evita crashes em emuladores/simuladores sem suporte a Push
    console.error('[NotificationsService] Erro ao obter Expo Push Token:', error);
    return null;
  }
}

/** Traduz o payload em navegação — a decisão em si é pura e testada à parte. */
function handleNotificationTap(data: unknown, origin: string): void {
  const route = buildNotificationRoute(data);
  if (!route) {
    console.log(`[NotificationsService] Toque sem rota conhecida (${origin}).`);
    return;
  }
  console.log(`[NotificationsService] Toque em notificação (${origin}) → ${route.kind}`);
  requestNotificationNavigation(route);
}

/**
 * Toques com o app VIVO (foreground ou background → foreground).
 * O cold start é coberto por `consumeColdStartNotificationAsync`.
 */
export function registerNotificationResponseListener() {
  if (Platform.OS === 'web') {
    return null;
  }

  return Notifications.addNotificationResponseReceivedListener((response) => {
    try {
      handleNotificationTap(response.notification.request.content.data, 'listener');
    } catch (err) {
      console.error('[NotificationsService] Erro ao processar toque na notificação:', err);
    }
  });
}

/**
 * COLD START: a push abriu o app do zero — o toque aconteceu antes de qualquer
 * listener existir. Consulta a última resposta pendente e a transforma em
 * intenção de navegação; quem decide QUANDO navegar é o RootNavigator, via
 * `setNotificationNavigationReady` (nunca antes do bootstrap de auth/perfil).
 */
export async function consumeColdStartNotificationAsync(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const last = await Notifications.getLastNotificationResponseAsync();
    if (!last) return;
    handleNotificationTap(last.notification.request.content.data, 'cold-start');
  } catch (err) {
    console.warn('[NotificationsService] Falha ao ler notificação de cold start:', err);
  }
}
