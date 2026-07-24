import { describe, it, expect } from 'vitest';
import { INITIAL_UPGRADE_POOL } from '../../config/upgrades';
import { XPSystem } from '../XPSystem';
import { LevelUpCoordinator } from '../LevelUpCoordinator';
import { createInitialMemories } from '../../config/memory-upgrades';
import type { UpgradeContext } from '../../types/interfaces';

/**
 * BUG-008 Regression Test
 *
 * Validates that selecting any upgrade does NOT throw TypeError.
 * Root cause: upgrades accessed `state.weapon.damage` but Player has no `weapon` property.
 * Fix: upgrades now use UpgradeContext with player stats and weaponSystem API.
 */

function createFakeUpgradeContext(): UpgradeContext {
  return {
    player: { hp: 100, maxHp: 100, speed: 200 },
    weaponSystem: {
      getDamage: () => 10,
      increaseDamage(amount: number) { (this as { _damage?: number })._damage = (((this as { _damage?: number })._damage) ?? 10) + amount; },
      getFireRateMs: () => 1000,
      reduceFireRate(_amountMs: number, _minimumMs: number) {},
      getRange: () => 384,
      increaseRange(_amount: number) {},
      getProjectileSpeed: () => 600,
      increaseProjectileSpeed(_amount: number) {},
      getMaxDistance: () => 450,
      increaseMaxDistance(_amount: number) {},
    },
  };
}

/**
 * Creates a mutable upgrade context that tracks mutations.
 */
function createMutableUpgradeContext(): UpgradeContext & {
  getWeaponDamage(): number;
  getWeaponFireRate(): number;
  getWeaponRange(): number;
  getWeaponProjectileSpeed(): number;
  getWeaponMaxDistance(): number;
} {
  let damage = 10;
  let fireRateMs = 1000;
  let range = 384;
  let projectileSpeed = 600;
  let maxDistance = 450;

  const ctx = {
    player: { hp: 100, maxHp: 100, speed: 200 },
    weaponSystem: {
      getDamage: () => damage,
      increaseDamage: (amount: number) => { damage += amount; },
      getFireRateMs: () => fireRateMs,
      reduceFireRate: (amountMs: number, minimumMs: number) => { fireRateMs = Math.max(fireRateMs - amountMs, minimumMs); },
      getRange: () => range,
      increaseRange: (amount: number) => { range += amount; },
      getProjectileSpeed: () => projectileSpeed,
      increaseProjectileSpeed: (amount: number) => { projectileSpeed += amount; },
      getMaxDistance: () => maxDistance,
      increaseMaxDistance: (amount: number) => { maxDistance += amount; },
    },
    getWeaponDamage: () => damage,
    getWeaponFireRate: () => fireRateMs,
    getWeaponRange: () => range,
    getWeaponProjectileSpeed: () => projectileSpeed,
    getWeaponMaxDistance: () => maxDistance,
  };
  return ctx;
}

