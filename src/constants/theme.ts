// Design System — Meu Best Mobile
// Alinhado 100% com a identidade visual da versão web (index.css + Dashboard.tsx)
// Web palette: dbm-red #E1301D, dbm-cream #FDF6F0, dbm-pink #FCE7E9, dbm-darkblue #1A1A1A

export const colors = {
  // ── Brand (alinhado com a web)
  primary: '#E1301D',          // dbm-red — cor principal (botões, tabs ativas, badges)
  primaryDark: '#C4200A',      // hover / pressed state
  primaryLight: '#FCE7E9',     // dbm-pink — fundo de badges, bordas de cards, accent suave

  // ── Backgrounds
  background: '#FDF6F0',       // dbm-cream — fundo global
  surface: '#FFFFFF',          // cards, modais
  surfaceAlt: '#F9F4F1',       // alternativa levemente mais quente

  // ── Dark cards (cards pretos da web)
  dark: '#1A1A1A',             // dbm-darkblue — fundo de BlackCards
  darkSurface: '#111111',
  darkBorder: 'rgba(255,255,255,0.08)',

  // ── Text
  text: '#1A1A1A',             // dbm-darkblue — texto principal
  textMuted: '#1A1A1A',        // 40% opacity na web — usar com opacity ou cor diluída
  textMutedValue: 'rgba(26,26,26,0.45)',
  textInverted: '#FFFFFF',     // sobre fundos escuros

  // ── Borders (border da web = dbm-pink)
  border: '#FCE7E9',           // borda padrão dos cards
  borderDark: 'rgba(26,26,26,0.12)',

  // ── Semantic
  success: '#22C55E',
  successLight: '#DCFCE7',
  danger: '#E1301D',
  dangerLight: '#FCE7E9',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // ── Gamification
  coins: '#F59E0B',            // moedas douradas
  flame: '#F97316',            // streak de fogo

  // ── UI misc
  overlay: 'rgba(26,26,26,0.6)',
  overlayLight: 'rgba(26,26,26,0.4)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 72,   // Espaço reservado para BottomNav flutuante
} as const;

export const borderRadius = {
  xs: 8,
  sm: 12,
  md: 20,
  lg: 28,
  xl: 40,     // Cards grandes da web (rounded-[40px])
  xxl: 50,
  full: 9999,
} as const;

export const typography = {
  // Line heights
  titleLineHeight: 1.0,
  bodyLineHeight: 1.5,
  captionLineHeight: 1.4,

  // Font sizes
  size: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    xxxl: 36,
  },

  // Font weights — React Native usa string
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
    black: '900' as const,
  },

  // Letter spacing (tracking)
  tracking: {
    tight: -0.5,
    normal: 0,
    wide: 1,
    wider: 2,
    widest: 3,     // uppercase tracking-widest da web
  },
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  primary: {
    // Sombra colorida para botão principal — alinhado com shadow-2xl da web
    shadowColor: '#E1301D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 10,
  },
  nav: {
    // Sombra do BottomNav flutuante
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.15,
    shadowRadius: 45,
    elevation: 20,
  },
} as const;

export const theme = {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
} as const;

export type Theme = typeof theme;
