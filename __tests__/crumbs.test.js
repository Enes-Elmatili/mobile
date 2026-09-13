const { deriveCrumbs } = require('../lib/request/crumbs');

describe('deriveCrumbs — puces des décisions prises (StepHeader)', () => {
  it('rien à l’étape 1 ni à l’étape 4', () => {
    expect(deriveCrumbs({ step: 1, address: 'Avenue Louise 143, 1050 Ixelles', serviceName: 'Débouchage' })).toEqual([]);
    expect(deriveCrumbs({ step: 4, address: 'Avenue Louise 143, 1050 Ixelles', serviceName: 'Débouchage' })).toEqual([]);
  });
  it('étape 2 : l’adresse seule, tronquée à la première virgule', () => {
    expect(deriveCrumbs({ step: 2, address: 'Avenue Louise 143, 1050 Ixelles', serviceName: 'Débouchage' }))
      .toEqual([{ step: 1, label: 'Avenue Louise 143' }]);
  });
  it('étape 3 : adresse puis prestation', () => {
    expect(deriveCrumbs({ step: 3, address: 'Rue Haute 12, 1000 Bruxelles', serviceName: 'Fuite d’eau' }))
      .toEqual([{ step: 1, label: 'Rue Haute 12' }, { step: 2, label: 'Fuite d’eau' }]);
  });
  it('ignore les valeurs absentes', () => {
    expect(deriveCrumbs({ step: 3, address: null, serviceName: null })).toEqual([]);
  });
});
