import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  createInitialUnlockedFragments,
  unlockFragment,
  isFragmentUnlocked,
  getUnlockedFragments,
  getMemoryNarrative,
  getMemoryFragment,
  hasNarrativeContent,
  type MemoryFragmentPayload,
} from '../../config/memory-narratives';
import type { MemoryId } from '../../config/memory-upgrades';
import { createInitialMemories } from '../../config/memory-upgrades';
import {
  LevelUpCoordinator,
  type PauseController,
  type LevelUpEventEmitter,
  type WeaponSystemUpgradeAPI,
} from '../LevelUpCoordinator';

// --- Helpers ---

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

// --- Unit Tests ---

describe('CHANGE-002: Memory Narrative Progression', () => {
  describe('Narrative Data Model', () => {
    it('1. Guerra has 6 fragments', () => {
      const narrative = getMemoryNarrative('memory-war');
      expect(narrative.fragments).toHaveLength(6);
    });

    it('2. Guerra fragments cover levels 1-6', () => {
      const narrative = getMemoryNarrative('memory-war');
      const levels = narrative.fragments.map((f) => f.level);
      expect(levels).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('3. Guerra has correct title', () => {
      const narrative = getMemoryNarrative('memory-war');
      expect(narrative.title).toBe('Recuerdo I — Ecos de la guerra');
    });

    it('4. Familia has 6 fragments', () => {
      const narrative = getMemoryNarrative('memory-family');
      expect(narrative.fragments).toHaveLength(6);
    });

    it('5. Hogar has 6 fragments', () => {
      const narrative = getMemoryNarrative('memory-home');
      expect(narrative.fragments).toHaveLength(6);
    });

    it('6. hasNarrativeContent returns true for Guerra', () => {
      expect(hasNarrativeContent('memory-war')).toBe(true);
    });

    it('7. hasNarrativeContent returns true for Familia', () => {
      expect(hasNarrativeContent('memory-family')).toBe(true);
    });

    it('8. hasNarrativeContent returns true for Hogar', () => {
      expect(hasNarrativeContent('memory-home')).toBe(true);
    });

    it('9. getMemoryFragment returns null for out-of-range levels', () => {
      expect(getMemoryFragment('memory-war', 0)).toBeNull();
      expect(getMemoryFragment('memory-war', 7)).toBeNull();
      expect(getMemoryFragment('memory-war', -1)).toBeNull();
    });

    it('10. getMemoryFragment returns correct fragment for Familia', () => {
      const frag1 = getMemoryFragment('memory-family', 1);
      expect(frag1).not.toBeNull();
      expect(frag1!.text).toBe('Escucho una risa pequeña. Dos niños corren hacia mí, pero sus rostros desaparecen cuando intento mirarlos.');
      const frag6 = getMemoryFragment('memory-family', 6);
      expect(frag6).not.toBeNull();
      expect(frag6!.text).toBe('Sus rostros se desvanecen entre las llamas. Extiendo la mano, pero solo alcanzo a escuchar: “Te esperamos”.');
    });

    it('11. getMemoryFragment returns correct text for Guerra level 1', () => {
      const fragment = getMemoryFragment('memory-war', 1);
      expect(fragment).not.toBeNull();
      expect(fragment!.text).toBe('Tambores… cada vez más cerca. Mis manos vuelven a sujetar el arma, aunque ya no tengo cuerpo.');
    });

    it('12. getMemoryFragment returns correct text for Guerra level 6', () => {
      const fragment = getMemoryFragment('memory-war', 6);
      expect(fragment).not.toBeNull();
      expect(fragment!.text).toBe('El cielo gira sobre mí. Los tambores se apagan y una pregunta permanece: ¿mi sacrificio protegió a alguien?');
    });
  });

  describe('Fragment Unlock State', () => {
    it('13. initial state has no unlocked fragments', () => {
      const state = createInitialUnlockedFragments();
      expect(state['memory-war']).toHaveLength(0);
      expect(state['memory-family']).toHaveLength(0);
      expect(state['memory-home']).toHaveLength(0);
    });

    it('14. unlockFragment adds level to state', () => {
      const state = createInitialUnlockedFragments();
      const result = unlockFragment(state, 'memory-war', 1);
      expect(result).toBe(true);
      expect(state['memory-war']).toContain(1);
    });

    it('15. unlockFragment rejects duplicate', () => {
      const state = createInitialUnlockedFragments();
      unlockFragment(state, 'memory-war', 1);
      const result = unlockFragment(state, 'memory-war', 1);
      expect(result).toBe(false);
      expect(state['memory-war']).toHaveLength(1);
    });

    it('16. unlockFragment rejects out-of-range levels', () => {
      const state = createInitialUnlockedFragments();
      expect(unlockFragment(state, 'memory-war', 0)).toBe(false);
      expect(unlockFragment(state, 'memory-war', 7)).toBe(false);
      expect(state['memory-war']).toHaveLength(0);
    });

    it('17. isFragmentUnlocked returns correct value', () => {
      const state = createInitialUnlockedFragments();
      unlockFragment(state, 'memory-war', 3);
      expect(isFragmentUnlocked(state, 'memory-war', 3)).toBe(true);
      expect(isFragmentUnlocked(state, 'memory-war', 1)).toBe(false);
    });

    it('18. getUnlockedFragments returns current list', () => {
      const state = createInitialUnlockedFragments();
      unlockFragment(state, 'memory-war', 1);
      unlockFragment(state, 'memory-war', 3);
      const fragments = getUnlockedFragments(state, 'memory-war');
      expect(fragments).toContain(1);
      expect(fragments).toContain(3);
      expect(fragments).toHaveLength(2);
    });
  });

  describe('LevelUpCoordinator Narrative Flow', () => {
    let memories: ReturnType<typeof createInitialMemories>;
    let pauseCtrl: ReturnType<typeof createFakePauseController>;
    let emitter: ReturnType<typeof createFakeEventEmitter>;
    let coordinator: LevelUpCoordinator;
    let fakeWeapon: ReturnType<typeof createFakeWeaponSystem>;
    const fakePlayer = { hp: 100, maxHp: 100, speed: 200, increaseSpeed() {} };

    beforeEach(() => {
      memories = createInitialMemories();
      pauseCtrl = createFakePauseController();
      emitter = createFakeEventEmitter();
      fakeWeapon = createFakeWeaponSystem();
      coordinator = new LevelUpCoordinator(memories, pauseCtrl, emitter, fakePlayer, fakeWeapon);
    });

    it('19. selecting Guerra emits memory-fragment-show', () => {
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-war' });
      const fragmentEvents = emitter.emitted.filter((e) => e.event === 'memory-fragment-show');
      expect(fragmentEvents).toHaveLength(1);
    });

    it('20. fragment payload has correct structure', () => {
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-war' });
      const fragmentEvents = emitter.emitted.filter((e) => e.event === 'memory-fragment-show');
      const payload = fragmentEvents[0].args[0] as MemoryFragmentPayload;
      expect(payload.memoryId).toBe('memory-war');
      expect(payload.title).toBe('Recuerdo I — Ecos de la guerra');
      expect(payload.fragmentNumber).toBe(1);
      expect(payload.totalFragments).toBe(6);
      expect(payload.text).toBe('Tambores… cada vez más cerca. Mis manos vuelven a sujetar el arma, aunque ya no tengo cuerpo.');
    });

    it('21. state is showing-fragment after Guerra selection', () => {
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-war' });
      expect(coordinator.getState().status).toBe('showing-fragment');
    });

    it('22. game stays paused during showing-fragment', () => {
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-war' });
      expect(pauseCtrl.isPaused).toBe(true);
      expect(pauseCtrl.resumeCount).toBe(0);
    });

    it('23. memory-fragment-closed resumes game', () => {
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-war' });
      emitter.trigger('memory-fragment-closed');
      expect(pauseCtrl.isPaused).toBe(false);
      expect(pauseCtrl.resumeCount).toBe(1);
      expect(coordinator.getState().status).toBe('idle');
    });

    it('24. Familia DOES emit memory-fragment-show (has content)', () => {
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-family' });
      const fragmentEvents = emitter.emitted.filter((e) => e.event === 'memory-fragment-show');
      expect(fragmentEvents).toHaveLength(1);
      const payload = fragmentEvents[0].args[0] as MemoryFragmentPayload;
      expect(payload.memoryId).toBe('memory-family');
      expect(payload.title).toBe('Recuerdo II — Voces junto al fuego');
      expect(payload.fragmentNumber).toBe(1);
      expect(payload.totalFragments).toBe(6);
      expect(coordinator.getState().status).toBe('showing-fragment');
      // Resume only after memory-fragment-closed
      expect(pauseCtrl.resumeCount).toBe(0);
      emitter.trigger('memory-fragment-closed');
      expect(pauseCtrl.resumeCount).toBe(1);
      expect(coordinator.getState().status).toBe('idle');
    });

    it('25. Hogar DOES emit memory-fragment-show (has content)', () => {
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-home' });
      const fragmentEvents = emitter.emitted.filter((e) => e.event === 'memory-fragment-show');
      expect(fragmentEvents).toHaveLength(1);
      const payload = fragmentEvents[0].args[0] as MemoryFragmentPayload;
      expect(payload.memoryId).toBe('memory-home');
      expect(payload.title).toBe('Recuerdo III — El camino a casa');
      expect(payload.fragmentNumber).toBe(1);
      expect(payload.totalFragments).toBe(6);
      expect(coordinator.getState().status).toBe('showing-fragment');
      expect(pauseCtrl.resumeCount).toBe(0);
      emitter.trigger('memory-fragment-closed');
      expect(pauseCtrl.resumeCount).toBe(1);
      expect(coordinator.getState().status).toBe('idle');
    });

    it('26. unlocked fragments state is updated after Guerra selection', () => {
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-war' });
      const unlocked = coordinator.getUnlockedFragments();
      expect(unlocked['memory-war']).toContain(1);
    });
  });

  // --- Property Tests ---

  describe('Property 41: Fragment Level Range', () => {
    it('getMemoryFragment returns non-null only for levels 1-6 when narrative has content', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -5, max: 12 }),
          (level) => {
            const fragment = getMemoryFragment('memory-war', level);
            if (level >= 1 && level <= 6) {
              expect(fragment).not.toBeNull();
              expect(fragment!.level).toBe(level);
            } else {
              expect(fragment).toBeNull();
            }
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('Property 42: Unlock Idempotency', () => {
    it('unlocking the same fragment twice never creates duplicates', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<MemoryId>('memory-war', 'memory-family', 'memory-home'),
          fc.integer({ min: 1, max: 6 }),
          (memoryId, level) => {
            const state = createInitialUnlockedFragments();
            const first = unlockFragment(state, memoryId, level);
            const second = unlockFragment(state, memoryId, level);
            expect(first).toBe(true);
            expect(second).toBe(false);
            expect(state[memoryId].filter((l) => l === level)).toHaveLength(1);
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  describe('Property 43: Narrative Content Gate', () => {
    it('fragment panel shows only when hasNarrativeContent is true and fragment exists', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<MemoryId>('memory-war', 'memory-family', 'memory-home'),
          (memoryId) => {
            const memories = createInitialMemories();
            const pauseCtrl = createFakePauseController();
            const emitter = createFakeEventEmitter();
            const weapon = createFakeWeaponSystem();
            const player = { hp: 100, maxHp: 100, speed: 200, increaseSpeed() {} };
            const coord = new LevelUpCoordinator(memories, pauseCtrl, emitter, player, weapon);

            coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
            emitter.trigger('upgrade-selected', { upgradeId: memoryId });

            const fragmentEvents = emitter.emitted.filter((e) => e.event === 'memory-fragment-show');

            if (hasNarrativeContent(memoryId)) {
              expect(fragmentEvents).toHaveLength(1);
              expect(coord.getState().status).toBe('showing-fragment');
            } else {
              expect(fragmentEvents).toHaveLength(0);
              expect(coord.getState().status).toBe('idle');
            }

            coord.destroy();
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  describe('Property 44: Fragment Closed Always Resumes', () => {
    it('memory-fragment-closed always transitions from showing-fragment to idle and resumes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 6 }),
          (iterations) => {
            const memories = createInitialMemories();
            const pauseCtrl = createFakePauseController();
            const emitter = createFakeEventEmitter();
            const weapon = createFakeWeaponSystem();
            const player = { hp: 100, maxHp: 100, speed: 200, increaseSpeed() {} };
            const coord = new LevelUpCoordinator(memories, pauseCtrl, emitter, player, weapon);

            // Level up Guerra multiple times
            for (let i = 0; i < iterations; i++) {
              coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 + i });
              emitter.trigger('upgrade-selected', { upgradeId: 'memory-war' });
              // Should be showing fragment
              if (coord.getState().status === 'showing-fragment') {
                emitter.trigger('memory-fragment-closed');
              }
              expect(coord.getState().status).toBe('idle');
              expect(pauseCtrl.isPaused).toBe(false);
            }

            coord.destroy();
          },
        ),
        { numRuns: 30 },
      );
    });
  });
});
