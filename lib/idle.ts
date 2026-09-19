// lib/idle.ts — « quand le fil JS respire ». Remplace InteractionManager
// (retiré de React Native 0.88) : `requestIdleCallback` attend un creux du
// fil JS, avec une échéance pour ne jamais retarder un chargement de plus
// de `timeoutMs` — un écran qui s'ouvre doit avoir ses données, pas attendre
// la fin d'une transition qui, chez nous, tourne sur le thread UI de toute façon.
// Sans `requestIdleCallback` (jest, web ancien), un simple tick suffit.
export type IdleTask = { cancel: () => void };

export function runWhenIdle(fn: () => void, timeoutMs: number = 300): IdleTask {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(() => fn(), { timeout: timeoutMs });
    return { cancel: () => cancelIdleCallback(id) };
  }
  const t = setTimeout(fn, 0);
  return { cancel: () => clearTimeout(t) };
}
