import type { UpgradeContext, UpgradeSelectedPayload } from '../types/interfaces';
import type { MemoryUpgrade, MemoryId } from '../config/memory-upgrades';
import { applyMemoryUpgrade, getAvailableMemories } from '../config/memory-upgrades';

/** Minimal interface for pause control — real PauseSystem (Task 18) will implement this */
export interface PauseController {
  readonly isPaused: boolean;
  pause(): void;
  resume(): void;
}

/** Minimal interface for weapon system upgrade API (BUG-008) */
export interface WeaponSystemUpgradeAPI {
  getDamage(): number;
  increaseDamage(amount: number): void;
  getFireRateMs(): number;
  reduceFireRate(amountMs: number, minimumMs: number): void;
  getRange(): number;
  increaseRange(amount: number): void;
  getProjectileSpeed(): number;
  increaseProjectileSpeed(amount: number): void;
  getMaxDistance(): number;
  increaseMaxDistance(amount: number): void;
}

/** Minimal event emitter interface */
export interface LevelUpEventEmitter {
  emit(event: string, ...args: unknown[]): boolean;
  on(event: string, fn: (...args: unknown[]) => void, context?: unknown): unknown;
  off(event: string, fn: (...args: unknown[]) => void, context?: unknown): unknown;
}

/** Payload emitted to HUDScene with memory upgrades */
export interface MemoryLevelUpPayload {
  level: number;
  memories: readonly MemoryUpgrade[];
}

/** Internal state machine */
type LevelUpFlowState =
  | { status: 'idle' }
  | { status: 'choosing'; level: number; memories: readonly MemoryUpgrade[] };

export class LevelUpCoordinator {
  private state: LevelUpFlowState = { status: 'idle' };
  private pausedByLevelUp = false;
  private upgradeSelectedHandler: ((payload: UpgradeSelectedPayload) => void) | null = null;
  private readonly pauseController: PauseController;
  private readonly eventEmitter: LevelUpEventEmitter;
  private readonly player: { hp: number; maxHp: number; speed: number };
  private readonly weaponSystem: WeaponSystemUpgradeAPI;
  private memories: MemoryUpgrade[];

  constructor(
    memories: MemoryUpgrade[],
    pauseController: PauseController,
    eventEmitter: LevelUpEventEmitter,
    player: { hp: number; maxHp: number; speed: number },
    weaponSystem: WeaponSystemUpgradeAPI,
  ) {
    this.memories = memories;
    this.pauseController = pauseController;
    this.eventEmitter = eventEmitter;
    this.player = player;
    this.weaponSystem = weaponSystem;
    this.upgradeSelectedHandler = (payload) => this.handleUpgradeSelected(payload.upgradeId);
    this.eventEmitter.on('upgrade-selected', this.upgradeSelectedHandler as (...args: unknown[]) => void);
  }

  /**
   * Process the result from XPSystem.addXP().
   * Called by GameScene/OrbCollector after XP is added.
   * Uses memory-based progression instead of random upgrade pool.
   */
  processLevelUp(result: { leveledUp: boolean; showPanel: boolean; newLevel: number }): void {
    if (!result.leveledUp) return;
    if (!result.showPanel) return;

    const available = getAvailableMemories(this.memories);
    if (available.length === 0) return;

    // Enter choosing state
    this.state = { status: 'choosing', level: result.newLevel, memories: available };

    // Pause the game
    this.pauseController.pause();
    this.pausedByLevelUp = true;

    // Emit level-up with memory options for HUDScene
    this.eventEmitter.emit('level-up', { level: result.newLevel, memories: available } as MemoryLevelUpPayload);
  }

  /** Handle upgrade selection from HUDScene */
  private handleUpgradeSelected(upgradeId: string): void {
    if (this.state.status !== 'choosing') return;

    // Verify the selection is one of the shown memories
    const selectedMemory = this.state.memories.find((m) => m.id === upgradeId);
    if (!selectedMemory) return;

    // Find the actual memory object in our state (to mutate level)
    const memoryRef = this.memories.find((m) => m.id === selectedMemory.id);
    if (!memoryRef) return;

    // Build UpgradeContext (BUG-008)
    const context: UpgradeContext = {
      player: this.player,
      weaponSystem: this.weaponSystem,
    };

    try {
      // Apply the memory effect
      applyMemoryUpgrade(memoryRef, context);
      // Increment level only on success
      memoryRef.level++;
    } catch (err) {
      // Error: do NOT increment level, do NOT modify availability
      console.error('[LevelUpCoordinator] Error applying memory upgrade:', err);
    } finally {
      // Close session
      this.state = { status: 'idle' };

      // Resume only if we paused — always resume even on error
      if (this.pausedByLevelUp) {
        this.pauseController.resume();
        this.pausedByLevelUp = false;
      }
    }
  }

  /** Get current flow state (for testing) */
  getState(): LevelUpFlowState {
    return this.state;
  }

  /** Get memories (for testing) */
  getMemories(): readonly MemoryUpgrade[] {
    return this.memories;
  }

  /** Get a specific memory by id (for testing) */
  getMemory(id: MemoryId): MemoryUpgrade | undefined {
    return this.memories.find((m) => m.id === id);
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
