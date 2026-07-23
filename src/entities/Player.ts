import Phaser from 'phaser';
import type { LevelUpResult } from '../types/interfaces';
import { GAME_CONSTANTS, xpThresholdFormula } from '../config/constants';

/**
 * Guerrero Jaguar — personaje principal del jugador.
 * Extiende Phaser.Physics.Arcade.Sprite con sistemas de HP, XP y nivel.
 * Requirements: 1.5, 5.1, 5.2, 5.6, 5.7, 5.10, 5.11
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  maxHp: number;
  level: number;
  levelXp: number;
  totalXp: number;
  xpThreshold: number;
  speed: number;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);

    this.hp = GAME_CONSTANTS.PLAYER_BASE_HP;
    this.maxHp = GAME_CONSTANTS.PLAYER_BASE_HP;
    this.level = 1;
    this.levelXp = 0;
    this.totalXp = 0;
    this.xpThreshold = xpThresholdFormula(1); // 1*10+5 = 15
    this.speed = GAME_CONSTANTS.PLAYER_BASE_SPEED;

    scene.add.existing(this);
    scene.physics.add.existing(this);
  }

  /**
   * Aplica movimiento al jugador usando un vector de dirección normalizado.
   * El delta se usa para hacer el movimiento frame-rate independent.
   */
  move(direction: Phaser.Math.Vector2, delta: number): void {
    const deltaSeconds = delta / 1000;
    this.x += direction.x * this.speed * deltaSeconds;
    this.y += direction.y * this.speed * deltaSeconds;

    // Clamp a los límites del mapa
    this.x = Phaser.Math.Clamp(this.x, 0, GAME_CONSTANTS.MAP_WIDTH);
    this.y = Phaser.Math.Clamp(this.y, 0, GAME_CONSTANTS.MAP_HEIGHT);
  }

  /**
   * Reduce HP del jugador. Clamp a 0.
   */
  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  /**
   * Restaura HP del jugador. Clamp a maxHp.
   */
  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /**
   * Añade XP al jugador. Maneja level-up con carry-over de exceso.
   * En nivel máximo (20), solo incrementa totalXp.
   */
  addXP(value: number): LevelUpResult {
    this.totalXp += value;

    // Si ya está en nivel máximo, solo incrementa totalXp
    if (this.level >= GAME_CONSTANTS.MAX_LEVEL) {
      this.levelXp = Math.min(this.levelXp, this.xpThreshold);
      return {
        leveledUp: false,
        newLevel: this.level,
        excessXp: 0,
        reachedMaxLevel: true,
      };
    }

    this.levelXp += value;

    // Verificar level-up
    if (this.levelXp >= this.xpThreshold) {
      this.level++;
      const excessXp = this.levelXp - this.xpThreshold;
      this.xpThreshold = xpThresholdFormula(this.level);
      this.levelXp = excessXp;

      const reachedMaxLevel = this.level >= GAME_CONSTANTS.MAX_LEVEL;
      if (reachedMaxLevel) {
        this.levelXp = Math.min(this.levelXp, this.xpThreshold);
      }

      return {
        leveledUp: true,
        newLevel: this.level,
        excessXp,
        reachedMaxLevel,
      };
    }

    return {
      leveledUp: false,
      newLevel: this.level,
      excessXp: 0,
      reachedMaxLevel: false,
    };
  }
}
