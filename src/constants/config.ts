// Portado de src/constants.ts da versão web
export const SESSION_THEMES = [
  { id: 'relacionamento', label: 'Relacionamento', emoji: '💑' },
  { id: 'carreira', label: 'Carreira', emoji: '💼' },
  { id: 'saude', label: 'Saúde Mental', emoji: '🧠' },
  { id: 'luto', label: 'Luto', emoji: '🕊️' },
  { id: 'espiritualidade', label: 'Espiritualidade', emoji: '🙏' },
  { id: 'estudos', label: 'Estudos', emoji: '📚' },
  { id: 'familia', label: 'Família', emoji: '👨‍👩‍👧' },
  { id: 'ansiedade', label: 'Ansiedade', emoji: '😓' },
  { id: 'outras', label: 'Outras', emoji: '💬' },
] as const;

// Portado de Dashboard.tsx e SessionRoom.tsx
export const BADGES_DATA = {
  listener: [
    { id: 'l1', name: 'Ouvinte Iniciante', icon: '🌱', points: 100, desc: 'Completou suas primeiras sessões.' },
    { id: 'l2', name: 'Ouvinte Prata', icon: '🥈', points: 500, desc: 'Dedicou 500 minutos ao próximo.' },
    { id: 'l3', name: 'Ouvinte Ouro', icon: '🥇', points: 1000, desc: 'Um pilar da nossa comunidade.' },
    { id: 'l4', name: 'Mestre da Empatia', icon: '💎', points: 5000, desc: 'Transformou centenas de vidas.' },
    { id: 'l5', name: 'Anjo da Guarda', icon: '👼', points: 10000, desc: 'O nível máximo de acolhimento.' },
  ],
  speaker: [
    { id: 's1', name: 'Primeiro Passo', icon: '🚶', sessions: 1, desc: 'Teve a coragem de ser ouvido.' },
    { id: 's2', name: 'Coragem', icon: '🦁', sessions: 5, desc: 'Cinco vezes buscando o seu melhor.' },
    { id: 's3', name: 'Superação', icon: '🏔️', sessions: 10, desc: 'Dez sessões de autoconhecimento.' },
    { id: 's4', name: 'Resiliência', icon: '🌳', sessions: 50, desc: 'Um exemplo de força interior.' },
  ],
} as const;

export const MOTIVATIONAL_PHRASES = [
  'Você é mais forte do que imagina.',
  'Tudo bem não estar bem o tempo todo.',
  'Um pequeno passo de cada vez é o suficiente.',
  'Sua jornada é única e valiosa.',
  'Respire fundo. Você consegue.',
  'O amanhã é uma nova oportunidade.',
  'Seja gentil consigo mesmo hoje.',
  'Você não está sozinho nessa.',
  'Sua voz importa.',
  'Não desista de você.',
  'Grandes coisas levam tempo para crescer.',
  'Sua presença faz a diferença no mundo.',
] as const;

export const GRATITUDE_TIP_SUGGESTIONS = [
  { minutes: 15, amount: 39.90 },
  { minutes: 60, amount: 59.90 },
  { minutes: 90, amount: 99.90 },
] as const;

export const CHECKIN_COINS_REWARD = 50;
