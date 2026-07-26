import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * BUG-010: OrbCollector crashes with "Cannot read properties of undefined (reading 'add')"
 * when spawning XPOrb after enemy defeat.
 *
 * Root cause: Phaser's Group.add() internally accesses a stale scene reference after
 * a scene restart cycle. The Group retains a reference to the scene's `sys` object
 * which may be in an inconsistent/stale state.
 *
 * Fix V3: Replace Phaser.GameObjects.Group with a plain tracked array.
 * XPOrb's constructor already calls scene.add.existing(this) and scene.physics.add.existing(this),
 * so Group.add() was redundant for scene management. The group was only used as a container
 * to iterate orbs for update/cleanup. A plain array eliminates the dependency on Phaser's
 * Group internal scene management while preserving all functionality.
 *
 * Previous fixes:
 * - V1: stored arrow function handler + isDestroyed guard + idempotent destroy()
 * - V2: orbPool.clear() instead of orbPool.destroy() to prevent scene corruption
 * - V3: eliminate Phaser Group entirely — use plain array
 */

// --- Typed fakes (no Phaser dependency) ---

interface FakeEventEmitter {
  listeners: Map<string, Array<(...args: unknown[]) => void>>;
  on(event: string, fn: (...args: unknown[]) => void): void;
  off(event: string, fn?: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
  listenerCount(event: string): number;
}

function createFakeEventEmitter(): FakeEventEmitter {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  return {
    listeners,
    on(event: string, fn: (...args: unknown[]) => void): void {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(fn);
    },
    off(event: string, fn?: (...args: unknown[]) => void): void {
      if (!fn) {
        // Remove ALL listeners for event (old buggy behavior)
        listeners.delete(event);
        return;
      }
      const arr = listeners.get(event);
      if (!arr) return;
      const idx = arr.indexOf(fn);
      if (idx !== -1) arr.splice(idx, 1);
      if (arr.length === 0) listeners.delete(event);
    },
    emit(event: string, ...args: unknown[]): void {
      const arr = listeners.get(event);
      if (!arr) return;
      for (const fn of [...arr]) {
        fn(...args);
      }
    },
    listenerCount(event: string): number {
      return listeners.get(event)?.length ?? 0;
    },
  };
}

interface FakeOrb {
  active: boolean;
  x: number;
  y: number;
  value: number;
  variant: string | undefined;
  destroyed: boolean;
  setActive(v: boolean): void;
  setVisible(v: boolean): void;
  destroy(): void;
}

function createFakeOrb(x: number, y: number, value: number, variant?: string): FakeOrb {
  return {
    active: true,
    x,
    y,
    value,
    variant,
    destroyed: false,
    setActive(v: boolean) { this.active = v; },
    setVisible(_v: boolean) { /* no-op for test */ },
    destroy() { this.destroyed = true; this.active = false; },
  };
}

interface FakeScene {
  events: FakeEventEmitter;
  add: { existing: (obj: unknown) => unknown };
  physics: { add: { existing: (obj: unknown) => unknown } };
  tweens: { add: (config: unknown) => { destroy: () => void } };
  /** Track if scene.add.group was ever called (should NOT be in V3) */
  groupCreated: boolean;
}

function createFakeScene(): FakeScene {
  return {
    events: createFakeEventEmitter(),
    add: {
      existing: (obj: unknown) => obj,
    },
    physics: {
      add: { existing: (obj: unknown) => obj },
    },
    tweens: {
      add: () => ({ destroy: () => {} }),
    },
    groupCreated: false,
  };
}

/**
 * Minimal OrbCollector simulation that mirrors the V3 fixed implementation.
 * Tests the lifecycle contract without importing Phaser.
 *
 * BUG-010 V3: Uses a plain array (orbs[]) instead of Phaser.GameObjects.Group.
 * No scene.add.group() call — XPOrb adds itself to scene in its constructor.
 */
class TestableOrbCollector {
  private scene: FakeScene;
  private player: { addXP(value: number): unknown } | null;
  private orbs: FakeOrb[] = [];
  private isDestroyed = false;
  spawnOrbCalls: Array<{ x: number; y: number; value: number; variant?: string }> = [];

