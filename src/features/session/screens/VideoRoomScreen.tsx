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
  Modal,
  ScrollView,
  TextInput,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera } from 'expo-camera';
import { WebView } from 'react-native-webview';
import { Gift, ShieldAlert } from 'lucide-react-native';
import {
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  getDoc,
  addDoc,
  collection,
} from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { db } from '@shared/services/firebase';
import { useAuth } from '@features/auth/hooks/useAuth';
import { colors, spacing, typography, borderRadius } from '@constants/theme';
import { InCallTipModal } from '@features/session/components/InCallTipModal';

// ─── JavaScript injetado na WebView — Bridge Jitsi → React Native ──────────
// Detecta:
//   1. Hangup (botão vermelho) → envia JITSI_HANGUP
//   2. Entrada real na reunião → envia JITSI_JOINED (multi-sinal robusto)
//
// Estratégia de JOINED:
//   - Eventos postMessage do Jitsi: videoConferenceJoined / conferenceJoined
//   - DOM guard: ausência de prejoin + presença de UI de conferência real
//   - Polling periódico por até 120s
//   - MutationObserver para capturar mudança de estado do DOM
const JITSI_HANGUP_BRIDGE_JS = `
(function() {
  if (window.__MEUBEST_BRIDGE) return;
  window.__MEUBEST_BRIDGE = true;
  window.__MEUBEST_JOINED = false;

  // ── Enviar hangup para o RN ───────────────────────────────────────
  function sendHangup() {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'JITSI_HANGUP', origin: 'jitsi_webview' }));
    } catch(e) {}
  }

  // ── Enviar JOINED para o RN (uma única vez) ───────────────────────
  function sendJoined() {
    if (window.__MEUBEST_JOINED) return;
    window.__MEUBEST_JOINED = true;
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'JITSI_JOINED' }));
    } catch(e) {}
  }

  // ── Detectar tela de prejoin ──────────────────────────────────────
  function isPrejoinVisible() {
    try {
      if (document.querySelector('[data-testid="prejoin.joinMeeting"]')) return true;
      if (document.querySelector('.prejoin-preview-dropdown-btns')) return true;
      if (document.querySelector('.prejoin-input-area')) return true;
      if (document.querySelector('[aria-label*="Join meeting"]')) return true;

      // Busca botões que contenham o texto 'join meeting'
      var buttons = document.querySelectorAll('button');
      for (var i = 0; i < buttons.length; i++) {
        var btnText = buttons[i].textContent || buttons[i].innerText || '';
        if (btnText.toLowerCase().indexOf('join meeting') !== -1) {
          return true;
        }
      }
    } catch(e) {}
    return false;
  }

  // ── Detectar UI real de conferência ──────────────────────────────
  function hasConferenceUi() {
    try {
      if (document.querySelector('[data-testid="toolbar.hangup"]')) return true;
      if (document.querySelector('.toolbox-button-red')) return true;
      if (document.querySelector('.filmstrip')) return true;
      if (document.querySelector('#filmstripRemoteVideos')) return true;
      if (document.querySelector('[data-testid="filmstrip"]')) return true;
      if (document.querySelector('[aria-label*="Leave"]')) return true;
      if (document.querySelector('[aria-label*="Encerrar"]')) return true;
    } catch(e) {}
    return false;
  }

  // ── Lógica de emissão de JOINED ──────────────────────────────────
  function tryEmitJoined() {
    if (window.__MEUBEST_JOINED) return;
    if (!isPrejoinVisible() && hasConferenceUi()) {
      // Dupla confirmação após 1.5s para evitar falso positivo transitório
      setTimeout(function() {
        if (!window.__MEUBEST_JOINED && !isPrejoinVisible() && hasConferenceUi()) {
          sendJoined();
        }
      }, 1500);
    }
  }

  // ── Eventos postMessage do Jitsi ──────────────────────────────────
  window.addEventListener('message', function(event) {
    try {
      var data = event.data;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch(e) {} }
      if (!data) return;
      // Hangup
      if (data.action === 'readyToClose' || data.action === 'videoConferenceLeft') {
        sendHangup();
      }
      // Joined (sinal primário — mais confiável)
      if (data.action === 'videoConferenceJoined' || data.action === 'conferenceJoined' || data.action === 'participantJoined') {
        // Confirma que não estamos em prejoin antes de emitir
        if (!isPrejoinVisible()) {
          sendJoined();
        } else {
          // Se ainda estiver em prejoin, tenta de novo após 2s
          setTimeout(tryEmitJoined, 2000);
        }
      }
    } catch(e) {}
  });

  // ── Anexar listener ao botão de hangup ───────────────────────────
  function attachHangupListener() {
    var hangupBtn = document.querySelector('[data-testid="toolbar.hangup"]')
      || document.querySelector('[aria-label*="Leave"]')
      || document.querySelector('[aria-label*="Encerrar"]')
      || document.querySelector('[aria-label*="leave"]')
      || document.querySelector('.toolbox-button-red');
    if (hangupBtn && !hangupBtn.__meubest_listener) {
      hangupBtn.__meubest_listener = true;
      hangupBtn.addEventListener('click', function() {
        setTimeout(sendHangup, 300);
      }, true);
    }
  }

  // ── Anexar listener ao botão de join meeting (prejoin) ───────────
  function attachPrejoinListener() {
    try {
      var joinBtn = document.querySelector('[data-testid="prejoin.joinMeeting"]')
        || document.querySelector('[aria-label*="Join meeting"]')
        || document.querySelector('.prejoin-input-area button');

      if (!joinBtn) {
        var buttons = document.querySelectorAll('button');
        for (var i = 0; i < buttons.length; i++) {
          var btnText = buttons[i].textContent || buttons[i].innerText || '';
          if (btnText.toLowerCase().indexOf('join meeting') !== -1) {
            joinBtn = buttons[i];
            break;
          }
        }
      }

      if (joinBtn && !joinBtn.__meubest_prejoin_listener) {
        joinBtn.__meubest_prejoin_listener = true;
        joinBtn.addEventListener('click', function() {
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'JITSI_JOIN_CLICKED' }));
          } catch(e) {}
        }, true);
      }
    } catch(e) {}
  }

  // ── Cliques na tela ───────────────────────────────────────────────
  document.addEventListener('click', function() {
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'JITSI_CLICKED' })); } catch(e) {}
  }, true);
  document.addEventListener('touchstart', function() {
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'JITSI_CLICKED' })); } catch(e) {}
  }, { passive: true, capture: true });

  // ── MutationObserver — detecta mudanças de estado do DOM ─────────
  var mutationObserver = new MutationObserver(function() {
    attachHangupListener();
    attachPrejoinListener();
    tryEmitJoined();
  });
  mutationObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });

  // ── Polling de fallback — a cada 2s por até 120s ──────────────────
  var pollCount = 0;
  var pollMax = 60; // 60 * 2s = 120s
  var pollInterval = setInterval(function() {
    attachHangupListener();
    attachPrejoinListener();
    tryEmitJoined();
    pollCount++;
    if (pollCount >= pollMax || window.__MEUBEST_JOINED) {
      clearInterval(pollInterval);
    }
  }, 2000);

  // ── Tentativa imediata ────────────────────────────────────────────
  attachHangupListener();
  attachPrejoinListener();
  tryEmitJoined();

  true; // Necessário para iOS
})();
`;

