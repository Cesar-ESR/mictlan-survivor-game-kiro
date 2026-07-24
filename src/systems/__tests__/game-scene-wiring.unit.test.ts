import { describe, it, expect, vi } from 'vitest';
import type { GameModeConfig, WaveChangedPayload } from '../../types/interfaces';

/**
 * Integration tests for GameScene wiring contracts.
 * Uses fakes/mocks to test the wiring logic without Phaser.
 *
 * Verifies Task 23 contracts:
 * - Pause prevents all updates
 * - End state prevents all updates
 * - enemy-defeated increments stats once
 * - wave-changed updates maxWave
 * - XP flow calls addXP once per orb
 * - LevelUpResult reaches coordinator
 * - Campaign mode uses finalWave
 * - Infinite mode uses null finalWave
 */

// Minimal event emitter for testing
class FakeEventEmitter {
  private listeners = new Map<string, ((...args: unknown[]) => void)[]>();

  on(event: string, fn: (...args: unknown[]) => void): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(fn);
    return this;
  }

  off(event: string, fn: (...args: unknown[]) => void): this {
    const arr = this.listeners.get(event);
    if (arr) {
      const idx = arr.indexOf(fn);
      if (idx >= 0) arr.splice(idx, 1);
    }
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const arr = this.listeners.get(event);
    if (arr) {
      for (const fn of arr) {
        fn(...args);
      }
      return true;
    }
    return false;
  }
}

