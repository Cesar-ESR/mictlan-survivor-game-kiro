import Phaser from 'phaser';
import { Enemy } from '../Enemy';
import type { EnemySpawnConfig } from '../../types/interfaces';
import { calculateDirectChaseVelocity } from './enemy-movement.pure';
import { getWalkAnimationKey, getAttackAnimationKey } from '../../config/enemy-assets';

/**
 * Esqueleto: persecución directa, enemigo básico.
 * HP=30, speed=80, damage=5, xpReward=5
 */
export class Esqueleto extends Enemy {
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  xpReward: number;
  private speedMultiplier: number;

  constructor(scene: Phaser.Scene, x: number, y: number, config: EnemySpawnConfig) {
    super(scene, x, y, 'esqueleto_sprite');
    this.hp = 30 * config.hpMultiplier;
    this.maxHp = 30 * config.hpMultiplier;
    this.speed = 80;
    this.damage = 5;
    this.xpReward = 5;
    this.speedMultiplier = config.speedMultiplier;
    this.xpOrbVariant = 'common';

    // Register animation keys (BUG-006)
    this.walkAnimKey = getWalkAnimationKey('esqueleto_sprite') ?? '';
    this.attackAnimKey = getAttackAnimationKey('esqueleto_sprite') ?? '';

    if (this.walkAnimKey && this.scene.anims.exists(this.walkAnimKey)) {
      this.play(this.walkAnimKey);
    }
  }

  update(_delta: number, playerPos: { x: number; y: number }): void {
    const velocity = calculateDirectChaseVelocity(
      { x: this.x, y: this.y },
      playerPos,
      this.speed,
      this.speedMultiplier,
    );
    this.setVelocity(velocity.x, velocity.y);
    this.updateFacing(playerPos);
  }
}
