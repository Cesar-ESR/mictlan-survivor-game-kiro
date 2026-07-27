import Phaser from 'phaser';
import { calculateDirection, applyMovement } from './movement.pure';
import type { DirectionInput } from './movement.pure';
import type { Player } from '../entities/Player';

// Re-export pure functions and types for consumers
export { calculateDirection, applyMovement };
export type { DirectionInput };

/**
 * PlayerManager: Processes WASD and arrow key input, calculates normalized direction,
 * applies delta-time movement, and clamps position to map boundaries.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.5, 2.6
 */
export class PlayerManager {
  private player: Player;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private wasd: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key } | null = null;

  constructor(player: Player, scene: Phaser.Scene) {
    this.player = player;

    const keyboard = scene.input.keyboard;
    if (keyboard) {
      this.cursors = keyboard.createCursorKeys();
      this.wasd = {
        W: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }
  }

  /**
   * Reads the current input state from keyboard keys.
   */
  private getInput(): DirectionInput {
    const up = (this.cursors?.up.isDown ?? false) || (this.wasd?.W.isDown ?? false);
    const down = (this.cursors?.down.isDown ?? false) || (this.wasd?.S.isDown ?? false);
    const left = (this.cursors?.left.isDown ?? false) || (this.wasd?.A.isDown ?? false);
    const right = (this.cursors?.right.isDown ?? false) || (this.wasd?.D.isDown ?? false);
    return { up, down, left, right };
  }

  /**
   * Update player velocity based on input.
   * Phaser Arcade Physics integrates velocity into position each physics step.
   * We only set velocity here — no manual setPosition to avoid double movement.
   * Map boundary clamping is handled by player.setCollideWorldBounds(true).
   *
   * Requirements: 2.1, 2.2, 2.3, 2.5, 2.6
   */
  update(_delta: number): void {
    const input = this.getInput();
    const direction = calculateDirection(input);

    if (direction.x === 0 && direction.y === 0) {
      // No input: stop immediately (1 frame)
      this.player.setVelocity(0, 0);
      this.player.updateAnimation(false);
      return;
    }

    // Apply velocity scaled by speed — Phaser handles position integration
    const vx = direction.x * this.player.speed;
    const vy = direction.y * this.player.speed;
    this.player.setVelocity(vx, vy);
    this.player.updateAnimation(true);
  }
}
