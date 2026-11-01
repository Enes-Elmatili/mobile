// La règle des erreurs (lib/logger) : en production, une erreur signalée part
// dans Sentry avec son contexte, et devError laisse une trace pour le prochain
// plantage. En dev, rien ne part : la console suffit.
const mockCapture = jest.fn();
const mockBreadcrumb = jest.fn();
jest.mock('@sentry/react-native', () => ({ captureException: mockCapture, addBreadcrumb: mockBreadcrumb }));

type Logger = typeof import('../logger');
const g = globalThis as unknown as { __DEV__: boolean };

function loadLogger(dev: boolean): Logger {
  g.__DEV__ = dev;
  let mod!: Logger;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- rechargé à chaque cas, après avoir fixé __DEV__
  jest.isolateModules(() => { mod = require('../logger'); });
  return mod;
}

const originalDev = g.__DEV__;
afterEach(() => { g.__DEV__ = originalDev; jest.clearAllMocks(); jest.restoreAllMocks(); });

describe('reportError', () => {
  it('production : Sentry reçoit l’erreur, niveau warning, taguée par son contexte', () => {
    const { reportError } = loadLogger(false);
    const err = new Error('500 Internal');
    reportError(err, 'settings.addresses');
    expect(mockCapture).toHaveBeenCalledWith(err, { level: 'warning', tags: { context: 'settings.addresses' } });
  });

  it('production : une valeur qui n’est pas une Error devient une Error lisible', () => {
    const { reportError } = loadLogger(false);
    reportError({ status: 401, error: 'expired' }, 'messages.mark_read');
    const sent = mockCapture.mock.calls[0][0] as Error;
    expect(sent).toBeInstanceOf(Error);
    expect(sent.message).toBe('{"status":401,"error":"expired"}');
  });

  it('dev : console seulement, Sentry jamais appelé', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { reportError } = loadLogger(true);
    reportError(new Error('x'), 'ctx');
    expect(warn).toHaveBeenCalledWith('[ctx]', expect.any(Error));
    expect(mockCapture).not.toHaveBeenCalled();
  });
});

describe('devError', () => {
  it('production : une trace (breadcrumb), pas un événement', () => {
    const { devError } = loadLogger(false);
    devError('Payment init error:', new Error('boom'));
    expect(mockBreadcrumb).toHaveBeenCalledWith({ category: 'devError', level: 'error', message: 'Payment init error: Error: boom' });
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('dev : console.error, aucune trace Sentry', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { devError } = loadLogger(true);
    devError('x');
    expect(error).toHaveBeenCalledWith('x');
    expect(mockBreadcrumb).not.toHaveBeenCalled();
  });
});
