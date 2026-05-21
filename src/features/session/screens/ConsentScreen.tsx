import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { ShieldCheck, ArrowRight, AlertTriangle } from 'lucide-react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { db } from '@shared/services/firebase';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';

export function ConsentScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId } = route.params;

  const [hasConsented, setHasConsented] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
      if (snap.exists()) {
        setSession({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [sessionId]);

  const handleAccept = () => {
    if (!hasConsented) return;
    navigation.replace('VideoRoom', { sessionId });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando termos...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <ShieldCheck size={36} color={colors.primary} />
          </View>

          <Text style={styles.title}>TERMOS DE USO E RESPONSABILIDADE</Text>

          <Text style={styles.introText}>
            O Meu.Best é uma rede de acolhimento formada por voluntários que oferecem escuta, apoio emocional e troca de experiências pessoais.
          </Text>

          <Text style={styles.declarationHeader}>Ao iniciar esta conversa, você declara estar ciente de que:</Text>

          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>Os voluntários não são profissionais de saúde, advogados ou especialistas certificados;</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>As orientações compartilhadas são baseadas em experiências pessoais e opiniões, não constituindo aconselhamento profissional, diagnóstico ou tratamento;</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>O site não se responsabiliza por decisões tomadas com base nas conversas realizadas;</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>Em situações que envolvam saúde física ou mental, questões jurídicas ou financeiras, deve imediatamente buscar um profissional qualificado;</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>Em caso de emergência, você deve procurar imediatamente os serviços locais competentes.</Text>
            </View>
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Ao clicar em “Aceito e continuar”, você concorda com estes termos e assume total responsabilidade pelo uso das informações recebidas.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.checkboxContainer}
            activeOpacity={0.8}
            onPress={() => setHasConsented(!hasConsented)}
          >
            <View style={[styles.checkbox, hasConsented && styles.checkboxChecked]}>
              {hasConsented && <ShieldCheck size={12} color={colors.textInverted} />}
            </View>
            <Text style={styles.checkboxLabel}>
              Li e concordo com os termos de uso e responsabilidade.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, !hasConsented && styles.buttonDisabled, shadows.primary]}
            disabled={!hasConsented}
            onPress={handleAccept}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Aceito e continuar</Text>
            <ArrowRight size={18} color={colors.textInverted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.getParent()?.goBack()}
          >
            <Text style={styles.cancelText}>Cancelar e Voltar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    backgroundColor: `${colors.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 4,
    borderColor: `${colors.primary}18`,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: typography.tracking.tight,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  introText: {
    fontSize: typography.size.base,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: typography.weight.medium,
    marginBottom: spacing.md,
  },
  declarationHeader: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.text,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  bulletList: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  bulletDot: {
    fontSize: typography.size.md,
    color: colors.primary,
    fontWeight: typography.weight.bold,
    marginTop: -2,
  },
  bulletText: {
    flex: 1,
    fontSize: typography.size.xs + 1,
    color: colors.textMutedValue,
    lineHeight: 18,
    fontWeight: typography.weight.medium,
  },
  warningBox: {
    backgroundColor: `${colors.text}03`,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignSelf: 'stretch',
    marginBottom: spacing.lg,
  },
  warningText: {
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    fontStyle: 'italic',
    lineHeight: 16,
    textAlign: 'center',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    alignSelf: 'stretch',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
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
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
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
  cancelButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  cancelText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textMutedValue,
    textDecorationLine: 'underline',
  },
});
