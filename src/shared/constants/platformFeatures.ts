/**
 * platformFeatures.ts
 *
 * Feature flags locais por plataforma. Baseado em Platform.OS — sem
 * dependência de configuração remota ou servidor.
 *
 * iOS: recursos financeiros desativados por exigência da App Store (Guideline 1.1.4).
 * Android: todos os recursos financeiros permanecem ativos.
 */
import { Platform } from 'react-native';

/**
 * true  → Android / Web (todos os recursos financeiros disponíveis)
 * false → iOS (carteira, Pix, gorjeta, saque, retribuição desabilitados)
 */
export const FINANCIAL_FEATURES_ENABLED = Platform.OS !== 'ios';
