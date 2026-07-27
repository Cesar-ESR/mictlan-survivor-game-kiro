import Phaser from 'phaser';
import { Enemy } from '../Enemy';
import type { EnemySpawnConfig } from '../../types/interfaces';
import {
  calculateChaseDirection,
  calculateZigzagOffset,
} from './enemy-movement.pure';
import { getWalkAnimationKey, getAttackAnimationKey, getDeathAnimationKey } from '../../config/enemy-assets';

/**
 * Murciélago: rápido con movimiento en zigzag perpendicular a la dirección de avance.
 * HP=15, speed=150, damage=3, xpReward=3
 */
export class Murcielago extends Enemy {
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  xpReward: number;
  private speedMultiplier: number;
  private zigzagPhase: number;
  private amplitude: number;
  private frequency: number;

  constructor(scene: Phaser.Scene, x: number, y: number, config: EnemySpawnConfig) {
    super(scene, x, y, 'murcielago_sprite');
    this.hp = 15 * config.hpMultiplier;
    this.maxHp = 15 * config.hpMultiplier;
    this.speed = 150;
    this.damage = 3;
    this.xpReward = 3;
    this.speedMultiplier = config.speedMultiplier;
    this.zigzagPhase = 0;
    this.amplitude = 40;
    this.frequency = 3;
    this.xpOrbVariant = 'common';

    // Register animation keys (BUG-006)
    this.walkAnimKey = getWalkAnimationKey('murcielago_sprite') ?? '';
    this.attackAnimKey = getAttackAnimationKey('murcielago_sprite') ?? '';
    this.deathAnimKey = getDeathAnimationKey('murcielago_sprite') ?? '';

    if (this.walkAnimKey && this.scene.anims.exists(this.walkAnimKey)) {
      this.play(this.walkAnimKey);
    }
  }

  update(delta: number, playerPos: { x: number; y: number }): void {
    if (this.animState === 'dying') return; // Don't move while dying (BUG-007)

    const deltaSeconds = delta / 1000;
    this.zigzagPhase += deltaSeconds;

    const direction = calculateChaseDirection(
      { x: this.x, y: this.y },
      playerPos,
    );

    const effectiveSpeed = this.speed * this.speedMultiplier;
    const baseVelX = direction.x * effectiveSpeed;
    const baseVelY = direction.y * effectiveSpeed;

    const offset = calculateZigzagOffset(direction, this.zigzagPhase, this.amplitude, this.frequency);

    this.setVelocity(baseVelX + offset.x, baseVelY + offset.y);
    this.updateFacing(playerPos);
  }
}
