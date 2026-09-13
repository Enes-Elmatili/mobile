// lib/request/crumbs.ts
// Les décisions déjà prises dans le stepper, sous forme de puces touchables
// (StepHeader). Rien à l'étape 1 (rien de décidé) ni à l'étape 4 (le récap
// prend le relais). Pur : testé dans __tests__/crumbs.test.js.
export type Crumb = { step: 1 | 2; label: string };

export function deriveCrumbs(input: { step: number; address: string | null; serviceName: string | null }): Crumb[] {
  const { step, address, serviceName } = input;
  if (step < 2 || step > 3) return [];
  const out: Crumb[] = [];
  if (address) out.push({ step: 1, label: address.split(',')[0].trim() });
  if (step >= 3 && serviceName) out.push({ step: 2, label: serviceName });
  return out;
}
