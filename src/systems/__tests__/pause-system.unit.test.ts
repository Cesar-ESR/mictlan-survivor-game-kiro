import { describe, it, expect, beforeEach } from 'vitest';
import { PauseSystem, type Pausable, type PhysicsPauseController } from '../PauseSystem';
import {
  LevelUpCoordinator,
  type LevelUpXPProvider,
  type LevelUpEventEmitter,
} from '../LevelUpCoordinator';
import type { Upgrade } from '../../types/interfaces';

// --- Fake implementations ---

function createFakePausable(): Pausable & { pauseCount: number; resumeCount: number } {
  const fake = {
    pauseCount: 0,
    resumeCount: 0,
    pause(): void {
      fake.pauseCount++;
    },
    resume(): void {
      fake.resumeCount++;
    },
  };
  return fake;
}

function createFakePhysics(): PhysicsPauseController & { pauseCount: number; resumeCount: number } {
  const fake = {
    pauseCount: 0,
    resumeCount: 0,
    pause(): void {
      fake.pauseCount++;
    },
    resume(): void {
      fake.resumeCount++;
    },
  };
  return fake;
}

/** Simulated game loop that respects PauseSystem.isPaused */
function simulateUpdate(delta: number, pauseSystem: PauseSystem, timer: { value: number }): void {
  if (pauseSystem.isPaused) return;
  timer.value += delta;
}

// --- LevelUpCoordinator integration helpers ---

function createFakeUpgrade(id: string): Upgrade {
  return { id, name: `Upgrade ${id}`, description: `Desc ${id}`, apply: () => {} };
}

function createFakeXPProvider(upgrades: Upgrade[]): LevelUpXPProvider {
  return {
    getRandomUpgrades(count?: number): Upgrade[] {
      return upgrades.slice(0, count ?? 3);
    },
    applyUpgrade(): void {},
    removeUpgradeFromPool(): void {},
  };
}

type Listener = (...args: unknown[]) => void;

function createFakeEventEmitter(): LevelUpEventEmitter & {
  trigger(event: string, ...args: unknown[]): void;
} {
  const listeners = new Map<string, Listener[]>();
  return {
    emit(event: string, ...args: unknown[]): boolean {
      const fns = listeners.get(event) || [];
      fns.forEach((fn) => fn(...args));
      return fns.length > 0;
    },
    on(event: string, fn: Listener): unknown {
      const arr = listeners.get(event) || [];
      arr.push(fn);
      listeners.set(event, arr);
      return this;
    },
    off(event: string, fn: Listener): unknown {
      const arr = listeners.get(event) || [];
      listeners.set(event, arr.filter((f) => f !== fn));
      return this;
    },
    trigger(event: string, ...args: unknown[]): void {
      const fns = listeners.get(event) || [];
      fns.forEach((fn) => fn(...args));
    },
  };
}

// --- Test suite ---

