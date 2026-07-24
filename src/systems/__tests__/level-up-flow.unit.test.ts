import { describe, it, expect, beforeEach } from 'vitest';
import type { Upgrade } from '../../types/interfaces';
import {
  LevelUpCoordinator,
  type LevelUpXPProvider,
  type PauseController,
  type LevelUpEventEmitter,
  type LevelUpPayload,
} from '../LevelUpCoordinator';

// --- Fake implementations ---

function createFakeUpgrade(id: string): Upgrade {
  return {
    id,
    name: `Upgrade ${id}`,
    description: `Description for ${id}`,
    apply: () => {},
  };
}

function createFakeXPProvider(
  upgrades: Upgrade[],
): LevelUpXPProvider & { applied: Upgrade[]; removed: string[]; callOrder: string[] } {
  const provider = {
    applied: [] as Upgrade[],
    removed: [] as string[],
    callOrder: [] as string[],
    getRandomUpgrades(count?: number): Upgrade[] {
      const c = count ?? 3;
      return upgrades.slice(0, c);
    },
    applyUpgrade(_player: unknown, upgrade: Upgrade): void {
      provider.applied.push(upgrade);
      provider.callOrder.push('applyUpgrade');
    },
    removeUpgradeFromPool(upgradeId: string): void {
      provider.removed.push(upgradeId);
      provider.callOrder.push('removeUpgradeFromPool');
    },
  };
  return provider;
}

function createFakePauseController(): PauseController & {
  pauseCount: number;
  resumeCount: number;
  isPaused: boolean;
} {
  const controller = {
    isPaused: false,
    pauseCount: 0,
    resumeCount: 0,
    pause(): void {
      controller.isPaused = true;
      controller.pauseCount++;
    },
    resume(): void {
      controller.isPaused = false;
      controller.resumeCount++;
    },
  };
  return controller;
}

type Listener = (...args: unknown[]) => void;

function createFakeEventEmitter(): LevelUpEventEmitter & {
  emitted: Array<{ event: string; args: unknown[] }>;
  trigger(event: string, ...args: unknown[]): void;
  listenerCount(event: string): number;
} {
  const listeners = new Map<string, Listener[]>();
  const emitter = {
    emitted: [] as Array<{ event: string; args: unknown[] }>,
    emit(event: string, ...args: unknown[]): boolean {
      emitter.emitted.push({ event, args });
      const fns = listeners.get(event) || [];
      fns.forEach((fn) => fn(...args));
      return fns.length > 0;
    },
    on(event: string, fn: Listener): unknown {
      const arr = listeners.get(event) || [];
      arr.push(fn);
      listeners.set(event, arr);
      return emitter;
    },
    off(event: string, fn: Listener): unknown {
      const arr = listeners.get(event) || [];
      listeners.set(
        event,
        arr.filter((f) => f !== fn),
      );
      return emitter;
    },
    trigger(event: string, ...args: unknown[]): void {
      const fns = listeners.get(event) || [];
      fns.forEach((fn) => fn(...args));
    },
    listenerCount(event: string): number {
      return (listeners.get(event) || []).length;
    },
  };
  return emitter;
}

// --- Test suite ---

