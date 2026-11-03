// Pont JS de modules/fixed-hinge : optionnel, partagé, sans re-rendu inutile.
// Chaque cas recharge le module avec un faux natif : React et le renderer sont
// rechargés dans le même registre, sinon deux copies de React coexistent.
// Le renderer est donc chargé dans le test : pas de nettoyage automatique.
process.env.RNTL_SKIP_AUTO_CLEANUP = 'true';

function loadWith(native) {
  jest.resetModules();
  jest.doMock('expo', () => ({ ...jest.requireActual('expo'), requireOptionalNativeModule: () => native }));
  return {
    ...require('@/lib/layout/hinge'),
    React: require('react'),
    Text: require('react-native').Text,
    ...require('@testing-library/react-native'),
  };
}

function fakeNative(initial) {
  const listeners = { onChange: new Set(), onAngle: new Set() };
  let state = initial;
  return {
    getState: () => state,
    getAngle: () => 172,
    addListener: (event, fn) => { listeners[event].add(fn); return { remove: () => listeners[event].delete(fn) }; },
    emit(next) { state = next; listeners.onChange.forEach((fn) => fn({ state: next })); },
    count: (event) => listeners[event].size,
  };
}

describe('lib/layout/hinge', () => {
  it('sans module natif : pas de charnière, rien ne plante', () => {
    const { useHinge, HINGE_SUPPORTED, React, Text, render } = loadWith(null);
    function Probe() { return React.createElement(Text, null, String(useHinge()?.posture)); }
    const r = render(React.createElement(Probe));
    expect(HINGE_SUPPORTED).toBe(false);
    expect(r.getByText('undefined')).toBeTruthy();
  });

  it('suit la posture, un seul abonnement natif, désabonné au démontage', async () => {
    const native = fakeNative({ posture: 'fully-open', fold: { x: 455, y: 0, width: 40, height: 669, separating: false } });
    const { useHinge, React, Text, render, act } = loadWith(native);
    let renders = 0;
    function Probe() { renders++; return React.createElement(Text, null, useHinge()?.posture); }
    const r = render(React.createElement(React.Fragment, null, React.createElement(Probe), React.createElement(Probe)));
    expect(r.getAllByText('fully-open')).toHaveLength(2);
    expect(native.count('onChange')).toBe(1);

    const before = renders;
    // Même état, nouvel objet : aucun re-rendu.
    await act(async () => { native.emit({ posture: 'fully-open', fold: { x: 455, y: 0, width: 40, height: 669, separating: false } }); });
    expect(renders).toBe(before);

    await act(async () => { native.emit({ posture: 'partially-open', fold: { x: 455, y: 0, width: 40, height: 669, separating: true } }); });
    expect(r.getAllByText('partially-open')).toHaveLength(2);

    r.unmount();
    expect(native.count('onChange')).toBe(0);
  });
});
