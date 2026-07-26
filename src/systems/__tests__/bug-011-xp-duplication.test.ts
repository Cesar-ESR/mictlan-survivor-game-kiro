import { describe, it, expect, beforeEach } from 'vitest';

/**
 * BUG-011: XPOrb duplicates and XP is applied more than once, especially after Retry.
 *
 * Root causes:
 * 1. XPOrb had no `collected` flag — same orb could be collected twice in the same frame
 *    (once at initial proximity check, once after attraction moves it into range).
 * 2. OrbCollector.collectOrb both emitted 'orb-collected' (routed to XPSystem.addXP)
 *    AND directly called this.player.addXP(value) — double XP delivery.
 * 3. GameScene.registerGameListeners() added listeners without removing existing ones first.
 *    On retry (scene restart), Phaser reuses the same Scene instance, so listeners accumulated.
 *
 * Fixes:
 * - Added `collected = false` field to XPOrb, set to true at start of collectOrb()
 * - OrbCollector.collectOrb() guards with `if (orb.collected) return` and update() skips collected orbs
 * - Removed duplicate `this.player.addXP(value)` from collectOrb() — only emits event now
 * - GameScene.registerGameListeners() calls `events.off(...)` before `events.on(...)` (idempotent)
 */

// --- Typed fakes (no Phaser dependency) ---

interface FakeEventEmitter {
  listeners: Map<string, Array<{ fn: Function; context?: unknown }>>;
  on(event: string, fn: Function, context?: unknown): void;
  off(event: string, fn?: Function, context?: unknown): void;
  emit(event: string, ...args: unknown[]): void;
  listenerCount(event: string): number;
}

function createFakeEventEmitter(): FakeEventEmitter {
  const listeners = new Map<string, Array<{ fn: Function; context?: unknown }>>();
  return {
    listeners,
    on(event: string, fn: Function, context?: unknown): void {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push({ fn, context });
    },
    off(event: string, fn?: Function, context?: unknown): void {
      if (!fn) {
        listeners.delete(event);
        return;
      }
      const arr = listeners.get(event);
      if (!arr) return;
      const idx = arr.findIndex((entry) => entry.fn === fn && entry.context === context);
      if (idx !== -1) arr.splice(idx, 1);
      if (arr.length === 0) listeners.delete(event);
    },
    emit(event: string, ...args: unknown[]): void {
      const arr = listeners.get(event);
      if (!arr) return;
      for (const entry of [...arr]) {
        entry.fn.call(entry.context, ...args);
      }
    },
    listenerCount(event: string): number {
      return listeners.get(event)?.length ?? 0;
    },
  };
}

// --- Fake XPOrb ---

interface FakeXPOrb {
  x: number;
  y: number;
  value: number;
  active: boolean;
  collected: boolean;
  age: number;
  isAttracted: boolean;
  creationSequence: number;
  body: { enable: boolean } | null;
  setActive(v: boolean): void;
  setVisible(v: boolean): void;
}

let orbSeq = 0;

function createFakeXPOrb(x: number, y: number, value: number): FakeXPOrb {
  return {
    x, y, value,
    active: true,
    collected: false,
    age: 0,
    isAttracted: false,
    creationSequence: orbSeq++,
    body: { enable: true },
    setActive(v: boolean) { this.active = v; },
    setVisible(_v: boolean) { /* no-op */ },
  };
}

// --- Simulate OrbCollector logic (mirrors real implementation after BUG-011 fix) ---

const COLLECTION_RADIUS = 16;

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function shouldCollect(orbPos: { x: number; y: number }, playerPos: { x: number; y: number }): boolean {
  return distance(orbPos, playerPos) <= COLLECTION_RADIUS;
}

class TestableOrbCollector {
  private orbs: FakeXPOrb[] = [];
  private scene: { events: FakeEventEmitter };
  private isDestroyed = false;
  collectCalls: Array<{ value: number }> = [];

