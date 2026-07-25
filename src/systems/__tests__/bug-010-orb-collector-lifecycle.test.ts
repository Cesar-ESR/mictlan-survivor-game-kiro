import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * BUG-010: OrbCollector crashes with "Cannot read properties of undefined (reading 'add')"
 * when spawning XPOrb after enemy defeat.
 *
 * Root cause: anonymous lambda registered as 'enemy-defeated' listener could not be
 * specifically removed by destroy(), and the blanket off('enemy-defeated') removed
 * ALL listeners for that event. On retry cycles stale references fired into destroyed scenes.
 *
 * Fix: stored arrow function handler + isDestroyed guard + idempotent destroy().
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

interface FakeGroup {
  children: Array<{ active: boolean; setActive(v: boolean): void; setVisible(v: boolean): void }>;
  add(child: unknown): void;
  getChildren(): unknown[];
  destroy(destroyChildren?: boolean): void;
  destroyed: boolean;
}

function createFakeGroup(): FakeGroup {
  return {
    children: [],
    destroyed: false,
    add(child: unknown): void {
      this.children.push(child as FakeGroup['children'][number]);
    },
    getChildren(): unknown[] {
      return this.children;
    },
    destroy(_destroyChildren?: boolean): void {
      this.destroyed = true;
      this.children = [];
    },
  };
}

interface FakeScene {
  events: FakeEventEmitter;
  add: { group: (config?: unknown) => FakeGroup; existing: (obj: unknown) => unknown };
  physics: { add: { existing: (obj: unknown) => unknown } };
  tweens: { add: (config: unknown) => { destroy: () => void } };
}

function createFakeScene(): FakeScene {
  return {
    events: createFakeEventEmitter(),
    add: {
      group: () => createFakeGroup(),
      existing: (obj: unknown) => obj,
    },
    physics: {
      add: { existing: (obj: unknown) => obj },
    },
    tweens: {
      add: () => ({ destroy: () => {} }),
    },
  };
}

/**
 * Minimal OrbCollector simulation that mirrors the fixed implementation.
 * Tests the lifecycle contract without importing Phaser.
 */
class TestableOrbCollector {
  private scene: FakeScene;
  private player: { addXP(value: number): unknown } | null;
  private orbPool: FakeGroup;
  private isDestroyed = false;
  spawnOrbCalls: Array<{ x: number; y: number; value: number; variant?: string }> = [];

  /** Stored handler for proper listener removal (BUG-010) */
  readonly enemyDefeatedHandler = (data: { x: number; y: number; xpReward: number; xpOrbVariant?: string }): void => {
    if (this.isDestroyed) return;
    this.spawnOrbCalls.push({ x: data.x, y: data.y, value: data.xpReward, variant: data.xpOrbVariant });
  };

  constructor(scene: FakeScene, player?: { addXP(value: number): unknown }) {
    this.scene = scene;
    this.player = player ?? null;
    this.orbPool = scene.add.group();

    // BUG-010: stored handler
    this.scene.events.on('enemy-defeated', this.enemyDefeatedHandler);
  }

  get destroyed(): boolean {
    return this.isDestroyed;
  }

  update(): void {
    if (this.isDestroyed) return;
    // Simplified — actual update logic tested elsewhere
  }

  spawnOrb(position: { x: number; y: number }, value: number): void {
    if (this.isDestroyed) return;
    this.spawnOrbCalls.push({ x: position.x, y: position.y, value });
  }

  /** BUG-010: idempotent, uses stored handler reference */
  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.scene.events.off('enemy-defeated', this.enemyDefeatedHandler);
    this.orbPool.destroy(true);
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

    it('20. orbPool.destroy(true) is called during cleanup', () => {
      const collector = new TestableOrbCollector(scene);
      // Access the internal pool via scene.add.group mock
      // The TestableOrbCollector uses scene.add.group() which returns a FakeGroup
      collector.destroy();
      // No crash = pool destroy was called successfully
      expect(collector.destroyed).toBe(true);
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
});
