import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { EnemySpawnConfig } from '../types/interfaces';

export type EnemyFactory = (scene: Phaser.Scene, x: number, y: number, config: EnemySpawnConfig) => Enemy;

export class EnemyRegistry {
  private factories: Map<string, EnemyFactory> = new Map();

  register(type: string, factory: EnemyFactory): void {
    this.factories.set(type, factory);
  }

  create(type: string, scene: Phaser.Scene, x: number, y: number, config: EnemySpawnConfig): Enemy {
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`Enemy type "${type}" is not registered.`);
    }
    return factory(scene, x, y, config);
  }

  has(type: string): boolean {
    return this.factories.has(type);
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.factories.keys());
  }
}
