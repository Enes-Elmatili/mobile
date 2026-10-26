// Reanimated mock (ships with the library)
require('react-native-reanimated').setUpTests?.();

// Gesture Handler 3 : mocks officiels (module natif, détecteurs).
require('react-native-gesture-handler/jestSetup');
// GH 3 exige un GestureHandlerRootView parent (app/_layout le fournit) : les
// tests montent les composants seuls, on leur donne ce contexte d'office.
for (const path of [
  'react-native-gesture-handler/src/GestureHandlerRootViewContext',
  'react-native-gesture-handler/lib/module/GestureHandlerRootViewContext',
]) {
  jest.mock(path, () => ({ __esModule: true, default: require('react').createContext(true) }));
}
// Pas de runtime UI Worklets en test : l'installation des bindings GH lève.
for (const path of [
  'react-native-gesture-handler/src/handlers/gestures/installUIRuntimeBindings',
  'react-native-gesture-handler/lib/module/handlers/gestures/installUIRuntimeBindings',
]) {
  jest.mock(path, () => ({ installUIRuntimeBindings: () => {} }));
}

jest.mock('expo-glass-effect', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GlassView: (props) => React.createElement(View, props),
    GlassContainer: (props) => React.createElement(View, props),
    isLiquidGlassAvailable: () => false,
    isGlassEffectAPIAvailable: () => false,
  };
});
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
