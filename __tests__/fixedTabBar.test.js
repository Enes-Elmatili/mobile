/**
 * FixedTabBar — les onglets de l'autre rôle doivent être cachés.
 * Expo Router ne transmet pas `href` au tabBar custom : il marque la route
 * cachée avec `tabBarItemStyle: { display: 'none' }` (TabsClient pour
 * `href: null`, useScreens pour les routes internes). On simule ce que
 * React Navigation fournit (state + descriptors) et on lit les onglets rendus.
 */
const React = require('react');
const { render } = require('@testing-library/react-native');

jest.mock('expo-blur', () => ({ BlurView: ({ children }) => children ?? null }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const { FixedTabBar } = require('../components/ui/FixedTabBar');

function makeProps({ hidden, active }) {
  const names = ['dashboard', 'missions', 'documents', 'wallet', 'profile', 'provider-dashboard'];
  const routes = names.map((name) => ({ key: `${name}-key`, name }));
  const descriptors = Object.fromEntries(routes.map((r) => [r.key, {
    options: {
      title: r.name,
      ...(hidden.includes(r.name) ? { tabBarItemStyle: { display: 'none' }, tabBarButton: () => null } : {}),
    },
  }]));
  return {
    state: { index: names.indexOf(active), routes },
    descriptors,
    navigation: { emit: () => ({ defaultPrevented: false }), navigate: () => {} },
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  };
}

describe('FixedTabBar — onglets par rôle', () => {
  it('client : Accueil, Documents, Profil seulement', () => {
    const { queryAllByRole } = render(React.createElement(FixedTabBar, makeProps({ hidden: ['missions', 'wallet', 'provider-dashboard'], active: 'dashboard' })));
    const tabs = queryAllByRole('tab').map((t) => t.props.accessibilityLabel);
    expect(tabs).toEqual(['dashboard', 'documents', 'profile']);
  });
  it('prestataire : Accueil, Missions, Gains, Profil seulement', () => {
    const { queryAllByRole } = render(React.createElement(FixedTabBar, makeProps({ hidden: ['documents', 'provider-dashboard'], active: 'provider-dashboard' })));
    const tabs = queryAllByRole('tab').map((t) => t.props.accessibilityLabel);
    expect(tabs).toEqual(['dashboard', 'missions', 'wallet', 'profile']);
  });
  it('prestataire sur provider-dashboard (route cachée) : Accueil est marqué sélectionné', () => {
    const { queryAllByRole } = render(React.createElement(FixedTabBar, makeProps({ hidden: ['documents', 'provider-dashboard'], active: 'provider-dashboard' })));
    const selected = queryAllByRole('tab').filter((t) => t.props.accessibilityState?.selected).map((t) => t.props.accessibilityLabel);
    expect(selected).toEqual(['dashboard']);
  });
});
