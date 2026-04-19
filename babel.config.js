module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json', '.native.js'],
          alias: {
            '@features': './src/features',
            '@shared': './src/shared',
            '@constants': './src/constants',
            '@models': './src/types',
            '@navigation': './src/navigation',
            '@app': './src/app',
          },
        },
      ],
    ],
  };
};
