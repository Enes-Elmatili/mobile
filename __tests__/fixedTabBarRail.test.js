/**
 * FixedTabBar sur iPhone Duo : quand le système range la barre d'état dans un
 * rail vertical (useVerticalBarEdgeIOS ≠ null), la navigation s'y range aussi,
 * calée en bas sous l'heure — comme la tab bar native (HIG « Designing for
 * iPhone Duo » : « Dynamic Island, status bar, toolbar, and tab bar »). Le rail
 * suit le côté du système ; sans rail, la pilule flottante habituelle.
 */
const React = require('react');
const { StyleSheet } = require('react-native');
const { render } = require('@testing-library/react-native');

let mockEdge = null;
jest.mock('expo-status-bar', () => ({ useVerticalBarEdgeIOS: () => mockEdge }));
jest.mock('expo-blur', () => ({ BlurView: ({ children }) => children ?? null }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 84 }),
}));

const { FixedTabBar } = require('../components/ui/FixedTabBar');

function makeProps(insets) {
  const names = ['dashboard', 'documents', 'profile'];
  const routes = names.map((name) => ({ key: `${name}-key`, name }));
  const descriptors = Object.fromEntries(routes.map((r) => [r.key, { options: { title: r.name } }]));
  return {
    state: { index: 0, routes },
    descriptors,
    emitter: { emit: () => ({ defaultPrevented: false }) },
    navigateToTab: () => {},
    insets,
  };
}

describe('FixedTabBar — rail système du Duo', () => {
  beforeEach(() => { mockEdge = null; });

  it('rail à droite : navigation collée au bord droit, sur la largeur du rail, avec les onglets', () => {
    mockEdge = 'trailing';
    const r = render(React.createElement(FixedTabBar, makeProps({ top: 0, bottom: 34, left: 0, right: 84 })));
    const style = StyleSheet.flatten(r.getByTestId('tab-rail').props.style);
    expect(style.right).toBe(0);
    expect(style.left).toBeUndefined();
    expect(style.width).toBe(84);
    expect(['tab-dashboard', 'tab-documents', 'tab-profile'].every((id) => r.queryByTestId(id))).toBe(true);
  });

  it('rail à gauche (leading) : la navigation suit le système à gauche', () => {
    mockEdge = 'leading';
    const r = render(React.createElement(FixedTabBar, makeProps({ top: 0, bottom: 34, left: 84, right: 0 })));
    const style = StyleSheet.flatten(r.getByTestId('tab-rail').props.style);
    expect(style.left).toBe(0);
    expect(style.right).toBeUndefined();
    expect(style.width).toBe(84);
  });

  it('pas de rail (iPhone classique, Duo tourné en portrait) : pas de rail', () => {
    mockEdge = null;
    const r = render(React.createElement(FixedTabBar, makeProps({ top: 59, bottom: 34, left: 0, right: 0 })));
    expect(r.queryByTestId('tab-rail')).toBeNull();
    expect(r.queryByTestId('tab-dashboard')).toBeTruthy();
  });
});
