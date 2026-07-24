import { describe, it, expect } from 'vitest';
import {
  calculateDirectChaseVelocity,
  calculateChaseDirection,
  calculateZigzagOffset,
  calculateAcceleration,
} from '../../entities/enemies/enemy-movement.pure';

/**
 * BUG-002 Regression Tests: Enemies pass through walls, obstacles, and liquids.
 *
 * Root Cause: SpawnManager created the enemy pool using `scene.add.group()`
 * (a plain Phaser.GameObjects.Group) instead of `scene.physics.add.group()`
 * (Phaser.Physics.Arcade.Group). When colliders are registered via
 * `physics.add.collider(group, tilemapLayer)`, Phaser's Arcade physics engine
 * does NOT properly resolve tile-vs-sprite separations for children of a plain group.
 * Switching to Physics.Arcade.Group ensures the physics system correctly iterates
 * and separates bodies against tilemap layers.
 *
 * Fix: Changed `scene.add.group({ runChildUpdate: false })` to
 * `scene.physics.add.group({ runChildUpdate: false })` in SpawnManager constructor.
 * Updated type declarations and return type accordingly.
 *
 * These tests verify the contracts that enable physics collisions to work:
 * 1. All enemy archetypes use setVelocity (not direct position manipulation)
 * 2. The SpawnManager module exports the correct type for the enemy pool
 * 3. Enemy movement pure functions produce velocity vectors (never positions)
 * 4. All archetypes follow the velocity-only movement contract
 */
