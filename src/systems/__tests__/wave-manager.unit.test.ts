import { describe, it, expect, beforeEach } from 'vitest';
import { WaveManager } from '../WaveManager';
import type { WaveSpawnController, WaveEventEmitter } from '../WaveManager';
import type { WaveConfig } from '../../types/interfaces';
import { GAME_CONSTANTS } from '../../config/constants';

/**
 * Unit tests para WaveManager.
 * Validates: Requirements 6.1, 6.4, 6.5, 3.7
 */
describe('WaveManager Unit Tests', () => {
  let spawnController: WaveSpawnController & { configs: WaveConfig[] };
  let eventEmitter: WaveEventEmitter & { events: Array<{ event: string; args: unknown[] }> };

  const WAVE_DURATION_MS = GAME_CONSTANTS.WAVE_DURATION * 1000; // 30000ms
  const TRANSITION_DURATION_MS = GAME_CONSTANTS.WAVE_TRANSITION_TIME * 1000; // 2000ms

  beforeEach(() => {
    spawnController = {
      configs: [],
      setWaveConfig(config: WaveConfig): void {
        this.configs.push(config);
      },
    };

    eventEmitter = {
      events: [],
      emit(event: string, ...args: unknown[]): boolean {
        this.events.push({ event, args });
        return true;
      },
    };
  });

  describe('Initialization', () => {
    it('initializes at wave 1 and notifies SpawnManager', () => {
      const manager = new WaveManager(
        { mode: 'campaign', finalWave: 10 },
        spawnController,
        eventEmitter,
      );

      expect(manager.getCurrentWave()).toBe(1);
      expect(manager.getState()).toBe('running');
      expect(spawnController.configs).toHaveLength(1);
      expect(spawnController.configs[0].waveNumber).toBe(1);
    });

    it('emits wave-changed at start with wave 1', () => {
      const wm = new WaveManager(
        { mode: 'campaign', finalWave: 10 },
        spawnController,
        eventEmitter,
      );
      wm.emitInitialState();

      const waveChangedEvents = eventEmitter.events.filter((e) => e.event === 'wave-changed');
      expect(waveChangedEvents).toHaveLength(1);
      expect(waveChangedEvents[0].args[0]).toMatchObject({ wave: 1 });
    });
  });

  describe('Wave Transitions', () => {
    it('transitions to next wave after waveDuration + transitionDuration', () => {
      const manager = new WaveManager(
        { mode: 'campaign', finalWave: 10 },
        spawnController,
        eventEmitter,
      );

      // Advance through wave 1 duration
      manager.update(WAVE_DURATION_MS);
      expect(manager.getState()).toBe('transitioning');

      // Advance through transition
      manager.update(TRANSITION_DURATION_MS);
      expect(manager.getState()).toBe('running');
      expect(manager.getCurrentWave()).toBe(2);
    });

    it('emits wave-changed after each transition', () => {
      const manager = new WaveManager(
        { mode: 'campaign', finalWave: 10 },
        spawnController,
        eventEmitter,
      );
      manager.emitInitialState();

      // Complete wave 1 + transition
      manager.update(WAVE_DURATION_MS);
      manager.update(TRANSITION_DURATION_MS);

      const waveChangedEvents = eventEmitter.events.filter((e) => e.event === 'wave-changed');
      // Wave 1 start + wave 2 start
      expect(waveChangedEvents).toHaveLength(2);
      expect(waveChangedEvents[1].args[0]).toMatchObject({ wave: 2 });
    });

    it('transition takes max 2000ms', () => {
      const manager = new WaveManager(
        { mode: 'campaign', finalWave: 10 },
        spawnController,
        eventEmitter,
      );

      // Complete wave 1
      manager.update(WAVE_DURATION_MS);
      expect(manager.getState()).toBe('transitioning');

      // 1999ms: still transitioning
      manager.update(1999);
      expect(manager.getState()).toBe('transitioning');
      expect(manager.getCurrentWave()).toBe(1);

      // 1ms more → completes transition
      manager.update(1);
      expect(manager.getState()).toBe('running');
      expect(manager.getCurrentWave()).toBe(2);
    });

    it('a large delta does NOT produce multiple transitions', () => {
      const manager = new WaveManager(
        { mode: 'campaign', finalWave: 10 },
        spawnController,
        eventEmitter,
      );

      // Pass a delta larger than 2× wave duration
      manager.update(WAVE_DURATION_MS * 3);

      // Should only transition once, not skip waves
      expect(manager.getState()).toBe('transitioning');
      expect(manager.getCurrentWave()).toBe(1);

      // Complete transition
      manager.update(TRANSITION_DURATION_MS);
      expect(manager.getCurrentWave()).toBe(2);
      expect(manager.getState()).toBe('running');
    });

    it('enemies are NOT touched (SpawnManager not asked to clear)', () => {
      const manager = new WaveManager(
        { mode: 'campaign', finalWave: 10 },
        spawnController,
        eventEmitter,
      );

      // Complete wave 1 + transition
      manager.update(WAVE_DURATION_MS);
      manager.update(TRANSITION_DURATION_MS);

      // SpawnManager was called with setWaveConfig (wave 1 + wave 2), never asked to clear
      expect(spawnController.configs).toHaveLength(2);
      // No clear/destroy/reset method was ever called
      const clearEvents = eventEmitter.events.filter(
        (e) => e.event === 'clear-enemies' || e.event === 'destroy-enemies',
      );
      expect(clearEvents).toHaveLength(0);
    });

    it('timers reset correctly when starting a new wave', () => {
      const manager = new WaveManager(
        { mode: 'campaign', finalWave: 10 },
        spawnController,
        eventEmitter,
      );

      // Complete wave 1 + transition → wave 2 starts
      manager.update(WAVE_DURATION_MS);
      manager.update(TRANSITION_DURATION_MS);
      expect(manager.getState()).toBe('running');
      expect(manager.getCurrentWave()).toBe(2);

      // Wave 2 should require full duration again
      manager.update(WAVE_DURATION_MS - 1);
      expect(manager.getState()).toBe('running');

      manager.update(1);
      expect(manager.getState()).toBe('transitioning');
    });
  });

  describe('Campaign Mode Victory', () => {
    it('does NOT declare victory before completing final wave', () => {
      const manager = new WaveManager(
        { mode: 'campaign', finalWave: 2 },
        spawnController,
        eventEmitter,
      );

      // Complete wave 1 + transition → wave 2 starts
      manager.update(WAVE_DURATION_MS);
      manager.update(TRANSITION_DURATION_MS);
      expect(manager.getCurrentWave()).toBe(2);
      expect(manager.isVictory()).toBe(false);
      expect(manager.getState()).toBe('running');
    });

    it('declares victory when currentWave > finalWave', () => {
      const manager = new WaveManager(
        { mode: 'campaign', finalWave: 2 },
        spawnController,
        eventEmitter,
      );

      // Wave 1 → wave 2
      manager.update(WAVE_DURATION_MS);
      manager.update(TRANSITION_DURATION_MS);
      expect(manager.getCurrentWave()).toBe(2);

      // Wave 2 completes → transition → currentWave becomes 3 > finalWave 2
      manager.update(WAVE_DURATION_MS);
      manager.update(TRANSITION_DURATION_MS);

      expect(manager.isVictory()).toBe(true);
      expect(manager.getState()).toBe('victory');
      expect(manager.getCurrentWave()).toBe(3);
    });

    it('victory event emitted only once', () => {
      const manager = new WaveManager(
        { mode: 'campaign', finalWave: 1 },
        spawnController,
        eventEmitter,
      );

      // Wave 1 completes → transition → currentWave becomes 2 > finalWave 1
      manager.update(WAVE_DURATION_MS);
      manager.update(TRANSITION_DURATION_MS);

      const victoryEvents = eventEmitter.events.filter((e) => e.event === 'victory');
      expect(victoryEvents).toHaveLength(1);

      // Further updates should NOT emit victory again
      manager.update(10000);
      manager.update(10000);

      const victoryEventsAfter = eventEmitter.events.filter((e) => e.event === 'victory');
      expect(victoryEventsAfter).toHaveLength(1);
    });

    it('victory event contains correct payload', () => {
      const manager = new WaveManager(
        { mode: 'campaign', finalWave: 2 },
        spawnController,
        eventEmitter,
      );

      // Complete wave 1 → wave 2 → victory
      manager.update(WAVE_DURATION_MS);
      manager.update(TRANSITION_DURATION_MS);
      manager.update(WAVE_DURATION_MS);
      manager.update(TRANSITION_DURATION_MS);

      const victoryEvent = eventEmitter.events.find((e) => e.event === 'victory');
      expect(victoryEvent).toBeDefined();
      expect(victoryEvent!.args[0]).toEqual({
        completedWave: 2,
        currentWave: 3,
        finalWave: 2,
      });
    });

    it('after victory, SpawnManager is not updated again', () => {
      const manager = new WaveManager(
        { mode: 'campaign', finalWave: 1 },
        spawnController,
        eventEmitter,
      );

      // Complete wave 1 → victory
      manager.update(WAVE_DURATION_MS);
      manager.update(TRANSITION_DURATION_MS);

      const configsAfterVictory = spawnController.configs.length;

      // Further updates should not call setWaveConfig
      manager.update(WAVE_DURATION_MS);
      manager.update(TRANSITION_DURATION_MS);
      manager.update(WAVE_DURATION_MS);

      expect(spawnController.configs).toHaveLength(configsAfterVictory);
    });
  });

  describe('Infinite Mode', () => {
    it('never declares victory', () => {
      const manager = new WaveManager(
        { mode: 'infinite', finalWave: null },
        spawnController,
        eventEmitter,
      );

      // Run through many waves
      for (let i = 0; i < 20; i++) {
        manager.update(WAVE_DURATION_MS);
        manager.update(TRANSITION_DURATION_MS);
      }

      expect(manager.isVictory()).toBe(false);
      expect(manager.getState()).toBe('running');
    });

    it('repeats last config without additional scaling for waves > 10', () => {
      const manager = new WaveManager(
        { mode: 'infinite', finalWave: null },
        spawnController,
        eventEmitter,
      );

      // Advance to wave 11
      for (let i = 0; i < 10; i++) {
        manager.update(WAVE_DURATION_MS);
        manager.update(TRANSITION_DURATION_MS);
      }
      expect(manager.getCurrentWave()).toBe(11);

      // Get the config for wave 11 (should be same as wave 10 params)
      const wave11Config = spawnController.configs[spawnController.configs.length - 1];
      const wave10Config = spawnController.configs[9]; // Index 9 = wave 10

      expect(wave11Config.spawnInterval).toBe(wave10Config.spawnInterval);
      expect(wave11Config.hpMultiplier).toBe(wave10Config.hpMultiplier);
      expect(wave11Config.speedMultiplier).toBe(wave10Config.speedMultiplier);
      expect(wave11Config.enemyTypes).toEqual(wave10Config.enemyTypes);
    });

    it('no victory event is ever emitted', () => {
      const manager = new WaveManager(
        { mode: 'infinite', finalWave: null },
        spawnController,
        eventEmitter,
      );

      // Run through many waves
      for (let i = 0; i < 15; i++) {
        manager.update(WAVE_DURATION_MS);
        manager.update(TRANSITION_DURATION_MS);
      }

      const victoryEvents = eventEmitter.events.filter((e) => e.event === 'victory');
      expect(victoryEvents).toHaveLength(0);
    });
  });
});
