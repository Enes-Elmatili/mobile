// Wrapper dev-only pour les logs — silencieux en production
//
// Règle des erreurs :
//   - échec cosmétique ou local (cache, haptique, splash, préférence) → `.catch(() => {})`
//     reste acceptable : rien ne change pour l'utilisateur ;
//   - échec d'un appel serveur qui change ce que l'utilisateur voit ou perd une
//     donnée → `reportError(e, 'contexte')` : console en dev, Sentry en production.
//   - en production, devError laisse une trace (breadcrumb) : un plantage
//     ultérieur arrive dans Sentry avec ce qui s'est passé avant.
export const devLog   = (...args: any[]) => { if (__DEV__) console.log(...args); };
export const devWarn  = (...args: any[]) => { if (__DEV__) console.warn(...args); };
export const devError = (...args: any[]) => {
  if (__DEV__) { console.error(...args); return; }
  sentry()?.addBreadcrumb({ category: 'devError', level: 'error', message: args.map(describe).join(' ').slice(0, 500) });
};

/**
 * Une erreur qui ne doit pas passer inaperçue mais ne mérite pas d'écran
 * d'erreur : l'app continue, l'équipe est prévenue. `context` regroupe les
 * occurrences dans Sentry (ex. 'addresses.list').
 */
export function reportError(error: unknown, context: string): void {
  if (__DEV__) { console.warn(`[${context}]`, error); return; }
  sentry()?.captureException(error instanceof Error ? error : new Error(describe(error)), {
    level: 'warning',
    tags: { context },
  });
}

// Sentry chargé à la demande, en production seulement : les tests et le dev
// ne l'importent jamais.
type SentryLike = Pick<typeof import('@sentry/react-native'), 'addBreadcrumb' | 'captureException'>;
let sentryModule: SentryLike | null | undefined;
function sentry(): SentryLike | null {
  if (sentryModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- chargement paresseux voulu
      sentryModule = require('@sentry/react-native') as SentryLike;
    } catch {
      sentryModule = null;
    }
  }
  return sentryModule;
}

function describe(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}
