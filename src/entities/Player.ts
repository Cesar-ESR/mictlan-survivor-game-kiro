import Phaser from 'phaser';
import { GAME_CONSTANTS } from '../config/constants';
import type { LevelUpResult } from '../types/interfaces';

/**
 * Player entity (Guerrero Jaguar) extending Phaser's Arcade Sprite.
 * Manages HP, XP dual counters, leveling, and damage/healing.
 *
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
    //this.setScale(0.5);
    this.setDisplaySize(128, 128);
    this.hp = GAME_CONSTANTS.PLAYER_BASE_HP;
    this.maxHp = GAME_CONSTANTS.PLAYER_BASE_HP;
    this.level = 1;
    this.levelXp = 0;
    this.totalXp = 0;
    this.xpThreshold = GAME_CONSTANTS.XP_THRESHOLD_FORMULA(1);
    this.speed = GAME_CONSTANTS.PLAYER_BASE_SPEED;

    // Add to scene and enable physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
  }

  /**
   * Applies damage to the player, clamping HP to 0 minimum.
   */
  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  /**
   * Heals the player, clamping HP to maxHp.
   */
  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /**
   * Adds XP to the player implementing dual counter logic.
   *
   * - Increments both levelXp and totalXp.
   * - At level 20: only increments totalXp, levelXp stays clamped to threshold.
   * - Below level 20: detects level-up when levelXp >= xpThreshold,
   *   carries over excess XP, updates threshold for new level.
   */
  addXP(value: number): LevelUpResult {
    this.totalXp += value;

    // At max level: only accumulate totalXp
    if (this.level >= GAME_CONSTANTS.MAX_LEVEL) {
      this.levelXp = this.xpThreshold;
      return {
        leveledUp: false,
        newLevel: this.level,
        excessXp: 0,
        reachedMaxLevel: true,
      };
    }

    this.levelXp += value;

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
      }

      return {
        leveledUp: true,
        newLevel: this.level,
        excessXp: excess,
        reachedMaxLevel: reachedMax,
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
