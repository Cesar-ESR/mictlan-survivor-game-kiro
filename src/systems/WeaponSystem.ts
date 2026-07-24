import Phaser from 'phaser';
import { findClosestEnemy, calculateProjectileVelocity } from './weapon-utils';
import type { WeaponTarget } from './weapon-utils';
import { Projectile } from '../entities/Projectile';

/** Line-of-sight checker function signature (BUG-005). */
export type LineOfSightChecker = (start: { x: number; y: number }, end: { x: number; y: number }) => boolean;

/**
 * Configuration for the WeaponSystem.
 */
export interface WeaponConfig {
  fireRateMs: number;       // default 1000
  range: number;            // default 800
  projectileSpeed: number;  // default 600
  maxDistance: number;       // default 1000
  damage: number;           // default 10
  poolSize?: number;        // default 30
}

/**
 * WeaponSystem: Handles automatic firing toward the closest enemy,
 * projectile pooling, and distance-based recycling.
 *
 * This system does NOT apply damage — DamageSystem handles collision
 * detection and damage application via the projectile pool.
 *
 * Requirements: 4.1, 4.6
 */
export class WeaponSystem {
  private fireRateMs: number;
  private range: number;
  private projectileSpeed: number;
  private maxDistance: number;
  private damage: number;
  private fireTimer: number = 0;
  private projectilePool: Phaser.Physics.Arcade.Group;
  private losChecker: LineOfSightChecker | null = null;

  constructor(scene: Phaser.Scene, config: WeaponConfig) {
    this.fireRateMs = config.fireRateMs;
    this.range = config.range;
    this.projectileSpeed = config.projectileSpeed;
    this.maxDistance = config.maxDistance;
    this.damage = config.damage;

    const poolSize = config.poolSize ?? 30;

    this.projectilePool = scene.physics.add.group({
      classType: Projectile,
      maxSize: poolSize,
      runChildUpdate: false,
    });

    // Pre-create pool members
    for (let i = 0; i < poolSize; i++) {
      const proj = new Projectile(scene, 0, 0, 'projectile');
      proj.setActive(false);
      proj.setVisible(false);
      if (proj.body) {
        (proj.body as Phaser.Physics.Arcade.Body).enable = false;
      }
      this.projectilePool.add(proj, true);
    }
  }

  /**
   * Main update loop. Accumulates fire timer, fires when ready,
   * and updates active projectile distances.
   */
  update(deltaMs: number, playerPos: { x: number; y: number }, enemies: WeaponTarget[]): void {
    // Accumulate fire timer
    this.fireTimer += deltaMs;

    // Fire when timer exceeds fire rate (preserve excess)
    if (this.fireTimer >= this.fireRateMs) {
      this.fireTimer -= this.fireRateMs;

      // Find closest enemy (with LOS check if available — BUG-005)
      let target: WeaponTarget | null;
      if (this.losChecker) {
        target = this.findClosestVisibleEnemy(playerPos, enemies);
      } else {
        target = findClosestEnemy(playerPos, enemies, this.range);
      }

      if (target) {
        this.fireProjectile(playerPos, target);
      }
      // If no target: timer consumed per design.md, no projectile created
    }

    // Update active projectiles (distance tracking and recycling)
    this.updateProjectiles(deltaMs);
  }

  /**
   * Finds the closest enemy that has clear line of sight from playerPos (BUG-005).
   * Falls back to standard range check for distance, then applies LOS filter.
   */
  private findClosestVisibleEnemy(playerPos: { x: number; y: number }, enemies: WeaponTarget[]): WeaponTarget | null {
    if (!enemies || enemies.length === 0) return null;

    const rangeSq = this.range * this.range;
    const candidates: Array<{ enemy: WeaponTarget; distSq: number }> = [];

    for (const enemy of enemies) {
      if (!enemy.active || enemy.hp <= 0) continue;
      if (!isFinite(enemy.x) || !isFinite(enemy.y)) continue;
      const dx = enemy.x - playerPos.x;
      const dy = enemy.y - playerPos.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= rangeSq) {
        candidates.push({ enemy, distSq });
      }
    }

    // Sort by distance (closest first)
    candidates.sort((a, b) => a.distSq - b.distSq);

    // Return first with clear line of sight
    for (const { enemy } of candidates) {
      if (this.losChecker!(playerPos, enemy)) {
        return enemy;
      }
    }

    return null;
  }

  /**
   * Fires a projectile from playerPos toward target.
   * Gets an inactive projectile from the pool.
   */
  private fireProjectile(from: { x: number; y: number }, target: WeaponTarget): void {
    const projectile = this.projectilePool.getFirstDead(false) as Projectile | null;

    if (!projectile) {
      // Pool exhausted, don't fire
      return;
    }

    const { vx, vy } = calculateProjectileVelocity(from, target, this.projectileSpeed);
    projectile.activate(from.x, from.y, vx, vy, this.damage, this.projectileSpeed);
  }

  /**
   * Updates all active projectiles: accumulates distance traveled,
   * recycles when maxDistance is reached.
   */
  private updateProjectiles(deltaMs: number): void {
    const children = this.projectilePool.getChildren() as Projectile[];

    for (const projectile of children) {
      if (!projectile.active) continue;

      // Accumulate distance via speed * (deltaMs / 1000)
      const distThisFrame = projectile.speed * (deltaMs / 1000);
      projectile.distanceTravelled += distThisFrame;

      // Recycle when max distance reached
      if (projectile.distanceTravelled >= this.maxDistance) {
        projectile.recycle();
      }
    }
  }

  // --- Public accessors for upgrade system (BUG-008) ---

  getDamage(): number { return this.damage; }
  increaseDamage(amount: number): void { this.damage += amount; }

  getFireRateMs(): number { return this.fireRateMs; }
  reduceFireRate(amountMs: number, minimumMs: number): void {
    this.fireRateMs = Math.max(this.fireRateMs - amountMs, minimumMs);
  }

  getRange(): number { return this.range; }
  increaseRange(amount: number): void { this.range += amount; }

  getProjectileSpeed(): number { return this.projectileSpeed; }
  increaseProjectileSpeed(amount: number): void { this.projectileSpeed += amount; }

  getMaxDistance(): number { return this.maxDistance; }
  increaseMaxDistance(amount: number): void { this.maxDistance += amount; }

  /**
   * Sets a line-of-sight checker function (BUG-005).
   * When set, targeting will skip enemies that are behind walls/obstacles/liquids.
   */
  setLineOfSightChecker(checker: LineOfSightChecker): void {
    this.losChecker = checker;
  }

  /**
   * Returns the Phaser group for DamageSystem integration.
   */
  getProjectilePool(): Phaser.Physics.Arcade.Group {
    return this.projectilePool;
  }

  /**
   * Cleans up resources.
   */
  destroy(): void {
    this.projectilePool.destroy(true);
  }
}