// ─── CSS injetado na WebView após carregamento (onLoadEnd) ───────────────────
// Tarefas 2, 3 e 4:
//   - Oculta o header/subject da sala do Jitsi (barra superior com nome da sala)
//   - Oculta o watermark/logo do Jitsi
//   - Adiciona safe area padding-top no painel de chat (iOS Dynamic Island/notch)
// Recebe safeAreaTop como parâmetro para não depender de estado do React.
function buildJitsiCleanupCss(safeAreaTop: number): string {
  return `
(function(topInset) {
  if (window.__MEUBEST_CSS) return;
  window.__MEUBEST_CSS = true;

  var style = document.createElement('style');
  style.id = '__meubest_cleanup';
  style.innerHTML = [
    /* ── Ocultar header/subject da sala (barra superior do Jitsi) ── */
    '.subject { display: none !important; }',
    '.subject-info-container { display: none !important; }',
    '[data-testid="subject"] { display: none !important; }',
    '#subject { display: none !important; }',
    '.jitsi-branding-container { display: none !important; }',
    /* ── Ocultar watermark/logo Jitsi ── */
    '.watermark { display: none !important; }',
    '.leftwatermark { display: none !important; }',
    '.rightwatermark { display: none !important; }',
    '#jitsiWatermark { display: none !important; }',
    'a[href*="jitsi"] img { display: none !important; }',
    '.poweredby { display: none !important; }',
    /* ── Safe area do chat (iOS Dynamic Island / notch) ── */
    '.chat-panel { padding-top: ' + topInset + 'px !important; box-sizing: border-box !important; }',
    '.chat-header { padding-top: ' + topInset + 'px !important; box-sizing: border-box !important; }',
    '[class*="chatHeader"] { padding-top: ' + topInset + 'px !important; box-sizing: border-box !important; }',
    '[data-testid="chat-panel-header"] { padding-top: ' + topInset + 'px !important; box-sizing: border-box !important; }',
    '.sidebarHeader { padding-top: ' + topInset + 'px !important; box-sizing: border-box !important; }'
  ].join(' ');

  (document.head || document.documentElement).appendChild(style);
  true;
})(${safeAreaTop});
`;
}

