/**
 * InsetScope : sur l'écran interne du Duo, la barre d'état vit dans un rail de
 * 84 pt. Chaque écran doit s'arrêter à son bord, et ses enfants doivent voir
 * l'inset de ce côté à 0 — sinon un SafeAreaView le rajoute une seconde fois.
 */
const React = require('react');
const { StyleSheet, Text } = require('react-native');
const { render } = require('@testing-library/react-native');

let mockParent = { top: 0, bottom: 34, left: 0, right: 84 };
const mockProviders = [];
jest.mock('react-native-safe-area-context', () => {
  const R = require('react');
  const Ctx = R.createContext(null);
  return {
    useSafeAreaInsets: () => R.useContext(Ctx) ?? mockParent,
    SafeAreaProvider: ({ initialMetrics, children }) => {
      mockProviders.push(initialMetrics);
      return R.createElement(Ctx.Provider, { value: initialMetrics.insets }, children);
    },
  };
});

const { InsetScope, insetsWithin } = require('../lib/layout/InsetScope');
const { useSafeAreaInsets } = require('react-native-safe-area-context');

function Probe() {
  const i = useSafeAreaInsets();
  return React.createElement(Text, { testID: 'probe' }, `${i.top},${i.right},${i.bottom},${i.left}`);
}

describe('insetsWithin', () => {
  it('retire le décalage déjà posé, garde haut et bas', () => {
    expect(insetsWithin({ top: 0, bottom: 34, left: 0, right: 84 }, { left: 0, right: 84 })).toEqual({ top: 0, bottom: 34, left: 0, right: 0 });
  });
  it('un rail plus large que l’inset (onglets) ne donne jamais un inset négatif', () => {
    expect(insetsWithin({ top: 0, bottom: 34, left: 84, right: 0 }, { left: 92, right: 0 })).toEqual({ top: 0, bottom: 34, left: 0, right: 0 });
  });
  it('iPhone : rien à retirer', () => {
    expect(insetsWithin({ top: 59, bottom: 34, left: 0, right: 0 }, { left: 0, right: 0 })).toEqual({ top: 59, bottom: 34, left: 0, right: 0 });
  });
});

describe('InsetScope', () => {
  beforeEach(() => { mockProviders.length = 0; });

  it('Duo déplié, rail à droite : le conteneur s’arrête au rail, les enfants voient right = 0', () => {
    mockParent = { top: 0, bottom: 34, left: 0, right: 84 };
    const r = render(React.createElement(InsetScope, null, React.createElement(Probe)));
    const container = StyleSheet.flatten(r.toJSON().props.style);
    expect(container.paddingRight).toBe(84);
    expect(container.paddingLeft).toBe(0);
    expect(r.getByTestId('probe').props.children).toBe('0,0,34,0');
  });

  it('pad explicite (scène d’onglets) : décalage imposé, enfants à 0 de ce côté', () => {
    mockParent = { top: 0, bottom: 34, left: 84, right: 0 };
    const r = render(React.createElement(InsetScope, { pad: { left: 84, right: 0 } }, React.createElement(Probe)));
    expect(StyleSheet.flatten(r.toJSON().props.style).paddingLeft).toBe(84);
    expect(r.getByTestId('probe').props.children).toBe('0,0,34,0');
  });

  it('iPhone : même arbre (rien ne se démonte au pliage), aucun décalage', () => {
    mockParent = { top: 59, bottom: 34, left: 0, right: 0 };
    const r = render(React.createElement(InsetScope, null, React.createElement(Probe)));
    const container = StyleSheet.flatten(r.toJSON().props.style);
    expect(container.paddingLeft).toBe(0);
    expect(container.paddingRight).toBe(0);
    expect(mockProviders).toHaveLength(1);
    expect(r.getByTestId('probe').props.children).toBe('59,0,34,0');
  });
});
