import Phaser from 'phaser';
<<<<<<< HEAD
import type { LevelUpResult } from '../types/interfaces';
import { GAME_CONSTANTS, xpThresholdFormula } from '../config/constants';

/**
 * Guerrero Jaguar — personaje principal del jugador.
 * Extiende Phaser.Physics.Arcade.Sprite con sistemas de HP, XP y nivel.
=======
import { GAME_CONSTANTS } from '../config/constants';
import type { LevelUpResult } from '../types/interfaces';

/**
 * Player entity (Guerrero Jaguar) extending Phaser's Arcade Sprite.
 * Manages HP, XP dual counters, leveling, and damage/healing.
 *
>>>>>>> a5ec5aa85c6d525884b3f19121c9f75ad5a42740
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
<<<<<<< HEAD
    this.xpThreshold = xpThresholdFormula(1); // 1*10+5 = 15
    this.speed = GAME_CONSTANTS.PLAYER_BASE_SPEED;

=======
    this.xpThreshold = GAME_CONSTANTS.XP_THRESHOLD_FORMULA(1);
    this.speed = GAME_CONSTANTS.PLAYER_BASE_SPEED;

    // Add to scene and enable physics
>>>>>>> a5ec5aa85c6d525884b3f19121c9f75ad5a42740
    scene.add.existing(this);
    scene.physics.add.existing(this);
  }

  /**
<<<<<<< HEAD
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
=======
   * Applies damage to the player, clamping HP to 0 minimum.
>>>>>>> a5ec5aa85c6d525884b3f19121c9f75ad5a42740
   */
  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  /**
<<<<<<< HEAD
   * Restaura HP del jugador. Clamp a maxHp.
=======
   * Heals the player, clamping HP to maxHp.
>>>>>>> a5ec5aa85c6d525884b3f19121c9f75ad5a42740
   */
  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /**
<<<<<<< HEAD
   * Añade XP al jugador. Maneja level-up con carry-over de exceso.
   * En nivel máximo (20), solo incrementa totalXp.
=======
   * Adds XP to the player implementing dual counter logic.
   *
   * - Increments both levelXp and totalXp.
   * - At level 20: only increments totalXp, levelXp stays clamped to threshold.
   * - Below level 20: detects level-up when levelXp >= xpThreshold,
   *   carries over excess XP, updates threshold for new level.
>>>>>>> a5ec5aa85c6d525884b3f19121c9f75ad5a42740
   */
  addXP(value: number): LevelUpResult {
    this.totalXp += value;

<<<<<<< HEAD
    // Si ya está en nivel máximo, solo incrementa totalXp
    if (this.level >= GAME_CONSTANTS.MAX_LEVEL) {
      this.levelXp = Math.min(this.levelXp, this.xpThreshold);
=======
    // At max level: only accumulate totalXp
    if (this.level >= GAME_CONSTANTS.MAX_LEVEL) {
      this.levelXp = this.xpThreshold;
>>>>>>> a5ec5aa85c6d525884b3f19121c9f75ad5a42740
      return {
        leveledUp: false,
        newLevel: this.level,
        excessXp: 0,
        reachedMaxLevel: true,
      };
    }

    this.levelXp += value;

<<<<<<< HEAD
    // Verificar level-up
    if (this.levelXp >= this.xpThreshold) {
      this.level++;
      const excessXp = this.levelXp - this.xpThreshold;
      this.xpThreshold = xpThresholdFormula(this.level);
      this.levelXp = excessXp;

      const reachedMaxLevel = this.level >= GAME_CONSTANTS.MAX_LEVEL;
      if (reachedMaxLevel) {
        this.levelXp = Math.min(this.levelXp, this.xpThreshold);
=======
    // Check for level-up
    if (this.levelXp >= this.xpThreshold) {
      const excess = this.levelXp - this.xpThreshold;
      this.level += 1;
      this.levelXp = excess;
      this.xpThreshold = GAME_CONSTANTS.XP_THRESHOLD_FORMULA(this.level);

      const reachedMax = this.level >= GAME_CONSTANTS.MAX_LEVEL;

      // If reached max level, clamp levelXp to threshold
      if (reachedMax) {
        this.levelXp = this.xpThreshold;
>>>>>>> a5ec5aa85c6d525884b3f19121c9f75ad5a42740
      }

      return {
        leveledUp: true,
        newLevel: this.level,
<<<<<<< HEAD
        excessXp,
        reachedMaxLevel,
=======
        excessXp: excess,
        reachedMaxLevel: reachedMax,
>>>>>>> a5ec5aa85c6d525884b3f19121c9f75ad5a42740
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
