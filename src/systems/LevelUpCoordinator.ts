import type { Upgrade, LevelUpPayload, UpgradeSelectedPayload } from '../types/interfaces';

/** Minimal interface for pause control — real PauseSystem (Task 18) will implement this */
export interface PauseController {
  readonly isPaused: boolean;
  pause(): void;
  resume(): void;
}

/** Minimal interface for XP system interaction */
export interface LevelUpXPProvider {
  getRandomUpgrades(count?: number): Upgrade[];
  applyUpgrade(player: unknown, upgrade: Upgrade): void;
  removeUpgradeFromPool(upgradeId: string): void;
}

/** Minimal event emitter interface */
export interface LevelUpEventEmitter {
  emit(event: string, ...args: unknown[]): boolean;
  on(event: string, fn: (...args: unknown[]) => void, context?: unknown): unknown;
  off(event: string, fn: (...args: unknown[]) => void, context?: unknown): unknown;
}

/** Internal state machine */
type LevelUpFlowState =
  | { status: 'idle' }
  | { status: 'choosing'; level: number; upgrades: readonly Upgrade[] };

export class LevelUpCoordinator {
  private state: LevelUpFlowState = { status: 'idle' };
  private pausedByLevelUp = false;
  private upgradeSelectedHandler: ((payload: UpgradeSelectedPayload) => void) | null = null;
  private readonly xpProvider: LevelUpXPProvider;
  private readonly pauseController: PauseController;
  private readonly eventEmitter: LevelUpEventEmitter;
  private readonly player: unknown;

  constructor(
    xpProvider: LevelUpXPProvider,
    pauseController: PauseController,
    eventEmitter: LevelUpEventEmitter,
    player: unknown,
  ) {
    this.xpProvider = xpProvider;
    this.pauseController = pauseController;
    this.eventEmitter = eventEmitter;
    this.player = player;
    this.upgradeSelectedHandler = (payload) => this.handleUpgradeSelected(payload.upgradeId);
    this.eventEmitter.on('upgrade-selected', this.upgradeSelectedHandler as (...args: unknown[]) => void);
  }

  /**
   * Process the result from XPSystem.addXP().
   * Called by GameScene/OrbCollector after XP is added.
   */
  processLevelUp(result: { leveledUp: boolean; showPanel: boolean; newLevel: number }): void {
    if (!result.leveledUp) return;
    if (!result.showPanel) return;

    const upgrades = this.xpProvider.getRandomUpgrades(3);
    if (upgrades.length === 0) return;

    // Enter choosing state
    this.state = { status: 'choosing', level: result.newLevel, upgrades };

    // Pause the game
    this.pauseController.pause();
    this.pausedByLevelUp = true;

    // Emit level-up with options for HUDScene
    this.eventEmitter.emit('level-up', { level: result.newLevel, upgrades } as LevelUpPayload);
  }

  /** Handle upgrade selection from HUDScene */
  private handleUpgradeSelected(upgradeId: string): void {
    if (this.state.status !== 'choosing') return;

    // Verify the upgrade is one of the shown options
    const selectedUpgrade = this.state.upgrades.find((u) => u.id === upgradeId);
    if (!selectedUpgrade) return;

    // Apply the upgrade
    this.xpProvider.applyUpgrade(this.player, selectedUpgrade);
    this.xpProvider.removeUpgradeFromPool(selectedUpgrade.id);

    // Close session
    this.state = { status: 'idle' };

    // Resume only if we paused
    if (this.pausedByLevelUp) {
      this.pauseController.resume();
      this.pausedByLevelUp = false;
    }
  }

  /** Get current flow state (for testing) */
  getState(): LevelUpFlowState {
    return this.state;
  }

  /** Cleanup: remove listener, reset state */
  destroy(): void {
    if (this.upgradeSelectedHandler) {
      this.eventEmitter.off('upgrade-selected', this.upgradeSelectedHandler as (...args: unknown[]) => void);
      this.upgradeSelectedHandler = null;
    }
    if (this.pausedByLevelUp) {
      this.pauseController.resume();
      this.pausedByLevelUp = false;
    }
    this.state = { status: 'idle' };
  }
}
