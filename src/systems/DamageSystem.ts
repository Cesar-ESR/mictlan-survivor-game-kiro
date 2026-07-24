import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { GAME_CONSTANTS } from '../config/constants';
import {
  canApplyContactDamage,
  applyContactDamage,
  updateCooldowns,
  shouldApplyExplosionDamage,
  type CooldownState,
} from './damage-utils';

/**
 * DamageSystem: handles projectile-enemy collisions, enemy-player contact damage,
 * explosion damage from CalaveraLlameante, and player defeat logic.
 *
 * Requirements: 4.2, 4.3, 4.4, 4.5
 */
export class DamageSystem {
  private cooldownState: CooldownState;
  private scene: Phaser.Scene;
  private player: Player;
  private projectilePool: Phaser.GameObjects.Group;
  private enemyPool: Phaser.GameObjects.Group;
  private weaponDamage: number;
  private enemyIdCounter: number = 0;
  private enemyIdMap: WeakMap<object, string> = new WeakMap();

  constructor(
    scene: Phaser.Scene,
    player: Player,
    projectilePool: Phaser.GameObjects.Group,
    enemyPool: Phaser.GameObjects.Group,
    weaponDamage: number,
  ) {
    this.scene = scene;
    this.player = player;
    this.projectilePool = projectilePool;
    this.enemyPool = enemyPool;
    this.weaponDamage = weaponDamage;

    this.cooldownState = {
      cooldowns: new Map<string, number>(),
      cooldownMs: GAME_CONSTANTS.CONTACT_DAMAGE_COOLDOWN,
    };

    // Listen for explosion-damage events from CalaveraLlameante
    this.scene.events.on('explosion-damage', (data: { x: number; y: number; radius: number; damage: number }) => {
      if (shouldApplyExplosionDamage(
        { x: this.player.x, y: this.player.y },
        { x: data.x, y: data.y },
        data.radius,
      )) {
        this.player.takeDamage(data.damage);
        this.scene.events.emit('hp-changed', this.player.hp, this.player.maxHp);
      }
    });
  }

  /**
   * Gets or assigns a unique string ID for an enemy instance.
   */
  private getEnemyId(enemy: Enemy): string {
    let id = this.enemyIdMap.get(enemy);
    if (!id) {
      id = `enemy_${this.enemyIdCounter++}`;
      this.enemyIdMap.set(enemy, id);
    }
    return id;
  }

  /**
   * Iterates active projectiles and enemies, checking for overlap.
   * On hit: applies weapon damage to enemy, deactivates projectile.
   * If enemy HP <= 0, calls handleEnemyDefeat.
   *
   * Requirement: 4.2
   */
  checkProjectileEnemyCollisions(): void {
    const projectiles = this.projectilePool.getChildren() as Phaser.Physics.Arcade.Sprite[];
    const enemies = this.enemyPool.getChildren() as (Phaser.Physics.Arcade.Sprite & Enemy)[];

    for (const projectile of projectiles) {
      if (!projectile.active) continue;

      for (const enemy of enemies) {
        if (!enemy.active) continue;

        // Manual distance-based overlap check using body dimensions
        const pBody = projectile.body as Phaser.Physics.Arcade.Body | null;
        const eBody = enemy.body as Phaser.Physics.Arcade.Body | null;

        if (!pBody || !eBody) continue;

        // Use Phaser's rectangle overlap check
        const overlap = Phaser.Geom.Intersects.RectangleToRectangle(
          new Phaser.Geom.Rectangle(pBody.x, pBody.y, pBody.width, pBody.height),
          new Phaser.Geom.Rectangle(eBody.x, eBody.y, eBody.width, eBody.height),
        );

        if (overlap) {
          enemy.takeDamage(this.weaponDamage);

          // Deactivate projectile
          projectile.setActive(false);
          projectile.setVisible(false);
          if (pBody) {
            pBody.enable = false;
          }

          // Check if enemy is defeated
          if (enemy.hp <= 0) {
            this.handleEnemyDefeat(enemy, { x: this.player.x, y: this.player.y });
          }

          // Projectile can only hit one enemy
          break;
        }
      }
    }
  }

  /**
   * Handles enemy defeat: calls enemy.onDefeat() which emits events and deactivates.
   * The explosion-damage listener in the constructor handles CalaveraLlameante explosion.
   *
   * Requirement: 4.3
   */
  handleEnemyDefeat(enemy: Enemy, _playerPos: { x: number; y: number }): void {
    enemy.onDefeat();
  }

  /**
   * Checks enemy-player contact and applies damage with cooldown.
   * Each enemy can only damage the player once per CONTACT_DAMAGE_COOLDOWN ms.
   * Emits 'hp-changed' on damage and 'player-defeated' + scene transition on death.
   *
   * Requirements: 4.4, 4.5
   */
  checkEnemyPlayerCollisions(delta: number): void {
    // Update all cooldowns first
    updateCooldowns(this.cooldownState, delta);

    const enemies = this.enemyPool.getChildren() as (Phaser.Physics.Arcade.Sprite & Enemy)[];
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body | null;

    if (!playerBody) return;

    const playerRect = new Phaser.Geom.Rectangle(
      playerBody.x, playerBody.y, playerBody.width, playerBody.height,
    );

    for (const enemy of enemies) {
      if (!enemy.active) continue;

      const eBody = enemy.body as Phaser.Physics.Arcade.Body | null;
      if (!eBody) continue;

      const enemyRect = new Phaser.Geom.Rectangle(
        eBody.x, eBody.y, eBody.width, eBody.height,
      );

      const overlapping = Phaser.Geom.Intersects.RectangleToRectangle(playerRect, enemyRect);

      if (overlapping) {
        const enemyId = this.getEnemyId(enemy);

        if (canApplyContactDamage(enemyId, this.cooldownState)) {
          const { newHp } = applyContactDamage(
            this.player.hp,
            enemy.damage,
            enemyId,
            this.cooldownState,
          );
          this.player.hp = newHp;

          this.scene.events.emit('hp-changed', this.player.hp, this.player.maxHp);

          // Check for player defeat
          if (this.player.hp <= 0) {
            this.scene.events.emit('player-defeated');
            return;
          }
        }
      }
    }
  }
}
