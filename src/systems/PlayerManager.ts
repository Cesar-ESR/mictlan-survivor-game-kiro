import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { calculateDirectionFromInput } from './movement-utils';

// Re-export pure utilities for external consumers
export { calculateDirectionFromInput, clampPosition } from './movement-utils';
export type { DirectionInput } from './movement-utils';

/**
 * PlayerManager — gestiona input del teclado y movimiento del jugador.
 * Lee WASD + flechas combinados, calcula dirección normalizada,
 * y aplica movimiento frame-rate independent con clamping.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.5, 2.6
 */
export class PlayerManager {
  private player: Player;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene, player: Player) {
    this.player = player;

    const keyboard = scene.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.wasd = {
      W: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  /**
   * Actualiza la posición del jugador basado en el input actual.
   * Llamado cada frame con el delta time en ms.
   */
  update(delta: number): void {
    const direction = this.calculateDirection();
    const vec = new Phaser.Math.Vector2(direction.x, direction.y);
    this.player.move(vec, delta);
  }

  /**
   * Lee el estado de input combinado (WASD + flechas) y calcula la dirección.
   */
  private calculateDirection(): { x: number; y: number } {
    const input = {
      up: this.cursors.up.isDown || this.wasd.W.isDown,
      down: this.cursors.down.isDown || this.wasd.S.isDown,
      left: this.cursors.left.isDown || this.wasd.A.isDown,
      right: this.cursors.right.isDown || this.wasd.D.isDown,
    };

    return calculateDirectionFromInput(input);
  }
}
