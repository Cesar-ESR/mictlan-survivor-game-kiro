import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialUnlockedFragments,
  unlockFragment,
  getMemoryNarrative,
  getMemoryFragment,
  hasNarrativeContent,
  type MemoryFragmentPayload,
} from '../../config/memory-narratives';
import { createInitialMemories } from '../../config/memory-upgrades';
import {
  LevelUpCoordinator,
  type PauseController,
  type LevelUpEventEmitter,
  type WeaponSystemUpgradeAPI,
} from '../LevelUpCoordinator';

// --- Helpers ---

function createFakePauseController(): PauseController & {
  pauseCount: number;
  resumeCount: number;
  isPaused: boolean;
} {
  const controller = {
    isPaused: false,
    pauseCount: 0,
    resumeCount: 0,
    pause(): void {
      controller.isPaused = true;
      controller.pauseCount++;
    },
    resume(): void {
      controller.isPaused = false;
      controller.resumeCount++;
    },
  };
  return controller;
}

type Listener = (...args: unknown[]) => void;

function createFakeEventEmitter(): LevelUpEventEmitter & {
  emitted: Array<{ event: string; args: unknown[] }>;
  trigger(event: string, ...args: unknown[]): void;
  listenerCount(event: string): number;
} {
  const listeners = new Map<string, Listener[]>();
  const emitter = {
    emitted: [] as Array<{ event: string; args: unknown[] }>,
    emit(event: string, ...args: unknown[]): boolean {
      emitter.emitted.push({ event, args });
      const fns = listeners.get(event) || [];
      fns.forEach((fn) => fn(...args));
      return fns.length > 0;
    },
    on(event: string, fn: Listener): unknown {
      const arr = listeners.get(event) || [];
      arr.push(fn);
      listeners.set(event, arr);
      return emitter;
    },
    off(event: string, fn: Listener): unknown {
      const arr = listeners.get(event) || [];
      listeners.set(event, arr.filter((f) => f !== fn));
      return emitter;
    },
    trigger(event: string, ...args: unknown[]): void {
      const fns = listeners.get(event) || [];
      fns.forEach((fn) => fn(...args));
    },
    listenerCount(event: string): number {
      return (listeners.get(event) || []).length;
    },
  };
  return emitter;
}

function createFakeWeaponSystem(): WeaponSystemUpgradeAPI & { getFireRateValue(): number } {
  let damage = 10;
  let fireRateMs = 1000;
  let range = 384;
  let projectileSpeed = 600;
  let maxDistance = 450;
  return {
    getDamage: () => damage,
    increaseDamage: (amount: number) => { damage += amount; },
    getFireRateMs: () => fireRateMs,
    reduceFireRate: (amountMs: number, minimumMs: number) => {
      fireRateMs = Math.max(fireRateMs - amountMs, minimumMs);
    },
    getRange: () => range,
    increaseRange: (amount: number) => { range += amount; },
    getProjectileSpeed: () => projectileSpeed,
    increaseProjectileSpeed: (amount: number) => { projectileSpeed += amount; },
    getMaxDistance: () => maxDistance,
    increaseMaxDistance: (amount: number) => { maxDistance += amount; },
    getFireRateValue: () => fireRateMs,
  };
}

// --- Exact texts for validation ---

const HOGAR_TEXTS = [
  'Un sendero de tierra aparece ante mí. Mis pies conocen el camino, aunque mi mente aún no lo ha olvidado.',
  'El viento mueve el maíz y trae consigo el aroma de las flores. Aquí… aquí podía descansar.',
  'Veo una pequeña casa bajo la luz del amanecer. Una sombra oscura espera junto a la entrada.',
  'Un xoloitzcuintle corre hacia mí. Sus patas levantan polvo y su cola se mueve al reconocerme.',
  'Recuerdo acariciar su cabeza antes de partir. Le pedí que protegiera el hogar hasta que yo regresara.',
  'Ahora camina conmigo por el Mictlán. Tal vez nunca dejó de esperarme… tal vez vino para llevarme finalmente a casa.',
];

// --- Tests ---

