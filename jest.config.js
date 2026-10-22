module.exports = {
  preset: 'jest-expo',
  // Reanimated 4.7 / Worklets 0.13 : écarte leurs fichiers .native, sinon les modules natifs sont chargés en test.
  resolver: 'react-native-reanimated/jest/resolver',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@gorhom/.*|react-native-reanimated|react-native-worklets|test-renderer|standard-navigation))',
  ],
};
