import React, { useState, useEffect, useRef } from 'react';
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
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { db } from '@shared/services/firebase';
import { useAuth } from '@features/auth/hooks/useAuth';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';

export function VideoRoomScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId } = route.params;
  const { profile } = useAuth();
  // Insets para posicionar a barra de controle acima da safe area
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
  const [sessionStartTime] = useState(Date.now());
  const [elapsedText, setElapsedText] = useState('00:00');
  const [isEndingCall, setIsEndingCall] = useState(false);

  const webViewRef = useRef<WebView>(null);

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
          [
            { text: 'Voltar', onPress: () => navigation.getParent()?.goBack() }
          ]
        );
      }
    })();
  }, []);

  // ─── Listener do Documento da Sessão ──────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSession({ id: snap.id, ...data });

        // Redireciona imediatamente se a sessão foi concluída/cancelada por qualquer uma das partes
        if (data.status === 'completed' || data.status === 'rejected' || data.status === 'cancelled') {
          navigation.replace('PostSession', { sessionId });
        }
      }
      setLoading(false);
    }, () => setLoading(false));

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
          { text: 'Encerrar', onPress: handleEndCall, style: 'destructive' }
        ]
      );
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [sessionStartTime]);

  // ─── Encerrar Chamada ────────────────────────────────────────────────
  const handleEndCall = async () => {
    if (isEndingCall) return; // Previne duplo toque
    setIsEndingCall(true);
    const finalElapsedMinutes = Math.max(1, Math.floor((Date.now() - sessionStartTime) / 60000));
    try {
      await updateDoc(doc(db, 'sessions', sessionId), { 
        status: 'completed',
        actualDuration: finalElapsedMinutes,
        completedAt: serverTimestamp()
      });
      // O redirect para PostSession ocorre de forma reativa pelo snapshot listener
    } catch (error) {
      console.error('Erro ao encerrar chamada:', error);
      Alert.alert('Erro', 'Não foi possível encerrar a chamada no momento.');
      setIsEndingCall(false);
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
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => navigation.getParent()?.goBack()}
        >
          <Text style={styles.cancelBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Gerar Link do Jitsi ───────────────────────────────────────────
  const jitsiDomain = process.env.EXPO_PUBLIC_JITSI_DOMAIN ?? 'meet.jit.si';
  const jitsiBaseUrl = jitsiDomain.startsWith('http') ? jitsiDomain : `https://${jitsiDomain}`;
  const jitsiRoomName = session?.jitsiRoomName || `EscutaAtiva_${sessionId}`;
  const displayName = encodeURIComponent(profile?.name || 'Acolhedor/Ouvinte');
  
  // URL Jitsi com parâmetros para embutir no celular (esconder recursos desnecessários e desativar banner mobile)
  const jitsiUrl = `${jitsiBaseUrl}/${jitsiRoomName}#config.prejoinPageEnabled=false&config.disableDeepLinking=true&interfaceConfig.MOBILE_APP_PROMO=false&interfaceConfig.TOOLBAR_BUTTONS=["microphone","camera","closedcaptions","desktop","fullscreen","fittowindow","hangup","profile","chat","settings","videoquality","filmstrip","feedback","stats","shortcuts","tileview","videobackgroundblur","download","help","mute-everyone","security"]&userInfo.displayName="${displayName}"`;

  // Distância do bottom: respeita a safe area + espaço extra para não conflitar com gestos
  const bottomBarBottom = Math.max(insets.bottom, 8) + 16;

  return (
    // Removemos edges para que a SafeAreaView não restrinja o topo —
    // o Jitsi deve ocupar 100% da tela, incluindo notch
    <SafeAreaView style={styles.root} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />

      {/* ── Área de Vídeo (WebView) — ocupa 100% da tela ── */}
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
          onShouldStartLoadWithRequest={(request) => {
            const url = request.url || '';
            console.log('[JitsiWebView] Trying to load URL:', url);
            
            // Bloqueia deep linking externo do Jitsi (market, intents, play store, etc.)
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

            // Apenas permite navegação para o domínio do Jitsi (ex: meet.jit.si ou meet.meu.best)
            const allowedDomain = process.env.EXPO_PUBLIC_JITSI_DOMAIN ?? 'meet.jit.si';
            const isAllowed = url.includes(allowedDomain) || url.startsWith('about:blank') || url.startsWith('blob:');
            if (!isAllowed) {
              console.log('[JitsiWebView] Blocked non-jitsi domain navigation:', url);
              return false;
            }

            return true;
          }}
          {...{
            onPermissionRequest: (request: any) => {
              request.grant(request.resources);
            }
          } as any}
        />
      </View>

      {/* ── Barra de controle flutuante inferior ── */}
      {/* Posicionada acima da safe area de gestos do sistema,
          longe da barra superior e sem conflitar com notch */}
      <View
        style={[
          styles.floatingBar,
          { bottom: bottomBarBottom },
        ]}
      >
        {/* Lado esquerdo: ícone segurança + tema + timer */}
        <View style={styles.barLeft}>
          <View style={styles.shieldBadge}>
            <ShieldCheck size={14} color={colors.primary} strokeWidth={2} />
          </View>
          <View>
            <Text style={styles.categoryLabel} numberOfLines={1}>
              {session?.category || 'Sessão de Apoio'}
            </Text>
            <Text style={styles.timerLabel}>
              {elapsedText} · Segura
            </Text>
          </View>
        </View>

        {/* Lado direito: botão Encerrar */}
        <TouchableOpacity
          style={[styles.endCallBtn, isEndingCall && styles.endCallBtnDisabled]}
          onPress={handleEndCall}
          activeOpacity={0.8}
          disabled={isEndingCall}
        >
          {isEndingCall ? (
            <ActivityIndicator size="small" color={colors.textInverted} />
          ) : (
            <>
              <PhoneOff size={15} color={colors.textInverted} strokeWidth={2} />
              <Text style={styles.endCallText}>ENCERRAR</Text>
            </>
          )}
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

  // ── Área de vídeo ──────────────────────────────────────────────────
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },

  // ── Barra de controle flutuante inferior ──────────────────────────
  floatingBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 64,
    backgroundColor: 'rgba(10, 10, 10, 0.88)',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    // Sombra para destacar sobre o Jitsi
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  barLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  shieldBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
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
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.3,
  },
  endCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md + 2,
    gap: spacing.xs,
    minWidth: 110,
    ...shadows.sm,
  },
  endCallBtnDisabled: {
    opacity: 0.55,
  },
  endCallText: {
    color: colors.textInverted,
    fontWeight: typography.weight.black,
    fontSize: 11,
    letterSpacing: 0.8,
  },
});
