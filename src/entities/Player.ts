import Phaser from 'phaser';
import { GAME_CONSTANTS } from '../config/constants';
import { PLAYER_SPRITES } from '../config/player-assets';
import type { LevelUpResult } from '../types/interfaces';

/**
 * Player entity (Guerrero Jaguar) extending Phaser's Arcade Sprite.
 * Manages HP, XP dual counters, leveling, damage/healing, and animation state.
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

  /** Current animation state for deduplication. */
  private currentAnimState: 'idle' | 'walk' | 'attack' | 'death' = 'idle';

  /** Whether the player is currently in the attack animation (blocks idle/walk). */
  private isAttacking = false;

  /** Whether the death animation has finished (stay on last frame). */
  private isDead = false;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
    this.setDisplaySize(96, 96);
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

    // Listen for animation complete to handle attack→idle/walk and death→freeze
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onAnimationComplete, this);

    // Start with idle animation
    this.playAnimState('idle');
  }

  /**
   * Updates animation based on current movement state.
   * Also updates horizontal facing based on velocity direction.
   * Call every frame after movement is applied.
   *
   * Priority: death > attack > walk > idle
   * Does NOT restart an animation if already playing the correct one.
   */
  updateAnimation(isMoving: boolean): void {
    // Update horizontal facing based on velocity (preserve last direction when idle)
    if (this.body && !this.isDead) {
      const vx = (this.body as Phaser.Physics.Arcade.Body).velocity.x;
      if (vx < 0) {
        this.setFlipX(true);
      } else if (vx > 0) {
        this.setFlipX(false);
      }
      // If vx === 0, keep current flipX (last direction)
    }

    // Death takes highest priority (once dead, stay in death anim)
    if (this.hp <= 0) {
      if (!this.isDead) {
        this.playAnimState('death');
      }
      return;
    }

    // Attack blocks idle/walk transitions until animation completes
    if (this.isAttacking) {
      return;
    }

    // Walk vs Idle based on movement
    if (isMoving) {
      this.playAnimState('walk');
    } else {
      this.playAnimState('idle');
    }
  }

  /**
   * Triggers the attack animation. Called when the weapon fires.
   * Does not interrupt death. Does not restart if already attacking.
   */
  playAttack(): void {
    if (this.isDead || this.isAttacking) return;
    this.isAttacking = true;
    // Force state change even if currentAnimState matches (edge case after interrupted attack)
    this.currentAnimState = 'idle'; // reset so playAnimState proceeds
    this.playAnimState('attack');
  }

  /**
   * Handles animation complete events.
   * - Attack: returns to idle/walk based on current velocity.
   * - Death: freezes on last frame.
   */
  private onAnimationComplete(animation: Phaser.Animations.Animation): void {
    if (animation.key === PLAYER_SPRITES.attack.key) {
      this.isAttacking = false;
      // Return to appropriate state based on current velocity
      if (this.body) {
        const vel = (this.body as Phaser.Physics.Arcade.Body).velocity;
        const isMoving = vel.x !== 0 || vel.y !== 0;
        this.currentAnimState = 'attack'; // allow transition
        if (isMoving) {
          this.playAnimState('walk');
        } else {
          this.playAnimState('idle');
        }
      } else {
        this.currentAnimState = 'attack';
        this.playAnimState('idle');
      }
    } else if (animation.key === PLAYER_SPRITES.death.key) {
      this.isDead = true;
      // Freeze on last frame — stop the animation manager from advancing
      this.anims.stop();
      // Notify listeners that death animation finished (for scene transition)
      this.emit('death-animation-complete');
    }
  }

  /**
   * Plays an animation state only if it's different from the current one.
   * Prevents restarting an already-playing animation.
   */
  private playAnimState(state: 'idle' | 'walk' | 'attack' | 'death'): void {
    if (this.currentAnimState === state) return;

    const animKey = this.getAnimKeyForState(state);
    if (animKey && this.scene.anims.exists(animKey)) {
      this.play(animKey);
      this.currentAnimState = state;
    }
  }

  /**
   * Maps animation state to the registered animation key from player-assets.ts.
   */
  private getAnimKeyForState(state: 'idle' | 'walk' | 'attack' | 'death'): string | undefined {
    switch (state) {
      case 'idle': return PLAYER_SPRITES.idle.key;
      case 'walk': return PLAYER_SPRITES.walk.key;
      case 'attack': return PLAYER_SPRITES.attack.key;
      case 'death': return PLAYER_SPRITES.death.key;
    }
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
   * Increases max HP and optionally heals by the same amount (BUG-008).
   */
  increaseMaxHp(amount: number, heal: boolean = true): void {
    this.maxHp += amount;
    if (heal) {
      this.hp = Math.min(this.hp + amount, this.maxHp);
    }
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
