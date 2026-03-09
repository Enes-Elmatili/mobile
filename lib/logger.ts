// Wrapper dev-only pour les logs — silencieux en production
export const devLog   = (...args: any[]) => { if (__DEV__) console.log(...args); };
export const devWarn  = (...args: any[]) => { if (__DEV__) console.warn(...args); };
export const devError = (...args: any[]) => { if (__DEV__) console.error(...args); };
