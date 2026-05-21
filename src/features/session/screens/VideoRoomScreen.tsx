import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera } from 'expo-camera';
import { WebView } from 'react-native-webview';
import { PhoneOff, ShieldCheck } from 'lucide-react-native';
import { doc, onSnapshot, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { db } from '@shared/services/firebase';
import { useAuth } from '@features/auth/hooks/useAuth';
import { colors, spacing, typography, borderRadius } from '@constants/theme';

// ─── JavaScript injetado na WebView para interceptar o hangup nativo do Jitsi ──
// Quando o usuário clica no botão vermelho nativo do Jitsi, dispara
// window.ReactNativeWebView.postMessage('JITSI_HANGUP')
// Funciona monitorando: evento jitsi 'readyToClose', evento 'videoConferenceLeft',
// e como fallback, clique no botão de hangup via MutationObserver.
const JITSI_HANGUP_BRIDGE_JS = `
(function() {
  // Previne execução dupla em hot reload
  if (window.__meubest_bridge_installed) return;
  window.__meubest_bridge_installed = true;

  function sendHangup() {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'JITSI_HANGUP',
        origin: 'jitsi_webview'
      }));
    } catch(e) {}
  }

  // Método 1: API do Jitsi iframe (para meet.jit.si público)
  // O Jitsi emite mensagens postMessage do tipo 'readyToClose' ou 'videoConferenceLeft'
  window.addEventListener('message', function(event) {
    try {
      var data = event.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch(e) {}
      }
      if (data && (data.action === 'readyToClose' || data.action === 'videoConferenceLeft')) {
        sendHangup();
      }
    } catch(e) {}
  });

  // Método 2: MutationObserver — observa quando o botão de hangup aparece e intercepta o clique
  // O botão nativo do Jitsi tem aria-label 'Leave the call' ou classe que contém 'hangup'
  function attachHangupListener() {
    var hangupBtn = document.querySelector('[data-testid="toolbar.hangup"]')
      || document.querySelector('[aria-label*="Leave"]')
      || document.querySelector('[aria-label*="Encerrar"]')
      || document.querySelector('[aria-label*="leave"]')
      || document.querySelector('.toolbox-button-red');
    
    if (hangupBtn && !hangupBtn.__meubest_listener) {
      hangupBtn.__meubest_listener = true;
      hangupBtn.addEventListener('click', function() {
        // Delay mínimo para Jitsi processar o clique antes de notificar o RN
        setTimeout(sendHangup, 300);
      }, true);
    }
  }

  // Observa mudanças no DOM para capturar o botão quando o Jitsi terminar de carregar
  var observer = new MutationObserver(function() {
    attachHangupListener();
  });
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  // Tentativa imediata
  attachHangupListener();

  // Método 3: Polling de fallback a cada 2s por 60s após carregamento
  var pollCount = 0;
  var poll = setInterval(function() {
    attachHangupListener();
    pollCount++;
    if (pollCount >= 30) clearInterval(poll);
  }, 2000);

  true; // Necessário para iOS
})();
`;

export function VideoRoomScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId } = route.params;
  const { profile, user } = useAuth();
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
  const [sessionStartTime] = useState(Date.now());
  const [elapsedText, setElapsedText] = useState('00:00');

  const webViewRef = useRef<WebView>(null);
  // Ref como guard: evita duplo encerramento pelo botão custom + botão nativo do Jitsi
  const isEndingCallRef = useRef(false);

  // ─── Timer da Sessão ────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - sessionStartTime) / 1000);
      const m = String(Math.floor(seconds / 60)).padStart(2, '0');
      const s = String(seconds % 60).padStart(2, '0');
      setElapsedText(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // ─── Solicitar Permissões Câmera e Microfone ──────────────────────────
  useEffect(() => {
    (async () => {
      const cameraStatus = await Camera.requestCameraPermissionsAsync();
      const micStatus = await Camera.requestMicrophonePermissionsAsync();
      const granted = cameraStatus.status === 'granted' && micStatus.status === 'granted';
      setHasPermissions(granted);
      if (!granted) {
        Alert.alert(
          'Permissões Necessárias',
          'Precisamos de acesso à câmera e microfone para realizar a chamada.',
          [{ text: 'Voltar', onPress: () => navigation.getParent()?.goBack() }]
        );
      }
    })();
  }, []);

  // ─── Encerrar sessão no Firestore (função centralizada) ──────────────
  // Guard isEndingCallRef impede duplo encerramento de qualquer origem.
  // Preenche: status, endedAt, endedBy, endReason, actualDuration.
  const completeSessionAndExit = useCallback(
    async (reason: 'user_hangup' | 'jitsi_native_hangup' | 'remote_completed' = 'user_hangup') => {
      if (isEndingCallRef.current) {
        console.log('[CallEnd Mobile] already ending — skipping duplicate');
        return;
      }
      isEndingCallRef.current = true;
      console.log('[CallEnd Mobile] button pressed / hangup triggered');
      console.log('[CallEnd Mobile] sessionId:', sessionId);
      console.log('[CallEnd Mobile] reason:', reason);

      // Revalida no Firestore antes de escrever (evita sobrescrever se remoto já encerrou)
      try {
        const snap = await getDoc(doc(db, 'sessions', sessionId));
        if (snap.exists() && snap.data().status === 'completed') {
          console.log('[CallEnd Mobile] session already completed in Firestore — navigating only');
          navigation.replace('PostSession', { sessionId });
          return;
        }
      } catch (e) {
        console.warn('[CallEnd Mobile] getDoc pre-check failed:', e);
      }

      const finalElapsedMinutes = Math.max(1, Math.floor((Date.now() - sessionStartTime) / 60000));

      try {
        console.log('[CallEnd Mobile] completing Firestore session...');
        await updateDoc(doc(db, 'sessions', sessionId), {
          status: 'completed',
          endedAt: serverTimestamp(),
          endedBy: user?.uid ?? null,
          endReason: reason,
          actualDuration: finalElapsedMinutes,
          completedAt: serverTimestamp(),
        });
        console.log('[CallEnd Mobile] Firestore update success — status:completed written');

        // Fallback de navegação caso o onSnapshot demore
        setTimeout(() => {
          if (isEndingCallRef.current) {
            console.log('[CallEnd Mobile] navigating to PostSession (fallback timer)');
            navigation.replace('PostSession', { sessionId });
          }
        }, 1500);
      } catch (error) {
        console.error('[CallEnd Mobile] Firestore update FAILED:', error);
        Alert.alert('Erro', 'Não foi possível encerrar a chamada no momento.');
        isEndingCallRef.current = false;
      }
    },
    [sessionId, sessionStartTime, user?.uid, navigation]
  );

  // ─── Listener do Documento da Sessão ──────────────────────────────────
  // Quando o OUTRO lado encerra (status='completed'), este lado reage e navega.
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'sessions', sessionId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setSession({ id: snap.id, ...data });

          if (
            data.status === 'completed' ||
            data.status === 'rejected' ||
            data.status === 'cancelled'
          ) {
            if (!isEndingCallRef.current) {
              // Encerrado pelo outro lado (remote)
              console.log('[CallEnd Mobile] remote completed detected — navigating to PostSession');
              isEndingCallRef.current = true;
            } else {
              console.log('[CallEnd Mobile] own completion confirmed in Firestore');
            }
            navigation.replace('PostSession', { sessionId });
          }
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [sessionId, navigation]);

  // ─── Prevenir BackButton físico do Android ──────────────────────────
  useEffect(() => {
    const onBackPress = () => {
      Alert.alert(
        'Sair da Chamada?',
        'Você deseja encerrar esta sessão de apoio?',
        [
          { text: 'Continuar', style: 'cancel' },
          {
            text: 'Encerrar',
            onPress: () => {
              console.log('[CallEnd] custom end pressed (back button)');
              completeSessionAndExit('user_hangup');
            },
            style: 'destructive',
          },
        ]
      );
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [completeSessionAndExit]);

  // ─── Receber mensagem da WebView (ponte Jitsi → RN) ──────────────────
  const handleWebViewMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'JITSI_HANGUP') {
          console.log('[CallEnd] jitsi native hangup detected');
          completeSessionAndExit('jitsi_native_hangup');
        }
      } catch (_) {}
    },
    [completeSessionAndExit]
  );

  if (hasPermissions === null || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Conectando ao canal seguro...</Text>
      </View>
    );
  }

  if (hasPermissions === false) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Acesso à câmera/microfone negado.</Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.getParent()?.goBack()}>
          <Text style={styles.cancelBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── URL do Jitsi ──────────────────────────────────────────────────
  const jitsiDomain = process.env.EXPO_PUBLIC_JITSI_DOMAIN ?? 'meet.jit.si';
  const jitsiBaseUrl = jitsiDomain.startsWith('http') ? jitsiDomain : `https://${jitsiDomain}`;
  const jitsiRoomName = session?.jitsiRoomName || `EscutaAtiva_${sessionId}`;
  const displayName = encodeURIComponent(profile?.name || 'Acolhedor/Ouvinte');
  const jitsiUrl = `${jitsiBaseUrl}/${jitsiRoomName}#config.prejoinPageEnabled=false&config.disableDeepLinking=true&interfaceConfig.MOBILE_APP_PROMO=false&interfaceConfig.TOOLBAR_BUTTONS=["microphone","camera","closedcaptions","desktop","fullscreen","fittowindow","hangup","profile","chat","settings","videoquality","filmstrip","feedback","stats","shortcuts","tileview","videobackgroundblur","download","help","mute-everyone","security"]&userInfo.displayName="${displayName}"`;

  // Header compacto posicionado abaixo do status bar/notch, não cobre controles do Jitsi
  const headerTop = insets.top + 12;

  return (
    // edges vazio: o Jitsi ocupa 100% da tela (incluindo área de notch e bottom)
    // O header flutua acima via position absolute, dentro da área segura
    <SafeAreaView style={styles.root} edges={[]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Área de Vídeo (WebView) — 100% da tela ── */}
      <View style={styles.videoContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: jitsiUrl }}
          style={styles.webview}
          originWhitelist={['*']}
          mediaPlaybackRequiresUserAction={false}
          domStorageEnabled={true}
          javaScriptEnabled={true}
          allowFileAccess={true}
          allowsInlineMediaPlayback={true}
          setSupportMultipleWindows={false}
          // Injeta o script ANTES do content para garantir que os listeners estejam prontos
          injectedJavaScriptBeforeContentLoaded={JITSI_HANGUP_BRIDGE_JS}
          onMessage={handleWebViewMessage}
          onShouldStartLoadWithRequest={(request) => {
            const url = request.url || '';
            console.log('[JitsiWebView] Trying to load URL:', url);
            if (
              url.startsWith('intent://') ||
              url.startsWith('market://') ||
              url.includes('play.google.com') ||
              url.includes('itunes.apple.com') ||
              url.startsWith('whatsapp://') ||
              url.startsWith('tel:') ||
              url.startsWith('mailto:')
            ) {
              console.log('[JitsiWebView] Blocked external navigation:', url);
              return false;
            }
            const allowedDomain = process.env.EXPO_PUBLIC_JITSI_DOMAIN ?? 'meet.jit.si';
            const isAllowed =
              url.includes(allowedDomain) ||
              url.startsWith('about:blank') ||
              url.startsWith('blob:');
            if (!isAllowed) {
              console.log('[JitsiWebView] Blocked non-jitsi domain navigation:', url);
              return false;
            }
            return true;
          }}
          {...{
            onPermissionRequest: (request: any) => {
              request.grant(request.resources);
            },
          } as any}
        />
      </View>

      {/* ── Header compacto flutuante superior ──────────────────────
          - position: absolute para não empurrar o Jitsi
          - top: insets.top + 12 → fica abaixo do status bar/notch
          - NÃO cobre os controles inferiores do Jitsi
          - zIndex alto para ficar acima do WebView
          ────────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.header,
          { top: headerTop },
        ]}
        pointerEvents="box-none"
      >
        {/* Lado esquerdo: ícone + tema + timer */}
        <View style={styles.headerLeft} pointerEvents="none">
          <View style={styles.shieldBadge}>
            <ShieldCheck size={14} color={colors.primary} strokeWidth={2} />
          </View>
          <View>
            <Text style={styles.categoryLabel} numberOfLines={1}>
              {session?.category || 'Sessão de Apoio'}
            </Text>
            <Text style={styles.timerLabel}>{elapsedText} · Segura</Text>
          </View>
        </View>

        {/* Botão Encerrar */}
          <TouchableOpacity
            style={styles.endCallBtn}
            onPress={() => {
              console.log('[CallEnd Mobile] button pressed (header)');
              completeSessionAndExit('user_hangup');
            }}
            activeOpacity={0.8}
          >
          <PhoneOff size={13} color={colors.textInverted} strokeWidth={2.2} />
          <Text style={styles.endCallText}>ENCERRAR</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
  },
  loadingText: {
    marginTop: spacing.md,
    color: '#FF8C61',
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: spacing.xl,
  },
  errorText: {
    color: '#EF4444',
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  cancelBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  cancelBtnText: {
    color: colors.textInverted,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.base,
  },

  // ── Vídeo ──────────────────────────────────────────────────────────
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },

  // ── Header superior flutuante ─────────────────────────────────────
  header: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 52,
    backgroundColor: 'rgba(10, 10, 10, 0.82)',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm + 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    // Sombra para destacar sobre o Jitsi
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 12,
    zIndex: 999,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 2,
    flex: 1,
    marginRight: spacing.sm,
  },
  shieldBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: `${colors.primary}18`,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryLabel: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    textTransform: 'capitalize',
    maxWidth: 160,
  },
  timerLabel: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 10,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.2,
  },
  endCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    borderRadius: borderRadius.full,
    paddingVertical: 7,
    paddingHorizontal: spacing.sm + 4,
    gap: 5,
    minWidth: 96,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  endCallText: {
    color: colors.textInverted,
    fontWeight: typography.weight.black,
    fontSize: 10,
    letterSpacing: 0.7,
  },
});