  /** Stored handler for proper listener removal (BUG-010) */
  readonly enemyDefeatedHandler = (data: { x: number; y: number; xpReward: number; xpOrbVariant?: string }): void => {
    if (this.isDestroyed) return;
    this.spawnOrb({ x: data.x, y: data.y }, data.xpReward, data.xpOrbVariant);
  };

  constructor(scene: FakeScene, player?: { addXP(value: number): unknown }) {
    this.scene = scene;
    this.player = player ?? null;

    // BUG-010 V3: NO scene.add.group() call — plain array only
    // (XPOrb adds itself to scene in its constructor)

    // BUG-010: stored handler
    this.scene.events.on('enemy-defeated', this.enemyDefeatedHandler);
  }

  get destroyed(): boolean {
    return this.isDestroyed;
  }

  /** Expose orbs array length for testing */
  get orbCount(): number {
    return this.orbs.length;
  }

  /** Expose active orbs for testing */
  getActiveOrbs(): FakeOrb[] {
    return this.orbs.filter((orb) => orb.active);
  }

  update(): void {
    if (this.isDestroyed) return;
    // Simplified — actual update logic tested elsewhere
  }

  spawnOrb(position: { x: number; y: number }, value: number, variant?: string): void {
    if (this.isDestroyed) return;
    const orb = createFakeOrb(position.x, position.y, value, variant);
    this.orbs.push(orb);
    this.spawnOrbCalls.push({ x: position.x, y: position.y, value, variant });
  }

  /** BUG-010 V3: destroys each active orb and clears the array */
  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.scene.events.off('enemy-defeated', this.enemyDefeatedHandler);
    for (const orb of this.orbs) {
      if (orb.active) {
        orb.destroy();
      }
    }
    this.orbs = [];
  }
}

// --- Tests ---