const REPORT_REASONS = [
  'Abuso / Assédio',
  'Racismo',
  'Discriminação',
  'Linguagem Imprópria',
  'Outros',
] as const;

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

  // Oculta a WebView imediatamente ao encerrar, evitando flash da home do Jitsi
  const [webViewVisible, setWebViewVisible] = useState(true);
  const [hasJoinedMeeting, setHasJoinedMeeting] = useState(false);

  // ─── Estado de denúncia ──────────────────────────────────────────────
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportComment, setReportComment] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // ─── Estado de Gorjeta (In-Call) ─────────────────────────────────────
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);

  const webViewRef = useRef<WebView>(null);
  // Ref como guard: evita duplo encerramento pelo botão custom + botão nativo do Jitsi
  const isEndingCallRef = useRef(false);
  const overlayFallbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Overlay inferior (gorjeta/denúncia) — auto-hide ──────────────────
  // Auto-hide temporariamente desativado para garantir visibilidade 100% durante a chamada.
  
  const showOverlay = useCallback(() => {
    // Mantido como função vazia para evitar quebras em chamadas antigas.
  }, []);

  const markMeetingJoined = useCallback((source: string) => {
    console.log('[JITSI_OVERLAY] joined via:', source);
    setHasJoinedMeeting(true);
  }, []);

  // ─── Determinar papel do usuário na sessão ───────────────────────────
  // isCurrentUserSpeaker: usa speakerId do Firestore como fonte de verdade.
  // Nunca usa profile.role para lógica de exibição — evita race condition
  // quando o usuário muda de papel entre sessões.
  const isCurrentUserSpeaker = session != null && user != null && session.speakerId === user.uid;

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

  // ─── Limpar temporizador fallback ao desmontar a tela ────────────────
  useEffect(() => {
    return () => {
      if (overlayFallbackTimerRef.current) {
        clearTimeout(overlayFallbackTimerRef.current);
        overlayFallbackTimerRef.current = null;
      }
    };
  }, []);

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
  // webViewVisible=false oculta WebView imediatamente (evita flash da home do Jitsi).
  const completeSessionAndExit = useCallback(
    async (reason: 'user_hangup' | 'jitsi_native_hangup' | 'remote_completed' = 'user_hangup') => {
      if (isEndingCallRef.current) {
        console.log('[CallEnd Mobile] already ending — skipping duplicate');
        return;
      }
      isEndingCallRef.current = true;

      // Ocultar WebView imediatamente para evitar flash da home do Jitsi
      setWebViewVisible(false);

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
        setWebViewVisible(true); // Restaura WebView se falhou
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
              setWebViewVisible(false); // Oculta WebView também no encerramento remoto
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

  // Fallback anti-loading infinito no Mobile
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    if (!webViewVisible && isEndingCallRef.current) {
      console.log('[VideoRoom Mobile] anti-loading guard started (8s)');
      timeout = setTimeout(() => {
        console.warn('[VideoRoom Mobile] anti-loading fallback triggered! Forcing navigation.');
        navigation.replace('PostSession', { sessionId });
      }, 8000);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [webViewVisible, sessionId, navigation]);

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
        const raw = event.nativeEvent.data;
        let typeVal = '';
        let dataObj: any = null;

        try {
          dataObj = JSON.parse(raw);
          typeVal = dataObj?.type || '';
        } catch (_) {
          typeVal = typeof raw === 'string' ? raw : '';
        }

        const isJoined = typeVal === 'JITSI_JOINED' || raw === 'JITSI_JOINED' || dataObj === 'JITSI_JOINED';
        const isJoinClicked = typeVal === 'JITSI_JOIN_CLICKED' || raw === 'JITSI_JOIN_CLICKED' || dataObj === 'JITSI_JOIN_CLICKED';
        const isHangup = typeVal === 'JITSI_HANGUP' || raw === 'JITSI_HANGUP' || dataObj === 'JITSI_HANGUP';

        if (isHangup) {
          console.log('[CallEnd] jitsi native hangup detected');
          completeSessionAndExit('jitsi_native_hangup');
        } else if (isJoined) {
          markMeetingJoined('bridge_joined');
        } else if (isJoinClicked) {
          console.log('[VideoRoom] JITSI_JOIN_CLICKED received — starting 2.5s fallback timer to set hasJoinedMeeting=true');
          setTimeout(() => {
            if (webViewVisible && !isEndingCallRef.current) {
              markMeetingJoined('bridge_join_clicked_2500ms');
            }
          }, 2500);
        }
        // JITSI_CLICKED ignorado — auto-hide desativado
      } catch (_) {}
    },
    [completeSessionAndExit, webViewVisible, markMeetingJoined]
  );

  // ─── Denúncia ───────────────────────────────────────────────────────
  const submitReport = async () => {
    if (!reportReason) {
      Alert.alert('Motivo obrigatório', 'Por favor, selecione um motivo para a denúncia.');
      return;
    }
    if (!session || !user) return;

    setIsSubmittingReport(true);
    try {
      const reportedUserId =
        session.speakerId === user.uid ? session.listenerId : session.speakerId;

      await addDoc(collection(db, 'reports'), {
        sessionId,
        reporterId: user.uid,
        reportedId: reportedUserId,
        reason: reportReason,
        comment: reportComment.trim() || null,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      // Fecha modal e reseta campos
      setIsReportModalOpen(false);
      setReportReason('');
      setReportComment('');
      Alert.alert(
        'Denúncia Enviada',
        'Sua denúncia é anônima e será analisada pela nossa equipe de moderação.'
      );
    } catch (error) {
      console.error('[VideoRoom] Erro ao enviar denúncia:', error);
      Alert.alert('Erro', 'Não foi possível enviar sua denúncia. Tente novamente.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

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
  // Usar apenas o primeiro nome para evitar exibição de '%20' na interface do Jitsi.
  // encodeURIComponent é aplicado somente no primeiro nome, sem espaços.
  const firstName = (profile?.name || 'Usuário').split(' ')[0];
  const displayName = encodeURIComponent(firstName);
  // config.startWithAudioMuted=false garante que o microfone não inicia mudo.
  // config.startWithVideoMuted=false garante que a câmera não inicia desligada.
  // interfaceConfig.SHOW_JITSI_WATERMARK=false oculta o logo do Jitsi via config da URL.
  const jitsiUrl = `${jitsiBaseUrl}/${jitsiRoomName}#config.prejoinPageEnabled=false&config.disableDeepLinking=true&config.startWithAudioMuted=false&config.startWithVideoMuted=false&interfaceConfig.MOBILE_APP_PROMO=false&interfaceConfig.SHOW_JITSI_WATERMARK=false&interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false&interfaceConfig.SHOW_BRAND_WATERMARK=false&userInfo.displayName="${displayName}"`;

  // Timer mínimo pill — posição absoluta acima do notch
  const timerTop = insets.top + 8;
  // Overlay inferior — fica acima da toolbar nativa do Jitsi (~90px)
  const overlayBottom = insets.bottom + 90;

  return (
    // edges vazio: o Jitsi ocupa 100% da tela
    <SafeAreaView style={styles.root} edges={[]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Área de Vídeo — touch mostra overlay ── */}
      <TouchableWithoutFeedback onPress={showOverlay}>
        <View style={styles.videoContainer}>
          {webViewVisible ? (
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
              // Concede permissões de captura de mídia (microfone/câmera) à WebView do Jitsi.
              // 'grantIfSameHostElsePrompt' concede automaticamente para o host do Jitsi.
              {...{ mediaCapturePermissionGrantType: 'grantIfSameHostElsePrompt' } as any}
              // Injeta o script ANTES do content para garantir que os listeners estejam prontos
              injectedJavaScriptBeforeContentLoaded={JITSI_HANGUP_BRIDGE_JS}
              onMessage={handleWebViewMessage}
              onLoadEnd={() => {
                if (overlayFallbackTimerRef.current) {
                  clearTimeout(overlayFallbackTimerRef.current);
                }
                overlayFallbackTimerRef.current = setTimeout(() => {
                  markMeetingJoined('fallback_timer_8s');
                }, 8000);
                // Injeta CSS de limpeza: oculta header/watermark do Jitsi
                // e corrige safe area do chat no iOS (Dynamic Island / notch).
                if (webViewRef.current) {
                  webViewRef.current.injectJavaScript(buildJitsiCleanupCss(insets.top));
                }
              }}
              onShouldStartLoadWithRequest={(request) => {
                const url = request.url || '';
                if (
                  url.startsWith('intent://') ||
                  url.startsWith('market://') ||
                  url.includes('play.google.com') ||
                  url.includes('itunes.apple.com') ||
                  url.startsWith('whatsapp://') ||
                  url.startsWith('tel:') ||
                  url.startsWith('mailto:')
                ) {
                  return false;
                }
                const allowedDomain = process.env.EXPO_PUBLIC_JITSI_DOMAIN ?? 'meet.jit.si';

                // ── Detectar e bloquear redirecionamento para home do Jitsi ──────────────
                try {
                  const parsedUrl = new URL(url);
                  const currentRoomName = session?.jitsiRoomName || `EscutaAtiva_${sessionId}`;
                  const isJitsiDomain = parsedUrl.hostname === allowedDomain;
                  const isRootOrHome = parsedUrl.pathname === '/' || parsedUrl.pathname === '';
                  const hasRoomHash = url.includes(currentRoomName);

                  if (isJitsiDomain && isRootOrHome && !hasRoomHash && !isEndingCallRef.current) {
                    console.log('[JitsiHangup Mobile] blocked Jitsi home redirect');
                    setWebViewVisible(false);
                    completeSessionAndExit('jitsi_native_hangup');
                    return false;
                  }
                } catch (_) {}

                const isAllowed =
                  url.includes(allowedDomain) ||
                  url.startsWith('about:blank') ||
                  url.startsWith('blob:');
                if (!isAllowed) {
                  return false;
                }
                return true;
              }}
              onPermissionRequest={(request: any) => {
                // Concede explicitamente AUDIO_CAPTURE, VIDEO_CAPTURE e outras
                // permissões solicitadas pela WebView (Android)
                if (request && request.grant && request.resources) {
                  request.grant(request.resources);
                }
              }}
            />
          ) : (
            // Placeholder escuro enquanto a sessão encerra (evita flash da home Jitsi)
            <View style={styles.callEndingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.callEndingText}>Encerrando sessão...</Text>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* ── Timer mínimo — pill discreta no topo ── */}
      <View
        style={[styles.timerPill, { top: timerTop }]}
        pointerEvents="none"
      >
        <View style={styles.timerDot} />
        <Text style={styles.timerPillText}>{elapsedText}</Text>
      </View>

      {/* ── Overlay inferior — Retribuição + Denúncia ─────────────────
           Regra de exibição:
           - Aparece SOMENTE após entrar de fato na reunião (hasJoinedMeeting=true)
           - Permanece visível o tempo todo durante a chamada (sem auto-hide)
           - Speaker (speakerId === user.uid): vê Retribuição + Denúncia
           - Listener (listenerId === user.uid): vê APENAS Denúncia
           Os modais abrem por cima sem desmontar a WebView.
      ── */}
      {hasJoinedMeeting && webViewVisible && session && (
        <View
          style={[styles.bottomOverlay, { bottom: overlayBottom }]}
          pointerEvents="box-none"
        >
          {/* Botão Retribuição — apenas speaker/desabafador */}
          {isCurrentUserSpeaker && (
            <TouchableOpacity
              style={styles.overlayBtn}
              onPress={() => setIsTipModalOpen(true)}
              activeOpacity={0.85}
              accessibilityLabel="Enviar retribuição"
            >
              <Gift size={22} color={colors.primary} strokeWidth={2} />
            </TouchableOpacity>
          )}

          {/* Botão Denunciar — visível para todos (speaker e listener) */}
          <TouchableOpacity
            style={[styles.overlayBtn, styles.overlayBtnReport]}
            onPress={() => setIsReportModalOpen(true)}
            activeOpacity={0.85}
            accessibilityLabel="Denunciar usuário"
          >
            <ShieldAlert size={22} color="#EF4444" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Modal de Retribuição In-Call (apenas speaker) ── */}
      {isCurrentUserSpeaker && (
        <InCallTipModal
          visible={isTipModalOpen}
          onClose={() => setIsTipModalOpen(false)}
          sessionId={sessionId}
          listenerId={session?.listenerId}
          supporterName="Acolhedor"
        />
      )}

      {/* ── Modal de Denúncia ──────────────────────────────────────── */}
      <Modal
        visible={isReportModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsReportModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reportModal}>
            {/* Cabeçalho */}
            <View style={styles.reportIconContainer}>
              <ShieldAlert size={32} color="#EF4444" />
            </View>
            <Text style={styles.reportTitle}>Denunciar Usuário</Text>
            <Text style={styles.reportSubtitle}>
              Sua denúncia é anônima e será analisada pela nossa equipe de moderação.
            </Text>

            {/* Motivos */}
            <ScrollView style={styles.reasonsScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.reasonsLabel}>MOTIVO DA DENÚNCIA</Text>
              {REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reasonOption,
                    reportReason === reason && styles.reasonOptionSelected,
                  ]}
                  onPress={() => setReportReason(reason)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.reasonOptionText,
                      reportReason === reason && styles.reasonOptionTextSelected,
                    ]}
                  >
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Campo de texto quando "Outros" */}
              {reportReason === 'Outros' && (
                <TextInput
                  style={styles.commentInput}
                  placeholder="Descreva o ocorrido..."
                  placeholderTextColor="#9CA3AF"
                  value={reportComment}
                  onChangeText={setReportComment}
                  multiline
                  numberOfLines={3}
                  maxLength={300}
                />
              )}
            </ScrollView>

            {/* Botões */}
            <View style={styles.reportActions}>
              <TouchableOpacity
                style={styles.cancelReportBtn}
                onPress={() => {
                  setIsReportModalOpen(false);
                  setReportReason('');
                  setReportComment('');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelReportText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitReportBtn,
                  (!reportReason || isSubmittingReport) && styles.submitReportBtnDisabled,
                ]}
                onPress={submitReport}
                disabled={!reportReason || isSubmittingReport}
                activeOpacity={0.85}
              >
                {isSubmittingReport ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitReportText}>Enviar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // ── Vídeo ────────────────────────────────────────────────────────────
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  callEndingOverlay: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  callEndingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
  },


  // ── Timer mínimo (pill) no topo ────────────────────────────────────
  timerPill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(10,10,10,0.55)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 999,
    alignSelf: 'center',
  },
  timerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  timerPillText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
  },

  // ── Overlay inferior ─────────────────────────────────────────────
  bottomOverlay: {
    position: 'absolute',
    left: 24,
    flexDirection: 'row',
    gap: 8,
    zIndex: 9999,
    elevation: 9999,
  },
  overlayBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,10,0.72)',
    borderWidth: 1,
    borderColor: `${colors.primary}44`,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  overlayBtnReport: {
    borderColor: 'rgba(239,68,68,0.4)',
  },

  // ── Modal de Denúncia ─────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  reportModal: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    maxHeight: '80%',
  },
  reportIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
    borderWidth: 3,
    borderColor: '#FECACA',
  },
  reportTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  reportSubtitle: {
    fontSize: typography.size.xs + 1,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: typography.weight.medium,
    marginBottom: spacing.lg,
  },
  reasonsScroll: {
    maxHeight: 280,
  },
  reasonsLabel: {
    fontSize: 10,
    fontWeight: typography.weight.black,
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  reasonOption: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
    marginBottom: spacing.xs,
  },
  reasonOptionSelected: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  reasonOptionText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: '#6B7280',
  },
  reasonOptionTextSelected: {
    color: '#EF4444',
  },
  commentInput: {
    marginTop: spacing.sm,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: typography.size.sm,
    color: '#1F2937',
    textAlignVertical: 'top',
    minHeight: 80,
    fontWeight: typography.weight.medium,
  },
  reportActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancelReportBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelReportText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: '#6B7280',
  },
  submitReportBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitReportBtnDisabled: {
    opacity: 0.5,
  },
  submitReportText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: '#FFF',
    letterSpacing: 0.5,
  },
});