describe('BUG-008: Selecting an upgrade does not crash', () => {
  describe('No TypeError on any upgrade', () => {
    it.each(INITIAL_UPGRADE_POOL.map((u) => [u.id, u.name]))(
      'upgrade "%s" (%s) applies without throwing',
      (id) => {
        const upgrade = INITIAL_UPGRADE_POOL.find((u) => u.id === id)!;
        const ctx = createFakeUpgradeContext();
        expect(() => upgrade.apply(ctx)).not.toThrow();
      },
    );
  });

  describe('XPSystem.applyUpgrade does not throw for any upgrade', () => {
    it.each(INITIAL_UPGRADE_POOL.map((u) => [u.id, u.name]))(
      'XPSystem.applyUpgrade with "%s" (%s) does not throw',
      (id) => {
        const upgrade = INITIAL_UPGRADE_POOL.find((u) => u.id === id)!;
        const xpSystem = new XPSystem([...INITIAL_UPGRADE_POOL]);
        const ctx = createFakeUpgradeContext();
        expect(() => xpSystem.applyUpgrade(ctx, upgrade)).not.toThrow();
      },
    );
  });

  describe('Upgrade effects are applied correctly', () => {
    it('speed_boost_1 increases player speed by 20', () => {
      const ctx = createMutableUpgradeContext();
      const upgrade = INITIAL_UPGRADE_POOL.find((u) => u.id === 'speed_boost_1')!;
      upgrade.apply(ctx);
      expect(ctx.player.speed).toBe(220);
    });

    it('speed_boost_2 increases player speed by 30', () => {
      const ctx = createMutableUpgradeContext();
      const upgrade = INITIAL_UPGRADE_POOL.find((u) => u.id === 'speed_boost_2')!;
      upgrade.apply(ctx);
      expect(ctx.player.speed).toBe(230);
    });

    it('max_hp_1 increases maxHp by 20 and heals by 20', () => {
      const ctx = createMutableUpgradeContext();
      const upgrade = INITIAL_UPGRADE_POOL.find((u) => u.id === 'max_hp_1')!;
      upgrade.apply(ctx);
      expect(ctx.player.maxHp).toBe(120);
      expect(ctx.player.hp).toBe(120);
    });

    it('max_hp_2 increases maxHp by 30 and heals by 30', () => {
      const ctx = createMutableUpgradeContext();
      const upgrade = INITIAL_UPGRADE_POOL.find((u) => u.id === 'max_hp_2')!;
      upgrade.apply(ctx);
      expect(ctx.player.maxHp).toBe(130);
      expect(ctx.player.hp).toBe(130);
    });

    it('max_hp_1 does not overheal above maxHp', () => {
      const ctx = createMutableUpgradeContext();
      ctx.player.hp = 50; // damaged
      const upgrade = INITIAL_UPGRADE_POOL.find((u) => u.id === 'max_hp_1')!;
      upgrade.apply(ctx);
      expect(ctx.player.maxHp).toBe(120);
      expect(ctx.player.hp).toBe(70); // 50 + 20 <= 120
    });

    it('weapon_damage_1 increases weapon damage by 5', () => {
      const ctx = createMutableUpgradeContext();
      const upgrade = INITIAL_UPGRADE_POOL.find((u) => u.id === 'weapon_damage_1')!;
      upgrade.apply(ctx);
      expect(ctx.getWeaponDamage()).toBe(15);
    });

    it('weapon_damage_2 increases weapon damage by 8', () => {
      const ctx = createMutableUpgradeContext();
      const upgrade = INITIAL_UPGRADE_POOL.find((u) => u.id === 'weapon_damage_2')!;
      upgrade.apply(ctx);
      expect(ctx.getWeaponDamage()).toBe(18);
    });

    it('fire_rate_1 reduces fire rate by 100ms (min 200)', () => {
      const ctx = createMutableUpgradeContext();
      const upgrade = INITIAL_UPGRADE_POOL.find((u) => u.id === 'fire_rate_1')!;
      upgrade.apply(ctx);
      expect(ctx.getWeaponFireRate()).toBe(900);
    });

    it('fire_rate_2 reduces fire rate by 150ms (min 200)', () => {
      const ctx = createMutableUpgradeContext();
      const upgrade = INITIAL_UPGRADE_POOL.find((u) => u.id === 'fire_rate_2')!;
      upgrade.apply(ctx);
      expect(ctx.getWeaponFireRate()).toBe(850);
    });

    it('fire_rate does not go below 200ms minimum', () => {
      const ctx = createMutableUpgradeContext();
      // Apply fire_rate reductions repeatedly
      const fr1 = INITIAL_UPGRADE_POOL.find((u) => u.id === 'fire_rate_1')!;
      const fr2 = INITIAL_UPGRADE_POOL.find((u) => u.id === 'fire_rate_2')!;
      // 1000 - 100 = 900, - 150 = 750, - 100 = 650, - 150 = 500, etc.
      for (let i = 0; i < 10; i++) {
        fr1.apply(ctx);
        fr2.apply(ctx);
      }
      expect(ctx.getWeaponFireRate()).toBeGreaterThanOrEqual(200);
    });

    it('weapon_range_1 increases range by 100', () => {
      const ctx = createMutableUpgradeContext();
      const upgrade = INITIAL_UPGRADE_POOL.find((u) => u.id === 'weapon_range_1')!;
      upgrade.apply(ctx);
      expect(ctx.getWeaponRange()).toBe(484);
    });

    it('weapon_range_2 increases range by 150', () => {
      const ctx = createMutableUpgradeContext();
      const upgrade = INITIAL_UPGRADE_POOL.find((u) => u.id === 'weapon_range_2')!;
      upgrade.apply(ctx);
      expect(ctx.getWeaponRange()).toBe(534);
    });

    it('projectile_speed_1 increases projectile speed by 100', () => {
      const ctx = createMutableUpgradeContext();
      const upgrade = INITIAL_UPGRADE_POOL.find((u) => u.id === 'projectile_speed_1')!;
      upgrade.apply(ctx);
      expect(ctx.getWeaponProjectileSpeed()).toBe(700);
    });

    it('max_distance_1 increases max distance by 200', () => {
      const ctx = createMutableUpgradeContext();
      const upgrade = INITIAL_UPGRADE_POOL.find((u) => u.id === 'max_distance_1')!;
      upgrade.apply(ctx);
      expect(ctx.getWeaponMaxDistance()).toBe(650);
    });
  });

  describe('PauseSystem always resumes even on error', () => {
    it('resume is called even if memory apply throws', () => {
      let resumed = false;
      const pauseCtrl = {
        isPaused: false,
        pause() { this.isPaused = true; },
        resume() { this.isPaused = false; resumed = true; },
      };

      const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
      const emitter = {
        emit(event: string, ...args: unknown[]) {
          const fns = listeners.get(event) || [];
          fns.forEach((fn) => fn(...args));
          return fns.length > 0;
        },
        on(event: string, fn: (...args: unknown[]) => void) {
          const arr = listeners.get(event) || [];
          arr.push(fn);
          listeners.set(event, arr);
          return emitter;
        },
        off(event: string, fn: (...args: unknown[]) => void) {
          const arr = listeners.get(event) || [];
          listeners.set(event, arr.filter((f) => f !== fn));
          return emitter;
        },
      };

      // Create memories with a patched weaponSystem that throws
      const memories = createInitialMemories();
      const fakePlayer = { hp: 100, maxHp: 100, speed: 200 };
      const throwingWeapon = {
        getDamage: () => 10,
        increaseDamage: () => { throw new Error('simulated crash'); },
        getFireRateMs: () => 1000,
        reduceFireRate: () => {},
        getRange: () => 384,
        increaseRange: () => {},
        getProjectileSpeed: () => 600,
        increaseProjectileSpeed: () => {},
        getMaxDistance: () => 450,
        increaseMaxDistance: () => {},
      };

      const coord = new LevelUpCoordinator(memories, pauseCtrl, emitter, fakePlayer, throwingWeapon);
      coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });

      // Trigger the memory selection that will throw (memory-war calls increaseDamage)
      const fns = listeners.get('upgrade-selected') || [];
      fns.forEach((fn) => fn({ upgradeId: 'memory-war' }));

      expect(resumed).toBe(true);
      // Memory level should NOT have been incremented since apply threw
      expect(memories[0].level).toBe(0);
      coord.destroy();
    });
  });

  describe('Upgrade pool integrity', () => {
    it('all 12 upgrades are in INITIAL_UPGRADE_POOL', () => {
      expect(INITIAL_UPGRADE_POOL).toHaveLength(12);
    });

    it('Corazón de Obsidiana is present', () => {
      expect(INITIAL_UPGRADE_POOL.find((u) => u.name === 'Corazón de Obsidiana')).toBeDefined();
    });

    it('Garras de Ocelotl is present', () => {
      expect(INITIAL_UPGRADE_POOL.find((u) => u.name === 'Garras de Ocelotl')).toBeDefined();
    });

    it('Cadencia del Colibrí is present', () => {
      expect(INITIAL_UPGRADE_POOL.find((u) => u.name === 'Cadencia del Colibrí')).toBeDefined();
    });

    it('all upgrades have unique IDs', () => {
      const ids = INITIAL_UPGRADE_POOL.map((u) => u.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
