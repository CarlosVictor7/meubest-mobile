import React, { useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ViewToken,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, MessageCircle, Shield, Star } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@navigation/types';
import { colors, spacing, typography, borderRadius } from '@constants/theme';
import { Button } from '@shared/components';

const { width, height } = Dimensions.get('window');

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Onboarding'>;

const slides = [
  {
    id: '1',
    Icon: Heart,
    gradient: [colors.primary, colors.primaryDark] as [string, string],
    title: 'Você não está sozinho',
    subtitle:
      'Conectamos pessoas que precisam falar com voluntários que querem ouvir. Sem julgamento, com presença.',
  },
  {
    id: '2',
    Icon: MessageCircle,
    gradient: ['#64B5F6', '#42A5F5'] as [string, string],
    title: 'Conexão imediata',
    subtitle:
      'Em segundos, encontre alguém que já passou pelo que você está vivendo e está aqui para acolher.',
  },
  {
    id: '3',
    Icon: Shield,
    gradient: ['#81C784', '#66BB6A'] as [string, string],
    title: '100% Seguro e gratuito',
    subtitle:
      'Conversas privadas, ambiente seguro. Nossa comunidade é formada por voluntários reais — de gente para gente.',
  },
  {
    id: '4',
    Icon: Star,
    gradient: [colors.primary, '#FF8C61'] as [string, string],
    title: 'Você consegue!',
    subtitle: 'Junte-se à comunidade Meu Best e dê o primeiro passo rumo ao seu melhor.',
  },
];

export function OnboardingScreen() {
  const navigation = useNavigation<Nav>();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const handleFinish = async () => {
    try {
      await AsyncStorage.setItem('@meubest:onboarding_seen', 'true');
    } catch (e) {
      console.error('Error saving onboarding_seen:', e);
    }
    navigation.navigate('Login');
  };

  const handleNext = () => {
    if (activeIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      handleFinish();
    }
  };

  const isLast = activeIndex === slides.length - 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <LinearGradient
              colors={item.gradient}
              style={styles.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <SafeAreaView style={styles.safeContent}>
                <View style={styles.iconCircle}>
                  <item.Icon color="#FFF" size={64} />
                </View>

                <View style={styles.textBlock}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.subtitle}>{item.subtitle}</Text>
                </View>

                {/* Dots */}
                <View style={styles.dots}>
                  {slides.map((_, i) => (
                    <View
                      key={i}
                      style={[styles.dot, i === activeIndex && styles.dotActive]}
                    />
                  ))}
                </View>

                <View style={styles.actions}>
                  <Button
                    label={isLast ? 'Começar Agora' : 'Próximo'}
                    onPress={handleNext}
                    size="lg"
                    variant="ghost"
                    style={{ backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 0 }}
                    textStyle={{ color: '#FFF' }}
                    fullWidth
                  />
                  {!isLast && (
                    <TouchableOpacity
                      onPress={handleFinish}
                      style={styles.skip}
                    >
                      <Text style={styles.skipText}>Pular</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </SafeAreaView>
            </LinearGradient>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    width,
    height,
  },
  gradient: {
    flex: 1,
  },
  safeContent: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
    paddingTop: spacing.xxl,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  textBlock: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  title: {
    fontSize: typography.size.xxxl,
    fontWeight: typography.weight.black,
    color: '#FFF',
    textAlign: 'center',
    lineHeight: 40,
  },
  subtitle: {
    fontSize: typography.size.md,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: typography.weight.medium,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#FFF',
    width: 24,
  },
  actions: {
    gap: spacing.md,
  },
  skip: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  skipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
});