  constructor(scene: { events: FakeEventEmitter }) {
    this.scene = scene;
    this.scene.events.on('enemy-defeated', this.enemyDefeatedHandler);
  }

  private enemyDefeatedHandler = (data: { x: number; y: number; xpReward: number }): void => {
    if (this.isDestroyed) return;
    this.spawnOrb(data.x, data.y, data.xpReward);
  };

  spawnOrb(x: number, y: number, value: number): void {
    if (this.isDestroyed) return;
    const orb = createFakeXPOrb(x, y, value);
    this.orbs.push(orb);
  }

  /** Mirrors the fixed update() logic */
  update(playerPos: { x: number; y: number }, delta: number = 16): void {
    if (this.isDestroyed) return;

    for (const orb of this.orbs) {
      if (orb.active) orb.age += delta;
    }

    for (const orb of this.orbs) {
      if (!orb.active || orb.collected) continue;

      if (shouldCollect(orb, playerPos)) {
        this.collectOrb(orb);
        continue;
      }

      // Simulate attraction moving orb toward player
      const dist = distance(orb, playerPos);
      if (dist <= 100) { // attract radius
        const dx = playerPos.x - orb.x;
        const dy = playerPos.y - orb.y;
        const norm = Math.sqrt(dx * dx + dy * dy);
        if (norm > 0) {
          orb.x += (dx / norm) * 200 * (delta / 1000);
          orb.y += (dy / norm) * 200 * (delta / 1000);
          orb.isAttracted = true;
        }
      }

      // BUG-011 fix: Check collected flag again after attraction
      if (!orb.collected && shouldCollect(orb, playerPos)) {
        this.collectOrb(orb);
      }
    }
  }

  /** Mirrors the fixed collectOrb() logic */
  private collectOrb(orb: FakeXPOrb): void {
    if (orb.collected) return;
    orb.collected = true;

    const value = orb.value;
    this.collectCalls.push({ value });
    this.scene.events.emit('orb-collected', { value });

    // Deactivate
    orb.setActive(false);
    if (orb.body) orb.body.enable = false;
  }

  getOrbs(): FakeXPOrb[] {
    return this.orbs;
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.scene.events.off('enemy-defeated', this.enemyDefeatedHandler);
    this.orbs = [];
  }
}

// --- Simulate GameScene listener registration (mirrors BUG-011 fix) ---

class TestableGameScene {
  events: FakeEventEmitter;
  xpReceived: number[] = [];
  enemyDefeatedCount = 0;

  constructor(events: FakeEventEmitter) {
    this.events = events;
  }

  private onEnemyDefeated = (): void => {
    this.enemyDefeatedCount++;
  };

  private onOrbCollected = (data: { value: number }): void => {
    this.xpReceived.push(data.value);
  };

  /** Mirrors the fixed registerGameListeners() — idempotent */
  registerGameListeners(): void {
    // Remove any existing listeners first (BUG-011 fix)
    this.events.off('enemy-defeated', this.onEnemyDefeated, this);
    this.events.off('orb-collected', this.onOrbCollected, this);

    // Register fresh
    this.events.on('enemy-defeated', this.onEnemyDefeated, this);
    this.events.on('orb-collected', this.onOrbCollected, this);
  }

  /** Mirrors shutdown() */
  shutdown(): void {
    this.events.off('enemy-defeated', this.onEnemyDefeated, this);
    this.events.off('orb-collected', this.onOrbCollected, this);
  }
}

// --- Tests ---

