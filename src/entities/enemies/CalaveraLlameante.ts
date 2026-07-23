import Phaser from 'phaser';
import { Enemy } from '../Enemy';
import type { EnemySpawnConfig } from '../../types/interfaces';
import { calculateDirectChaseVelocity, calculateDistance } from './enemy-movement.pure';
import { GAME_CONSTANTS } from '../../config/constants';

/**
 * Calavera Llameante: persecución directa, explota al morir si el jugador está cerca.
 * HP=50, speed=60, damage=10, xpReward=10
 */
export class CalaveraLlameante extends Enemy {
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  xpReward: number;
  private speedMultiplier: number;
  private playerPos: { x: number; y: number };

  constructor(scene: Phaser.Scene, x: number, y: number, config: EnemySpawnConfig) {
    super(scene, x, y, 'calavera_llameante_sprite');
    this.hp = 50 * config.hpMultiplier;
    this.maxHp = 50 * config.hpMultiplier;
    this.speed = 60;
    this.damage = 10;
    this.xpReward = 10;
    this.speedMultiplier = config.speedMultiplier;
    this.playerPos = { x: 0, y: 0 };
  }

  update(_delta: number, playerPos: { x: number; y: number }): void {
    this.playerPos = playerPos;
    const velocity = calculateDirectChaseVelocity(
      { x: this.x, y: this.y },
      playerPos,
      this.speed,
      this.speedMultiplier,
    );
    this.setVelocity(velocity.x, velocity.y);
  }

  onDefeat(): void {
    const distance = calculateDistance(
      { x: this.x, y: this.y },
      this.playerPos,
    );

    if (distance <= GAME_CONSTANTS.EXPLOSION_RADIUS) {
      this.scene.events.emit('explosion-damage', {
        x: this.x,
        y: this.y,
        radius: GAME_CONSTANTS.EXPLOSION_RADIUS,
        damage: GAME_CONSTANTS.EXPLOSION_DAMAGE,
      });
    }

    // Call parent onDefeat for normal cleanup (emit enemy-defeated, deactivate)
    super.onDefeat();
  }
}
