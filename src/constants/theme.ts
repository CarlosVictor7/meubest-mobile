// Design System — Meu Best Mobile
// Alinhado com a identidade visual da versão web

export const colors = {
  // Brand
  primary: '#FF8C61',
  primaryDark: '#FF5C35',
  primaryLight: '#FFF5F0',

  // Backgrounds
  background: '#FDF8F5',
  surface: '#FFFFFF',
  surfaceAlt: '#F9F9F9',

  // Text
  text: '#333333',
  textMuted: '#999999',
  textInverted: '#FFFFFF',
  textDark: '#2D2D2D',

  // Borders
  border: '#EAD7CC',
  borderLight: '#F0F0F0',

  // Semantic
  success: '#4CAF50',
  successLight: '#E8F5E9',
  danger: '#FF5252',
  dangerLight: '#FFEBEE',
  warning: '#FFD54F',
  warningLight: '#FFF3E0',
  info: '#64B5F6',
  infoLight: '#E3F2FD',

  // Dark mode (preparado para v2)
  dark: '#2D2D2D',
  darkSurface: '#1A1A1A',
  darkBorder: 'rgba(255,255,255,0.1)',

  // Special
  coins: '#FFD54F',
  overlay: 'rgba(0,0,0,0.5)',
  overlayHeavy: 'rgba(0,0,0,0.8)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const borderRadius = {
  xs: 8,
  sm: 12,
  md: 20,
  lg: 28,
  xl: 36,
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
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  lg: {
    shadowColor: '#FF8C61',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  primary: {
    shadowColor: '#FF8C61',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
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
