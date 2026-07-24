import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { WaveManager, calculateDifficulty } from '../WaveManager';
import type { WaveSpawnController, WaveEventEmitter } from '../WaveManager';
import { buildWaveConfig, WAVE_ENEMY_PROGRESSION } from '../../config/wave-configs';
import { GAME_CONSTANTS } from '../../config/constants';
import type { WaveConfig } from '../../types/interfaces';

/**
 * Property-based tests para el WaveManager.
 * Validates: Requirements 6.2, 6.3, 6.5, 9.4
 */
describe('WaveManager Property Tests', () => {
  /** Last configured wave in WAVE_ENEMY_PROGRESSION */
  const LAST_CONFIGURED_WAVE = 10;

  function createMockSpawnController(): WaveSpawnController & { configs: WaveConfig[] } {
    const configs: WaveConfig[] = [];
    return {
      configs,
      setWaveConfig(config: WaveConfig): void {
        configs.push(config);
      },
    };
  }

  function createMockEventEmitter(): WaveEventEmitter & { events: Array<{ event: string; args: unknown[] }> } {
    const events: Array<{ event: string; args: unknown[] }> = [];
    return {
      events,
      emit(event: string, ...args: unknown[]): boolean {
        events.push({ event, args });
        return true;
      },
    };
  }

  /**
   * Property 17: Exponential Difficulty Scaling with Clamping
   * For any wave in [1, 100]:
   * - spawnInterval >= 0.5
   * - hpMultiplier <= 5
   * - speedMultiplier <= 2
   * - Values follow the exponential formulas before hitting limits
   *
   * **Validates: Requirements 6.2, 6.3**
   */
  describe('Property 17: Exponential Difficulty Scaling with Clamping', () => {
    it('difficulty parameters are clamped within bounds for any wave', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (wave: number) => {
            const params = calculateDifficulty(wave);

            // spawnInterval has a floor of 0.5
            expect(params.spawnInterval).toBeGreaterThanOrEqual(GAME_CONSTANTS.MIN_SPAWN_INTERVAL);
            // hpMultiplier has a ceiling of 5
            expect(params.hpMultiplier).toBeLessThanOrEqual(GAME_CONSTANTS.MAX_HP_MULTIPLIER);
            // speedMultiplier has a ceiling of 2
            expect(params.speedMultiplier).toBeLessThanOrEqual(GAME_CONSTANTS.MAX_SPEED_MULTIPLIER);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('difficulty follows exponential formulas before hitting limits', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (wave: number) => {
            const params = calculateDifficulty(wave);

            // Raw exponential values
            const rawSpawnInterval = GAME_CONSTANTS.BASE_SPAWN_INTERVAL *
              Math.pow(GAME_CONSTANTS.SPAWN_INTERVAL_DECAY, wave - 1);
            const rawHp = Math.pow(GAME_CONSTANTS.HP_SCALING_BASE, wave - 1);
            const rawSpeed = Math.pow(GAME_CONSTANTS.SPEED_SCALING_BASE, wave - 1);

            // spawnInterval = max(raw, 0.5)
            expect(params.spawnInterval).toBeCloseTo(
              Math.max(rawSpawnInterval, GAME_CONSTANTS.MIN_SPAWN_INTERVAL),
              10,
            );
            // hpMultiplier = min(raw, 5)
            expect(params.hpMultiplier).toBeCloseTo(
              Math.min(rawHp, GAME_CONSTANTS.MAX_HP_MULTIPLIER),
              10,
            );
            // speedMultiplier = min(raw, 2)
            expect(params.speedMultiplier).toBeCloseTo(
              Math.min(rawSpeed, GAME_CONSTANTS.MAX_SPEED_MULTIPLIER),
              10,
            );
          },
        ),
        { numRuns: 200 },
      );
    });

    it('wave < 1 is treated as wave 1', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100, max: 0 }),
          (wave: number) => {
            const params = calculateDifficulty(wave);
            const wave1Params = calculateDifficulty(1);

            expect(params.spawnInterval).toBe(wave1Params.spawnInterval);
            expect(params.hpMultiplier).toBe(wave1Params.hpMultiplier);
            expect(params.speedMultiplier).toBe(wave1Params.speedMultiplier);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('difficulty is monotonically harder as wave increases', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 99 }),
          (wave: number) => {
            const current = calculateDifficulty(wave);
            const next = calculateDifficulty(wave + 1);

            // spawnInterval decreases or stays at minimum
            expect(next.spawnInterval).toBeLessThanOrEqual(current.spawnInterval);
            // hpMultiplier increases or stays at max
            expect(next.hpMultiplier).toBeGreaterThanOrEqual(current.hpMultiplier);
            // speedMultiplier increases or stays at max
            expect(next.speedMultiplier).toBeGreaterThanOrEqual(current.speedMultiplier);
          },
        ),
        { numRuns: 99 },
      );
    });
  });

  /**
   * Property 18: Infinite Mode Repeats Last Wave Config
   * For any wave > 10 (lastConfiguredWave), resolveWaveConfig returns same parameters
   * as wave 10. No additional scaling. Returned config is a separate object.
   *
   * **Validates: Requirements 6.5**
   */
  describe('Property 18: Infinite Mode Repeats Last Wave Config', () => {
    it('waves beyond last configured use wave 10 parameters without additional scaling', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: LAST_CONFIGURED_WAVE + 1, max: 500 }),
          (wave: number) => {
            const spawnController = createMockSpawnController();
            const eventEmitter = createMockEventEmitter();
            const manager = new WaveManager(
              { mode: 'infinite', finalWave: null },
              spawnController,
              eventEmitter,
            );

            const config = manager.resolveWaveConfig(wave);
            const wave10Config = buildWaveConfig(LAST_CONFIGURED_WAVE);

            // Same difficulty parameters as wave 10
            expect(config.spawnInterval).toBe(wave10Config.spawnInterval);
            expect(config.hpMultiplier).toBe(wave10Config.hpMultiplier);
            expect(config.speedMultiplier).toBe(wave10Config.speedMultiplier);
            expect(config.maxEnemies).toBe(wave10Config.maxEnemies);
            expect(config.duration).toBe(wave10Config.duration);

            // Same enemy types as wave 10
            expect(config.enemyTypes).toEqual(wave10Config.enemyTypes);

            // But waveNumber reflects the actual wave
            expect(config.waveNumber).toBe(wave);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('returned config is a separate object (not same reference)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: LAST_CONFIGURED_WAVE + 1, max: 200 }),
          (wave: number) => {
            const spawnController = createMockSpawnController();
            const eventEmitter = createMockEventEmitter();
            const manager = new WaveManager(
              { mode: 'infinite', finalWave: null },
              spawnController,
              eventEmitter,
            );

            const config1 = manager.resolveWaveConfig(wave);
            const config2 = manager.resolveWaveConfig(wave);

            // Different references
            expect(config1).not.toBe(config2);
            // But same values
            expect(config1).toEqual(config2);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('configs within range [1, 10] return correct waveNumber', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: LAST_CONFIGURED_WAVE }),
          (wave: number) => {
            const spawnController = createMockSpawnController();
            const eventEmitter = createMockEventEmitter();
            const manager = new WaveManager(
              { mode: 'infinite', finalWave: null },
              spawnController,
              eventEmitter,
            );

            const config = manager.resolveWaveConfig(wave);
            expect(config.waveNumber).toBe(wave);
          },
        ),
        { numRuns: 10 },
      );
    });
  });

  /**
   * Property 19: Wave-to-Enemy-Type Mapping
   * - Waves 1-3: only 'esqueleto'
   * - Waves 4-6: 'esqueleto' and 'murcielago'
   * - Waves 7-8: adds 'calavera_llameante'
   * - Waves 9-10: all four types
   * - After wave 10: preserves the wave 10 mapping
   *
   * **Validates: Requirements 9.4**
   */
  describe('Property 19: Wave-to-Enemy-Type Mapping', () => {
    it('waves 1-3 contain only esqueleto', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3 }),
          (wave: number) => {
            const spawnController = createMockSpawnController();
            const eventEmitter = createMockEventEmitter();
            const manager = new WaveManager(
              { mode: 'campaign', finalWave: 10 },
              spawnController,
              eventEmitter,
            );

            const config = manager.resolveWaveConfig(wave);
            const types = config.enemyTypes.map((et) => et.type);

            expect(types).toEqual(['esqueleto']);
          },
        ),
        { numRuns: 3 },
      );
    });

    it('waves 4-6 contain esqueleto and murcielago', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 6 }),
          (wave: number) => {
            const spawnController = createMockSpawnController();
            const eventEmitter = createMockEventEmitter();
            const manager = new WaveManager(
              { mode: 'campaign', finalWave: 10 },
              spawnController,
              eventEmitter,
            );

            const config = manager.resolveWaveConfig(wave);
            const types = config.enemyTypes.map((et) => et.type);

            expect(types).toContain('esqueleto');
            expect(types).toContain('murcielago');
            expect(types).toHaveLength(2);
          },
        ),
        { numRuns: 3 },
      );
    });

    it('waves 7-8 add calavera_llameante', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 7, max: 8 }),
          (wave: number) => {
            const spawnController = createMockSpawnController();
            const eventEmitter = createMockEventEmitter();
            const manager = new WaveManager(
              { mode: 'campaign', finalWave: 10 },
              spawnController,
              eventEmitter,
            );

            const config = manager.resolveWaveConfig(wave);
            const types = config.enemyTypes.map((et) => et.type);

            expect(types).toContain('esqueleto');
            expect(types).toContain('murcielago');
            expect(types).toContain('calavera_llameante');
            expect(types).toHaveLength(3);
          },
        ),
        { numRuns: 2 },
      );
    });

    it('waves 9-10 contain all four enemy types', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 9, max: 10 }),
          (wave: number) => {
            const spawnController = createMockSpawnController();
            const eventEmitter = createMockEventEmitter();
            const manager = new WaveManager(
              { mode: 'campaign', finalWave: 10 },
              spawnController,
              eventEmitter,
            );

            const config = manager.resolveWaveConfig(wave);
            const types = config.enemyTypes.map((et) => et.type);

            expect(types).toContain('esqueleto');
            expect(types).toContain('murcielago');
            expect(types).toContain('calavera_llameante');
            expect(types).toContain('serpiente_emplumada');
            expect(types).toHaveLength(4);
          },
        ),
        { numRuns: 2 },
      );
    });

    it('waves beyond 10 preserve wave 10 enemy type mapping', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 11, max: 200 }),
          (wave: number) => {
            const spawnController = createMockSpawnController();
            const eventEmitter = createMockEventEmitter();
            const manager = new WaveManager(
              { mode: 'infinite', finalWave: null },
              spawnController,
              eventEmitter,
            );

            const config = manager.resolveWaveConfig(wave);
            const types = config.enemyTypes.map((et) => et.type);
            const wave10Types = WAVE_ENEMY_PROGRESSION[10];

            expect(types).toEqual(wave10Types);
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