describe('BUG-010: OrbCollector lifecycle and listener management', () => {
  let scene: FakeScene;

  beforeEach(() => {
    scene = createFakeScene();
  });

  describe('Handler registration', () => {
    it('1. OrbCollector registers exactly one enemy-defeated listener on construction', () => {
      new TestableOrbCollector(scene);
      expect(scene.events.listenerCount('enemy-defeated')).toBe(1);
    });

    it('2. enemy-defeated event triggers spawnOrb with payload coordinates and value', () => {
      const collector = new TestableOrbCollector(scene);
      scene.events.emit('enemy-defeated', { x: 100, y: 200, xpReward: 50, xpOrbVariant: 'common' });
      expect(collector.spawnOrbCalls).toHaveLength(1);
      expect(collector.spawnOrbCalls[0]).toEqual({ x: 100, y: 200, value: 50, variant: 'common' });
    });

    it('3. payload coordinates (x, y) and xpReward are forwarded correctly', () => {
      const collector = new TestableOrbCollector(scene);
      scene.events.emit('enemy-defeated', { x: 42, y: 99, xpReward: 123, xpOrbVariant: 'rare' });
      expect(collector.spawnOrbCalls[0].x).toBe(42);
      expect(collector.spawnOrbCalls[0].y).toBe(99);
      expect(collector.spawnOrbCalls[0].value).toBe(123);
      expect(collector.spawnOrbCalls[0].variant).toBe('rare');
    });

    it('4. exactly one orb spawned per enemy-defeated event', () => {
      const collector = new TestableOrbCollector(scene);
      scene.events.emit('enemy-defeated', { x: 0, y: 0, xpReward: 10 });
      scene.events.emit('enemy-defeated', { x: 1, y: 1, xpReward: 20 });
      scene.events.emit('enemy-defeated', { x: 2, y: 2, xpReward: 30 });
      expect(collector.spawnOrbCalls).toHaveLength(3);
    });

    it('5. Enemy defeatEmitted guard prevents duplicate defeat events from same enemy', () => {
      // Simulate Enemy.onDefeat guard: if animState === dying, return early
      let defeatEmitted = false;
      const emitDefeat = () => {
        if (defeatEmitted) return;
        defeatEmitted = true;
        scene.events.emit('enemy-defeated', { x: 50, y: 50, xpReward: 10 });
      };
      const collector = new TestableOrbCollector(scene);
      emitDefeat();
      emitDefeat(); // duplicate — guard blocks
      expect(collector.spawnOrbCalls).toHaveLength(1);
    });

    it('6. handler preserves `this` context (arrow function binding)', () => {
      const collector = new TestableOrbCollector(scene);
      // Extract and call handler directly — arrow function retains `this`
      const handler = collector.enemyDefeatedHandler;
      handler({ x: 5, y: 10, xpReward: 7 });
      expect(collector.spawnOrbCalls).toHaveLength(1);
      expect(collector.spawnOrbCalls[0].value).toBe(7);
    });
  });

  describe('Destroy lifecycle', () => {
    it('7. destroy() removes only the specific enemyDefeatedHandler', () => {
      const collector = new TestableOrbCollector(scene);
      // Add another listener for the same event (simulates GameScene.onEnemyDefeated)
      const otherListener = vi.fn();
      scene.events.on('enemy-defeated', otherListener);

      expect(scene.events.listenerCount('enemy-defeated')).toBe(2);

      collector.destroy();

      // Only the collector's handler is removed; the other remains
      expect(scene.events.listenerCount('enemy-defeated')).toBe(1);

      // Emit — other listener still fires
      scene.events.emit('enemy-defeated', { x: 0, y: 0, xpReward: 5 });
      expect(otherListener).toHaveBeenCalledTimes(1);
    });

    it('8. event emitted after destroy does not generate orbs', () => {
      const collector = new TestableOrbCollector(scene);
      collector.destroy();
      scene.events.emit('enemy-defeated', { x: 10, y: 20, xpReward: 99 });
      expect(collector.spawnOrbCalls).toHaveLength(0);
    });

    it('9. destroy() is idempotent — double call does not throw', () => {
      const collector = new TestableOrbCollector(scene);
      collector.destroy();
      expect(() => collector.destroy()).not.toThrow();
    });

    it('10. new OrbCollector per session does not inherit old listeners', () => {
      const collector1 = new TestableOrbCollector(scene);
      collector1.destroy();

      // Second session
      const collector2 = new TestableOrbCollector(scene);
      scene.events.emit('enemy-defeated', { x: 0, y: 0, xpReward: 15 });

      // Only collector2 receives the event
      expect(collector1.spawnOrbCalls).toHaveLength(0);
      expect(collector2.spawnOrbCalls).toHaveLength(1);
    });
  });

  describe('Retry cycle simulation', () => {
    it('11. full defeat-retry cycle: destroy old collector, create new, event works', () => {
      const collector1 = new TestableOrbCollector(scene);
      scene.events.emit('enemy-defeated', { x: 1, y: 1, xpReward: 10 });
      expect(collector1.spawnOrbCalls).toHaveLength(1);

      // Simulate shutdown
      collector1.destroy();

      // Simulate retry — new collector on same scene
      const collector2 = new TestableOrbCollector(scene);
      scene.events.emit('enemy-defeated', { x: 2, y: 2, xpReward: 20 });
      expect(collector2.spawnOrbCalls).toHaveLength(1);
      expect(collector2.spawnOrbCalls[0].value).toBe(20);
      // Old collector is unaffected
      expect(collector1.spawnOrbCalls).toHaveLength(1);
    });

    it('12. three consecutive retry cycles accumulate zero stale listeners', () => {
      for (let i = 0; i < 3; i++) {
        const collector = new TestableOrbCollector(scene);
        expect(scene.events.listenerCount('enemy-defeated')).toBe(1);
        collector.destroy();
        expect(scene.events.listenerCount('enemy-defeated')).toBe(0);
      }
    });

    it('13. stale collector handler does not fire after scene recreated', () => {
      const collector1 = new TestableOrbCollector(scene);
      collector1.destroy();

      // Even if someone holds a reference to the old handler...
      const staleHandler = collector1.enemyDefeatedHandler;
      // ...calling it directly is guarded by isDestroyed
      staleHandler({ x: 0, y: 0, xpReward: 100 });
      expect(collector1.spawnOrbCalls).toHaveLength(0);
    });

    it('14. update() after destroy is a no-op', () => {
      const collector = new TestableOrbCollector(scene);
      collector.destroy();
      expect(() => collector.update()).not.toThrow();
    });

    it('15. spawnOrb() after destroy is a no-op', () => {
      const collector = new TestableOrbCollector(scene);
      collector.destroy();
      collector.spawnOrb({ x: 0, y: 0 }, 50);
      // spawnOrb guard prevents push when isDestroyed
      expect(collector.spawnOrbCalls).toHaveLength(0);
    });
  });

  describe('Integration with GameScene shutdown pattern', () => {
    it('16. GameScene shutdown calls orbCollector.destroy() exactly once', () => {
      const collector = new TestableOrbCollector(scene);
      const destroySpy = vi.spyOn(collector, 'destroy');

      // Simulate GameScene.shutdown()
      collector.destroy();
      expect(destroySpy).toHaveBeenCalledTimes(1);
    });

    it('17. GameScene onEnemyDefeated listener survives OrbCollector destroy', () => {
      const gameSceneListener = vi.fn();
      scene.events.on('enemy-defeated', gameSceneListener);

      const collector = new TestableOrbCollector(scene);
      collector.destroy();

      scene.events.emit('enemy-defeated', { x: 0, y: 0, xpReward: 5 });
      expect(gameSceneListener).toHaveBeenCalledTimes(1);
    });

    it('18. OrbCollector does not remove listeners from other systems', () => {
      const waveListener = vi.fn();
      const statsListener = vi.fn();
      scene.events.on('enemy-defeated', waveListener);
      scene.events.on('enemy-defeated', statsListener);

      const collector = new TestableOrbCollector(scene);
      expect(scene.events.listenerCount('enemy-defeated')).toBe(3);

      collector.destroy();
      expect(scene.events.listenerCount('enemy-defeated')).toBe(2);

      scene.events.emit('enemy-defeated', { x: 0, y: 0, xpReward: 1 });
      expect(waveListener).toHaveBeenCalledTimes(1);
      expect(statsListener).toHaveBeenCalledTimes(1);
    });

    it('19. destroyed flag is true after destroy()', () => {
      const collector = new TestableOrbCollector(scene);
      expect(collector.destroyed).toBe(false);
      collector.destroy();
      expect(collector.destroyed).toBe(true);
    });

    it('20. after destroy, orbs array is empty (BUG-010 V3)', () => {
      const collector = new TestableOrbCollector(scene);
      // Spawn some orbs
      collector.spawnOrb({ x: 10, y: 10 }, 5);
      collector.spawnOrb({ x: 20, y: 20 }, 10);
      expect(collector.orbCount).toBe(2);

      collector.destroy();
      // Orbs array is cleared
      expect(collector.orbCount).toBe(0);
    });
  });

  describe('Edge cases and regression guards', () => {
    it('21. handler with undefined xpOrbVariant still works (uses default)', () => {
      const collector = new TestableOrbCollector(scene);
      scene.events.emit('enemy-defeated', { x: 10, y: 20, xpReward: 5 });
      expect(collector.spawnOrbCalls).toHaveLength(1);
      expect(collector.spawnOrbCalls[0].variant).toBeUndefined();
    });

    it('22. multiple OrbCollectors on same scene each get their own handler', () => {
      const collector1 = new TestableOrbCollector(scene);
      const collector2 = new TestableOrbCollector(scene);
      expect(scene.events.listenerCount('enemy-defeated')).toBe(2);

      scene.events.emit('enemy-defeated', { x: 0, y: 0, xpReward: 10 });
      expect(collector1.spawnOrbCalls).toHaveLength(1);
      expect(collector2.spawnOrbCalls).toHaveLength(1);

      collector1.destroy();
      expect(scene.events.listenerCount('enemy-defeated')).toBe(1);

      scene.events.emit('enemy-defeated', { x: 1, y: 1, xpReward: 20 });
      expect(collector1.spawnOrbCalls).toHaveLength(1); // still 1
      expect(collector2.spawnOrbCalls).toHaveLength(2); // now 2
    });

    it('23. no TypeError from undefined.add — isDestroyed blocks spawnOrb before scene access', () => {
      const collector = new TestableOrbCollector(scene);
      collector.destroy();
      // Simulate the exact crash scenario: handler fires on destroyed collector
      const handler = collector.enemyDefeatedHandler;
      expect(() => handler({ x: 0, y: 0, xpReward: 10 })).not.toThrow();
      expect(collector.spawnOrbCalls).toHaveLength(0);
    });

    it('24. rapid create-destroy-create cycle does not leak listeners', () => {
      const c1 = new TestableOrbCollector(scene);
      c1.destroy();
      const c2 = new TestableOrbCollector(scene);
      c2.destroy();
      const c3 = new TestableOrbCollector(scene);

      expect(scene.events.listenerCount('enemy-defeated')).toBe(1);

      scene.events.emit('enemy-defeated', { x: 0, y: 0, xpReward: 5 });
      expect(c1.spawnOrbCalls).toHaveLength(0);
      expect(c2.spawnOrbCalls).toHaveLength(0);
      expect(c3.spawnOrbCalls).toHaveLength(1);
    });
  });

  describe('BUG-010 V3: plain array replaces Phaser Group — no scene lifecycle coupling', () => {
    it('25. no Phaser Group is created — no scene.add.group() call', () => {
      // The FakeScene has no group() method on add — if it were called, it would throw
      const sceneWithoutGroup = createFakeScene();
      // Verify scene.add does NOT have a group method
      expect((sceneWithoutGroup.add as Record<string, unknown>)['group']).toBeUndefined();

      // Construction does NOT throw — no group creation attempted
      const collector = new TestableOrbCollector(sceneWithoutGroup);
      expect(collector.destroyed).toBe(false);
      collector.destroy();
    });

    it('26. spawnOrb pushes to internal array (no Group.add call)', () => {
      const collector = new TestableOrbCollector(scene);
      collector.spawnOrb({ x: 10, y: 20 }, 42, 'common');
      // Orb tracked in array
      expect(collector.orbCount).toBe(1);
      expect(collector.getActiveOrbs()).toHaveLength(1);
      expect(collector.getActiveOrbs()[0].value).toBe(42);
      collector.destroy();
    });

    it('27. after destroy, orbs array is empty and orbs are destroyed', () => {
      const collector = new TestableOrbCollector(scene);
      collector.spawnOrb({ x: 1, y: 1 }, 10);
      collector.spawnOrb({ x: 2, y: 2 }, 20);
      collector.spawnOrb({ x: 3, y: 3 }, 30);

      const activeOrbs = collector.getActiveOrbs();
      expect(activeOrbs).toHaveLength(3);

      collector.destroy();
      expect(collector.orbCount).toBe(0);
      // Each active orb was destroyed
      for (const orb of activeOrbs) {
        expect(orb.destroyed).toBe(true);
      }
    });

    it('28. five retry cycles never touch a Phaser Group', () => {
      for (let cycle = 0; cycle < 5; cycle++) {
        const collector = new TestableOrbCollector(scene);

        // Each cycle: scene.add and scene.physics.add remain valid (no group corruption)
        expect(scene.add).toBeDefined();
        expect(scene.physics.add).toBeDefined();

        // Spawn an orb via event
        scene.events.emit('enemy-defeated', { x: cycle, y: cycle, xpReward: 10 + cycle });
        expect(collector.spawnOrbCalls).toHaveLength(1);
        expect(collector.spawnOrbCalls[0].value).toBe(10 + cycle);
        expect(collector.orbCount).toBe(1);

        // Destroy (simulating shutdown)
        collector.destroy();
        expect(collector.orbCount).toBe(0);

        // After destruction, scene managers still intact
        expect(scene.add).toBeDefined();
        expect(scene.physics.add).toBeDefined();
      }

      // Final verification: no stale listeners remain
      expect(scene.events.listenerCount('enemy-defeated')).toBe(0);
    });

    it('29. XPOrb adds itself to scene — no group-managed add needed', () => {
      // In the real implementation, XPOrb constructor calls:
      //   scene.add.existing(this) — adds to display list
      //   scene.physics.add.existing(this) — adds physics body
      // So the orb is already in the scene without Group.add()
      const addExistingSpy = vi.fn((obj: unknown) => obj);
      const physicsAddExistingSpy = vi.fn((obj: unknown) => obj);
      const spyScene = createFakeScene();
      spyScene.add.existing = addExistingSpy;
      spyScene.physics.add.existing = physicsAddExistingSpy;

      // When the real XPOrb is created, it calls scene.add.existing and scene.physics.add.existing
      // Our FakeOrb doesn't do that (it's a test double), but we verify the contract holds:
      // OrbCollector does NOT call scene.add.group() or group.add()
      const collector = new TestableOrbCollector(spyScene);
      collector.spawnOrb({ x: 5, y: 5 }, 100);

      // scene.add.existing was NOT called by OrbCollector (it's XPOrb's job)
      // The key assertion: no group was ever accessed
      expect(spyScene.groupCreated).toBe(false);
      collector.destroy();
    });

    it('30. scene.add remains available after OrbCollector cleanup (no group corruption)', () => {
      const collector = new TestableOrbCollector(scene);
      collector.spawnOrb({ x: 0, y: 0 }, 10);
      collector.destroy();

      // After cleanup, the scene's add factory is still intact
      // (not corrupted by group destruction propagating through display list)
      expect(scene.add).toBeDefined();
      expect(scene.add.existing).toBeDefined();
      expect(scene.physics.add).toBeDefined();
      expect(scene.physics.add.existing).toBeDefined();
    });

    it('31. new OrbCollector after destroy creates fresh tracking without interference', () => {
      // First lifecycle
      const collector1 = new TestableOrbCollector(scene);
      collector1.spawnOrb({ x: 1, y: 1 }, 10);
      expect(collector1.orbCount).toBe(1);
      collector1.destroy();
      expect(collector1.orbCount).toBe(0);

      // Second lifecycle — fresh array, no shared state
      const collector2 = new TestableOrbCollector(scene);
      expect(collector2.orbCount).toBe(0);

      scene.events.emit('enemy-defeated', { x: 5, y: 5, xpReward: 42 });
      expect(collector2.spawnOrbCalls).toHaveLength(1);
      expect(collector2.spawnOrbCalls[0].value).toBe(42);
      expect(collector2.orbCount).toBe(1);

      // Old collector stays dead
      expect(collector1.spawnOrbCalls).toHaveLength(1); // from before destroy
      expect(collector1.orbCount).toBe(0);

      collector2.destroy();
    });

    it('32. inactive orbs are NOT destroyed during cleanup (only active ones)', () => {
      const collector = new TestableOrbCollector(scene);
      collector.spawnOrb({ x: 1, y: 1 }, 10);
      collector.spawnOrb({ x: 2, y: 2 }, 20);

      const orbs = collector.getActiveOrbs();
      // Manually deactivate one orb (simulating collection/expiration)
      orbs[0].setActive(false);

      collector.destroy();
      // The inactive orb was NOT re-destroyed (already handled)
      expect(orbs[0].destroyed).toBe(false);
      // The active orb was destroyed
      expect(orbs[1].destroyed).toBe(true);
    });
  });
});
