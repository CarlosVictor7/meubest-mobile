import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { collection, addDoc, doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Compass, X, RefreshCw, Heart, Zap } from 'lucide-react-native';
import { db } from '@shared/services/firebase';
import { useAuth } from '@features/auth/hooks/useAuth';
import { colors, spacing, borderRadius, typography, shadows } from '@constants/theme';

// Frases motivacionais rotativas
const COMFORT_PHRASES = [
  "Respire fundo. Vai ficar tudo bem.",
  "Você não está sozinho(a) nessa jornada.",
  "O seu melhor está só começando.",
  "Um pequeno passo de cada vez é o suficiente.",
  "Sua presença faz a diferença no mundo.",
  "Seja gentil consigo mesmo hoje.",
];

export function MatchSearchScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { category } = route.params || { category: 'Conversa' };
  
  const { user, profile } = useAuth();
  const [status, setStatus] = useState<'searching' | 'timeout' | 'error'>('searching');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  
  const sessionIdRef = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const phraseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Animação de pulso para o radar
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1500,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Rotatividade das frases a cada 4 segundos
  useEffect(() => {
    phraseTimerRef.current = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % COMFORT_PHRASES.length);
    }, 4000);

    return () => {
      if (phraseTimerRef.current) clearInterval(phraseTimerRef.current);
    };
  }, []);

  // Iniciar a busca ao montar o componente
  useEffect(() => {
    console.log('[MatchSearch] Start pressed');
    console.log(`[MatchSearch] Category selected: ${category}`);
    
    startSearch();

    return () => {
      cleanupSearch(true); // Cancela a sessão se sair da tela no meio da busca
    };
  }, []);

  // Função principal para iniciar busca e criar sessão no Firestore
  const startSearch = async () => {
    if (!user || !profile) {
      console.log('[MatchSearch] Error: User or Profile is not loaded');
      setStatus('error');
      return;
    }

    try {
      setStatus('searching');
      setSecondsElapsed(0);
      sessionIdRef.current = null;

      console.log('[MatchSearch] Creating session in Firestore...');

      // Copia EXATAMENTE a estrutura de campos que o Web já usa em startImmediateSession
      const sessionData = {
        speakerId: user.uid,
        speakerName: profile.name || user.displayName || 'Usuário',
        speakerEmail: user.email || '',
        listenerId: null,
        listenerEmail: null,
        listenerName: null,
        status: 'pending', // Mesmíssimo status inicial usado no Web
        category: category, // Campo correspondente ao tema
        type: 'immediate', // Tipo da sessão
        duration: 15,
        price: 0,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'sessions'), sessionData);
      sessionIdRef.current = docRef.id;
      console.log(`[MatchSearch] Session created in Firestore with ID: ${docRef.id}`);

      // Inicia a escuta da sessão em tempo real via onSnapshot
      console.log('[MatchSearch] Listening session...');
      unsubscribeRef.current = onSnapshot(doc(db, 'sessions', docRef.id), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          
          // Se o apoiador aceitou (status mudou para active e tem listenerId)
          if (data.status === 'active' && data.listenerId) {
            console.log(`[MatchSearch] Match accepted by supporter: ${data.listenerId}`);
            cleanupSearch(false); // Mantém a sessão no Firestore, limpa local
            
            // Navega diretamente para o fluxo nativo da sessão (SessionNavigator)
            navigation.navigate('Session', { sessionId: docRef.id });
          }
        }
      }, (err) => {
        console.log('[MatchSearch] Error in onSnapshot:', err);
      });

      // Timer para acompanhar timeout de 60 segundos
      timerRef.current = setInterval(() => {
        setSecondsElapsed((prev) => {
          if (prev >= 59) {
            console.log('[MatchSearch] Timeout triggered at 60s');
            handleTimeout();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      console.log('[MatchSearch] Error creating matchmaking session:', err);
      setStatus('error');
    }
  };

  // Trata o timeout de 60 segundos
  const handleTimeout = async () => {
    cleanupSearch(false);
    setStatus('timeout');

    // Cancela a sessão no Firestore mudando para 'cancelled' (como o Web faz)
    if (sessionIdRef.current) {
      try {
        await updateDoc(doc(db, 'sessions', sessionIdRef.current), {
          status: 'cancelled',
        });
        console.log('[MatchSearch] Session status marked as cancelled in Firestore');
      } catch (err) {
        console.log('[MatchSearch] Error updating session to cancelled:', err);
      }
    }
  };

  // Limpa timers e inscrições locais do Firebase
  const cleanupSearch = (cancelOnFirestore = false) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // Se solicitado (ex: ao clicar em cancelar ou voltar), cancela a sessão no Firestore
    if (cancelOnFirestore && sessionIdRef.current) {
      const idToCancel = sessionIdRef.current;
      sessionIdRef.current = null;
      console.log(`[MatchSearch] Cancelled: cancelling session ${idToCancel} in Firestore`);
      
      updateDoc(doc(db, 'sessions', idToCancel), {
        status: 'cancelled',
      }).catch((err) => {
        console.log('[MatchSearch] Error cancelling session on exit:', err);
      });
    }
  };

  // Cancela busca manualmente pelo botão
  const handleCancelPress = () => {
    cleanupSearch(true);
    navigation.goBack();
  };

  // Renderizar o estado de busca ativa (radar com pulso premium)
  const renderSearching = () => {
    // Progresso visual da barra de carregamento de 60s
    const progressPercent = `${(secondsElapsed / 60) * 100}%`;

    return (
      <View style={styles.centerContainer}>
        {/* Radar animado premium */}
        <View style={styles.radarWrapper}>
          <Animated.View
            style={[
              styles.pulseCircle,
              {
                transform: [{ scale: pulseAnim }],
                opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.3],
                  outputRange: [0.4, 0],
                }),
              },
            ]}
          />
          <View style={styles.radarCore}>
            <Compass size={40} color={colors.textInverted} strokeWidth={1.8} />
          </View>
        </View>

        {/* Título e tema */}
        <Text style={styles.title}>BUSCANDO UM ACOLHEDOR</Text>
        <View style={styles.tag}>
          <Heart size={12} color={colors.primary} fill={colors.primary} />
          <Text style={styles.tagText}>{category.toUpperCase()}</Text>
        </View>

        {/* Barra de progresso discreta e moderna */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: progressPercent as any }]} />
        </View>
        <Text style={styles.timerText}>Procurando voluntários... ({secondsElapsed}s)</Text>

        {/* Frases motivacionais rotativas com Animação sutil */}
        <View style={styles.phraseContainer}>
          <Text style={styles.phraseText}>
            "{COMFORT_PHRASES[phraseIndex]}"
          </Text>
        </View>

        {/* Botão de cancelamento */}
        <TouchableOpacity
          style={[styles.cancelButton, shadows.sm]}
          onPress={handleCancelPress}
          activeOpacity={0.8}
        >
          <X size={18} color={colors.text} />
          <Text style={styles.cancelButtonText}>CANCELAR BUSCA</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Renderizar estado de timeout amigável e acolhedor (tentar novamente)
  const renderTimeout = () => {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.iconBoxTimeout}>
          <Zap size={38} color={colors.primary} fill={colors.primary} />
        </View>

        <Text style={styles.title}>TODOS OS NOSSOS VOLUNTÁRIOS ESTÃO OCUPADOS</Text>
        <Text style={styles.subtitle}>
          Nossa rede é inteiramente formada por voluntários acolhedores. No momento, todos eles estão em atendimentos ou indisponíveis.{'\n'}{'\n'}
          Respire fundo, tente novamente em alguns instantes ou agende uma conversa para mais tarde!
        </Text>

        <View style={styles.actionCol}>
          <TouchableOpacity
            style={[styles.primaryButton, shadows.primary]}
            onPress={() => startSearch()}
            activeOpacity={0.85}
          >
            <RefreshCw size={18} color={colors.textInverted} style={{ marginRight: 8 }} />
            <Text style={styles.primaryButtonText}>TENTAR NOVAMENTE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>VOLTAR AO INÍCIO</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Renderizar estado de erro inesperado
  const renderError = () => {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.iconBoxError}>
          <X size={38} color={colors.text} />
        </View>

        <Text style={styles.title}>NÃO CONSEGUIMOS INICIAR SUA BUSCA AGORA</Text>
        <Text style={styles.subtitle}>
          Ocorreu um erro ao estabelecer conexão com o nosso servidor de acolhimento. Por favor, tente novamente em alguns instantes.
        </Text>

        <TouchableOpacity
          style={[styles.primaryButton, shadows.primary]}
          onPress={() => startSearch()}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>TENTAR NOVAMENTE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>VOLTAR AO INÍCIO</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      
      {/* Botão flutuante para voltar / fechar no canto superior */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeHeaderBtn}
          onPress={handleCancelPress}
          activeOpacity={0.7}
        >
          <X size={20} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {status === 'searching' && renderSearching()}
      {status === 'timeout' && renderTimeout()}
      {status === 'error' && renderError()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#121212', // Fundo escuro super premium
    paddingHorizontal: spacing.xl,
  },
  header: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  closeHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },

  // Estilos do radar ativo
  radarWrapper: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  pulseCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  radarCore: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.primary,
  },

  // Título e subtexto
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textInverted,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 28,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.size.base,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: typography.weight.medium,
    marginBottom: spacing.xxl,
  },

  // Tag do tema
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: spacing.xxl,
  },
  tagText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 1,
  },

  // Barra de progresso
  progressContainer: {
    width: '80%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  timerText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xxl * 1.5,
  },

  // Container de frases rotativas
  phraseContainer: {
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xxl,
  },
  phraseText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
  },

  // Botão Cancelar
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 2,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  cancelButtonText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: 0.8,
  },

  // Caixa de ícone dos estados finais (timeout/error)
  iconBoxTimeout: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderWidth: 3,
    borderColor: `${colors.primary}50`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconBoxError: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },

  // Botões de Ação
  actionCol: {
    width: '100%',
    gap: spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md + 2,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: 1,
  },
  secondaryButton: {
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md + 2,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  secondaryButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: 1,
  },
});
