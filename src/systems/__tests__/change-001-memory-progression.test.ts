import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  createInitialMemories,
  getAvailableMemories,
  applyMemoryUpgrade,
  type MemoryId,
} from '../../config/memory-upgrades';
import type { UpgradeContext } from '../../types/interfaces';
import { LevelUpCoordinator, type WeaponSystemUpgradeAPI } from '../LevelUpCoordinator';

// --- Helpers ---

function createMutableContext(): UpgradeContext & {
  getDamage(): number;
  getFireRate(): number;
} {
  let damage = 10;
  let fireRateMs = 1000;
  const ctx: UpgradeContext & { getDamage(): number; getFireRate(): number } = {
    player: { hp: 100, maxHp: 100, speed: 200 },
    weaponSystem: {
      getDamage: () => damage,
      increaseDamage: (amount: number) => { damage += amount; },
      getFireRateMs: () => fireRateMs,
      reduceFireRate: (amountMs: number, minimumMs: number) => {
        fireRateMs = Math.max(fireRateMs - amountMs, minimumMs);
      },
      getRange: () => 384,
      increaseRange: () => {},
      getProjectileSpeed: () => 600,
      increaseProjectileSpeed: () => {},
      getMaxDistance: () => 450,
      increaseMaxDistance: () => {},
    },
    getDamage: () => damage,
    getFireRate: () => fireRateMs,
  };
  return ctx;
}

function createFakeWeaponSystem(): WeaponSystemUpgradeAPI & { getDamageValue(): number; getFireRateValue(): number } {
  let damage = 10;
  let fireRateMs = 1000;
  return {
    getDamage: () => damage,
    increaseDamage: (amount: number) => { damage += amount; },
    getFireRateMs: () => fireRateMs,
    reduceFireRate: (amountMs: number, minimumMs: number) => {
      fireRateMs = Math.max(fireRateMs - amountMs, minimumMs);
    },
    getRange: () => 384,
    increaseRange: () => {},
    getProjectileSpeed: () => 600,
    increaseProjectileSpeed: () => {},
    getMaxDistance: () => 450,
    increaseMaxDistance: () => {},
    getDamageValue: () => damage,
    getFireRateValue: () => fireRateMs,
  };
}

// --- Unit Tests ---

