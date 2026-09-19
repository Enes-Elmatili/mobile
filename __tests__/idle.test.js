// lib/idle.ts — remplaçant d'InteractionManager (retiré de RN 0.88).
const { runWhenIdle } = require('@/lib/idle');

describe('runWhenIdle', () => {
  it('appelle la tâche dans un creux, et une tâche annulée ne part pas', async () => {
    const ran = jest.fn();
    runWhenIdle(ran, 50);
    const cancelled = jest.fn();
    runWhenIdle(cancelled, 50).cancel();
    await new Promise((r) => setTimeout(r, 120));
    expect(ran).toHaveBeenCalledTimes(1);
    expect(cancelled).not.toHaveBeenCalled();
  });
});
