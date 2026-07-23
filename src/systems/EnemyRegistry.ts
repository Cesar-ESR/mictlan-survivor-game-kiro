import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { EnemySpawnConfig } from '../types/interfaces';

/**
 * Factory function type for creating enemy instances.
 */
export type EnemyFactory = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  config: EnemySpawnConfig,
) => Enemy;

/**
 * Registry for enemy types using the factory/registry pattern.
 * Allows adding new enemy types without modifying existing code (Open/Closed Principle).
 *
 * Requirements: 9.5
 */
export class EnemyRegistry {
  private factories: Map<string, EnemyFactory> = new Map();

  /**
   * Registers a new enemy type with its factory function.
   */
  register(type: string, factory: EnemyFactory): void {
    this.factories.set(type, factory);
  }

  /**
   * Creates an enemy instance of the given type.
   * Throws if the type is not registered.
   */
  create(
    type: string,
    scene: Phaser.Scene,
    x: number,
    y: number,
    config: EnemySpawnConfig,
  ): Enemy {
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`Enemy type "${type}" is not registered in the EnemyRegistry.`);
    }
    return factory(scene, x, y, config);
  }

  /**
   * Returns true if the given enemy type is registered.
   */
  has(type: string): boolean {
    return this.factories.has(type);
  }

  /**
   * Returns an array of all registered enemy type names.
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.factories.keys());
  }
}
