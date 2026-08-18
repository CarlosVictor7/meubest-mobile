/**
 * Configuração de testes — deliberadamente mínima.
 *
 * Escopo: **funções puras**. Não testamos componentes React Native aqui.
 * Renderizar componentes exigiria @testing-library/react-native mais mocks de
 * expo-haptics, lucide-react-native, firebase e safe-area-context — custo de
 * manutenção que não se paga para o que este projeto precisa hoje.
 *
 * O que protegemos: helpers de nome público, guardas de acolhedor, janela de
 * entrada em sessão, merge/dedupe de histórico e idempotência de métricas.
 * São exatamente os pontos onde uma regressão passa despercebida no teste manual.
 *
 * A transformação usa babel-preset-expo com config inline (`configFile: false`)
 * para não arrastar o plugin do reanimated, que não faz sentido em ambiente node.
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@features/(.*)$': '<rootDir>/src/features/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@navigation/(.*)$': '<rootDir>/src/navigation/$1',
    '^@models/(.*)$': '<rootDir>/src/types/$1',
    '^@app/(.*)$': '<rootDir>/src/app/$1',
  },
  transform: {
    '^.+\\.[jt]sx?$': [
      'babel-jest',
      {
        babelrc: false,
        configFile: false,
        presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]],
      },
    ],
  },
  clearMocks: true,
};
