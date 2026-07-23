/**
 * Unit tests for TileIndexResolver.
 * Pure logic tests — no Phaser dependency needed.
 *
 * Validates: Requirements 10.2, 10.14, Property 30
 */

import { describe, it, expect } from 'vitest';
import { TileIndexResolver } from '../TileIndexResolver';
import type { TileReference, MapLayerName } from '../TileCatalog';

describe('TileIndexResolver', () => {
  const resolver = new TileIndexResolver();

  describe('resolve()', () => {
    it('should resolve frame 0 of ground to index 0', () => {
      const ref: TileReference = { tileset: 'ground', frame: 0 };
      expect(resolver.resolve(ref)).toBe(0);
    });

    it('should resolve frame 42 of ground to index 42', () => {
      const ref: TileReference = { tileset: 'ground', frame: 42 };
      expect(resolver.resolve(ref)).toBe(42);
    });

    it('should reject frame 43 of ground (empty range)', () => {
      const ref: TileReference = { tileset: 'ground', frame: 43 };
      expect(() => resolver.resolve(ref)).toThrow(/out of valid range/);
    });

    it('should reject frame 48 of ground (beyond tileset)', () => {
      const ref: TileReference = { tileset: 'ground', frame: 48 };
      expect(() => resolver.resolve(ref)).toThrow(/out of valid range/);
    });

    it('should resolve valid decorations frame (frame 0)', () => {
      const ref: TileReference = { tileset: 'decorations', frame: 0 };
      expect(resolver.resolve(ref)).toBe(0);
    });

    it('should resolve valid decorations frame (frame 51)', () => {
      const ref: TileReference = { tileset: 'decorations', frame: 51 };
      expect(resolver.resolve(ref)).toBe(51);
    });

    it('should reject frame 52 of decorations (empty range)', () => {
      const ref: TileReference = { tileset: 'decorations', frame: 52 };
      expect(() => resolver.resolve(ref)).toThrow(/out of valid range/);
    });

    it('should resolve valid borders frame (frame 15)', () => {
      const ref: TileReference = { tileset: 'borders', frame: 15 };
      expect(resolver.resolve(ref)).toBe(15);
    });

    it('should resolve valid walls frame (frame 34)', () => {
      const ref: TileReference = { tileset: 'walls', frame: 34 };
      expect(resolver.resolve(ref)).toBe(34);
    });

    it('should reject frame 35 of walls (empty range)', () => {
      const ref: TileReference = { tileset: 'walls', frame: 35 };
      expect(() => resolver.resolve(ref)).toThrow(/out of valid range/);
    });

    it('should resolve valid liquids frame (frame 44)', () => {
      const ref: TileReference = { tileset: 'liquids', frame: 44 };
      expect(resolver.resolve(ref)).toBe(44);
    });

    it('should reject frame 45 of liquids (empty range)', () => {
      const ref: TileReference = { tileset: 'liquids', frame: 45 };
      expect(() => resolver.resolve(ref)).toThrow(/out of valid range/);
    });

    it('should reject negative frame numbers', () => {
      const ref: TileReference = { tileset: 'ground', frame: -1 };
      expect(() => resolver.resolve(ref)).toThrow(/out of valid range/);
    });
  });

  describe('validateForLayer()', () => {
    it('should accept ground tile for ground layer', () => {
      const ref: TileReference = { tileset: 'ground', frame: 10 };
      expect(() => resolver.validateForLayer(ref, 'ground')).not.toThrow();
    });

    it('should reject ground tile for walls layer', () => {
      const ref: TileReference = { tileset: 'ground', frame: 10 };
      expect(() => resolver.validateForLayer(ref, 'walls')).toThrow(/not permitted/);
    });

    it('should accept walls tile for obstacles layer', () => {
      // Obstacles use frames from the walls tileset
      const ref: TileReference = { tileset: 'walls', frame: 27 };
      expect(() => resolver.validateForLayer(ref, 'obstacles')).not.toThrow();
    });

    it('should reject decorations tile for ground layer', () => {
      const ref: TileReference = { tileset: 'decorations', frame: 5 };
      expect(() => resolver.validateForLayer(ref, 'ground')).toThrow(/not permitted/);
    });

    it('should accept borders tile for borders layer', () => {
      const ref: TileReference = { tileset: 'borders', frame: 8 };
      expect(() => resolver.validateForLayer(ref, 'borders')).not.toThrow();
    });

    it('should reject borders tile for liquids layer', () => {
      const ref: TileReference = { tileset: 'borders', frame: 8 };
      expect(() => resolver.validateForLayer(ref, 'liquids')).toThrow(/not permitted/);
    });

    it('should accept liquids tile for liquids layer', () => {
      const ref: TileReference = { tileset: 'liquids', frame: 20 };
      expect(() => resolver.validateForLayer(ref, 'liquids')).not.toThrow();
    });

    it('should accept decorations tile for decorations layer', () => {
      const ref: TileReference = { tileset: 'decorations', frame: 30 };
      expect(() => resolver.validateForLayer(ref, 'decorations')).not.toThrow();
    });

    it('should reject out-of-range frame even if tileset matches', () => {
      const ref: TileReference = { tileset: 'ground', frame: 43 };
      expect(() => resolver.validateForLayer(ref, 'ground')).toThrow(/out of valid range/);
    });

    it('should validate all layer names', () => {
      const layers: MapLayerName[] = ['ground', 'liquids', 'borders', 'walls', 'obstacles', 'decorations'];
      const validRefs: Record<MapLayerName, TileReference> = {
        ground: { tileset: 'ground', frame: 0 },
        liquids: { tileset: 'liquids', frame: 0 },
        borders: { tileset: 'borders', frame: 0 },
        walls: { tileset: 'walls', frame: 0 },
        obstacles: { tileset: 'walls', frame: 27 },
        decorations: { tileset: 'decorations', frame: 0 },
      };

      for (const layer of layers) {
        expect(() => resolver.validateForLayer(validRefs[layer], layer)).not.toThrow();
      }
    });
  });
});
