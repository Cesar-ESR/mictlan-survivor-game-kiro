import { describe, it, expect, beforeEach } from 'vitest';
import {
  LevelUpCoordinator,
  type PauseController,
  type LevelUpEventEmitter,
  type WeaponSystemUpgradeAPI,
  type MemoryLevelUpPayload,
} from '../LevelUpCoordinator';
import type { MemoryUpgrade } from '../../config/memory-upgrades';
import { createInitialMemories } from '../../config/memory-upgrades';

// --- Fake implementations ---

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
      listeners.set(event, arr.filter((f) => f !== fn));
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

function createFakeWeaponSystem(): WeaponSystemUpgradeAPI {
  let damage = 10;
  let fireRateMs = 1000;
  let range = 384;
  let projectileSpeed = 600;
  let maxDistance = 450;
  return {
    getDamage: () => damage,
    increaseDamage: (amount: number) => { damage += amount; },
    getFireRateMs: () => fireRateMs,
    reduceFireRate: (amountMs: number, minimumMs: number) => {
      fireRateMs = Math.max(fireRateMs - amountMs, minimumMs);
    },
    getRange: () => range,
    increaseRange: (amount: number) => { range += amount; },
    getProjectileSpeed: () => projectileSpeed,
    increaseProjectileSpeed: (amount: number) => { projectileSpeed += amount; },
    getMaxDistance: () => maxDistance,
    increaseMaxDistance: (amount: number) => { maxDistance += amount; },
  };
}