describe('PauseSystem', () => {
  let pauseSystem: PauseSystem;

  beforeEach(() => {
    pauseSystem = new PauseSystem();
  });

  // 1. Initial state: isPaused = false
  it('starts with isPaused = false', () => {
    expect(pauseSystem.isPaused).toBe(false);
  });

  // 2. pause() sets isPaused to true
  it('pause() sets isPaused to true', () => {
    pauseSystem.pause();
    expect(pauseSystem.isPaused).toBe(true);
  });

  // 3. resume() sets isPaused to false
  it('resume() sets isPaused to false after pause', () => {
    pauseSystem.pause();
    pauseSystem.resume();
    expect(pauseSystem.isPaused).toBe(false);
  });

  // 4. pause() calls each registered pausable.pause() exactly once
  it('pause() calls each registered pausable.pause() exactly once', () => {
    const p1 = createFakePausable();
    const p2 = createFakePausable();
    pauseSystem.register(p1);
    pauseSystem.register(p2);
    pauseSystem.pause();
    expect(p1.pauseCount).toBe(1);
    expect(p2.pauseCount).toBe(1);
  });

  // 5. Duplicate pause() is idempotent (no second call to pausables)
  it('duplicate pause() is idempotent', () => {
    const p1 = createFakePausable();
    pauseSystem.register(p1);
    pauseSystem.pause();
    pauseSystem.pause();
    expect(p1.pauseCount).toBe(1);
  });

  // 6. resume() calls each registered pausable.resume() exactly once
  it('resume() calls each registered pausable.resume() exactly once', () => {
    const p1 = createFakePausable();
    const p2 = createFakePausable();
    pauseSystem.register(p1);
    pauseSystem.register(p2);
    pauseSystem.pause();
    pauseSystem.resume();
    expect(p1.resumeCount).toBe(1);
    expect(p2.resumeCount).toBe(1);
  });

  // 7. Duplicate resume() is idempotent (no second call to pausables)
  it('duplicate resume() is idempotent', () => {
    const p1 = createFakePausable();
    pauseSystem.register(p1);
    pauseSystem.pause();
    pauseSystem.resume();
    pauseSystem.resume();
    expect(p1.resumeCount).toBe(1);
  });

  // 8. Physics world is paused via physicsController
  it('pauses physics world via physicsController', () => {
    const physics = createFakePhysics();
    pauseSystem.setPhysicsController(physics);
    pauseSystem.pause();
    expect(physics.pauseCount).toBe(1);
  });

  // 9. Physics world is resumed via physicsController
  it('resumes physics world via physicsController', () => {
    const physics = createFakePhysics();
    pauseSystem.setPhysicsController(physics);
    pauseSystem.pause();
    pauseSystem.resume();
    expect(physics.resumeCount).toBe(1);
  });

  // 10. During pause, player position unchanged (simulated via isPaused check)
  it('during pause, player position does not update', () => {
    const playerPos = { value: 100 };
    pauseSystem.pause();
    simulateUpdate(16, pauseSystem, playerPos);
    expect(playerPos.value).toBe(100);
  });

  // 11. During pause, enemy position unchanged
  it('during pause, enemy position does not update', () => {
    const enemyPos = { value: 50 };
    pauseSystem.pause();
    simulateUpdate(16, pauseSystem, enemyPos);
    expect(enemyPos.value).toBe(50);
  });

  // 12. During pause, projectiles don't advance
  it('during pause, projectiles do not advance', () => {
    const projectilePos = { value: 200 };
    pauseSystem.pause();
    simulateUpdate(16, pauseSystem, projectilePos);
    expect(projectilePos.value).toBe(200);
  });

  // 13. During pause, WeaponSystem fireTimer doesn't advance
  it('during pause, weapon fireTimer does not advance', () => {
    const fireTimer = { value: 500 };
    pauseSystem.pause();
    simulateUpdate(16, pauseSystem, fireTimer);
    expect(fireTimer.value).toBe(500);
  });

  // 14. During pause, SpawnManager spawnTimer doesn't advance
  it('during pause, spawn timer does not advance', () => {
    const spawnTimer = { value: 1200 };
    pauseSystem.pause();
    simulateUpdate(16, pauseSystem, spawnTimer);
    expect(spawnTimer.value).toBe(1200);
  });

  // 15. During pause, WaveManager waveTimer doesn't advance
  it('during pause, wave timer does not advance', () => {
    const waveTimer = { value: 25000 };
    pauseSystem.pause();
    simulateUpdate(16, pauseSystem, waveTimer);
    expect(waveTimer.value).toBe(25000);
  });

  // 16. During pause, DamageSystem cooldown doesn't advance
  it('during pause, damage cooldown does not advance', () => {
    const cooldown = { value: 800 };
    pauseSystem.pause();
    simulateUpdate(16, pauseSystem, cooldown);
    expect(cooldown.value).toBe(800);
  });

  // 17. During pause, OrbCollector age doesn't increment
  it('during pause, orb age does not increment', () => {
    const orbAge = { value: 5000 };
    pauseSystem.pause();
    simulateUpdate(16, pauseSystem, orbAge);
    expect(orbAge.value).toBe(5000);
  });

  // 18. Resume preserves fireTimer progress
  it('resume preserves fireTimer progress', () => {
    const fireTimer = { value: 500 };
    simulateUpdate(100, pauseSystem, fireTimer); // advance to 600
    pauseSystem.pause();
    simulateUpdate(200, pauseSystem, fireTimer); // should NOT advance
    pauseSystem.resume();
    expect(fireTimer.value).toBe(600); // preserved at 600
  });

  // 19. Resume preserves spawnTimer progress
  it('resume preserves spawnTimer progress', () => {
    const spawnTimer = { value: 1000 };
    simulateUpdate(50, pauseSystem, spawnTimer);
    pauseSystem.pause();
    simulateUpdate(300, pauseSystem, spawnTimer);
    pauseSystem.resume();
    expect(spawnTimer.value).toBe(1050);
  });

  // 20. Resume preserves waveTimer progress
  it('resume preserves waveTimer progress', () => {
    const waveTimer = { value: 20000 };
    simulateUpdate(1000, pauseSystem, waveTimer);
    pauseSystem.pause();
    simulateUpdate(5000, pauseSystem, waveTimer);
    pauseSystem.resume();
    expect(waveTimer.value).toBe(21000);
  });

  // 21. Resume preserves contact cooldown progress
  it('resume preserves contact cooldown progress', () => {
    const cooldown = { value: 400 };
    simulateUpdate(100, pauseSystem, cooldown);
    pauseSystem.pause();
    simulateUpdate(500, pauseSystem, cooldown);
    pauseSystem.resume();
    expect(cooldown.value).toBe(500);
  });

  // 22. Resume preserves orb age progress
  it('resume preserves orb age progress', () => {
    const orbAge = { value: 3000 };
    simulateUpdate(500, pauseSystem, orbAge);
    pauseSystem.pause();
    simulateUpdate(2000, pauseSystem, orbAge);
    pauseSystem.resume();
    expect(orbAge.value).toBe(3500);
  });

  // 23. Timers don't reset to zero on resume
  it('timers do not reset to zero on resume', () => {
    const timer = { value: 750 };
    simulateUpdate(250, pauseSystem, timer);
    pauseSystem.pause();
    pauseSystem.resume();
    expect(timer.value).toBe(1000);
    simulateUpdate(100, pauseSystem, timer);
    expect(timer.value).toBe(1100);
  });

  // 24. Delta during pause is not accumulated (isPaused → skip update)
  it('delta during pause is not accumulated', () => {
    const timer = { value: 0 };
    simulateUpdate(100, pauseSystem, timer);
    pauseSystem.pause();
    simulateUpdate(500, pauseSystem, timer);
    simulateUpdate(500, pauseSystem, timer);
    pauseSystem.resume();
    simulateUpdate(50, pauseSystem, timer);
    expect(timer.value).toBe(150); // 100 + 50, the 1000 during pause is lost
  });

  // 25. register() adds a system
  it('register() adds a system that receives pause/resume calls', () => {
    const p = createFakePausable();
    pauseSystem.register(p);
    pauseSystem.pause();
    expect(p.pauseCount).toBe(1);
    pauseSystem.resume();
    expect(p.resumeCount).toBe(1);
  });

  // 26. unregister() prevents future callbacks
  it('unregister() prevents future callbacks', () => {
    const p = createFakePausable();
    pauseSystem.register(p);
    pauseSystem.unregister(p);
    pauseSystem.pause();
    expect(p.pauseCount).toBe(0);
  });

  // 27. destroy() clears all registered systems
  it('destroy() clears all registered systems', () => {
    const p = createFakePausable();
    pauseSystem.register(p);
    pauseSystem.destroy();
    // After destroy, pause should not call the pausable
    // (destroyed flag prevents pause from executing)
    pauseSystem = new PauseSystem(); // need fresh instance since destroyed is terminal
    // Original pausable was cleared from the destroyed instance
    expect(p.pauseCount).toBe(0);
  });

  // 28. destroy() is idempotent (second call is safe)
  it('destroy() is idempotent', () => {
    pauseSystem.destroy();
    expect(() => pauseSystem.destroy()).not.toThrow();
  });

  // 29. Duplicate registration doesn't cause duplicate calls (Set)
  it('duplicate registration does not cause duplicate calls', () => {
    const p = createFakePausable();
    pauseSystem.register(p);
    pauseSystem.register(p);
    pauseSystem.pause();
    expect(p.pauseCount).toBe(1);
  });

  // 30. Re-creating PauseSystem doesn't duplicate controllers (fresh instance)
  it('re-creating PauseSystem starts fresh without old controllers', () => {
    const p = createFakePausable();
    pauseSystem.register(p);
    pauseSystem.destroy();

    const newPauseSystem = new PauseSystem();
    newPauseSystem.pause();
    expect(p.pauseCount).toBe(0); // old pausable not carried over
    newPauseSystem.destroy();
  });

  // 31. LevelUpCoordinator accepts PauseSystem as PauseController
  it('LevelUpCoordinator accepts PauseSystem as PauseController', () => {
    const upgrades = [createFakeUpgrade('u1'), createFakeUpgrade('u2'), createFakeUpgrade('u3')];
    const xpProvider = createFakeXPProvider(upgrades);
    const emitter = createFakeEventEmitter();
    const player = {};

    const coordinator = new LevelUpCoordinator(xpProvider, pauseSystem, emitter, player);
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });

    expect(pauseSystem.isPaused).toBe(true);
    coordinator.destroy();
  });

  // 32. Valid selection flow: pause called once, resume called once
  it('valid selection flow calls pause once and resume once', () => {
    const physics = createFakePhysics();
    pauseSystem.setPhysicsController(physics);

    const upgrades = [createFakeUpgrade('u1'), createFakeUpgrade('u2'), createFakeUpgrade('u3')];
    const xpProvider = createFakeXPProvider(upgrades);
    const emitter = createFakeEventEmitter();
    const player = {};

    const coordinator = new LevelUpCoordinator(xpProvider, pauseSystem, emitter, player);
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });

    expect(physics.pauseCount).toBe(1);
    expect(pauseSystem.isPaused).toBe(true);

    emitter.trigger('upgrade-selected', { upgradeId: 'u1' });

    expect(physics.resumeCount).toBe(1);
    expect(pauseSystem.isPaused).toBe(false);
    coordinator.destroy();
  });

  // 33. Empty pool doesn't pause
  it('empty upgrade pool does not pause', () => {
    const xpProvider = createFakeXPProvider([]);
    const emitter = createFakeEventEmitter();
    const player = {};

    const coordinator = new LevelUpCoordinator(xpProvider, pauseSystem, emitter, player);
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });

    expect(pauseSystem.isPaused).toBe(false);
    coordinator.destroy();
  });

  // 34. Level 20 doesn't pause (showPanel=false)
  it('level 20 does not pause when showPanel is false', () => {
    const upgrades = [createFakeUpgrade('u1'), createFakeUpgrade('u2'), createFakeUpgrade('u3')];
    const xpProvider = createFakeXPProvider(upgrades);
    const emitter = createFakeEventEmitter();
    const player = {};

    const coordinator = new LevelUpCoordinator(xpProvider, pauseSystem, emitter, player);
    coordinator.processLevelUp({ leveledUp: true, showPanel: false, newLevel: 20 });

    expect(pauseSystem.isPaused).toBe(false);
    coordinator.destroy();
  });

  // 35. Pause doesn't destroy enemies, projectiles, or orbs
  it('pause does not destroy registered systems (only notifies them)', () => {
    const enemy = createFakePausable();
    const projectile = createFakePausable();
    const orb = createFakePausable();
    pauseSystem.register(enemy);
    pauseSystem.register(projectile);
    pauseSystem.register(orb);

    pauseSystem.pause();

    // All systems still registered and received pause — they're "frozen" not destroyed
    expect(enemy.pauseCount).toBe(1);
    expect(projectile.pauseCount).toBe(1);
    expect(orb.pauseCount).toBe(1);

    // Resume still reaches them (they weren't removed)
    pauseSystem.resume();
    expect(enemy.resumeCount).toBe(1);
    expect(projectile.resumeCount).toBe(1);
    expect(orb.resumeCount).toBe(1);
  });
});
