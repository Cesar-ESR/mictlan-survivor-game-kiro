import type { GameModeConfig, WaveConfig, DifficultyParams, WaveChangedPayload } from '../types/interfaces';
import { buildWaveConfig } from '../config/wave-configs';
import { GAME_CONSTANTS } from '../config/constants';

/**
 * Interface for SpawnManager injection — only the method WaveManager needs.
 */
export interface WaveSpawnController {
  setWaveConfig(config: WaveConfig): void;
}

/**
 * Interface for event emission — subset of Phaser.Events.EventEmitter.
 */
export interface WaveEventEmitter {
  emit(event: string, ...args: unknown[]): boolean;
}

/** WaveManager state machine states */
export type WaveState = 'running' | 'transitioning' | 'victory';

/** Last configured wave in WAVE_ENEMY_PROGRESSION */
const LAST_CONFIGURED_WAVE = 10;

/**
 * WaveManager: gestiona la progresión de oleadas, transiciones, y modos Campaña/Infinito.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 3.7
 */
export class WaveManager {
  private currentWave: number;
  private state: WaveState;
  private waveTimer: number;
  private transitionTimer: number;
  private victoryEmitted: boolean;

  private readonly waveDurationMs: number;
  private readonly transitionDurationMs: number;
  private readonly gameMode: GameModeConfig;
  private readonly spawnController: WaveSpawnController;
  private readonly eventEmitter: WaveEventEmitter;

  constructor(
    gameMode: GameModeConfig,
    spawnController: WaveSpawnController,
    eventEmitter: WaveEventEmitter,
  ) {
    this.gameMode = gameMode;
    this.spawnController = spawnController;
    this.eventEmitter = eventEmitter;

    this.currentWave = 1;
    this.state = 'running';
    this.waveTimer = 0;
    this.transitionTimer = 0;
    this.victoryEmitted = false;

    this.waveDurationMs = GAME_CONSTANTS.WAVE_DURATION * 1000; // 30s → 30000ms
    this.transitionDurationMs = GAME_CONSTANTS.WAVE_TRANSITION_TIME * 1000; // 2s → 2000ms

    // Initialize wave 1: resolve config, notify spawn controller, emit event
    const config = this.resolveWaveConfig(this.currentWave);
    this.spawnController.setWaveConfig(config);
    const payload: WaveChangedPayload = { wave: this.currentWave, config };
    this.eventEmitter.emit('wave-changed', payload);
  }

  /**
   * Main update loop. Receives delta in milliseconds from Phaser.
   * Caps accumulation to prevent skipping multiple waves in a single large delta.
   */
  update(deltaMs: number): void {
    if (this.state === 'victory') {
      return;
    }

    if (this.state === 'running') {
      this.waveTimer += deltaMs;

      // Cap: only allow one transition per update (no skipping multiple waves)
      if (this.waveTimer >= this.waveDurationMs) {
        this.waveTimer = this.waveDurationMs; // cap excess
        this.state = 'transitioning';
        this.transitionTimer = 0;
      }
      return;
    }

    if (this.state === 'transitioning') {
      this.transitionTimer += deltaMs;

      if (this.transitionTimer >= this.transitionDurationMs) {
        this.currentWave++;

        // Check victory for campaign mode
        if (this.checkVictory()) {
          this.state = 'victory';
          if (!this.victoryEmitted) {
            this.victoryEmitted = true;
            this.eventEmitter.emit('victory', {
              completedWave: this.currentWave - 1,
              currentWave: this.currentWave,
              finalWave: this.gameMode.finalWave,
            });
          }
          return;
        }

        // No victory: start next wave
        const config = this.resolveWaveConfig(this.currentWave);
        this.spawnController.setWaveConfig(config);
        const changedPayload: WaveChangedPayload = { wave: this.currentWave, config };
        this.eventEmitter.emit('wave-changed', changedPayload);
        this.state = 'running';
        this.waveTimer = 0;
      }
    }
  }

  /** Returns the current wave number. */
  getCurrentWave(): number {
    return this.currentWave;
  }

  /** Returns the current state of the wave state machine. */
  getState(): WaveState {
    return this.state;
  }

  /** Returns true if the game is in victory state (campaign only). */
  isVictory(): boolean {
    if (this.gameMode.mode === 'infinite') {
      return false;
    }
    return this.state === 'victory';
  }

  /**
   * Resolves the WaveConfig for a given wave number.
   * For infinite mode: when wave > lastConfiguredWave (10), uses buildWaveConfig(10)
   * but sets waveNumber to the actual wave number. Returns a COPY.
   */
  resolveWaveConfig(wave: number): WaveConfig {
    const effectiveWave = Math.max(1, wave);

    if (effectiveWave <= LAST_CONFIGURED_WAVE) {
      return { ...buildWaveConfig(effectiveWave) };
    }

    // For waves beyond last configured: use last configured wave's config
    // but with actual wave number. No additional scaling.
    const baseConfig = buildWaveConfig(LAST_CONFIGURED_WAVE);
    return { ...baseConfig, waveNumber: effectiveWave };
  }

  /**
   * Checks if victory condition is met.
   * Campaign: currentWave > finalWave
   * Infinite: never
   */
  private checkVictory(): boolean {
    if (this.gameMode.mode === 'infinite') {
      return false;
    }
    return this.currentWave > this.gameMode.finalWave;
  }
}

/**
 * Pure function to calculate difficulty parameters for a given wave.
 * Exported separately for testability.
 *
 * Formulas:
 * - spawnInterval = max(2 × 0.9^(wave-1), 0.5)
 * - hpMultiplier = min(1.15^(wave-1), 5)
 * - speedMultiplier = min(1.05^(wave-1), 2)
 *
 * Protects against wave < 1 (treats as wave 1).
 */
export function calculateDifficulty(wave: number): DifficultyParams {
  const effectiveWave = Math.max(1, wave);

  const spawnInterval = Math.max(
    GAME_CONSTANTS.BASE_SPAWN_INTERVAL * Math.pow(GAME_CONSTANTS.SPAWN_INTERVAL_DECAY, effectiveWave - 1),
    GAME_CONSTANTS.MIN_SPAWN_INTERVAL,
  );

  const hpMultiplier = Math.min(
    Math.pow(GAME_CONSTANTS.HP_SCALING_BASE, effectiveWave - 1),
    GAME_CONSTANTS.MAX_HP_MULTIPLIER,
  );

  const speedMultiplier = Math.min(
    Math.pow(GAME_CONSTANTS.SPEED_SCALING_BASE, effectiveWave - 1),
    GAME_CONSTANTS.MAX_SPEED_MULTIPLIER,
  );

  return { spawnInterval, hpMultiplier, speedMultiplier };
}