describe('LevelUpCoordinator', () => {
  let upgrades3: Upgrade[];
  let upgrades5: Upgrade[];
  let xpProvider: ReturnType<typeof createFakeXPProvider>;
  let pauseCtrl: ReturnType<typeof createFakePauseController>;
  let emitter: ReturnType<typeof createFakeEventEmitter>;
  let coordinator: LevelUpCoordinator;
  const fakePlayer = { name: 'jaguar' };

  beforeEach(() => {
    upgrades3 = [createFakeUpgrade('u1'), createFakeUpgrade('u2'), createFakeUpgrade('u3')];
    upgrades5 = [
      createFakeUpgrade('a'),
      createFakeUpgrade('b'),
      createFakeUpgrade('c'),
      createFakeUpgrade('d'),
      createFakeUpgrade('e'),
    ];
    xpProvider = createFakeXPProvider(upgrades3);
    pauseCtrl = createFakePauseController();
    emitter = createFakeEventEmitter();
    coordinator = new LevelUpCoordinator(xpProvider, pauseCtrl, emitter, fakePlayer);
  });

  // 1. leveledUp=false → no pause
  it('does not pause when leveledUp is false', () => {
    coordinator.processLevelUp({ leveledUp: false, showPanel: true, newLevel: 2 });
    expect(pauseCtrl.pauseCount).toBe(0);
  });

  // 2. showPanel=false → no pause
  it('does not pause when showPanel is false', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: false, newLevel: 2 });
    expect(pauseCtrl.pauseCount).toBe(0);
  });

  // 3. level 20 (reachedMaxLevel) → no pause, no level-up event
  it('does not pause or emit level-up when showPanel is false (max level scenario)', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: false, newLevel: 20 });
    expect(pauseCtrl.pauseCount).toBe(0);
    expect(emitter.emitted.filter((e) => e.event === 'level-up')).toHaveLength(0);
  });

  // 4. pool empty (getRandomUpgrades returns []) → no pause
  it('does not pause when upgrade pool is empty', () => {
    const emptyProvider = createFakeXPProvider([]);
    const coord = new LevelUpCoordinator(emptyProvider, pauseCtrl, emitter, fakePlayer);
    coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    expect(pauseCtrl.pauseCount).toBe(0);
    coord.destroy();
  });

  // 5. pool empty → no level-up event
  it('does not emit level-up event when upgrade pool is empty', () => {
    const emptyProvider = createFakeXPProvider([]);
    const coord = new LevelUpCoordinator(emptyProvider, pauseCtrl, emitter, fakePlayer);
    coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    expect(emitter.emitted.filter((e) => e.event === 'level-up')).toHaveLength(0);
    coord.destroy();
  });

  // 6. pool with 1 → emits 1 option
  it('emits 1 upgrade option when pool has only 1', () => {
    const oneProvider = createFakeXPProvider([createFakeUpgrade('single')]);
    const coord = new LevelUpCoordinator(oneProvider, pauseCtrl, emitter, fakePlayer);
    coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    const levelUpEvents = emitter.emitted.filter((e) => e.event === 'level-up');
    expect(levelUpEvents).toHaveLength(1);
    const payload = levelUpEvents[0].args[0] as LevelUpPayload;
    expect(payload.upgrades).toHaveLength(1);
    coord.destroy();
  });

  // 7. pool with 2 → emits 2 options
  it('emits 2 upgrade options when pool has only 2', () => {
    const twoProvider = createFakeXPProvider([createFakeUpgrade('x'), createFakeUpgrade('y')]);
    const coord = new LevelUpCoordinator(twoProvider, pauseCtrl, emitter, fakePlayer);
    coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 3 });
    const payload = emitter.emitted.filter((e) => e.event === 'level-up')[0].args[0] as LevelUpPayload;
    expect(payload.upgrades).toHaveLength(2);
    coord.destroy();
  });

  // 8. pool with 3+ → emits exactly 3
  it('emits exactly 3 upgrade options when pool has more than 3', () => {
    const bigProvider = createFakeXPProvider(upgrades5);
    const coord = new LevelUpCoordinator(bigProvider, pauseCtrl, emitter, fakePlayer);
    coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 4 });
    const payload = emitter.emitted.filter((e) => e.event === 'level-up')[0].args[0] as LevelUpPayload;
    expect(payload.upgrades).toHaveLength(3);
    coord.destroy();
  });

  // 9. showPanel=true → pause called once
  it('calls pause exactly once on valid level-up', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    expect(pauseCtrl.pauseCount).toBe(1);
  });

  // 10. level-up payload contains exactly the stored options
  it('level-up payload contains the same upgrades stored in state', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 5 });
    const payload = emitter.emitted.filter((e) => e.event === 'level-up')[0].args[0] as LevelUpPayload;
    const state = coordinator.getState();
    expect(state.status).toBe('choosing');
    if (state.status === 'choosing') {
      expect(payload.upgrades).toEqual(state.upgrades);
    }
  });

  // 11. valid selection → applyUpgrade called
  it('calls applyUpgrade on valid selection', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'u1' });
    expect(xpProvider.applied).toHaveLength(1);
    expect(xpProvider.applied[0].id).toBe('u1');
  });

  // 12. valid selection → removeUpgradeFromPool called
  it('calls removeUpgradeFromPool on valid selection', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'u2' });
    expect(xpProvider.removed).toContain('u2');
  });

  // 13. applyUpgrade called before removeUpgradeFromPool (order check)
  it('calls applyUpgrade before removeUpgradeFromPool', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'u1' });
    expect(xpProvider.callOrder).toEqual(['applyUpgrade', 'removeUpgradeFromPool']);
  });

  // 14. valid selection → resume called once
  it('calls resume once after valid selection', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'u1' });
    expect(pauseCtrl.resumeCount).toBe(1);
  });

  // 15. invalid upgradeId → no applyUpgrade
  it('does not call applyUpgrade for invalid upgradeId', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'nonexistent' });
    expect(xpProvider.applied).toHaveLength(0);
  });

  // 16. upgradeId not in shown options → ignored
  it('ignores upgradeId not in the shown options', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'u99' });
    expect(xpProvider.applied).toHaveLength(0);
    expect(pauseCtrl.resumeCount).toBe(0);
  });

  // 17. double click → only first applied
  it('applies only the first selection on double click', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'u1' });
    emitter.trigger('upgrade-selected', { upgradeId: 'u2' });
    expect(xpProvider.applied).toHaveLength(1);
    expect(xpProvider.applied[0].id).toBe('u1');
  });

  // 18. event after session closed → ignored
  it('ignores upgrade-selected event after session is closed', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'u1' });
    // Session is now closed
    emitter.trigger('upgrade-selected', { upgradeId: 'u2' });
    expect(xpProvider.applied).toHaveLength(1);
  });

  // 19. new session doesn't reuse old options
  it('new session generates fresh upgrade options', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'u1' });

    // Start new session — new upgrades returned
    const newUpgrades = [createFakeUpgrade('new1'), createFakeUpgrade('new2'), createFakeUpgrade('new3')];
    xpProvider.getRandomUpgrades = (count?: number) => newUpgrades.slice(0, count ?? 3);

    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 3 });
    const state = coordinator.getState();
    if (state.status === 'choosing') {
      expect(state.upgrades[0].id).toBe('new1');
    }
  });

  // 20. cleanup → state becomes idle
  it('destroy resets state to idle', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    coordinator.destroy();
    expect(coordinator.getState().status).toBe('idle');
  });

  // 21. cleanup → listener removed
  it('destroy removes event listener', () => {
    const listenersBefore = emitter.listenerCount('upgrade-selected');
    coordinator.destroy();
    const listenersAfter = emitter.listenerCount('upgrade-selected');
    expect(listenersAfter).toBe(listenersBefore - 1);
  });

  // 22. re-instantiation doesn't duplicate listeners
  it('re-instantiation does not duplicate listeners after destroy', () => {
    coordinator.destroy();
    const coord2 = new LevelUpCoordinator(xpProvider, pauseCtrl, emitter, fakePlayer);
    expect(emitter.listenerCount('upgrade-selected')).toBe(1);
    coord2.destroy();
  });

  // 23. doesn't resume a pause not initiated by level-up
  it('does not resume if pause was not initiated by level-up', () => {
    // Externally pause the game
    pauseCtrl.pause();
    pauseCtrl.pauseCount = 0; // reset counter

    // No level-up flow has started, simulate a stray event
    emitter.trigger('upgrade-selected', { upgradeId: 'u1' });
    expect(pauseCtrl.resumeCount).toBe(0);
  });

  // 24. selection doesn't modify XP directly (doesn't call addXP again)
  it('selection does not call addXP on the player', () => {
    let addXPCalled = false;
    const trackedPlayer = {
      addXP: () => {
        addXPCalled = true;
        return { leveledUp: false, newLevel: 1, excessXp: 0, reachedMaxLevel: false };
      },
    };
    const coord = new LevelUpCoordinator(xpProvider, pauseCtrl, emitter, trackedPlayer);
    coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'u1' });
    expect(addXPCalled).toBe(false);
    coord.destroy();
  });

  // 25. no new options generated on selection (uses stored ones)
  it('does not call getRandomUpgrades again during selection', () => {
    let getRandomCalls = 0;
    xpProvider.getRandomUpgrades = (count?: number) => {
      getRandomCalls++;
      return upgrades3.slice(0, count ?? 3);
    };

    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    expect(getRandomCalls).toBe(1);

    emitter.trigger('upgrade-selected', { upgradeId: 'u1' });
    expect(getRandomCalls).toBe(1); // no additional call
  });
});