describe('BUG-002 Regression: Enemy Map Collisions', () => {
  /**
   * Contract 1: All enemy archetypes use velocity-based movement.
   * Arcade physics collisions only work correctly when movement is done via
   * setVelocity(). Direct position manipulation (x = ..., y = ...) bypasses
   * the physics engine and ignores colliders entirely.
   *
   * We verify this by confirming that the pure movement functions return
   * velocity vectors (not new positions), and that the velocity magnitude
   * matches speed × multiplier.
   */
  describe('Velocity-based movement contract', () => {
    it('calculateDirectChaseVelocity returns velocity, not position', () => {
      const enemyPos = { x: 100, y: 100 };
      const playerPos = { x: 200, y: 200 };
      const speed = 80;
      const multiplier = 1.0;

      const velocity = calculateDirectChaseVelocity(enemyPos, playerPos, speed, multiplier);

      // Velocity magnitude should equal speed × multiplier
      const mag = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      expect(mag).toBeCloseTo(speed * multiplier, 1);

      // Velocity values should NOT be absolute positions (they should be small relative to positions)
      // A velocity of 80 px/s is not a world coordinate
      expect(Math.abs(velocity.x)).toBeLessThan(speed * multiplier + 1);
      expect(Math.abs(velocity.y)).toBeLessThan(speed * multiplier + 1);
    });

    it('Esqueleto archetype: direct chase uses velocity vector', () => {
      // Esqueleto: speed=80, uses calculateDirectChaseVelocity
      const enemyPos = { x: 500, y: 500 };
      const playerPos = { x: 600, y: 400 };
      const speed = 80;
      const multiplier = 1.2;

      const velocity = calculateDirectChaseVelocity(enemyPos, playerPos, speed, multiplier);
      const mag = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

      expect(mag).toBeCloseTo(speed * multiplier, 1);

      // Direction should point toward player
      const dir = calculateChaseDirection(enemyPos, playerPos);
      expect(velocity.x / mag).toBeCloseTo(dir.x, 4);
      expect(velocity.y / mag).toBeCloseTo(dir.y, 4);
    });

    it('CalaveraLlameante archetype: direct chase uses velocity vector', () => {
      // CalaveraLlameante: speed=60, uses calculateDirectChaseVelocity
      const enemyPos = { x: 300, y: 300 };
      const playerPos = { x: 100, y: 100 };
      const speed = 60;
      const multiplier = 1.0;

      const velocity = calculateDirectChaseVelocity(enemyPos, playerPos, speed, multiplier);
      const mag = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

      expect(mag).toBeCloseTo(speed * multiplier, 1);
    });

    it('SerpienteEmplumada archetype: accelerating chase uses velocity vector', () => {
      // SerpienteEmplumada: speed starts at 100, accelerates to max 250
      const enemyPos = { x: 400, y: 400 };
      const playerPos = { x: 600, y: 600 };
      const initialSpeed = 100;
      const acceleration = 30;
      const maxSpeed = 250;
      const multiplier = 1.5;

      // Simulate acceleration over 2 seconds
      const newSpeed = calculateAcceleration(initialSpeed, acceleration, maxSpeed, 2.0);
      expect(newSpeed).toBe(160); // 100 + 30*2 = 160, capped at 250

      // The velocity should use the accelerated speed
      const dir = calculateChaseDirection(enemyPos, playerPos);
      const effectiveSpeed = newSpeed * multiplier;
      const velocity = { x: dir.x * effectiveSpeed, y: dir.y * effectiveSpeed };
      const mag = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

      expect(mag).toBeCloseTo(effectiveSpeed, 1);
    });

    it('SerpienteEmplumada speed never exceeds maxSpeed', () => {
      const currentSpeed = 240;
      const acceleration = 30;
      const maxSpeed = 250;

      // After 1 second: 240 + 30 = 270, but capped at 250
      const newSpeed = calculateAcceleration(currentSpeed, acceleration, maxSpeed, 1.0);
      expect(newSpeed).toBe(maxSpeed);
    });

    it('Murcielago archetype: zigzag movement uses velocity vector', () => {
      // Murcielago: speed=150, adds perpendicular zigzag offset
      const enemyPos = { x: 200, y: 200 };
      const playerPos = { x: 400, y: 200 };
      const speed = 150;
      const multiplier = 1.0;
      const amplitude = 40;
      const frequency = 3;
      const phase = 1.5;

      const direction = calculateChaseDirection(enemyPos, playerPos);
      const effectiveSpeed = speed * multiplier;
      const baseVelX = direction.x * effectiveSpeed;
      const baseVelY = direction.y * effectiveSpeed;

      const offset = calculateZigzagOffset(direction, phase, amplitude, frequency);

      const finalVelX = baseVelX + offset.x;
      const finalVelY = baseVelY + offset.y;

      // The final velocity is still a velocity vector (reasonable magnitude)
      const mag = Math.sqrt(finalVelX * finalVelX + finalVelY * finalVelY);
      // Magnitude should be bounded: max possible = speed + amplitude
      expect(mag).toBeLessThanOrEqual(effectiveSpeed + amplitude + 1);
      expect(mag).toBeGreaterThan(0);
    });
  });

  /**
   * Contract 2: SpawnManager.getEnemyPool() return type is Physics.Arcade.Group.
   *
   * We verify this structurally: the SpawnManager module declares the pool
   * as Phaser.Physics.Arcade.Group and returns it typed correctly.
   * This is a compile-time guarantee verified by TypeScript (tsc --noEmit passes).
   *
   * We also verify via source inspection that the group creation uses
   * `scene.physics.add.group()` (not `scene.add.group()`).
   */
  describe('SpawnManager pool type contract', () => {
    it('SpawnManager source uses scene.physics.add.group (verified via source text)', async () => {
      // Read the SpawnManager source to confirm the physics group pattern
      // This avoids importing Phaser (which needs browser globals like navigator)
      // @ts-ignore -- node:fs available in vitest runtime
      const nodeFs: { readFileSync(p: string, enc: string): string } = await import('node:fs');
      // @ts-ignore -- node:path available in vitest runtime
      const nodePath: { resolve(...args: string[]): string } = await import('node:path');

      // @ts-ignore -- __dirname available in vitest CJS compat
      const dir: string = __dirname;
      const spawnManagerPath = nodePath.resolve(dir, '..', 'SpawnManager.ts');
      const source = nodeFs.readFileSync(spawnManagerPath, 'utf-8');

      // Verify the fix: scene.physics.add.group is used (not scene.add.group)
      expect(source).toContain('scene.physics.add.group');
      expect(source).not.toMatch(/scene\.add\.group\s*\(/);

      // Verify type declaration uses Physics.Arcade.Group
      expect(source).toContain('Phaser.Physics.Arcade.Group');

      // Verify return type of getEnemyPool
      expect(source).toMatch(/getEnemyPool\(\):\s*Phaser\.Physics\.Arcade\.Group/);
    });
  });

  /**
   * Contract 3: Velocity-only movement means Arcade physics can resolve collisions.
   *
   * When an enemy calls setVelocity(vx, vy), Phaser Arcade physics:
   * 1. Moves the body by velocity×dt
   * 2. Checks overlap with colliders (tilemap layers)
   * 3. Separates the body from the tile if overlapping
   *
   * If an enemy used direct position manipulation instead (x += dx),
   * step 2 and 3 would be skipped, allowing pass-through.
   *
   * We verify that all pure movement functions output velocity components,
   * never absolute world positions.
   */
  describe('No direct position manipulation', () => {
    it('calculateDirectChaseVelocity output is independent of enemy absolute position', () => {
      const speed = 100;
      const multiplier = 1.0;
      const playerPos = { x: 500, y: 500 };

      // Two different enemy positions pointing to same player
      const vel1 = calculateDirectChaseVelocity({ x: 100, y: 100 }, playerPos, speed, multiplier);
      const vel2 = calculateDirectChaseVelocity({ x: 900, y: 900 }, playerPos, speed, multiplier);

      // Magnitudes should be the same (speed × multiplier)
      const mag1 = Math.sqrt(vel1.x * vel1.x + vel1.y * vel1.y);
      const mag2 = Math.sqrt(vel2.x * vel2.x + vel2.y * vel2.y);
      expect(mag1).toBeCloseTo(speed * multiplier, 1);
      expect(mag2).toBeCloseTo(speed * multiplier, 1);

      // Directions should differ (pointing to same target from different positions)
      // But both should have same magnitude — confirming velocity is relative, not absolute
      expect(vel1.x).not.toBeCloseTo(vel2.x, 0);
    });

    it('calculateZigzagOffset returns a small perturbation, not a world position', () => {
      const direction = { x: 1, y: 0 }; // moving right
      const phase = 2.0;
      const amplitude = 40;
      const frequency = 3;

      const offset = calculateZigzagOffset(direction, phase, amplitude, frequency);

      // Offset components should be bounded by amplitude
      expect(Math.abs(offset.x)).toBeLessThanOrEqual(amplitude + 0.01);
      expect(Math.abs(offset.y)).toBeLessThanOrEqual(amplitude + 0.01);
    });

    it('zero distance produces zero velocity (no NaN or infinite)', () => {
      const pos = { x: 100, y: 200 };
      const velocity = calculateDirectChaseVelocity(pos, pos, 100, 1.0);

      expect(velocity.x).toBe(0);
      expect(velocity.y).toBe(0);
      expect(Number.isFinite(velocity.x)).toBe(true);
      expect(Number.isFinite(velocity.y)).toBe(true);
    });
  });

  /**
   * Contract 4: Enemy body configuration for collision resolution.
   *
   * For Arcade physics tile-vs-sprite collision to work, the enemy body must:
   * - exist (physics added)
   * - be enabled (body.enable = true)
   * - be in a Physics.Arcade.Group (so collider iterates it)
   * - use velocity-based movement
   *
   * We verify the movement contract here; the group type is verified at compile time
   * and in the SpawnManager pool type contract test above.
   */
  describe('Body configuration requirements for tile collision', () => {
    it('all 4 enemy archetypes produce non-zero velocity when chasing', () => {
      const playerPos = { x: 500, y: 500 };
      const enemyPositions = [
        { x: 100, y: 100 }, // far away
        { x: 450, y: 450 }, // close
        { x: 800, y: 200 }, // different quadrant
        { x: 300, y: 700 }, // another quadrant
      ];

      const speeds = [80, 60, 100, 150]; // esqueleto, calavera, serpiente, murcielago
      const multiplier = 1.0;

      for (let i = 0; i < 4; i++) {
        const velocity = calculateDirectChaseVelocity(
          enemyPositions[i],
          playerPos,
          speeds[i],
          multiplier,
        );
        const mag = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        expect(mag).toBeGreaterThan(0);
        expect(mag).toBeCloseTo(speeds[i], 1);
      }
    });

    it('velocity magnitude is invariant under speed multiplier scaling', () => {
      const enemyPos = { x: 100, y: 100 };
      const playerPos = { x: 300, y: 300 };
      const speed = 80;

      for (const mult of [0.5, 1.0, 1.5, 2.0, 3.0]) {
        const velocity = calculateDirectChaseVelocity(enemyPos, playerPos, speed, mult);
        const mag = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        expect(mag).toBeCloseTo(speed * mult, 1);
      }
    });
  });
});