describe('LevelUpCoordinator', () => {
  let memories: MemoryUpgrade[];
  let pauseCtrl: ReturnType<typeof createFakePauseController>;
  let emitter: ReturnType<typeof createFakeEventEmitter>;
  let coordinator: LevelUpCoordinator;
  let fakeWeapon: WeaponSystemUpgradeAPI;
  const fakePlayer = { hp: 100, maxHp: 100, speed: 200 };

  beforeEach(() => {
    memories = createInitialMemories();
    pauseCtrl = createFakePauseController();
    emitter = createFakeEventEmitter();
    fakeWeapon = createFakeWeaponSystem();
    coordinator = new LevelUpCoordinator(memories, pauseCtrl, emitter, fakePlayer, fakeWeapon);
  });

  it('does not pause when leveledUp is false', () => {
    coordinator.processLevelUp({ leveledUp: false, showPanel: true, newLevel: 2 });
    expect(pauseCtrl.pauseCount).toBe(0);
  });

  it('does not pause when showPanel is false', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: false, newLevel: 2 });
    expect(pauseCtrl.pauseCount).toBe(0);
  });

  it('does not pause or emit level-up when showPanel is false (max level)', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: false, newLevel: 20 });
    expect(pauseCtrl.pauseCount).toBe(0);
    expect(emitter.emitted.filter((e) => e.event === 'level-up')).toHaveLength(0);
  });

  it('does not pause when all memories are maxed', () => {
    memories.forEach((m) => { m.level = m.maxLevel; });
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    expect(pauseCtrl.pauseCount).toBe(0);
  });

  it('does not emit level-up event when all memories are maxed', () => {
    memories.forEach((m) => { m.level = m.maxLevel; });
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    expect(emitter.emitted.filter((e) => e.event === 'level-up')).toHaveLength(0);
  });

  it('emits 1 memory option when only 1 is available', () => {
    memories[0].level = 6;
    memories[1].level = 6;
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    const events = emitter.emitted.filter((e) => e.event === 'level-up');
    expect(events).toHaveLength(1);
    const payload = events[0].args[0] as MemoryLevelUpPayload;
    expect(payload.memories).toHaveLength(1);
  });

  it('emits 2 memory options when 2 are available', () => {
    memories[0].level = 6;
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 3 });
    const payload = emitter.emitted.filter((e) => e.event === 'level-up')[0].args[0] as MemoryLevelUpPayload;
    expect(payload.memories).toHaveLength(2);
  });

  it('emits exactly 3 memory options when all are available', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 4 });
    const payload = emitter.emitted.filter((e) => e.event === 'level-up')[0].args[0] as MemoryLevelUpPayload;
    expect(payload.memories).toHaveLength(3);
  });

  it('calls pause exactly once on valid level-up', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    expect(pauseCtrl.pauseCount).toBe(1);
  });

  it('level-up payload contains the same memories stored in state', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 5 });
    const payload = emitter.emitted.filter((e) => e.event === 'level-up')[0].args[0] as MemoryLevelUpPayload;
    const state = coordinator.getState();
    expect(state.status).toBe('choosing');
    if (state.status === 'choosing') {
      expect(payload.memories).toEqual(state.memories);
    }
  });

  it('applies memory effect on valid selection', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'memory-war' });
    expect(fakeWeapon.getDamage()).toBe(18);
  });

  it('increments memory level on valid selection', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'memory-war' });
    expect(memories[0].level).toBe(1);
  });

  it('applies effect before incrementing level', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'memory-war' });
    expect(fakeWeapon.getDamage()).toBe(18);
    expect(memories[0].level).toBe(1);
  });

  it('calls resume once after valid selection', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'memory-war' });
    // Guerra has narrative content, so resume happens after fragment-closed
    emitter.trigger('memory-fragment-closed');
    expect(pauseCtrl.resumeCount).toBe(1);
  });

  it('does not apply effect for invalid upgradeId', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'nonexistent' });
    expect(fakeWeapon.getDamage()).toBe(10);
  });

  it('ignores upgradeId not in the shown options', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'u99' });
    expect(fakeWeapon.getDamage()).toBe(10);
    expect(pauseCtrl.resumeCount).toBe(0);
  });

  it('applies only the first selection on double click', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'memory-war' });
    emitter.trigger('upgrade-selected', { upgradeId: 'memory-family' });
    expect(fakeWeapon.getDamage()).toBe(18);
    expect(memories[0].level).toBe(1);
    expect(memories[1].level).toBe(0);
  });

  it('ignores upgrade-selected event after session is closed', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'memory-war' });
    emitter.trigger('upgrade-selected', { upgradeId: 'memory-family' });
    expect(memories[1].level).toBe(0);
  });

  it('new session generates fresh memory options', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'memory-war' });
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 3 });
    const state = coordinator.getState();
    if (state.status === 'choosing') {
      expect(state.memories).toHaveLength(3);
    }
  });

  it('destroy resets state to idle', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    coordinator.destroy();
    expect(coordinator.getState().status).toBe('idle');
  });

  it('destroy removes event listener', () => {
    const listenersBefore = emitter.listenerCount('upgrade-selected');
    coordinator.destroy();
    const listenersAfter = emitter.listenerCount('upgrade-selected');
    expect(listenersAfter).toBe(listenersBefore - 1);
  });

  it('re-instantiation does not duplicate listeners after destroy', () => {
    coordinator.destroy();
    const coord2 = new LevelUpCoordinator(memories, pauseCtrl, emitter, fakePlayer, fakeWeapon);
    expect(emitter.listenerCount('upgrade-selected')).toBe(1);
    coord2.destroy();
  });

  it('does not resume if pause was not initiated by level-up', () => {
    pauseCtrl.pause();
    pauseCtrl.pauseCount = 0;
    emitter.trigger('upgrade-selected', { upgradeId: 'memory-war' });
    expect(pauseCtrl.resumeCount).toBe(0);
  });

  it('selection does not call addXP on the player', () => {
    let addXPCalled = false;
    const trackedPlayer = {
      hp: 100,
      maxHp: 100,
      speed: 200,
      addXP: () => {
        addXPCalled = true;
        return { leveledUp: false, newLevel: 1, excessXp: 0, reachedMaxLevel: false };
      },
    };
    const coord = new LevelUpCoordinator(memories, pauseCtrl, emitter, trackedPlayer, fakeWeapon);
    coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    emitter.trigger('upgrade-selected', { upgradeId: 'memory-war' });
    expect(addXPCalled).toBe(false);
    coord.destroy();
  });

  it('memories are always presented in order: war, family, home', () => {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
    const payload = emitter.emitted.filter((e) => e.event === 'level-up')[0].args[0] as MemoryLevelUpPayload;
    expect(payload.memories[0].id).toBe('memory-war');
    expect(payload.memories[1].id).toBe('memory-family');
    expect(payload.memories[2].id).toBe('memory-home');
  });
});