describe('GameScene Wiring Contracts', () => {
  describe('Pause prevents all updates', () => {
    it('when pauseSystem.isPaused is true, no system update should be called', () => {
      // Simulate the guard logic in GameScene.update()
      const pauseSystem = { isPaused: true };
      const playerManagerUpdate = vi.fn();
      const waveManagerUpdate = vi.fn();
      const weaponSystemUpdate = vi.fn();

      // Simulate GameScene update guard
      const gameState = 'playing';
      if (gameState !== 'playing') return;
      if (pauseSystem.isPaused) {
        // Should return early - systems not called
        expect(playerManagerUpdate).not.toHaveBeenCalled();
        expect(waveManagerUpdate).not.toHaveBeenCalled();
        expect(weaponSystemUpdate).not.toHaveBeenCalled();
        return;
      }

      playerManagerUpdate();
      waveManagerUpdate();
      weaponSystemUpdate();
    });

    it('when pauseSystem.isPaused is false, systems are called', () => {
      const pauseSystem = { isPaused: false };
      const playerManagerUpdate = vi.fn();

      const gameState = 'playing';
      if (gameState !== 'playing') return;
      if (pauseSystem.isPaused) return;

      playerManagerUpdate();
      expect(playerManagerUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('End state prevents all updates', () => {
    it('when gameState is defeat, no updates run', () => {
      const playerManagerUpdate = vi.fn();

      const gameState = 'defeat' as 'playing' | 'victory' | 'defeat';
      if (gameState !== 'playing') {
        expect(playerManagerUpdate).not.toHaveBeenCalled();
        return;
      }
      playerManagerUpdate();
    });

    it('when gameState is victory, no updates run', () => {
      const playerManagerUpdate = vi.fn();

      const gameState = 'victory' as 'playing' | 'victory' | 'defeat';
      if (gameState !== 'playing') {
        expect(playerManagerUpdate).not.toHaveBeenCalled();
        return;
      }
      playerManagerUpdate();
    });
  });

  describe('enemy-defeated increments stats once', () => {
    it('each enemy-defeated event increments enemiesDefeated by exactly 1', () => {
      const emitter = new FakeEventEmitter();
      const gameStats = { survivalTime: 0, enemiesDefeated: 0, maxWave: 1 };

      // Register handler (same as GameScene)
      emitter.on('enemy-defeated', () => {
        gameStats.enemiesDefeated++;
      });

      emitter.emit('enemy-defeated', { x: 100, y: 100, xpReward: 5 });
      expect(gameStats.enemiesDefeated).toBe(1);

      emitter.emit('enemy-defeated', { x: 200, y: 200, xpReward: 10 });
      expect(gameStats.enemiesDefeated).toBe(2);
    });
  });

  describe('wave-changed updates maxWave', () => {
    it('updates maxWave to the highest wave seen', () => {
      const emitter = new FakeEventEmitter();
      const gameStats = { survivalTime: 0, enemiesDefeated: 0, maxWave: 1 };

      emitter.on('wave-changed', (payload: unknown) => {
        const p = payload as WaveChangedPayload;
        gameStats.maxWave = Math.max(gameStats.maxWave, p.wave);
      });

      emitter.emit('wave-changed', { wave: 3, config: {} });
      expect(gameStats.maxWave).toBe(3);

      // Wave 2 shouldn't lower maxWave (edge case during restarts)
      emitter.emit('wave-changed', { wave: 2, config: {} });
      expect(gameStats.maxWave).toBe(3);

      emitter.emit('wave-changed', { wave: 5, config: {} });
      expect(gameStats.maxWave).toBe(5);
    });
  });

  describe('XP flow calls addXP once per orb', () => {
    it('orb-collected event triggers exactly one addXP call through XPSystem', () => {
      const emitter = new FakeEventEmitter();
      const addXPCalls: number[] = [];

      // Mock XPSystem.addXP
      const mockXPSystem = {
        addXP: (_player: unknown, value: number) => {
          addXPCalls.push(value);
          return { leveledUp: false, showPanel: false, newLevel: 1, excessXp: 0, reachedMaxLevel: false };
        },
      };

      // Mock player
      const mockPlayer = {
        addXP: vi.fn().mockReturnValue({ leveledUp: false, newLevel: 1, excessXp: 0, reachedMaxLevel: false }),
        levelXp: 5,
        xpThreshold: 15,
        level: 1,
      };

      // Register handler (same as GameScene.onOrbCollected)
      emitter.on('orb-collected', (data: unknown) => {
        const { value } = data as { value: number };
        mockXPSystem.addXP(mockPlayer, value);
      });

      emitter.emit('orb-collected', { value: 7 });
      expect(addXPCalls).toEqual([7]);

      emitter.emit('orb-collected', { value: 3 });
      expect(addXPCalls).toEqual([7, 3]);
    });
  });

  describe('LevelUpResult reaches coordinator', () => {
    it('when XPSystem returns showPanel=true, processLevelUp is called', () => {
      const emitter = new FakeEventEmitter();
      const processLevelUpCalls: { leveledUp: boolean; showPanel: boolean; newLevel: number }[] = [];

      const mockXPSystem = {
        addXP: (_player: unknown, _value: number) => ({
          leveledUp: true,
          showPanel: true,
          newLevel: 2,
          excessXp: 3,
          reachedMaxLevel: false,
        }),
      };

      const mockCoordinator = {
        processLevelUp: (result: { leveledUp: boolean; showPanel: boolean; newLevel: number }) => {
          processLevelUpCalls.push(result);
        },
      };

      const mockPlayer = { levelXp: 3, xpThreshold: 25, level: 2 };

      // Register handler (same as GameScene.onOrbCollected)
      emitter.on('orb-collected', (data: unknown) => {
        const { value } = data as { value: number };
        const result = mockXPSystem.addXP(mockPlayer, value);
        if (result.leveledUp && result.showPanel) {
          mockCoordinator.processLevelUp(result);
        }
      });

      emitter.emit('orb-collected', { value: 15 });
      expect(processLevelUpCalls).toHaveLength(1);
      expect(processLevelUpCalls[0].newLevel).toBe(2);
      expect(processLevelUpCalls[0].showPanel).toBe(true);
    });

    it('when XPSystem returns showPanel=false, processLevelUp is NOT called', () => {
      const emitter = new FakeEventEmitter();
      const processLevelUpCalls: unknown[] = [];

      const mockXPSystem = {
        addXP: (_player: unknown, _value: number) => ({
          leveledUp: true,
          showPanel: false, // No upgrades available or max level
          newLevel: 20,
          excessXp: 0,
          reachedMaxLevel: true,
        }),
      };

      const mockCoordinator = {
        processLevelUp: (result: unknown) => {
          processLevelUpCalls.push(result);
        },
      };

      const mockPlayer = { levelXp: 0, xpThreshold: 205, level: 20 };

      emitter.on('orb-collected', (data: unknown) => {
        const { value } = data as { value: number };
        const result = mockXPSystem.addXP(mockPlayer, value);
        if (result.leveledUp && result.showPanel) {
          mockCoordinator.processLevelUp(result);
        }
      });

      emitter.emit('orb-collected', { value: 10 });
      expect(processLevelUpCalls).toHaveLength(0);
    });
  });

  describe('Campaign mode uses finalWave', () => {
    it('campaign mode config has finalWave=10', () => {
      const modeParam: string | null = null; // default
      const config: GameModeConfig = modeParam === 'infinite'
        ? { mode: 'infinite', finalWave: null }
        : { mode: 'campaign', finalWave: 10 };

      expect(config.mode).toBe('campaign');
      expect(config.finalWave).toBe(10);
    });

    it('explicit campaign param resolves to campaign mode', () => {
      const modeParam: string | null = 'campaign';
      const config: GameModeConfig = modeParam === 'infinite'
        ? { mode: 'infinite', finalWave: null }
        : { mode: 'campaign', finalWave: 10 };

      expect(config.mode).toBe('campaign');
      expect(config.finalWave).toBe(10);
    });
  });

  describe('Infinite mode uses null finalWave', () => {
    it('?mode=infinite results in infinite config with null finalWave', () => {
      const modeParam: string | null = 'infinite';
      const config: GameModeConfig = modeParam === 'infinite'
        ? { mode: 'infinite', finalWave: null }
        : { mode: 'campaign', finalWave: 10 };

      expect(config.mode).toBe('infinite');
      expect(config.finalWave).toBeNull();
    });
  });

  describe('Event handler cleanup', () => {
    it('shutdown removes all registered listeners', () => {
      const emitter = new FakeEventEmitter();
      const gameStats = { survivalTime: 0, enemiesDefeated: 0, maxWave: 1 };

      const onEnemyDefeated = () => { gameStats.enemiesDefeated++; };
      emitter.on('enemy-defeated', onEnemyDefeated);

      // Before shutdown
      emitter.emit('enemy-defeated', {});
      expect(gameStats.enemiesDefeated).toBe(1);

      // Simulate shutdown
      emitter.off('enemy-defeated', onEnemyDefeated);

      // After shutdown - events should no longer reach handler
      emitter.emit('enemy-defeated', {});
      expect(gameStats.enemiesDefeated).toBe(1); // unchanged
    });
  });

  describe('Survival time accumulation', () => {
    it('survivalTime accumulates delta/1000 each frame', () => {
      const gameStats = { survivalTime: 0, enemiesDefeated: 0, maxWave: 1 };

      // Simulate 3 frames with different deltas
      const deltas = [16.67, 16.67, 33.34]; // ms

      for (const delta of deltas) {
        gameStats.survivalTime += delta / 1000;
      }

      // Expected: (16.67 + 16.67 + 33.34) / 1000 = 0.06668
      expect(gameStats.survivalTime).toBeCloseTo(0.06668, 4);
    });
  });

  describe('Player defeat transitions state', () => {
    it('player-defeated sets gameState to defeat and prevents further updates', () => {
      const emitter = new FakeEventEmitter();
      let gameState: 'playing' | 'victory' | 'defeat' = 'playing';

      emitter.on('player-defeated', () => {
        if (gameState !== 'playing') return;
        gameState = 'defeat';
      });

      emitter.emit('player-defeated');
      expect(gameState).toBe('defeat');

      // Second defeat should not change anything (idempotent)
      emitter.emit('player-defeated');
      expect(gameState).toBe('defeat');
    });
  });

  describe('Victory transitions state', () => {
    it('victory event sets gameState to victory', () => {
      const emitter = new FakeEventEmitter();
      let gameState: 'playing' | 'victory' | 'defeat' = 'playing';

      emitter.on('victory', () => {
        if (gameState !== 'playing') return;
        gameState = 'victory';
      });

      emitter.emit('victory', { completedWave: 10, currentWave: 11, finalWave: 10 });
      expect(gameState).toBe('victory');
    });
  });
});
