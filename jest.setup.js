// Gesture Handler 3 : module natif et détecteurs remplacés par ses mocks.
require('react-native-gesture-handler/jestSetup');
// Le lien avec le runtime UI de Worklets n'existe pas sous Jest (setImmediate qui casse la suite).
jest.mock('react-native-gesture-handler/src/handlers/gestures/installUIRuntimeBindings', () => ({ installUIRuntimeBindings: () => {} }));
jest.mock('react-native-gesture-handler/lib/module/handlers/gestures/installUIRuntimeBindings', () => ({ installUIRuntimeBindings: () => {} }));

// Reanimated mock (ships with the library)
require('react-native-reanimated').setUpTests?.();

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
