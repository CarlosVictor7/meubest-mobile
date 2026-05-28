import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  StatusBar,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  Clock, 
  Sparkles, 
  User, 
  Search, 
  Star, 
  ChevronRight, 
  CheckCircle2, 
  X,
  MapPin,
  Smile,
  Compass,
  ChevronDown
} from 'lucide-react-native';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

import { db } from '@shared/services/firebase';
import { useAuth } from '@features/auth/hooks/useAuth';
import { colors, spacing, typography, borderRadius, shadows } from '@constants/theme';
import { SESSION_THEMES } from '@constants/config';

const { width, height } = Dimensions.get('window');

// Grade de horários padrões do PWA
const DEFAULT_TIMES = ['09:00', '10:00', '14:00', '16:00', '19:00', '21:00'];

// Opções de duração da sessão
const DURATIONS = [
  { value: 15, label: '15 MIN' },
  { value: 30, label: '30 MIN' },
  { value: 60, label: '60 MIN' },
  { value: 90, label: '90 MIN' },
];

export function ScheduleMatchScreen() {
  const navigation = useNavigation<any>();
  const { user, profile } = useAuth();

  // Etapa do fluxo: 0 = Escolha Tipo (Aleatório/Específico), 1 = Escolha Voluntário, 2 = Configurar Agendamento
  const [step, setStep] = useState(0);
  
  // Modo de agendamento: 'random' ou 'specific'
  const [bookingMode, setBookingMode] = useState<'random' | 'specific'>('random');

  // Estados dos voluntários
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [loadingVolunteers, setLoadingVolunteers] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState<any | null>(null);

  // Filtros de busca (Apenas para o modo específico)
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [ageFilter, setAgeFilter] = useState('');
  const [themeFilter, setThemeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Dados do Agendamento
  const [selectedTheme, setSelectedTheme] = useState<string>(SESSION_THEMES[0]?.label || 'Relacionamento');
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [selectedDateObj, setSelectedDateObj] = useState<Date | null>(null);
  const [selectedTimeStr, setSelectedTimeStr] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modais de Seleção (Substituem os dropdowns nativos feios)
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [durationModalVisible, setDurationModalVisible] = useState(false);

  // ── Carrega Voluntários (Listeners) do Firestore ─────────────────────────
  const fetchVolunteers = useCallback(async () => {
    setLoadingVolunteers(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'listener')
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setVolunteers(list);
    } catch (error) {
      console.error('Error fetching volunteers:', error);
      Alert.alert('Erro', 'Não foi possível carregar a lista de voluntários.');
    } finally {
      setLoadingVolunteers(false);
    }
  }, []);

  useEffect(() => {
    if (step === 1 && volunteers.length === 0) {
      fetchVolunteers();
    }
  }, [step, volunteers.length, fetchVolunteers]);

  // ── Filtros aplicados no frontend ─────────────────────────────────────────
  const filteredVolunteers = useMemo(() => {
    return volunteers.filter(v => {
      const nameMatch = v.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
      const bioMatch = v.bio?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
      const matchesSearch = searchQuery === '' || nameMatch || bioMatch;

      const matchesCity = cityFilter === '' || v.city === cityFilter;
      const matchesGender = genderFilter === '' || v.gender === genderFilter;
      const matchesAge = ageFilter === '' || v.ageRange === ageFilter;
      
      const themeId = SESSION_THEMES.find(t => t.label === themeFilter)?.id;
      const matchesTheme = themeFilter === '' || (v.interests && v.interests.includes(themeId));

      return matchesSearch && matchesCity && matchesGender && matchesAge && matchesTheme;
    });
  }, [volunteers, searchQuery, cityFilter, genderFilter, ageFilter, themeFilter]);

  // Colecionar cidades únicas para popular filtros
  const uniqueCities = useMemo(() => {
    const list = volunteers.map(v => v.city).filter(Boolean);
    return Array.from(new Set(list));
  }, [volunteers]);

  // ── Próximos 8 dias para o Calendário Horizontal ─────────────────────────
  const nextDays = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 8; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, []);

  // ── Confirmar Agendamento e Salvar no Firestore ─────────────────────────
  const handleConfirmBooking = async () => {
    if (!user || !selectedDateObj || !selectedTimeStr) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (bookingMode === 'specific' && !selectedVolunteer) {
      Alert.alert('Erro', 'Por favor, selecione um voluntário.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Monta data final com hora selecionada
      const finalDate = new Date(selectedDateObj);
      const [hours, minutes] = selectedTimeStr.split(':');
      finalDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      const isoDateString = finalDate.toISOString();

      const sessionData = {
        speakerId: user.uid,
        speakerEmail: user.email || '',
        speakerName: profile?.name || user.displayName || 'Usuário',
        listenerId: bookingMode === 'specific' ? selectedVolunteer.id : null,
        listenerEmail: bookingMode === 'specific' ? (selectedVolunteer.email || null) : null,
        listenerName: bookingMode === 'specific' ? (selectedVolunteer.name || 'Voluntário') : null,
        status: 'pending',
        category: selectedTheme,
        duration: selectedDuration,
        createdAt: serverTimestamp(),
        scheduledTimes: [isoDateString],
        selectedTime: isoDateString,
        type: 'scheduled',
        schedulingMode: bookingMode
      };

      await addDoc(collection(db, 'sessions'), sessionData);

      Alert.alert(
        'Sucesso 🎉',
        'Seu acolhimento foi agendado! Ele aparecerá em "Próximas Sessões" na sua tela inicial.',
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Limpa estados e volta para home
              setStep(0);
              setSelectedVolunteer(null);
              setSelectedDateObj(null);
              setSelectedTimeStr(null);
              navigation.navigate('Home');
            } 
          }
        ]
      );
    } catch (error) {
      console.error('Error saving scheduled session:', error);
      Alert.alert('Erro', 'Não foi possível salvar o seu agendamento no momento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDurationLabel = (value: number) => {
    return DURATIONS.find(d => d.value === value)?.label || `${value} MIN`;
  };

  // ── Render ──
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Header com botão voltar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (step === 2 && bookingMode === 'random') {
              setStep(0);
            } else if (step > 0) {
              setStep(step - 1);
            } else {
              navigation.goBack();
            }
          }}
          style={styles.backBtn}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Agendar Momento</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.closeBtn}>
          <X size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* ETAPA 0: Escolha do Tipo (Aleatório / Específico) */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {step === 0 && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.brutalCard}>
            <View style={styles.heroTextContainer}>
              <Text style={styles.brutalTitle}>NOVA SESSÃO</Text>
              <Text style={styles.brutalSubtitle}>Como você prefere se conectar hoje?</Text>
            </View>

            <View style={styles.optionsContainer}>
              {/* Option Aleatório */}
              <TouchableOpacity
                style={styles.optionBtn}
                activeOpacity={0.85}
                onPress={() => {
                  setBookingMode('random');
                  setSelectedVolunteer(null);
                  setStep(2); // Avança direto para a Configuração
                }}
              >
                <View style={styles.optionIconBox}>
                  <Sparkles size={32} color={colors.primary} />
                </View>
                <View style={styles.optionTextBox}>
                  <Text style={styles.optionTitle}>ALEATÓRIO</Text>
                  <Text style={styles.optionDesc}>
                    Encontraremos o melhor voluntário disponível para você agora.
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Option Específico */}
              <TouchableOpacity
                style={styles.optionBtn}
                activeOpacity={0.85}
                onPress={() => {
                  setBookingMode('specific');
                  setStep(1); // Avança para escolha de voluntário
                }}
              >
                <View style={styles.optionIconBox}>
                  <User size={32} color={colors.primary} />
                </View>
                <View style={styles.optionTextBox}>
                  <Text style={styles.optionTitle}>ESPECÍFICO</Text>
                  <Text style={styles.optionDesc}>
                    Escolha um voluntário que você já conhece ou se identifica.
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* ETAPA 1: Escolha do Voluntário (Apenas modo específico) */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {step === 1 && (
        <View style={{ flex: 1 }}>
          {/* Campo de Busca */}
          <View style={styles.searchBarContainer}>
            <View style={styles.searchBar}>
              <Search size={20} color={colors.textMutedValue} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Pesquisar por nome ou bio..."
                placeholderTextColor={colors.textMutedValue}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery !== '' && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={20} color={colors.textMutedValue} />
                </TouchableOpacity>
              )}
            </View>

            {/* Botão de Toggle de Filtros Avançados */}
            <TouchableOpacity 
              style={[styles.filterToggleBtn, showFilters && styles.filterToggleBtnActive]} 
              onPress={() => setShowFilters(!showFilters)}
            >
              <Compass size={16} color={showFilters ? colors.textInverted : colors.primary} />
              <Text style={[styles.filterToggleText, showFilters && styles.filterToggleTextActive]}>
                {showFilters ? 'Ocultar Filtros' : 'Filtros Avançados'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Filtros Extras Expandíveis */}
          {showFilters && (
            <View style={styles.filtersWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
                {/* Filtro Tema */}
                <View style={styles.pickerWrapper}>
                  <Text style={styles.pickerLabel}>Tema</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                    <TouchableOpacity 
                      style={[styles.chip, themeFilter === '' && styles.chipActive]} 
                      onPress={() => setThemeFilter('')}
                    >
                      <Text style={[styles.chipText, themeFilter === '' && styles.chipTextActive]}>Todos</Text>
                    </TouchableOpacity>
                    {SESSION_THEMES.map(theme => (
                      <TouchableOpacity 
                        key={theme.id}
                        style={[styles.chip, themeFilter === theme.label && styles.chipActive]} 
                        onPress={() => setThemeFilter(theme.label)}
                      >
                        <Text style={[styles.chipText, themeFilter === theme.label && styles.chipTextActive]}>
                          {theme.emoji} {theme.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Filtro Gênero */}
                <View style={styles.pickerWrapper}>
                  <Text style={styles.pickerLabel}>Gênero</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                    {['', 'masculino', 'feminino', 'outro'].map(g => (
                      <TouchableOpacity
                        key={g}
                        style={[styles.chip, genderFilter === g && styles.chipActive]}
                        onPress={() => setGenderFilter(g)}
                      >
                        <Text style={[styles.chipText, genderFilter === g && styles.chipTextActive]}>
                          {g === '' ? 'Todos' : g.charAt(0).toUpperCase() + g.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Filtro Cidade */}
                {uniqueCities.length > 0 && (
                  <View style={styles.pickerWrapper}>
                    <Text style={styles.pickerLabel}>Cidade</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                      <TouchableOpacity 
                        style={[styles.chip, cityFilter === '' && styles.chipActive]} 
                        onPress={() => setCityFilter('')}
                      >
                        <Text style={[styles.chipText, cityFilter === '' && styles.chipTextActive]}>Todas</Text>
                      </TouchableOpacity>
                      {uniqueCities.map(city => (
                        <TouchableOpacity
                          key={city}
                          style={[styles.chip, cityFilter === city && styles.chipActive]}
                          onPress={() => setCityFilter(city)}
                        >
                          <Text style={[styles.chipText, cityFilter === city && styles.chipTextActive]}>{city}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Filtro Idade */}
                <View style={styles.pickerWrapper}>
                  <Text style={styles.pickerLabel}>Faixa Etária</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                    {['', '18-25', '26-40', '41-60', '60+'].map(age => (
                      <TouchableOpacity
                        key={age}
                        style={[styles.chip, ageFilter === age && styles.chipActive]}
                        onPress={() => setAgeFilter(age)}
                      >
                        <Text style={[styles.chipText, ageFilter === age && styles.chipTextActive]}>
                          {age === '' ? 'Todas' : `${age} anos`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>
          )}

          {/* Lista de Voluntários */}
          {loadingVolunteers ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Carregando voluntários acolhedores...</Text>
            </View>
          ) : filteredVolunteers.length === 0 ? (
            <View style={styles.centered}>
              <Smile size={48} color={colors.textMutedValue} style={{ marginBottom: spacing.sm }} />
              <Text style={styles.noResultsText}>Nenhum voluntário encontrado com estes filtros.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredVolunteers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const initials = item.name ? item.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() : 'V';
                return (
                  <TouchableOpacity
                    style={[styles.volunteerCard, shadows.sm]}
                    activeOpacity={0.88}
                    onPress={() => {
                      setSelectedVolunteer(item);
                      setStep(2);
                    }}
                  >
                    <View style={styles.volunteerAvatar}>
                      <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                    <View style={styles.volunteerDetails}>
                      <Text style={styles.volunteerName}>{item.name}</Text>
                      <Text style={styles.volunteerBio} numberOfLines={2}>
                        {item.bio || 'Voluntário atencioso disponível para ouvir você.'}
                      </Text>
                      
                      <View style={styles.metaRow}>
                        {item.city && (
                          <View style={styles.metaTag}>
                            <MapPin size={10} color={colors.textMutedValue} />
                            <Text style={styles.metaTagText}>{item.city}</Text>
                          </View>
                        )}
                        <View style={styles.metaTag}>
                          <Star size={10} color={colors.primary} fill={colors.primary} />
                          <Text style={[styles.metaTagText, { color: colors.primary, fontWeight: 'bold' }]}>
                            {item.rating ? item.rating.toFixed(1) : '5.0'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <ChevronRight size={20} color={colors.textMutedValue} style={styles.arrowIcon} />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* ETAPA 2: Configurar Sessão (Compartilhado entre Específico e Aleatório) */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {step === 2 && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          
          <View style={styles.brutalCard}>
            <View style={styles.configHeader}>
              <Text style={styles.configTitle}>CONFIGURAR SESSÃO</Text>
            </View>

            {/* Identificação da escolha do voluntário */}
            {bookingMode === 'specific' && selectedVolunteer && (
              <View style={styles.smallVolunteerCard}>
                <View style={styles.smallAvatar}>
                  <Text style={styles.smallAvatarInitials}>
                    {selectedVolunteer.name ? selectedVolunteer.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() : 'V'}
                  </Text>
                </View>
                <View>
                  <Text style={styles.smallVolunteerLabel}>VOLUNTÁRIO SELECIONADO</Text>
                  <Text style={styles.smallVolunteerName}>{selectedVolunteer.name}</Text>
                </View>
              </View>
            )}

            {bookingMode === 'random' && (
              <View style={styles.randomAlertBox}>
                <Text style={styles.randomAlertText}>
                  ✨ Encontraremos o melhor voluntário disponível para o horário escolhido.
                </Text>
              </View>
            )}

            {/* SELEÇÃO DO TEMA */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>TEMA</Text>
              <TouchableOpacity
                style={styles.selectBox}
                activeOpacity={0.8}
                onPress={() => setThemeModalVisible(true)}
              >
                <Text style={styles.selectValue}>{selectedTheme}</Text>
                <ChevronDown size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* SELEÇÃO DA DURAÇÃO */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>DURAÇÃO</Text>
              <TouchableOpacity
                style={styles.selectBox}
                activeOpacity={0.8}
                onPress={() => setDurationModalVisible(true)}
              >
                <Text style={styles.selectValue}>{getDurationLabel(selectedDuration)}</Text>
                <ChevronDown size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* ESCOLHA DE DATA E HORÁRIO */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                <CalendarIcon size={14} color={colors.primary} /> ESCOLHA UMA DATA E HORÁRIO
              </Text>
              
              {/* Calendário horizontal de Dias */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calendarContainer}>
                {nextDays.map((date, idx) => {
                  const isDateSelected = selectedDateObj?.toDateString() === date.toDateString();
                  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase();
                  const dayNum = date.getDate();

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.calendarDay, isDateSelected && styles.calendarDayActive]}
                      onPress={() => {
                        setSelectedDateObj(date);
                        setSelectedTimeStr(null); // Reseta hora ao mudar dia
                      }}
                    >
                      <Text style={[styles.calendarWeekday, isDateSelected && styles.calendarWeekdayActive]}>
                        {weekday}
                      </Text>
                      <Text style={[styles.calendarDayNum, isDateSelected && styles.calendarDayNumActive]}>
                        {dayNum}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Seleção de Horários */}
            {selectedDateObj && (
              <View style={styles.formGroup}>
                <View style={styles.timesGrid}>
                  {DEFAULT_TIMES.map(time => {
                    const isTimeSelected = selectedTimeStr === time;
                    return (
                      <TouchableOpacity
                        key={time}
                        style={[styles.timeChip, isTimeSelected && styles.timeChipActive]}
                        onPress={() => setSelectedTimeStr(time)}
                      >
                        <Clock size={12} color={isTimeSelected ? colors.textInverted : colors.primary} />
                        <Text style={[styles.timeChipText, isTimeSelected && styles.timeChipTextActive]}>
                          {time}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Resumo e Botão de Envio */}
            <View style={styles.confirmSection}>
              {selectedDateObj && selectedTimeStr && (
                <View style={styles.summaryBox}>
                  <CheckCircle2 size={18} color="#166534" />
                  <Text style={styles.summaryText}>
                    Confirmado para{' '}
                    <Text style={{fontWeight: 'bold'}}>{selectedDateObj.getDate()}/{selectedDateObj.getMonth() + 1}</Text> às{' '}
                    <Text style={{fontWeight: 'bold'}}>{selectedTimeStr}</Text>.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (!selectedDateObj || !selectedTimeStr || isSubmitting) && styles.submitBtnDisabled,
                  shadows.primary
                ]}
                disabled={!selectedDateObj || !selectedTimeStr || isSubmitting}
                onPress={handleConfirmBooking}
                activeOpacity={0.88}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={colors.textInverted} />
                ) : (
                  <Text style={styles.submitBtnText}>CONFIRMAR AGENDAMENTO</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL DE ESCOLHA DE TEMA */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <Modal
        visible={themeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setThemeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>SELECIONE UM TEMA</Text>
              <TouchableOpacity onPress={() => setThemeModalVisible(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.themeGrid}>
                {SESSION_THEMES.map(theme => (
                  <TouchableOpacity
                    key={theme.id}
                    style={[
                      styles.modalThemeCard,
                      selectedTheme === theme.label && styles.modalThemeCardActive
                    ]}
                    onPress={() => {
                      setSelectedTheme(theme.label);
                      setThemeModalVisible(false);
                    }}
                  >
                    <Text style={styles.modalThemeEmoji}>{theme.emoji}</Text>
                    <Text style={[
                      styles.modalThemeLabel,
                      selectedTheme === theme.label && styles.modalThemeLabelActive
                    ]}>
                      {theme.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL DE ESCOLHA DE DURAÇÃO */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <Modal
        visible={durationModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDurationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>DURAÇÃO DA CONVERSA</Text>
              <TouchableOpacity onPress={() => setDurationModalVisible(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalScroll}>
              <View style={styles.durationList}>
                {DURATIONS.map(d => (
                  <TouchableOpacity
                    key={d.value}
                    style={[
                      styles.modalDurationItem,
                      selectedDuration === d.value && styles.modalDurationItemActive
                    ]}
                    onPress={() => {
                      setSelectedDuration(d.value);
                      setDurationModalVisible(false);
                    }}
                  >
                    <Clock size={20} color={selectedDuration === d.value ? colors.textInverted : colors.primary} />
                    <Text style={[
                      styles.modalDurationLabel,
                      selectedDuration === d.value && styles.modalDurationLabelActive
                    ]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
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
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 3,
    borderBottomColor: colors.primaryLight,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: -0.5,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },

  // ── Brutal Cards Estilo PWA
  brutalCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl, // rounded-[40px]
    borderWidth: 4,
    borderColor: colors.primaryLight,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroTextContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  brutalTitle: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: -1,
  },
  brutalSubtitle: {
    fontSize: typography.size.base,
    color: colors.textMutedValue,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // ── Etapa 0: Options
  optionsContainer: {
    gap: spacing.md,
  },
  optionBtn: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 3,
    borderColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  optionIconBox: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTextBox: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  optionDesc: {
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    lineHeight: 16,
    fontWeight: typography.weight.medium,
  },

  // ── Etapa 1: Busca e Filtros (specific)
  searchBarContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    height: 48,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.size.base,
    color: colors.text,
    fontWeight: typography.weight.semibold,
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
    gap: spacing.xs,
    marginTop: 2,
  },
  filterToggleBtnActive: {
    backgroundColor: colors.primary,
  },
  filterToggleText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  filterToggleTextActive: {
    color: colors.textInverted,
  },

  // Filtros expandíveis
  filtersWrapper: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  filtersScroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  pickerWrapper: {
    gap: spacing.xs,
    minWidth: 160,
  },
  pickerLabel: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.textMutedValue,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.textInverted,
  },

  // Lista de Voluntários
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  volunteerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    gap: spacing.md,
  },
  volunteerAvatar: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.primary,
  },
  volunteerDetails: {
    flex: 1,
    gap: 2,
  },
  volunteerName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.text,
    textTransform: 'uppercase',
  },
  volunteerBio: {
    fontSize: typography.size.xs,
    color: colors.textMutedValue,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.xs,
    paddingVertical: 2,
    paddingHorizontal: 6,
    gap: 4,
  },
  metaTagText: {
    fontSize: 9,
    color: colors.textMutedValue,
    fontWeight: typography.weight.bold,
  },
  arrowIcon: {
    marginLeft: spacing.xs,
  },

  // ── Etapa 2: Configuração de Agendamento
  configHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  configTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  smallVolunteerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  smallAvatar: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallAvatarInitials: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  smallVolunteerLabel: {
    fontSize: 8,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 0.8,
  },
  smallVolunteerName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.text,
    textTransform: 'uppercase',
  },
  randomAlertBox: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  randomAlertText: {
    fontSize: typography.size.xs,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
    lineHeight: 18,
  },

  // Formulário estilo PWA
  formGroup: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  formLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: colors.primary,
    letterSpacing: 0.5,
    paddingLeft: spacing.xs,
  },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    height: 52,
    paddingHorizontal: spacing.md,
  },
  selectValue: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },

  // Calendário horizontal
  calendarContainer: {
    gap: spacing.xs,
    paddingVertical: 2,
  },
  calendarDay: {
    width: 68,
    height: 76,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  calendarDayActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  calendarWeekday: {
    fontSize: 9,
    fontWeight: typography.weight.black,
    color: colors.textMutedValue,
  },
  calendarWeekdayActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  calendarDayNum: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.text,
  },
  calendarDayNumActive: {
    color: colors.textInverted,
  },

  // Grid de Horários
  timesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
    width: '31%', // 3 chips por linha
    paddingVertical: 10,
    gap: 6,
  },
  timeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeChipText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  timeChipTextActive: {
    color: colors.textInverted,
  },

  // Confirmação e Envio
  confirmSection: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  summaryBox: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4', // verde claro
    borderWidth: 1.5,
    borderColor: '#DCFCE7',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    fontSize: typography.size.xs,
    color: '#166534',
    fontWeight: typography.weight.semibold,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: colors.primaryLight,
    shadowColor: 'transparent',
    elevation: 0,
  },
  submitBtnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.textInverted,
    letterSpacing: typography.tracking.wide,
  },

  // Modais customizados de seleção
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26,26,26,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: height * 0.7,
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    color: colors.primary,
  },
  modalScroll: {
    padding: spacing.lg,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  modalThemeCard: {
    width: '47%',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  modalThemeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  modalThemeEmoji: {
    fontSize: 24,
  },
  modalThemeLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  modalThemeLabelActive: {
    color: colors.primary,
  },

  durationList: {
    gap: spacing.sm,
  },
  modalDurationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  modalDurationItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  modalDurationLabel: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  modalDurationLabelActive: {
    color: colors.textInverted,
  },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.size.base,
    color: colors.textMutedValue,
    fontWeight: typography.weight.semibold,
  },
  noResultsText: {
    fontSize: typography.size.base,
    color: colors.textMutedValue,
    textAlign: 'center',
    fontWeight: typography.weight.semibold,
  },
});