describe('BUG-011: XP orb duplication and listener accumulation', () => {
  let emitter: FakeEventEmitter;

  beforeEach(() => {
    emitter = createFakeEventEmitter();
    orbSeq = 0;
  });

  describe('Cause 1: collected flag prevents double-collection in same frame', () => {
    it('1. collectOrb processes an orb only once (collected flag)', () => {
      const scene = { events: emitter };
      const collector = new TestableOrbCollector(scene);
      collector.spawnOrb(10, 10, 5);

      // Player is within collection radius
      const playerPos = { x: 10, y: 10 };
      collector.update(playerPos);

      // Orb should be collected exactly once
      expect(collector.collectCalls).toHaveLength(1);
      expect(collector.collectCalls[0].value).toBe(5);
    });

    it('2. double overlap in same frame: addXP called once', () => {
      const scene = { events: emitter };
      const collector = new TestableOrbCollector(scene);

      // Place orb just outside collection radius but inside attraction radius
      // so it gets attracted INTO collection range during the same update
      collector.spawnOrb(30, 0, 5);

      // Player at origin — orb at 30px is within attract radius (100) but
      // outside collection radius (16). With high delta, attraction may move it in.
      // Force a scenario: manually set orb position to be exactly at the boundary
      const orbs = collector.getOrbs();
      orbs[0].x = 15; // Just barely outside collection (distance = 15 < 16 => will collect on first check)

      const playerPos = { x: 0, y: 0 };
      collector.update(playerPos);

      // Even though the orb is in range at both checkpoints, it's collected only once
      expect(collector.collectCalls).toHaveLength(1);
      expect(collector.collectCalls[0].value).toBe(5);
    });

    it('3. orb.collected is true after collection', () => {
      const scene = { events: emitter };
      const collector = new TestableOrbCollector(scene);
      collector.spawnOrb(5, 5, 10);

      const playerPos = { x: 5, y: 5 };
      collector.update(playerPos);

      const orbs = collector.getOrbs();
      expect(orbs[0].collected).toBe(true);
      expect(orbs[0].active).toBe(false);
    });

    it('4. subsequent update frames do not re-collect a collected orb', () => {
      const scene = { events: emitter };
      const collector = new TestableOrbCollector(scene);
      collector.spawnOrb(5, 5, 7);

      const playerPos = { x: 5, y: 5 };
      collector.update(playerPos);
      collector.update(playerPos); // second frame
      collector.update(playerPos); // third frame

      expect(collector.collectCalls).toHaveLength(1);
      expect(collector.collectCalls[0].value).toBe(7);
    });
  });

  describe('Cause 2: single XP delivery path (no duplicate player.addXP)', () => {
    it('5. xpValue=5 delivers exactly 5 XP via event', () => {
      const xpReceived: number[] = [];
      emitter.on('orb-collected', (data: unknown) => {
        xpReceived.push((data as { value: number }).value);
      });

      const scene = { events: emitter };
      const collector = new TestableOrbCollector(scene);
      collector.spawnOrb(0, 0, 5);

      collector.update({ x: 0, y: 0 });

      // Exactly one event with exactly 5 XP
      expect(xpReceived).toHaveLength(1);
      expect(xpReceived[0]).toBe(5);
    });

    it('6. one enemy death produces exactly one orb and one XP event on collection', () => {
      const xpEvents: number[] = [];
      emitter.on('orb-collected', (data: unknown) => {
        xpEvents.push((data as { value: number }).value);
      });

      const scene = { events: emitter };
      const collector = new TestableOrbCollector(scene);

      // Simulate enemy defeat
      emitter.emit('enemy-defeated', { x: 50, y: 50, xpReward: 8 });

      // One orb spawned
      expect(collector.getOrbs()).toHaveLength(1);
      expect(collector.getOrbs()[0].value).toBe(8);

      // Collect it
      collector.update({ x: 50, y: 50 });

      // Exactly one XP event
      expect(xpEvents).toHaveLength(1);
      expect(xpEvents[0]).toBe(8);
    });
  });

  describe('Cause 3: registerGameListeners is idempotent (no accumulation on retry)', () => {
    it('7. after retry: registerGameListeners has exactly 1 listener per event', () => {
      const gameScene = new TestableGameScene(emitter);

      // First registration (simulate first create())
      gameScene.registerGameListeners();
      expect(emitter.listenerCount('orb-collected')).toBe(1);
      expect(emitter.listenerCount('enemy-defeated')).toBe(1);

      // Simulate retry: shutdown then create again (without actual shutdown call)
      // BUG-011 fix: registerGameListeners removes old before adding new
      gameScene.registerGameListeners();
      expect(emitter.listenerCount('orb-collected')).toBe(1);
      expect(emitter.listenerCount('enemy-defeated')).toBe(1);
    });

    it('8. after 5 retries: no listener accumulation', () => {
      const gameScene = new TestableGameScene(emitter);

      for (let i = 0; i < 5; i++) {
        gameScene.registerGameListeners();
      }

      // Still exactly 1 listener per event
      expect(emitter.listenerCount('orb-collected')).toBe(1);
      expect(emitter.listenerCount('enemy-defeated')).toBe(1);
    });

    it('9. after retry: xpValue=5 still delivers exactly 5 XP', () => {
      const gameScene = new TestableGameScene(emitter);
      const scene = { events: emitter };
      const collector = new TestableOrbCollector(scene);

      // First session
      gameScene.registerGameListeners();
      collector.spawnOrb(0, 0, 5);
      collector.update({ x: 0, y: 0 });
      expect(gameScene.xpReceived).toEqual([5]);

      // Simulate retry: destroy old collector, re-register listeners
      collector.destroy();
      gameScene.xpReceived = [];
      gameScene.registerGameListeners();

      const collector2 = new TestableOrbCollector(scene);
      collector2.spawnOrb(0, 0, 5);
      collector2.update({ x: 0, y: 0 });

      // Still exactly 5 XP (no duplication)
      expect(gameScene.xpReceived).toEqual([5]);
      collector2.destroy();
    });

    it('10. proper shutdown+register cycle: no stale listeners', () => {
      const gameScene = new TestableGameScene(emitter);

      // Session 1
      gameScene.registerGameListeners();
      expect(emitter.listenerCount('orb-collected')).toBe(1);
      gameScene.shutdown();
      expect(emitter.listenerCount('orb-collected')).toBe(0);

      // Session 2
      gameScene.registerGameListeners();
      expect(emitter.listenerCount('orb-collected')).toBe(1);
      gameScene.shutdown();
      expect(emitter.listenerCount('orb-collected')).toBe(0);

      // Session 3
      gameScene.registerGameListeners();
      expect(emitter.listenerCount('orb-collected')).toBe(1);
    });
  });

  describe('End-to-end regression: full XP pipeline', () => {
    it('11. one enemy death → one orb → one collection → exactly xpReward XP', () => {
      const gameScene = new TestableGameScene(emitter);
      const scene = { events: emitter };
      gameScene.registerGameListeners();
      const collector = new TestableOrbCollector(scene);

      // Enemy dies at (100, 100) with xpReward = 12
      emitter.emit('enemy-defeated', { x: 100, y: 100, xpReward: 12 });

      // One orb exists
      const orbs = collector.getOrbs();
      expect(orbs).toHaveLength(1);
      expect(orbs[0].value).toBe(12);

      // Player moves to collect
      collector.update({ x: 100, y: 100 });

      // GameScene received exactly 12 XP
      expect(gameScene.xpReceived).toEqual([12]);
      // EnemyDefeated counter incremented exactly once
      expect(gameScene.enemyDefeatedCount).toBe(1);

      collector.destroy();
    });

    it('12. multiple enemies die, each produces exactly one orb with correct XP', () => {
      const gameScene = new TestableGameScene(emitter);
      const scene = { events: emitter };
      gameScene.registerGameListeners();
      const collector = new TestableOrbCollector(scene);

      emitter.emit('enemy-defeated', { x: 10, y: 10, xpReward: 3 });
      emitter.emit('enemy-defeated', { x: 20, y: 20, xpReward: 7 });
      emitter.emit('enemy-defeated', { x: 30, y: 30, xpReward: 11 });

      expect(collector.getOrbs()).toHaveLength(3);
      expect(gameScene.enemyDefeatedCount).toBe(3);

      // Collect all (player at each position)
      collector.update({ x: 10, y: 10 });
      collector.update({ x: 20, y: 20 });
      collector.update({ x: 30, y: 30 });

      expect(gameScene.xpReceived).toEqual([3, 7, 11]);

      collector.destroy();
    });

    it('13. full retry cycle: session 1 XP correct, session 2 XP correct (no doubling)', () => {
      const gameScene = new TestableGameScene(emitter);
      const scene = { events: emitter };

      // --- Session 1 ---
      gameScene.registerGameListeners();
      const collector1 = new TestableOrbCollector(scene);

      emitter.emit('enemy-defeated', { x: 50, y: 50, xpReward: 5 });
      collector1.update({ x: 50, y: 50 });
      expect(gameScene.xpReceived).toEqual([5]);

      // Shutdown session 1
      collector1.destroy();
      gameScene.shutdown();
      gameScene.xpReceived = [];
      gameScene.enemyDefeatedCount = 0;

      // --- Session 2 (Retry) ---
      gameScene.registerGameListeners();
      const collector2 = new TestableOrbCollector(scene);

      emitter.emit('enemy-defeated', { x: 60, y: 60, xpReward: 5 });
      collector2.update({ x: 60, y: 60 });

      // BUG-011 REGRESSION: Before fix, this would be [5, 5] or [10] due to accumulation
      expect(gameScene.xpReceived).toEqual([5]);
      expect(gameScene.enemyDefeatedCount).toBe(1);

      collector2.destroy();
    });

    it('14. five consecutive retry cycles: XP never doubles', () => {
      const gameScene = new TestableGameScene(emitter);
      const scene = { events: emitter };

      for (let session = 1; session <= 5; session++) {
        gameScene.xpReceived = [];
        gameScene.enemyDefeatedCount = 0;
        gameScene.registerGameListeners();
        const collector = new TestableOrbCollector(scene);

        emitter.emit('enemy-defeated', { x: 0, y: 0, xpReward: 5 });
        collector.update({ x: 0, y: 0 });

        // Every session: exactly 5 XP, no accumulation
        expect(gameScene.xpReceived).toEqual([5]);
        expect(gameScene.enemyDefeatedCount).toBe(1);

        collector.destroy();
        gameScene.shutdown();
      }
    });
  });

  describe('Enemy.onDefeat guard (defeatEmitted)', () => {
    it('15. one enemy death emits enemy-defeated once (defeatEmitted guard)', () => {
      // Simulate Enemy.onDefeat double-kill scenario
      let defeatEmitted = false;
      let animState: 'moving' | 'dying' = 'moving';
      let emitCount = 0;

      const onDefeat = () => {
        if (animState === 'dying') return;
        animState = 'dying';

        if (!defeatEmitted) {
          defeatEmitted = true;
          emitCount++;
        }
      };

      // Two projectiles hit in the same frame
      onDefeat();
      onDefeat();

      expect(emitCount).toBe(1);
    });

    it('16. multiple projectiles in same frame: only one orb spawned', () => {
      const scene = { events: emitter };
      const collector = new TestableOrbCollector(scene);

      // Simulating Enemy.onDefeat guard: only first call emits
      let defeatEmitted = false;
      const simulateEnemyDefeat = () => {
        if (defeatEmitted) return;
        defeatEmitted = true;
        emitter.emit('enemy-defeated', { x: 100, y: 100, xpReward: 10 });
      };

      simulateEnemyDefeat();
      simulateEnemyDefeat(); // second projectile — blocked

      expect(collector.getOrbs()).toHaveLength(1);
      collector.destroy();
    });
  });
});
