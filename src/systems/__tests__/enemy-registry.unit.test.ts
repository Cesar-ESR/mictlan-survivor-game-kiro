import { describe, it, expect, vi } from 'vitest';
import { EnemyRegistry } from '../EnemyRegistry';
import type { EnemyFactory } from '../EnemyRegistry';
import type { EnemySpawnConfig } from '../../types/interfaces';

/**
 * Unit tests for EnemyRegistry (factory/registry pattern).
 * Validates: Requirement 9.5
 */

/**
 * Creates a mock factory that returns a minimal object simulating an Enemy.
 */
function createMockFactory(): EnemyFactory {
  return vi.fn((_scene, _x, _y, _config: EnemySpawnConfig) => {
    return { type: 'mock-enemy' } as unknown as ReturnType<EnemyFactory>;
  });
}

describe('EnemyRegistry', () => {
  describe('register and create', () => {
    it('registers a factory and creates an enemy using it', () => {
      const registry = new EnemyRegistry();
      const factory = createMockFactory();
      const mockScene = {} as Parameters<EnemyFactory>[0];
      const config: EnemySpawnConfig = { hpMultiplier: 1, speedMultiplier: 1 };

      registry.register('esqueleto', factory);
      const enemy = registry.create('esqueleto', mockScene, 100, 200, config);

      expect(factory).toHaveBeenCalledWith(mockScene, 100, 200, config);
      expect(enemy).toBeDefined();
    });
  });

  describe('has()', () => {
    it('returns true for registered types', () => {
      const registry = new EnemyRegistry();
      registry.register('esqueleto', createMockFactory());

      expect(registry.has('esqueleto')).toBe(true);
    });

    it('returns false for unregistered types', () => {
      const registry = new EnemyRegistry();

      expect(registry.has('dragon')).toBe(false);
    });
  });

  describe('getRegisteredTypes()', () => {
    it('returns empty array when no types registered', () => {
      const registry = new EnemyRegistry();

      expect(registry.getRegisteredTypes()).toEqual([]);
    });

    it('returns all registered type names', () => {
      const registry = new EnemyRegistry();
      registry.register('esqueleto', createMockFactory());
      registry.register('murcielago', createMockFactory());
      registry.register('calavera', createMockFactory());

      const types = registry.getRegisteredTypes();

      expect(types).toHaveLength(3);
      expect(types).toContain('esqueleto');
      expect(types).toContain('murcielago');
      expect(types).toContain('calavera');
    });
  });

  describe('create() with unregistered type', () => {
    it('throws an error for unregistered types', () => {
      const registry = new EnemyRegistry();
      const mockScene = {} as Parameters<EnemyFactory>[0];
      const config: EnemySpawnConfig = { hpMultiplier: 1, speedMultiplier: 1 };

      expect(() => registry.create('unknown', mockScene, 0, 0, config)).toThrowError(
        'Enemy type "unknown" is not registered in the EnemyRegistry.',
      );
    });
  });
});