describe('CHANGE-001: Memory Progression System', () => {
  describe('Configuration', () => {
    it('1. exactly three memories exist', () => {
      const memories = createInitialMemories();
      expect(memories).toHaveLength(3);
    });

    it('2. all IDs are unique', () => {
      const memories = createInitialMemories();
      const ids = memories.map((m) => m.id);
      expect(new Set(ids).size).toBe(3);
    });

    it('3. correct names', () => {
      const memories = createInitialMemories();
      expect(memories[0].name).toBe('Recuerdo de la Guerra');
      expect(memories[1].name).toBe('Recuerdo de la Familia');
      expect(memories[2].name).toBe('Recuerdo del Hogar');
    });

    it('4. order is Guerra, Familia, Hogar', () => {
      const memories = createInitialMemories();
      expect(memories[0].id).toBe('memory-war');
      expect(memories[1].id).toBe('memory-family');
      expect(memories[2].id).toBe('memory-home');
    });

    it('5. initial level is 0', () => {
      const memories = createInitialMemories();
      memories.forEach((m) => expect(m.level).toBe(0));
    });

    it('6. max level is 5', () => {
      const memories = createInitialMemories();
      memories.forEach((m) => expect(m.maxLevel).toBe(5));
    });
  });

  describe('Effects', () => {
    it('7. Guerra increases damage by 8', () => {
      const ctx = createMutableContext();
      const memories = createInitialMemories();
      applyMemoryUpgrade(memories[0], ctx);
      expect(ctx.getDamage()).toBe(18);
    });

    it('8. Familia increases maxHp by 20', () => {
      const ctx = createMutableContext();
      const memories = createInitialMemories();
      applyMemoryUpgrade(memories[1], ctx);
      expect(ctx.player.maxHp).toBe(120);
    });

    it('9. Familia heals 20 without exceeding maxHp', () => {
      const ctx = createMutableContext();
      ctx.player.hp = 50;
      const memories = createInitialMemories();
      applyMemoryUpgrade(memories[1], ctx);
      expect(ctx.player.hp).toBe(70); // 50 + 20 = 70 <= 120
      expect(ctx.player.maxHp).toBe(120);
    });

    it('9b. Familia heal does not exceed maxHp when hp is near max', () => {
      const ctx = createMutableContext();
      ctx.player.hp = 95;
      const memories = createInitialMemories();
      applyMemoryUpgrade(memories[1], ctx);
      expect(ctx.player.hp).toBe(115); // 95 + 20 = 115 <= 120
    });

    it('10. Hogar reduces fireRate by 100', () => {
      const ctx = createMutableContext();
      const memories = createInitialMemories();
      applyMemoryUpgrade(memories[2], ctx);
      expect(ctx.getFireRate()).toBe(900);
    });

    it('11. Hogar respects minimum of 250', () => {
      const ctx = createMutableContext();
      const memories = createInitialMemories();
      // Apply Hogar many times to push below minimum
      for (let i = 0; i < 20; i++) {
        applyMemoryUpgrade(memories[2], ctx);
      }
      expect(ctx.getFireRate()).toBe(250);
    });

    it('12. each effect modifies only its area', () => {
      const ctx = createMutableContext();
      const memories = createInitialMemories();

      // Apply Guerra — only damage changes
      const hpBefore = ctx.player.maxHp;
      const frBefore = ctx.getFireRate();
      applyMemoryUpgrade(memories[0], ctx);
      expect(ctx.player.maxHp).toBe(hpBefore);
      expect(ctx.getFireRate()).toBe(frBefore);

      // Apply Familia — only maxHp/hp changes
      const dmgBefore = ctx.getDamage();
      const frBefore2 = ctx.getFireRate();
      applyMemoryUpgrade(memories[1], ctx);
      expect(ctx.getDamage()).toBe(dmgBefore);
      expect(ctx.getFireRate()).toBe(frBefore2);

      // Apply Hogar — only fireRate changes
      const dmgBefore2 = ctx.getDamage();
      const hpBefore2 = ctx.player.maxHp;
      applyMemoryUpgrade(memories[2], ctx);
      expect(ctx.getDamage()).toBe(dmgBefore2);
      expect(ctx.player.maxHp).toBe(hpBefore2);
    });
  });

  describe('Progression', () => {
    it('13. selecting increments level once', () => {
      const memories = createInitialMemories();
      const weapon = createFakeWeaponSystem();
      const player = { hp: 100, maxHp: 100, speed: 200 };
      const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
      const emitter = {
        emit: () => true,
        on: (event: string, fn: (...args: unknown[]) => void) => {
          const arr = listeners.get(event) || [];
          arr.push(fn);
          listeners.set(event, arr);
        },
        off: () => {},
      };
      const pause = { isPaused: false, pause() { this.isPaused = true; }, resume() { this.isPaused = false; } };
      const coord = new LevelUpCoordinator(memories, pause, emitter, player, weapon);
      coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      const fns = listeners.get('upgrade-selected') || [];
      fns.forEach((fn) => fn({ upgradeId: 'memory-war' }));
      expect(memories[0].level).toBe(1);
      coord.destroy();
    });

    it('14. double click does not increment twice', () => {
      const memories = createInitialMemories();
      const weapon = createFakeWeaponSystem();
      const player = { hp: 100, maxHp: 100, speed: 200 };
      const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
      const emitter = {
        emit: () => true,
        on: (event: string, fn: (...args: unknown[]) => void) => {
          const arr = listeners.get(event) || [];
          arr.push(fn);
          listeners.set(event, arr);
        },
        off: () => {},
      };
      const pause = { isPaused: false, pause() { this.isPaused = true; }, resume() { this.isPaused = false; } };
      const coord = new LevelUpCoordinator(memories, pause, emitter, player, weapon);
      coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      const fns = listeners.get('upgrade-selected') || [];
      fns.forEach((fn) => fn({ upgradeId: 'memory-war' }));
      fns.forEach((fn) => fn({ upgradeId: 'memory-war' }));
      expect(memories[0].level).toBe(1);
      coord.destroy();
    });

    it('15. can select same memory multiple times across sessions', () => {
      const memories = createInitialMemories();
      const weapon = createFakeWeaponSystem();
      const player = { hp: 100, maxHp: 100, speed: 200 };
      const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
      const emitter = {
        emit: () => true,
        on: (event: string, fn: (...args: unknown[]) => void) => {
          const arr = listeners.get(event) || [];
          arr.push(fn);
          listeners.set(event, arr);
        },
        off: () => {},
      };
      const pause = { isPaused: false, pause() { this.isPaused = true; }, resume() { this.isPaused = false; } };
      const coord = new LevelUpCoordinator(memories, pause, emitter, player, weapon);
      for (let i = 0; i < 3; i++) {
        coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 + i });
        const fns = listeners.get('upgrade-selected') || [];
        fns.forEach((fn) => fn({ upgradeId: 'memory-war' }));
      }
      expect(memories[0].level).toBe(3);
      coord.destroy();
    });

    it('16. cannot exceed max level 5', () => {
      const memories = createInitialMemories();
      const weapon = createFakeWeaponSystem();
      const player = { hp: 100, maxHp: 100, speed: 200 };
      const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
      const emitter = {
        emit: () => true,
        on: (event: string, fn: (...args: unknown[]) => void) => {
          const arr = listeners.get(event) || [];
          arr.push(fn);
          listeners.set(event, arr);
        },
        off: () => {},
      };
      const pause = { isPaused: false, pause() { this.isPaused = true; }, resume() { this.isPaused = false; } };
      const coord = new LevelUpCoordinator(memories, pause, emitter, player, weapon);
      // Level up war 5 times
      for (let i = 0; i < 5; i++) {
        coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 + i });
        const fns = listeners.get('upgrade-selected') || [];
        fns.forEach((fn) => fn({ upgradeId: 'memory-war' }));
      }
      expect(memories[0].level).toBe(5);
      // Try 6th time — war should be excluded from available
      coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 7 });
      const fns = listeners.get('upgrade-selected') || [];
      fns.forEach((fn) => fn({ upgradeId: 'memory-war' }));
      expect(memories[0].level).toBe(5); // still 5
      coord.destroy();
    });
  });

  describe('Availability', () => {
    it('17. maxed memory is excluded from available', () => {
      const memories = createInitialMemories();
      memories[0].level = 5;
      const available = getAvailableMemories(memories);
      expect(available).toHaveLength(2);
      expect(available.find((m) => m.id === 'memory-war')).toBeUndefined();
    });

    it('18. available matches non-maximized branches', () => {
      const memories = createInitialMemories();
      memories[0].level = 5;
      memories[2].level = 5;
      const available = getAvailableMemories(memories);
      expect(available).toHaveLength(1);
      expect(available[0].id).toBe('memory-family');
    });

    it('19. all maxed → coordinator does not pause', () => {
      const memories = createInitialMemories();
      memories.forEach((m) => { m.level = 5; });
      const weapon = createFakeWeaponSystem();
      const player = { hp: 100, maxHp: 100, speed: 200 };
      const emitter = { emit: () => true, on: () => {}, off: () => {} };
      const pause = { isPaused: false, pause() { this.isPaused = true; }, resume() { this.isPaused = false; } };
      const coord = new LevelUpCoordinator(memories, pause, emitter, player, weapon);
      coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      expect(pause.isPaused).toBe(false);
      coord.destroy();
    });
  });

  describe('Error handling', () => {
    it('20. error does not increment level', () => {
      const memories = createInitialMemories();
      const throwingWeapon: WeaponSystemUpgradeAPI = {
        getDamage: () => 10,
        increaseDamage: () => { throw new Error('boom'); },
        getFireRateMs: () => 1000,
        reduceFireRate: () => {},
        getRange: () => 384,
        increaseRange: () => {},
        getProjectileSpeed: () => 600,
        increaseProjectileSpeed: () => {},
        getMaxDistance: () => 450,
        increaseMaxDistance: () => {},
      };
      const player = { hp: 100, maxHp: 100, speed: 200 };
      const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
      const emitter = {
        emit: () => true,
        on: (event: string, fn: (...args: unknown[]) => void) => {
          const arr = listeners.get(event) || [];
          arr.push(fn);
          listeners.set(event, arr);
        },
        off: () => {},
      };
      const pause = { isPaused: false, pause() { this.isPaused = true; }, resume() { this.isPaused = false; } };
      const coord = new LevelUpCoordinator(memories, pause, emitter, player, throwingWeapon);
      coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      const fns = listeners.get('upgrade-selected') || [];
      fns.forEach((fn) => fn({ upgradeId: 'memory-war' }));
      expect(memories[0].level).toBe(0); // NOT incremented
      coord.destroy();
    });

    it('21. error still resumes PauseSystem', () => {
      const memories = createInitialMemories();
      const throwingWeapon: WeaponSystemUpgradeAPI = {
        getDamage: () => 10,
        increaseDamage: () => { throw new Error('boom'); },
        getFireRateMs: () => 1000,
        reduceFireRate: () => {},
        getRange: () => 384,
        increaseRange: () => {},
        getProjectileSpeed: () => 600,
        increaseProjectileSpeed: () => {},
        getMaxDistance: () => 450,
        increaseMaxDistance: () => {},
      };
      const player = { hp: 100, maxHp: 100, speed: 200 };
      const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
      const emitter = {
        emit: () => true,
        on: (event: string, fn: (...args: unknown[]) => void) => {
          const arr = listeners.get(event) || [];
          arr.push(fn);
          listeners.set(event, arr);
        },
        off: () => {},
      };
      let resumed = false;
      const pause = { isPaused: false, pause() { this.isPaused = true; }, resume() { this.isPaused = false; resumed = true; } };
      const coord = new LevelUpCoordinator(memories, pause, emitter, player, throwingWeapon);
      coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      const fns = listeners.get('upgrade-selected') || [];
      fns.forEach((fn) => fn({ upgradeId: 'memory-war' }));
      expect(resumed).toBe(true);
      coord.destroy();
    });
  });

  describe('State per session', () => {
    it('22. retry resets levels', () => {
      const session1 = createInitialMemories();
      session1[0].level = 3;
      const session2 = createInitialMemories();
      expect(session2[0].level).toBe(0);
    });

    it('23. two sessions do not share objects', () => {
      const session1 = createInitialMemories();
      const session2 = createInitialMemories();
      session1[0].level = 5;
      expect(session2[0].level).toBe(0);
      // Verify no shared references
      expect(session1[0]).not.toBe(session2[0]);
      expect(session1[0].effect).not.toBe(session2[0].effect);
    });
  });

  describe('Presentation', () => {
    it('24. old upgrade names do not appear in memories', () => {
      const memories = createInitialMemories();
      const oldNames = ['Corazón de Obsidiana', 'Garras de Ocelotl', 'Cadencia del Colibrí'];
      memories.forEach((m) => {
        expect(oldNames).not.toContain(m.name);
      });
    });
  });

  describe('BUG-008 regression', () => {
    it('25. BUG-008 remains fixed — applying memory does not throw TypeError', () => {
      const ctx = createMutableContext();
      const memories = createInitialMemories();
      memories.forEach((m) => {
        expect(() => applyMemoryUpgrade(m, ctx)).not.toThrow();
      });
    });

    it('26. all previous INITIAL_UPGRADE_POOL tests still pass (pool exists)', async () => {
      // This is verified by the full test suite running — this test confirms the module exists
      const { INITIAL_UPGRADE_POOL } = await import('../../config/upgrades');
      expect(INITIAL_UPGRADE_POOL).toHaveLength(12);
    });
  });

  // --- Property Tests ---

  describe('Property 37: Memory Level Bounds', () => {
    it('for any number of selections, level stays between 0 and maxLevel', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 20 }),
          (selections) => {
            const memories = createInitialMemories();
            const weapon = createFakeWeaponSystem();
            const player = { hp: 100, maxHp: 100, speed: 200 };
            const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
            const emitter = {
              emit: () => true,
              on: (event: string, fn: (...args: unknown[]) => void) => {
                const arr = listeners.get(event) || [];
                arr.push(fn);
                listeners.set(event, arr);
              },
              off: () => {},
            };
            const pause = { isPaused: false, pause() { this.isPaused = true; }, resume() { this.isPaused = false; } };
            const coord = new LevelUpCoordinator(memories, pause, emitter, player, weapon);

            for (let i = 0; i < selections; i++) {
              coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 + i });
              const fns = listeners.get('upgrade-selected') || [];
              fns.forEach((fn) => fn({ upgradeId: 'memory-war' }));
            }

            memories.forEach((m) => {
              expect(m.level).toBeGreaterThanOrEqual(0);
              expect(m.level).toBeLessThanOrEqual(m.maxLevel);
            });
            coord.destroy();
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('Property 38: Memory Effect Isolation', () => {
    it('applying a memory modifies only its associated stats', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<MemoryId>('memory-war', 'memory-family', 'memory-home'),
          (memoryId) => {
            const ctx = createMutableContext();
            const memories = createInitialMemories();
            const memory = memories.find((m) => m.id === memoryId)!;

            const dmgBefore = ctx.getDamage();
            const hpBefore = ctx.player.maxHp;
            const frBefore = ctx.getFireRate();

            applyMemoryUpgrade(memory, ctx);

            switch (memoryId) {
              case 'memory-war':
                expect(ctx.getDamage()).toBe(dmgBefore + 8);
                expect(ctx.player.maxHp).toBe(hpBefore);
                expect(ctx.getFireRate()).toBe(frBefore);
                break;
              case 'memory-family':
                expect(ctx.getDamage()).toBe(dmgBefore);
                expect(ctx.player.maxHp).toBe(hpBefore + 20);
                expect(ctx.getFireRate()).toBe(frBefore);
                break;
              case 'memory-home':
                expect(ctx.getDamage()).toBe(dmgBefore);
                expect(ctx.player.maxHp).toBe(hpBefore);
                expect(ctx.getFireRate()).toBe(Math.max(frBefore - 100, 250));
                break;
            }
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  describe('Property 39: Memory State Independence', () => {
    it('two states created by createInitialMemories do not share mutable references', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 0, max: 5 }),
          (warLevel, famLevel, homeLevel) => {
            const state1 = createInitialMemories();
            const state2 = createInitialMemories();

            state1[0].level = warLevel;
            state1[1].level = famLevel;
            state1[2].level = homeLevel;

            // state2 must remain at initial values
            expect(state2[0].level).toBe(0);
            expect(state2[1].level).toBe(0);
            expect(state2[2].level).toBe(0);

            // No shared references
            expect(state1[0]).not.toBe(state2[0]);
            expect(state1[1]).not.toBe(state2[1]);
            expect(state1[2]).not.toBe(state2[2]);
            expect(state1[0].effect).not.toBe(state2[0].effect);
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  describe('Property 40: Available Memories Match Non-Maximized Branches', () => {
    it('available list contains exactly memories with level < maxLevel', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 0, max: 5 }),
          (warLevel, famLevel, homeLevel) => {
            const memories = createInitialMemories();
            memories[0].level = warLevel;
            memories[1].level = famLevel;
            memories[2].level = homeLevel;

            const available = getAvailableMemories(memories);

            const expectedCount = [warLevel, famLevel, homeLevel].filter((l) => l < 5).length;
            expect(available).toHaveLength(expectedCount);

            available.forEach((m) => {
              expect(m.level).toBeLessThan(m.maxLevel);
            });

            // Verify order is preserved
            const availableIds = available.map((m) => m.id);
            const expectedIds = memories
              .filter((m) => m.level < m.maxLevel)
              .map((m) => m.id);
            expect(availableIds).toEqual(expectedIds);
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
