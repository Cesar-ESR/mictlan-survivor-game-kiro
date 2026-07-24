import type { PauseController } from './LevelUpCoordinator';

/** Interface for systems that can be paused/resumed */
export interface Pausable {
  pause(): void;
  resume(): void;
}

/** Interface for physics world control */
export interface PhysicsPauseController {
  pause(): void;
  resume(): void;
}

/**
 * PauseSystem: Controls global game pause during upgrade selection.
 * Implements PauseController interface from LevelUpCoordinator.
 *
 * Strategy:
 * - When paused, GameScene skips all system updates (no delta is passed)
 * - Physics World is paused/resumed
 * - All registered Pausable systems receive pause()/resume() calls
 * - Timers are preserved because update() is never called during pause
 * - Idempotent: calling pause() twice or resume() twice is safe
 *
 * Requirements: 5.4, 5.5
 */
export class PauseSystem implements PauseController {
  private _isPaused = false;
  private pausables: Set<Pausable> = new Set();
  private physicsController: PhysicsPauseController | null = null;
  private destroyed = false;

  get isPaused(): boolean {
    return this._isPaused;
  }

  /** Register a physics world controller */
  setPhysicsController(controller: PhysicsPauseController): void {
    this.physicsController = controller;
  }

  /** Register a pausable system */
  register(pausable: Pausable): void {
    this.pausables.add(pausable);
  }

  /** Unregister a pausable system */
  unregister(pausable: Pausable): void {
    this.pausables.delete(pausable);
  }

  /**
   * Pauses all registered systems and physics.
   * Idempotent: calling when already paused does nothing.
   */
  pause(): void {
    if (this.destroyed || this._isPaused) return;
    this._isPaused = true;

    // Pause physics world
    if (this.physicsController) {
      this.physicsController.pause();
    }

    // Notify all registered pausables
    for (const pausable of this.pausables) {
      pausable.pause();
    }
  }

  /**
   * Resumes all registered systems and physics.
   * Idempotent: calling when already active does nothing.
   */
  resume(): void {
    if (this.destroyed || !this._isPaused) return;
    this._isPaused = false;

    // Resume physics world
    if (this.physicsController) {
      this.physicsController.resume();
    }

    // Notify all registered pausables
    for (const pausable of this.pausables) {
      pausable.resume();
    }
  }

  /** Cleanup: clear all references */
  destroy(): void {
    this.destroyed = true;
    this.pausables.clear();
    this.physicsController = null;
  }
}