describe('CHANGE-004: Hogar Narrative — El camino a casa', () => {
  describe('Narrative Data', () => {
    it('1. Hogar contains exactly six fragments', () => {
      const narrative = getMemoryNarrative('memory-home');
      expect(narrative.fragments).toHaveLength(6);
    });

    it('2. title is Recuerdo III — El camino a casa', () => {
      const narrative = getMemoryNarrative('memory-home');
      expect(narrative.title).toBe('Recuerdo III — El camino a casa');
    });

    it('3. levels are exactly 1, 2, 3, 4, 5 and 6', () => {
      const narrative = getMemoryNarrative('memory-home');
      const levels = narrative.fragments.map((f) => f.level);
      expect(levels).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('4. no duplicate levels', () => {
      const narrative = getMemoryNarrative('memory-home');
      const levels = narrative.fragments.map((f) => f.level);
      expect(new Set(levels).size).toBe(6);
    });

    it('5. fragment 1 corresponds to level 1', () => {
      const fragment = getMemoryFragment('memory-home', 1);
      expect(fragment).not.toBeNull();
      expect(fragment!.level).toBe(1);
      expect(fragment!.text).toBe(HOGAR_TEXTS[0]);
    });

    it('6. fragment 6 corresponds to level 6', () => {
      const fragment = getMemoryFragment('memory-home', 6);
      expect(fragment).not.toBeNull();
      expect(fragment!.level).toBe(6);
      expect(fragment!.text).toBe(HOGAR_TEXTS[5]);
    });

    it('7. all six texts match exactly', () => {
      for (let level = 1; level <= 6; level++) {
        const fragment = getMemoryFragment('memory-home', level);
        expect(fragment).not.toBeNull();
        expect(fragment!.text).toBe(HOGAR_TEXTS[level - 1]);
      }
    });

    it('8. level 0 returns null', () => {
      expect(getMemoryFragment('memory-home', 0)).toBeNull();
    });

    it('9. level 7 returns null', () => {
      expect(getMemoryFragment('memory-home', 7)).toBeNull();
    });
  });

  describe('LevelUpCoordinator Flow', () => {
    let memories: ReturnType<typeof createInitialMemories>;
    let pauseCtrl: ReturnType<typeof createFakePauseController>;
    let emitter: ReturnType<typeof createFakeEventEmitter>;
    let coordinator: LevelUpCoordinator;
    let fakeWeapon: ReturnType<typeof createFakeWeaponSystem>;
    const fakePlayer = { hp: 100, maxHp: 100, speed: 200, increaseSpeed() {} };

    beforeEach(() => {
      memories = createInitialMemories();
      pauseCtrl = createFakePauseController();
      emitter = createFakeEventEmitter();
      fakeWeapon = createFakeWeaponSystem();
      coordinator = new LevelUpCoordinator(memories, pauseCtrl, emitter, fakePlayer, fakeWeapon);
    });

    it('10. successful selection unlocks the corresponding fragment', () => {
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-home' });
      const unlocked = coordinator.getUnlockedFragments();
      expect(unlocked['memory-home']).toContain(1);
    });

    it('11. error does not unlock fragment', () => {
      const throwingWeapon: WeaponSystemUpgradeAPI = {
        getDamage: () => 10,
        increaseDamage: () => {},
        getFireRateMs: () => 1000,
        reduceFireRate: () => { throw new Error('simulated'); },
        getRange: () => 384,
        increaseRange: () => {},
        getProjectileSpeed: () => 600,
        increaseProjectileSpeed: () => {},
        getMaxDistance: () => 450,
        increaseMaxDistance: () => {},
      };
      const coord = new LevelUpCoordinator(memories, pauseCtrl, emitter, fakePlayer, throwingWeapon);
      coord.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-home' });
      const unlocked = coord.getUnlockedFragments();
      expect(unlocked['memory-home']).toHaveLength(0);
      coord.destroy();
    });

    it('12. same fragment is not registered twice', () => {
      const state = createInitialUnlockedFragments();
      unlockFragment(state, 'memory-home', 1);
      const result = unlockFragment(state, 'memory-home', 1);
      expect(result).toBe(false);
      expect(state['memory-home'].filter((l) => l === 1)).toHaveLength(1);
    });

    it('13. panel shows the correct title', () => {
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-home' });
      const events = emitter.emitted.filter((e) => e.event === 'memory-fragment-show');
      expect(events).toHaveLength(1);
      const payload = events[0].args[0] as MemoryFragmentPayload;
      expect(payload.title).toBe('Recuerdo III — El camino a casa');
    });

    it('14. panel shows Fragmento X de 6', () => {
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-home' });
      const events = emitter.emitted.filter((e) => e.event === 'memory-fragment-show');
      const payload = events[0].args[0] as MemoryFragmentPayload;
      expect(payload.fragmentNumber).toBe(1);
      expect(payload.totalFragments).toBe(6);
    });

    it('15. game stays paused during fragment reading', () => {
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-home' });
      expect(pauseCtrl.isPaused).toBe(true);
      expect(pauseCtrl.resumeCount).toBe(0);
      expect(coordinator.getState().status).toBe('showing-fragment');
    });

    it('16. Continuar resumes exactly once', () => {
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-home' });
      emitter.trigger('memory-fragment-closed');
      expect(pauseCtrl.resumeCount).toBe(1);
      expect(pauseCtrl.isPaused).toBe(false);
      // Second close does nothing
      emitter.trigger('memory-fragment-closed');
      expect(pauseCtrl.resumeCount).toBe(1);
    });

    it('17. double click does not duplicate effects or levels', () => {
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-home' });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-home' });
      expect(memories[2].level).toBe(1);
      expect(fakeWeapon.getFireRateValue()).toBe(900); // applied once
    });

    it('18. level 6 leaves Hogar maximized', () => {
      for (let i = 0; i < 6; i++) {
        coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 + i });
        emitter.trigger('upgrade-selected', { upgradeId: 'memory-home' });
        if (coordinator.getState().status === 'showing-fragment') {
          emitter.trigger('memory-fragment-closed');
        }
      }
      expect(memories[2].level).toBe(6);
    });

    it('19. Hogar maximized is excluded from options', () => {
      memories[2].level = 6;
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 8 });
      const levelUpEvents = emitter.emitted.filter((e) => e.event === 'level-up');
      if (levelUpEvents.length > 0) {
        const payload = levelUpEvents[0].args[0] as { memories: readonly { id: string }[] };
        const ids = payload.memories.map((m) => m.id);
        expect(ids).not.toContain('memory-home');
      }
    });

    it('20. Guerra preserves its six fragments intact', () => {
      const narrative = getMemoryNarrative('memory-war');
      expect(narrative.fragments).toHaveLength(6);
      expect(narrative.title).toBe('Recuerdo I — Ecos de la guerra');
      expect(hasNarrativeContent('memory-war')).toBe(true);
    });

    it('21. Familia preserves its six fragments intact', () => {
      const narrative = getMemoryNarrative('memory-family');
      expect(narrative.fragments).toHaveLength(6);
      expect(narrative.title).toBe('Recuerdo II — Voces junto al fuego');
      expect(hasNarrativeContent('memory-family')).toBe(true);
    });

    it('22. retry clears Hogar fragments', () => {
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-home' });
      const unlocked1 = coordinator.getUnlockedFragments();
      expect(unlocked1['memory-home']).toContain(1);
      coordinator.destroy();

      // New session
      const memories2 = createInitialMemories();
      const pauseCtrl2 = createFakePauseController();
      const emitter2 = createFakeEventEmitter();
      const weapon2 = createFakeWeaponSystem();
      const coord2 = new LevelUpCoordinator(memories2, pauseCtrl2, emitter2, fakePlayer, weapon2);
      const unlocked2 = coord2.getUnlockedFragments();
      expect(unlocked2['memory-home']).toHaveLength(0);
      coord2.destroy();
    });

    it('23. two sessions do not share progress', () => {
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-home' });

      const memories2 = createInitialMemories();
      const pauseCtrl2 = createFakePauseController();
      const emitter2 = createFakeEventEmitter();
      const weapon2 = createFakeWeaponSystem();
      const coord2 = new LevelUpCoordinator(memories2, pauseCtrl2, emitter2, fakePlayer, weapon2);
      expect(coord2.getUnlockedFragments()['memory-home']).toHaveLength(0);
      expect(memories2[2].level).toBe(0);
      coord2.destroy();
    });

    it('24. CHANGE-001 continues functioning (memories have correct config)', () => {
      const mems = createInitialMemories();
      expect(mems).toHaveLength(3);
      expect(mems[0].maxLevel).toBe(6);
      expect(mems[1].maxLevel).toBe(6);
      expect(mems[2].maxLevel).toBe(6);
      expect(mems[2].id).toBe('memory-home');
      expect(mems[2].effect.type).toBe('fire-rate');
    });

    it('25. CHANGE-002 continues functioning (all three have narrative content)', () => {
      expect(hasNarrativeContent('memory-war')).toBe(true);
      expect(hasNarrativeContent('memory-family')).toBe(true);
      expect(hasNarrativeContent('memory-home')).toBe(true);
    });

    it('26. full six-level Hogar progression works', () => {
      for (let i = 0; i < 6; i++) {
        coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 + i });
        emitter.trigger('upgrade-selected', { upgradeId: 'memory-home' });
        const events = emitter.emitted.filter((e) => e.event === 'memory-fragment-show');
        const lastEvent = events[events.length - 1];
        const payload = lastEvent.args[0] as MemoryFragmentPayload;
        expect(payload.fragmentNumber).toBe(i + 1);
        expect(payload.text).toBe(HOGAR_TEXTS[i]);
        emitter.trigger('memory-fragment-closed');
      }
      expect(memories[2].level).toBe(6);
      // Fire rate reduced 6 times: 1000 - 6*100 = 400, but minimum is 250
      expect(fakeWeapon.getFireRateValue()).toBe(400);
    });
  });
});
