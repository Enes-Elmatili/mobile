// Dédoublonnage de navigations déclenchées par plusieurs sources
// (ex: API response immédiate + socket event différé).
//
// Quand un écran navigue de lui-même (ex: handleComplete → /earnings),
// il appelle markCompletionHandled(id). Le SocketContext, en recevant
// ensuite request:completed, vérifie isCompletionHandled() avant de
// re-naviguer — évite le double-mount du screen cible.

const completedNav = new Set<string>();

export function markCompletionHandled(reqId: string | number): void {
  completedNav.add(String(reqId));
  // Auto-cleanup au bout de 60s pour ne pas garder en mémoire indéfiniment.
  setTimeout(() => completedNav.delete(String(reqId)), 60_000);
}

export function isCompletionHandled(reqId: string | number): boolean {
  return completedNav.has(String(reqId));
}
