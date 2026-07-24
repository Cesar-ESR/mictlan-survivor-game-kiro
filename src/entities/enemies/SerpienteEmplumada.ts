import Phaser from 'phaser';
import { Enemy } from '../Enemy';
import type { EnemySpawnConfig } from '../../types/interfaces';
import { calculateChaseDirection, calculateAcceleration } from './enemy-movement.pure';
import { getWalkAnimationKey, getAttackAnimationKey } from '../../config/enemy-assets';

/**
 * Serpiente Emplumada: persecución con aceleración progresiva.
 * HP=80, speed=100 (inicial), damage=8, xpReward=15
 */
export class SerpienteEmplumada extends Enemy {
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  xpReward: number;
  private speedMultiplier: number;
  private currentSpeed: number;
  private acceleration: number;
  private maxSpeed: number;

  constructor(scene: Phaser.Scene, x: number, y: number, config: EnemySpawnConfig) {
    super(scene, x, y, 'serpiente_emplumada_sprite');
    this.hp = 80 * config.hpMultiplier;
    this.maxHp = 80 * config.hpMultiplier;
    this.speed = 100;
    this.damage = 8;
    this.xpReward = 15;
    this.speedMultiplier = config.speedMultiplier;
    this.currentSpeed = 100;
    this.acceleration = 30;
    this.maxSpeed = 250;
    this.xpOrbVariant = 'special';

    // Register animation keys (BUG-006)
    this.walkAnimKey = getWalkAnimationKey('serpiente_emplumada_sprite') ?? '';
    this.attackAnimKey = getAttackAnimationKey('serpiente_emplumada_sprite') ?? '';

    if (this.walkAnimKey && this.scene.anims.exists(this.walkAnimKey)) {
      this.play(this.walkAnimKey);
    }
  }

  update(delta: number, playerPos: { x: number; y: number }): void {
    const deltaSeconds = delta / 1000;

    // Progressive acceleration
    this.currentSpeed = calculateAcceleration(
      this.currentSpeed,
      this.acceleration,
      this.maxSpeed,
      deltaSeconds,
    );

    const direction = calculateChaseDirection(
      { x: this.x, y: this.y },
      playerPos,
    );

    const effectiveSpeed = this.currentSpeed * this.speedMultiplier;
    this.setVelocity(direction.x * effectiveSpeed, direction.y * effectiveSpeed);
    this.updateFacing(playerPos);
  }
}
