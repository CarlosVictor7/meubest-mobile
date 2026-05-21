import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Star } from 'lucide-react-native';
import { collection, addDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { db } from '@shared/services/firebase';
import { useAuth } from '@features/auth/hooks/useAuth';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import Toast from 'react-native-toast-message';

export function PostSessionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId } = route.params;
  const { user, profile } = useAuth();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
      if (snap.exists()) {
        setSession({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [sessionId]);

  const handleSubmit = async () => {
    if (rating === 0) {
      Toast.show({
        type: 'error',
        text1: 'Avaliação Obrigatória',
        text2: 'Por favor, selecione ao menos 1 estrela.',
      });
      return;
    }

    if (!user || !session) return;

    setSubmitting(true);
    const isSpeaker = profile?.role === 'speaker' || session.speakerId === user.uid;
    const targetUserId = isSpeaker ? session.listenerId : session.speakerId;
    const visibleAt = new Date();
    visibleAt.setDate(visibleAt.getDate() + 3);

    try {
      // 1. Salvar Review no Firestore
      await addDoc(collection(db, 'reviews'), {
        sessionId,
        fromId: user.uid,
        toId: targetUserId,
        rating,
        comment,
        isPublic,
        visibleAt: visibleAt.toISOString(),
        createdAt: serverTimestamp(),
      });

      // 2. Criar Notificação para o destinatário no Firestore
      await addDoc(collection(db, 'notifications'), {
        userId: targetUserId,
        title: 'Nova Avaliação! ✨',
        message: 'Você recebeu uma nova avaliação pela sua participação em uma conversa.',
        type: 'session',
        read: false,
        link: '/dashboard?tab=sessions',
        createdAt: new Date().toISOString(),
      });

      Toast.show({
        type: 'success',
        text1: 'Avaliação Enviada',
        text2: 'Obrigado por ajudar a manter nossa comunidade segura!',
      });

      if (isSpeaker && session.listenerId) {
        // Se for o orador (ouvinte da conversa) e tem um apoiador na sessão, vai para gorjeta
        navigation.navigate('TipAfterSession', { sessionId });
      } else {
        // Se for o próprio apoiador, volta direto para o Início limpando o histórico
        navigation.reset({
          index: 0,
          routes: [{ name: 'App' }],
        });
      }
    } catch (error) {
      console.error('Erro ao enviar avaliação:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível salvar sua avaliação.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Preparando avaliação...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Star size={36} color={colors.primary} fill={colors.primary} />
            </View>

            <Text style={styles.title}>Como foi a conversa?</Text>
            <Text style={styles.subtitle}>
              Sua avaliação ajuda a manter nossa comunidade segura e acolhedora.
            </Text>

            {/* Estrelas */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setRating(s)}
                  activeOpacity={0.7}
                  style={styles.starBtn}
                >
                  <Star
                    size={38}
                    color={rating >= s ? colors.primary : '#EAD7CC'}
                    fill={rating >= s ? colors.primary : 'transparent'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Campo de Comentário */}
            <TextInput
              style={styles.input}
              placeholder="Deixe um comentário (opcional)..."
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
              maxLength={300}
            />

            {/* Checkbox de Comentário Público */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              activeOpacity={0.8}
              onPress={() => setIsPublic(!isPublic)}
            >
              <View style={[styles.checkbox, isPublic && styles.checkboxChecked]}>
                {isPublic && <Star size={10} color={colors.textInverted} fill={colors.textInverted} />}
              </View>
              <Text style={styles.checkboxLabel}>
                Comentário público (visível em 3 dias)
              </Text>
            </TouchableOpacity>

            {/* Botão Enviar */}
            <TouchableOpacity
              style={[styles.button, rating === 0 && styles.buttonDisabled, shadows.primary]}
              disabled={rating === 0 || submitting}
              onPress={handleSubmit}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.textInverted} />
              ) : (
                <Text style={styles.buttonText}>Enviar Avaliação</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.lg,
    flexGrow: 1,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textMutedValue,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 3,
    borderColor: colors.primaryLight,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 4,
    borderColor: `${colors.primary}10`,
  },
  title: {
    fontSize: typography.size.xxl - 2,
    fontWeight: typography.weight.black,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.textMutedValue,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: typography.weight.medium,
    marginBottom: spacing.xl,
  },
  starsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  starBtn: {
    padding: spacing.xs,
  },
  input: {
    width: '100%',
    height: 100,
    backgroundColor: '#FDF8F5',
    borderWidth: 2,
    borderColor: '#EAD7CC',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    textAlignVertical: 'top',
    fontSize: typography.size.base,
    color: colors.text,
    fontWeight: typography.weight.medium,
    marginBottom: spacing.md,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
    alignSelf: 'stretch',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.xs,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: typography.size.xs + 1,
    fontWeight: typography.weight.bold,
    color: colors.textMutedValue,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.widest,
  },
});
