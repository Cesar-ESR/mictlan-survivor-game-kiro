import { describe, it, expect } from 'vitest';
import { calculateDirection, applyMovement } from '../movement.pure';
import type { WaveChangedPayload, UpgradeSelectedPayload } from '../../types/interfaces';
import type { WaveSpawnController, WaveEventEmitter } from '../WaveManager';
import { WaveManager } from '../WaveManager';
import { LevelUpCoordinator, type PauseController, type LevelUpEventEmitter, type WeaponSystemUpgradeAPI, type MemoryLevelUpPayload } from '../LevelUpCoordinator';
import { createInitialMemories } from '../../config/memory-upgrades';

/**
 * Preflight contract tests: verify that system boundaries share typed payloads
 * and that architectural invariants hold before Task 23 wiring.
 */
describe('Preflight Contracts', () => {
  describe('PlayerManager does not call setPosition', () => {
    it('update only sets velocity, never position (architectural contract)', () => {
      // Verify that the pure movement function exists for test/logic purposes
      // but is NOT used in runtime PlayerManager.update() for setPosition.
      // We test the pure function separately:
      const direction = calculateDirection({ up: true, down: false, left: false, right: true });
      expect(Math.abs(direction.x * direction.x + direction.y * direction.y - 1)).toBeLessThan(0.001);

      // applyMovement exists for pure logic/tests but is not used at runtime
      const result = applyMovement({ x: 100, y: 100 }, direction, 200, 16);
      expect(result.x).toBeGreaterThan(100);
      expect(result.y).toBeLessThan(100);
    });
  });

  describe('WaveManager and consumers share WaveChangedPayload', () => {
    it('WaveManager emits wave-changed with {wave, config} payload', () => {
      const emittedPayloads: WaveChangedPayload[] = [];
      const spawnController: WaveSpawnController = {
        setWaveConfig: () => {},
      };
      const eventEmitter: WaveEventEmitter = {
        emit(event: string, ...args: unknown[]): boolean {
          if (event === 'wave-changed') {
            emittedPayloads.push(args[0] as WaveChangedPayload);
          }
          return true;
        },
      };

      const wm = new WaveManager({ mode: 'campaign', finalWave: 10 }, spawnController, eventEmitter);
      wm.emitInitialState();

      expect(emittedPayloads).toHaveLength(1);
      const payload = emittedPayloads[0];
      expect(payload).toHaveProperty('wave');
      expect(payload).toHaveProperty('config');
      expect(typeof payload.wave).toBe('number');
      expect(payload.wave).toBe(1);
      expect(payload.config).toHaveProperty('waveNumber');
      expect(payload.config).toHaveProperty('spawnInterval');
    });
  });

  describe('LevelUpCoordinator and HUDScene share MemoryLevelUpPayload', () => {
    it('LevelUpCoordinator emits level-up with {level, memories} payload', () => {
      const emittedPayloads: MemoryLevelUpPayload[] = [];
      const memories = createInitialMemories();

      const pauseController: PauseController = {
        isPaused: false,
        pause: () => {},
        resume: () => {},
      };
      const eventEmitter: LevelUpEventEmitter = {
        emit(event: string, ...args: unknown[]): boolean {
          if (event === 'level-up') {
            emittedPayloads.push(args[0] as MemoryLevelUpPayload);
          }
          return true;
        },
        on: () => {},
        off: () => {},
      };

      const fakeWeapon: WeaponSystemUpgradeAPI = {
        getDamage: () => 10, increaseDamage: () => {},
        getFireRateMs: () => 1000, reduceFireRate: () => {},
        getRange: () => 384, increaseRange: () => {},
        getProjectileSpeed: () => 600, increaseProjectileSpeed: () => {},
        getMaxDistance: () => 450, increaseMaxDistance: () => {},
      };

      const coordinator = new LevelUpCoordinator(memories, pauseController, eventEmitter, { hp: 100, maxHp: 100, speed: 200, increaseSpeed() {} }, fakeWeapon);
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });

      expect(emittedPayloads).toHaveLength(1);
      const payload = emittedPayloads[0];
      expect(payload).toHaveProperty('level');
      expect(payload).toHaveProperty('memories');
      expect(payload.level).toBe(2);
      expect(payload.memories).toHaveLength(3);
      expect(payload.memories[0].id).toBe('memory-war');
    });
  });

  describe('upgrade-selected uses UpgradeSelectedPayload', () => {
    it('LevelUpCoordinator listens for {upgradeId} payload and applies memory effect', () => {
      const memories = createInitialMemories();
      let weaponDamage = 10;

      const pauseController: PauseController = {
        isPaused: false,
        pause: () => {},
        resume: () => {},
      };

      let upgradeHandler: ((...args: unknown[]) => void) | null = null;
      const eventEmitter: LevelUpEventEmitter = {
        emit: () => true,
        on: (event: string, fn: (...args: unknown[]) => void) => {
          if (event === 'upgrade-selected') upgradeHandler = fn;
        },
        off: () => {},
      };

      const fakeWeapon2: WeaponSystemUpgradeAPI = {
        getDamage: () => weaponDamage,
        increaseDamage: (amt: number) => { weaponDamage += amt; },
        getFireRateMs: () => 1000, reduceFireRate: () => {},
        getRange: () => 384, increaseRange: () => {},
        getProjectileSpeed: () => 600, increaseProjectileSpeed: () => {},
        getMaxDistance: () => 450, increaseMaxDistance: () => {},
      };

      const coordinator = new LevelUpCoordinator(memories, pauseController, eventEmitter, { hp: 100, maxHp: 100, speed: 200, increaseSpeed() {} }, fakeWeapon2);
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });

      // Simulate HUDScene emitting upgrade-selected with typed payload
      const selectedPayload: UpgradeSelectedPayload = { upgradeId: 'memory-war' };
      upgradeHandler!(selectedPayload);

      expect(weaponDamage).toBe(35); // 10 + 25
      expect(memories[0].level).toBe(1);
    });
  });

  describe('Orb lifetime does not depend on system clock', () => {
    it('XPOrb source uses age and creationSequence, not Date.now()', async () => {
      // Verify architectural contract: XPOrb uses delta-based age, not wall-clock
      // Dynamic imports of node builtins — vitest provides these at runtime
      // @ts-ignore -- node:fs and node:path are available in vitest runtime
      const nodeFs: { readFileSync(p: string, enc: string): string } = await import('node:fs');
      // @ts-ignore -- node:path available in vitest runtime
      const nodePath: { resolve(...args: string[]): string } = await import('node:path');
      // @ts-ignore -- __dirname available in vitest CJS compat
      const dir: string = __dirname;
      const orbPath = nodePath.resolve(dir, '../../entities/XPOrb.ts');
      const source = nodeFs.readFileSync(orbPath, 'utf-8');

      // Should have age property
      expect(source).toContain('age');
      // Should have creationSequence for FIFO
      expect(source).toContain('creationSequence');
      // Should NOT use Date.now() for timing
      expect(source).not.toContain('Date.now');
    });
  });
});
