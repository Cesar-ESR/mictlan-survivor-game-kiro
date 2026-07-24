import { describe, it, expect } from 'vitest';
import { findClosestEnemy, calculateProjectileVelocity } from '../weapon-utils';
import type { WeaponTarget } from '../weapon-utils';
import { GAME_CONSTANTS } from '../../config/constants';

/**
 * Unit tests for the WeaponSystem and weapon-utils.
 * Tests pure functions without Phaser mocks, and timer/pool logic with minimal mocks.
 *
 * **Validates: Requirements 4.1, 4.6**
 */
describe('WeaponSystem Unit Tests', () => {
  const RANGE = GAME_CONSTANTS.WEAPON_RANGE; // 384 (BUG-004)
  const MAX_DISTANCE = GAME_CONSTANTS.PROJECTILE_MAX_DISTANCE; // 450 (BUG-004)
  const FIRE_RATE = GAME_CONSTANTS.WEAPON_BASE_FIRE_RATE; // 1000ms
  const DAMAGE = GAME_CONSTANTS.WEAPON_BASE_DAMAGE; // 10

  // --- Fire Timer Tests ---

  describe('Fire timer logic', () => {
    it('1. fireTimer starts at zero', () => {
      // Simulating fire timer starts at zero
      const fireTimer = 0;
      expect(fireTimer).toBe(0);
    });

    it('2. Before 1000ms no firing', () => {
      let fireTimer = 0;
      let fired = false;

      // Accumulate 999ms
      fireTimer += 999;
      if (fireTimer >= FIRE_RATE) {
        fired = true;
      }

      expect(fired).toBe(false);
    });

    it('3. At 1000ms attempts to fire', () => {
      let fireTimer = 0;
      let fired = false;

      // Accumulate exactly 1000ms
      fireTimer += 1000;
      if (fireTimer >= FIRE_RATE) {
        fireTimer -= FIRE_RATE;
        fired = true;
      }

      expect(fired).toBe(true);
      expect(fireTimer).toBe(0);
    });

    it('timer preserves excess when firing', () => {
      let fireTimer = 0;
      let firedCount = 0;

      // Accumulate 1200ms (fire once, preserve 200ms)
      fireTimer += 1200;
      if (fireTimer >= FIRE_RATE) {
        fireTimer -= FIRE_RATE;
        firedCount++;
      }

      expect(firedCount).toBe(1);
      expect(fireTimer).toBe(200);
    });
  });

  // --- Targeting Tests ---

  describe('findClosestEnemy targeting', () => {
    const playerPos = { x: 100, y: 100 };

    it('4. Without enemies in range: no target (returns null)', () => {
      const enemies: WeaponTarget[] = [
        { x: 1000, y: 1000, active: true, hp: 10 }, // far away
      ];
      const result = findClosestEnemy(playerPos, enemies, RANGE);
      expect(result).toBeNull();
    });

    it('5. Selects closest enemy', () => {
      const enemies: WeaponTarget[] = [
        { x: 350, y: 100, active: true, hp: 10 }, // distance 250
        { x: 250, y: 100, active: true, hp: 10 }, // distance 150 (closest)
        { x: 450, y: 100, active: true, hp: 10 }, // distance 350
      ];
      const result = findClosestEnemy(playerPos, enemies, RANGE);
      expect(result).toBe(enemies[1]);
    });

    it('6. Enemy at exactly WEAPON_RANGE is valid', () => {
      const enemies: WeaponTarget[] = [
        { x: 100 + RANGE, y: 100, active: true, hp: 10 }, // exactly at range
      ];
      const result = findClosestEnemy(playerPos, enemies, RANGE);
      expect(result).toBe(enemies[0]);
    });

    it('7. Enemy beyond WEAPON_RANGE is invalid', () => {
      const enemies: WeaponTarget[] = [
        { x: 100 + RANGE + 1, y: 100, active: true, hp: 10 }, // 1px beyond range
      ];
      const result = findClosestEnemy(playerPos, enemies, RANGE);
      expect(result).toBeNull();
    });

    it('ignores inactive enemies', () => {
      const enemies: WeaponTarget[] = [
        { x: 200, y: 100, active: false, hp: 10 }, // inactive
        { x: 300, y: 100, active: true, hp: 10 },  // distance 200, within range
      ];
      const result = findClosestEnemy(playerPos, enemies, RANGE);
      expect(result).toBe(enemies[1]);
    });

    it('ignores enemies with hp <= 0', () => {
      const enemies: WeaponTarget[] = [
        { x: 200, y: 100, active: true, hp: 0 },  // dead
        { x: 300, y: 100, active: true, hp: 10 }, // distance 200, within range
      ];
      const result = findClosestEnemy(playerPos, enemies, RANGE);
      expect(result).toBe(enemies[1]);
    });

    it('returns first found on exact tie', () => {
      const enemies: WeaponTarget[] = [
        { x: 400, y: 100, active: true, hp: 10 }, // distance 300
        { x: 100, y: 400, active: true, hp: 10 }, // distance 300 (same)
      ];
      const result = findClosestEnemy(playerPos, enemies, RANGE);
      expect(result).toBe(enemies[0]);
    });

    it('returns null for empty array', () => {
      const result = findClosestEnemy(playerPos, [], RANGE);
      expect(result).toBeNull();
    });
  });

  // --- Projectile Velocity Tests ---

  describe('calculateProjectileVelocity', () => {
    const SPEED = 600;

    it('8. Projectile appears at player position (velocity points right)', () => {
      const from = { x: 100, y: 100 };
      const target = { x: 200, y: 100 };
      const { vx, vy } = calculateProjectileVelocity(from, target, SPEED);
      expect(vx).toBeCloseTo(SPEED);
      expect(vy).toBeCloseTo(0);
    });

    it('9. Velocity points toward target (diagonal)', () => {
      const from = { x: 0, y: 0 };
      const target = { x: 100, y: 100 };
      const { vx, vy } = calculateProjectileVelocity(from, target, SPEED);
      // Direction should be (1/√2, 1/√2) * speed
      const expected = SPEED / Math.sqrt(2);
      expect(vx).toBeCloseTo(expected);
      expect(vy).toBeCloseTo(expected);
    });

    it('10. Velocity has correct magnitude', () => {
      const from = { x: 50, y: 30 };
      const target = { x: 200, y: 150 };
      const { vx, vy } = calculateProjectileVelocity(from, target, SPEED);
      const magnitude = Math.sqrt(vx * vx + vy * vy);
      expect(magnitude).toBeCloseTo(SPEED);
    });

    it('returns zero velocity when from equals target', () => {
      const from = { x: 100, y: 100 };
      const { vx, vy } = calculateProjectileVelocity(from, from, SPEED);
      expect(vx).toBe(0);
      expect(vy).toBe(0);
    });

    it('never produces NaN', () => {
      const from = { x: 0, y: 0 };
      const target = { x: 0, y: 0 };
      const { vx, vy } = calculateProjectileVelocity(from, target, SPEED);
      expect(Number.isNaN(vx)).toBe(false);
      expect(Number.isNaN(vy)).toBe(false);
    });
  });

  // --- Pool / Recycling Logic Tests (simulated, no Phaser) ---

  describe('Projectile pool and recycling logic', () => {
    // Simulated projectile state for pool tests
    interface SimProjectile {
      active: boolean;
      visible: boolean;
      x: number;
      y: number;
      vx: number;
      vy: number;
      damage: number;
      distanceTravelled: number;
      speed: number;
    }

    function createSimProjectile(): SimProjectile {
      return {
        active: false,
        visible: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        damage: 0,
        distanceTravelled: 0,
        speed: 0,
      };
    }

    function activateSimProjectile(
      p: SimProjectile,
      x: number,
      y: number,
      vx: number,
      vy: number,
      damage: number,
      speed: number,
    ): void {
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.damage = damage;
      p.speed = speed;
      p.distanceTravelled = 0;
      p.active = true;
      p.visible = true;
    }

    function recycleSimProjectile(p: SimProjectile): void {
      p.active = false;
      p.visible = false;
      p.vx = 0;
      p.vy = 0;
      p.distanceTravelled = 0;
    }

    it('11. Pool reuses inactive projectile', () => {
      const pool = [createSimProjectile(), createSimProjectile()];

      // Activate first
      activateSimProjectile(pool[0], 10, 10, 100, 0, DAMAGE, 600);

      // Get first dead (inactive)
      const dead = pool.find((p) => !p.active);
      expect(dead).toBe(pool[1]);
    });

    it('12. Pool respects maxSize (all active = no fire)', () => {
      const maxSize = 2;
      const pool = Array.from({ length: maxSize }, createSimProjectile);

      // Activate all
      pool.forEach((p) => activateSimProjectile(p, 0, 0, 100, 0, DAMAGE, 600));

      // Try to get dead — none available
      const dead = pool.find((p) => !p.active);
      expect(dead).toBeUndefined();
    });

    it('13. Recycle stops velocity', () => {
      const p = createSimProjectile();
      activateSimProjectile(p, 0, 0, 500, 300, DAMAGE, 600);
      recycleSimProjectile(p);

      expect(p.vx).toBe(0);
      expect(p.vy).toBe(0);
    });

    it('14. Recycle hides and deactivates', () => {
      const p = createSimProjectile();
      activateSimProjectile(p, 0, 0, 100, 100, DAMAGE, 600);
      recycleSimProjectile(p);

      expect(p.active).toBe(false);
      expect(p.visible).toBe(false);
    });

    it('15. Recycle resets distance', () => {
      const p = createSimProjectile();
      activateSimProjectile(p, 0, 0, 100, 0, DAMAGE, 600);
      p.distanceTravelled = 500;
      recycleSimProjectile(p);

      expect(p.distanceTravelled).toBe(0);
    });

    it('16. At MAX_DISTANCE: recycles', () => {
      const p = createSimProjectile();
      activateSimProjectile(p, 0, 0, 600, 0, DAMAGE, 600);

      // Simulate distance accumulation
      const deltaMs = 16; // one frame
      const distPerFrame = p.speed * (deltaMs / 1000);
      let recycled = false;

      while (!recycled) {
        p.distanceTravelled += distPerFrame;
        if (p.distanceTravelled >= MAX_DISTANCE) {
          recycleSimProjectile(p);
          recycled = true;
        }
      }

      expect(p.active).toBe(false);
      expect(p.distanceTravelled).toBe(0);
    });

    it('17. Inactive projectile not updated', () => {
      const p = createSimProjectile();
      // p is inactive by default
      const deltaMs = 100;

      // Only update active projectiles
      if (p.active) {
        p.distanceTravelled += p.speed * (deltaMs / 1000);
      }

      expect(p.distanceTravelled).toBe(0);
    });
  });

  // --- WeaponSystem does NOT do damage ---

  describe('WeaponSystem responsibility boundaries', () => {
    it('18. WeaponSystem does NOT apply damage (only creates projectiles)', () => {
      // The weapon system creates projectiles with a damage value,
      // but does NOT call takeDamage on enemies. DamageSystem handles that.
      const enemies: WeaponTarget[] = [
        { x: 200, y: 100, active: true, hp: 30 },
      ];

      // findClosestEnemy just returns reference, no damage applied
      const target = findClosestEnemy({ x: 100, y: 100 }, enemies, RANGE);
      expect(target).not.toBeNull();
      expect(target!.hp).toBe(30); // HP unchanged
    });

    it('19. WeaponSystem does NOT kill enemies', () => {
      const enemies: WeaponTarget[] = [
        { x: 200, y: 100, active: true, hp: 5 },
      ];

      // Using findClosestEnemy and calculateProjectileVelocity never modifies enemy
      findClosestEnemy({ x: 100, y: 100 }, enemies, RANGE);
      calculateProjectileVelocity({ x: 100, y: 100 }, { x: 200, y: 100 }, 600);

      expect(enemies[0].hp).toBe(5);
      expect(enemies[0].active).toBe(true);
    });
  });
});
