/**
 * FixedTabBar branchée sur le VRAI Expo Router (renderRouter) : on vérifie
 * la chaîne complète Tabs.Screen `href: null` → React Navigation →
 * descriptors → onglets rendus, sans simuler les descripteurs à la main.
 */
const React = require('react');
const { renderRouter } = require('expo-router/testing-library');
const { Text } = require('react-native');

jest.mock('expo-blur', () => ({ BlurView: ({ children }) => children ?? null }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    initialWindowMetrics: { insets: { top: 0, bottom: 0, left: 0, right: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } },
    SafeAreaInsetsContext: React.createContext({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const { Tabs } = require('expo-router');
const { FixedTabBar } = require('../components/ui/FixedTabBar');

const Page = (label) => () => React.createElement(Text, null, label);

function layoutFor(role) {
  const isProvider = role === 'provider';
  return function Layout() {
    return React.createElement(
      Tabs,
      { tabBar: (props) => React.createElement(FixedTabBar, props), screenOptions: { headerShown: false } },
      React.createElement(Tabs.Screen, { name: 'dashboard', options: { title: 'Accueil' } }),
      React.createElement(Tabs.Screen, { name: 'missions', options: { title: 'Missions', href: isProvider ? undefined : null } }),
      React.createElement(Tabs.Screen, { name: 'documents', options: { title: 'Documents', href: isProvider ? null : undefined } }),
      React.createElement(Tabs.Screen, { name: 'wallet', options: { title: 'Gains', href: isProvider ? undefined : null } }),
      React.createElement(Tabs.Screen, { name: 'profile', options: { title: 'Profil' } }),
      React.createElement(Tabs.Screen, { name: 'provider-dashboard', options: { href: null } }),
    );
  };
}

function routes(role) {
  return {
    '(tabs)/_layout': layoutFor(role),
    '(tabs)/dashboard': Page('dashboard-page'),
    '(tabs)/missions': Page('missions-page'),
    '(tabs)/documents': Page('documents-page'),
    '(tabs)/wallet': Page('wallet-page'),
    '(tabs)/profile': Page('profile-page'),
    '(tabs)/provider-dashboard': Page('provider-dashboard-page'),
  };
}

const tabLabels = (r) => r.getAllByRole('tab').map((t) => t.props.accessibilityLabel);

describe('FixedTabBar dans le vrai Expo Router', () => {
  it('client : Accueil, Documents, Profil', async () => {
    const r = renderRouter(routes('client'), { initialUrl: '/dashboard' });
    expect(await r.findByText('dashboard-page')).toBeTruthy();
    expect(tabLabels(r)).toEqual(['Accueil', 'Documents', 'Profil']);
  });

  it('prestataire : Accueil, Missions, Gains, Profil', async () => {
    const r = renderRouter(routes('provider'), { initialUrl: '/dashboard' });
    expect(await r.findByText('dashboard-page')).toBeTruthy();
    expect(tabLabels(r)).toEqual(['Accueil', 'Missions', 'Gains', 'Profil']);
  });

  it('prestataire sur /provider-dashboard : mêmes onglets, Accueil sélectionné', async () => {
    const r = renderRouter(routes('provider'), { initialUrl: '/provider-dashboard' });
    expect(await r.findByText('provider-dashboard-page')).toBeTruthy();
    expect(tabLabels(r)).toEqual(['Accueil', 'Missions', 'Gains', 'Profil']);
    const selected = r.getAllByRole('tab').filter((t) => t.props.accessibilityState?.selected).map((t) => t.props.accessibilityLabel);
    expect(selected).toEqual(['Accueil']);
  });
});
