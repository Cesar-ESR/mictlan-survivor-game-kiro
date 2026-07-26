import { describe, it, expect } from 'vitest';
import {
  getMemoryNarrative,
  getMemoryFragment,
  hasNarrativeContent,
  createInitialUnlockedFragments,
  unlockFragment,
  isFragmentUnlocked,
  getUnlockedFragments,
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

function createFakeWeaponSystem(): WeaponSystemUpgradeAPI {
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
  };
}

function createCoordinator() {
  const memories = createInitialMemories();
  const pauseCtrl = createFakePauseController();
  const emitter = createFakeEventEmitter();
  const fakeWeapon = createFakeWeaponSystem();
  const fakePlayer = { hp: 100, maxHp: 100, speed: 200, increaseSpeed() {} };
  const coordinator = new LevelUpCoordinator(memories, pauseCtrl, emitter, fakePlayer, fakeWeapon);
  return { memories, pauseCtrl, emitter, fakeWeapon, fakePlayer, coordinator };
}

function selectMemoryNTimes(
  coordinator: LevelUpCoordinator,
  emitter: ReturnType<typeof createFakeEventEmitter>,
  memoryId: string,
  times: number,
): void {
  for (let i = 0; i < times; i++) {
    coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 + i });
    emitter.trigger('upgrade-selected', { upgradeId: memoryId });
    if (coordinator.getState().status === 'showing-fragment') {
      emitter.trigger('memory-fragment-closed');
    }
  }
}


// --- Expected texts ---
const FAMILIA_TEXTS = [
  'Escucho una risa pequeña. Dos niños corren hacia mí, pero sus rostros desaparecen cuando intento mirarlos.',
  'El fuego ilumina unas manos preparando alimento. Conozco esas manos… alguna vez las sostuve entre las mías.',
  'Una voz me pide que me siente junto a ellos. Por un momento, el peso de la guerra desaparece de mis hombros.',
  'Mi compañera acomoda mi máscara antes de una batalla. Sus labios se mueven: “Regresa conmigo”.',
  'Recuerdo haber prometido que volvería. Lo dije sonriendo, como si la muerte nunca pudiera encontrarme.',
  'Sus rostros se desvanecen entre las llamas. Extiendo la mano, pero solo alcanzo a escuchar: “Te esperamos”.',
];

describe('CHANGE-003: Familia Narrative — Voces junto al fuego', () => {
  describe('Narrative Data Integrity', () => {
    it('1. Familia contains exactly 6 fragments', () => {
      const narrative = getMemoryNarrative('memory-family');
      expect(narrative.fragments).toHaveLength(6);
    });

    it('2. Title is Recuerdo II — Voces junto al fuego', () => {
      const narrative = getMemoryNarrative('memory-family');
      expect(narrative.title).toBe('Recuerdo II — Voces junto al fuego');
    });

    it('3. Fragment levels are exactly 1, 2, 3, 4, 5, 6', () => {
      const narrative = getMemoryNarrative('memory-family');
      const levels = narrative.fragments.map((f) => f.level);
      expect(levels).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('4. No duplicate levels exist', () => {
      const narrative = getMemoryNarrative('memory-family');
      const levels = narrative.fragments.map((f) => f.level);
      const unique = new Set(levels);
      expect(unique.size).toBe(levels.length);
    });

    it('5. Fragment 1 corresponds to level 1', () => {
      const fragment = getMemoryFragment('memory-family', 1);
      expect(fragment).not.toBeNull();
      expect(fragment!.level).toBe(1);
    });

    it('6. Fragment 6 corresponds to level 6', () => {
      const fragment = getMemoryFragment('memory-family', 6);
      expect(fragment).not.toBeNull();
      expect(fragment!.level).toBe(6);
    });

    it('7. All 6 texts match exactly', () => {
      for (let i = 0; i < 6; i++) {
        const fragment = getMemoryFragment('memory-family', i + 1);
        expect(fragment).not.toBeNull();
        expect(fragment!.text).toBe(FAMILIA_TEXTS[i]);
      }
    });

    it('8. Level 0 returns null', () => {
      expect(getMemoryFragment('memory-family', 0)).toBeNull();
    });

    it('9. Level 7 returns null', () => {
      expect(getMemoryFragment('memory-family', 7)).toBeNull();
    });
  });


  describe('Fragment Unlock Mechanics', () => {
    it('10. Successful selection unlocks the corresponding fragment', () => {
      const { coordinator, emitter } = createCoordinator();
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-family' });
      const unlocked = coordinator.getUnlockedFragments();
      expect(unlocked['memory-family']).toContain(1);
      coordinator.destroy();
    });

    it('11. Error in mechanical effect does not unlock fragment', () => {
      const memories = createInitialMemories();
      const pauseCtrl = createFakePauseController();
      const emitter = createFakeEventEmitter();
      const fakePlayer = { hp: 100, maxHp: 100, speed: 200, increaseSpeed() {} };
      // Create a weapon system that throws on increaseDamage
      const brokenWeapon: WeaponSystemUpgradeAPI = {
        getDamage: () => 10,
        increaseDamage: () => { throw new Error('weapon error'); },
        getFireRateMs: () => 1000,
        reduceFireRate: () => {},
        getRange: () => 384,
        increaseRange: () => {},
        getProjectileSpeed: () => 600,
        increaseProjectileSpeed: () => {},
        getMaxDistance: () => 450,
        increaseMaxDistance: () => {},
      };
      const coordinator = new LevelUpCoordinator(memories, pauseCtrl, emitter, fakePlayer, brokenWeapon);
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      // Select Guerra (which uses increaseDamage - it will throw)
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-war' });
      const unlocked = coordinator.getUnlockedFragments();
      expect(unlocked['memory-war']).toHaveLength(0);
      coordinator.destroy();
    });

    it('12. Same fragment cannot be registered twice', () => {
      const state = createInitialUnlockedFragments();
      const first = unlockFragment(state, 'memory-family', 1);
      const second = unlockFragment(state, 'memory-family', 1);
      expect(first).toBe(true);
      expect(second).toBe(false);
      expect(state['memory-family'].filter((l) => l === 1)).toHaveLength(1);
    });
  });

  describe('Fragment Panel Display', () => {
    it('13. Panel shows the correct title', () => {
      const { coordinator, emitter } = createCoordinator();
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-family' });
      const fragmentEvents = emitter.emitted.filter((e) => e.event === 'memory-fragment-show');
      const payload = fragmentEvents[0].args[0] as MemoryFragmentPayload;
      expect(payload.title).toBe('Recuerdo II — Voces junto al fuego');
      coordinator.destroy();
    });

    it('14. Panel shows Fragmento X de 6 (fragmentNumber matches level)', () => {
      const { coordinator, emitter } = createCoordinator();
      // Select Familia twice to get fragment 2
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-family' });
      emitter.trigger('memory-fragment-closed');

      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 3 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-family' });
      const fragmentEvents = emitter.emitted.filter((e) => e.event === 'memory-fragment-show');
      const payload = fragmentEvents[1].args[0] as MemoryFragmentPayload;
      expect(payload.fragmentNumber).toBe(2);
      expect(payload.totalFragments).toBe(6);
      coordinator.destroy();
    });

    it('15. Game stays paused during showing-fragment', () => {
      const { coordinator, emitter, pauseCtrl } = createCoordinator();
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-family' });
      expect(pauseCtrl.isPaused).toBe(true);
      expect(pauseCtrl.resumeCount).toBe(0);
      expect(coordinator.getState().status).toBe('showing-fragment');
      coordinator.destroy();
    });

    it('16. Continuar resumes exactly once', () => {
      const { coordinator, emitter, pauseCtrl } = createCoordinator();
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-family' });
      emitter.trigger('memory-fragment-closed');
      expect(pauseCtrl.resumeCount).toBe(1);
      expect(pauseCtrl.isPaused).toBe(false);
      expect(coordinator.getState().status).toBe('idle');
      coordinator.destroy();
    });

    it('17. Double click does not duplicate effects or levels', () => {
      const { coordinator, emitter, pauseCtrl } = createCoordinator();
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-family' });
      // Double close
      emitter.trigger('memory-fragment-closed');
      emitter.trigger('memory-fragment-closed');
      expect(pauseCtrl.resumeCount).toBe(1);
      // Memory level should be 1, not 2
      const mem = coordinator.getMemory('memory-family');
      expect(mem!.level).toBe(1);
      coordinator.destroy();
    });
  });


  describe('Progression and Maximization', () => {
    it('18. Level 6 makes Familia maximized', () => {
      const { coordinator, emitter } = createCoordinator();
      selectMemoryNTimes(coordinator, emitter, 'memory-family', 6);
      const mem = coordinator.getMemory('memory-family');
      expect(mem!.level).toBe(6);
      expect(mem!.level).toBe(mem!.maxLevel);
      coordinator.destroy();
    });

    it('19. Maximized Familia stops being offered', () => {
      const { coordinator, emitter } = createCoordinator();
      selectMemoryNTimes(coordinator, emitter, 'memory-family', 6);
      // Now try level up - Familia should not be in available memories
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 10 });
      const levelUpEvents = emitter.emitted.filter((e) => e.event === 'level-up');
      const lastPayload = levelUpEvents[levelUpEvents.length - 1].args[0] as { memories: Array<{ id: string }> };
      const familiaInOptions = lastPayload.memories.some((m) => m.id === 'memory-family');
      expect(familiaInOptions).toBe(false);
      coordinator.destroy();
    });
  });

  describe('Isolation and Coexistence', () => {
    it('20. Guerra still has its 6 fragments intact', () => {
      const narrative = getMemoryNarrative('memory-war');
      expect(narrative.fragments).toHaveLength(6);
      expect(narrative.title).toBe('Recuerdo I — Ecos de la guerra');
      const frag1 = getMemoryFragment('memory-war', 1);
      expect(frag1).not.toBeNull();
      expect(frag1!.text).toContain('Tambores');
    });

    it('21. Hogar DOES show fragment panel (has content now)', () => {
      const { coordinator, emitter, pauseCtrl } = createCoordinator();
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-home' });
      const fragmentEvents = emitter.emitted.filter((e) => e.event === 'memory-fragment-show');
      expect(fragmentEvents).toHaveLength(1);
      const payload = fragmentEvents[0].args[0] as { memoryId: string; title: string };
      expect(payload.memoryId).toBe('memory-home');
      expect(payload.title).toBe('Recuerdo III — El camino a casa');
      expect(coordinator.getState().status).toBe('showing-fragment');
      expect(pauseCtrl.resumeCount).toBe(0);
      emitter.trigger('memory-fragment-closed');
      expect(pauseCtrl.resumeCount).toBe(1);
      expect(coordinator.getState().status).toBe('idle');
      coordinator.destroy();
    });
  });

  describe('Session and State Reset', () => {
    it('22. Retry clears Familia fragments', () => {
      // Session 1: unlock some fragments
      const { coordinator, emitter } = createCoordinator();
      selectMemoryNTimes(coordinator, emitter, 'memory-family', 3);
      const unlocked1 = coordinator.getUnlockedFragments();
      expect(unlocked1['memory-family']).toHaveLength(3);
      coordinator.destroy();

      // Session 2: fresh state
      const session2 = createCoordinator();
      const unlocked2 = session2.coordinator.getUnlockedFragments();
      expect(unlocked2['memory-family']).toHaveLength(0);
      session2.coordinator.destroy();
    });

    it('23. Two sessions don’t share progress', () => {
      const session1 = createCoordinator();
      selectMemoryNTimes(session1.coordinator, session1.emitter, 'memory-family', 2);
      const mem1 = session1.coordinator.getMemory('memory-family');
      expect(mem1!.level).toBe(2);
      session1.coordinator.destroy();

      const session2 = createCoordinator();
      const mem2 = session2.coordinator.getMemory('memory-family');
      expect(mem2!.level).toBe(0);
      session2.coordinator.destroy();
    });
  });

  describe('Regression: Previous Changes Still Work', () => {
    it('24. CHANGE-001 continues functioning (memories exist, effects work)', () => {
      const memories = createInitialMemories();
      expect(memories).toHaveLength(3);
      expect(memories[0].id).toBe('memory-war');
      expect(memories[1].id).toBe('memory-family');
      expect(memories[2].id).toBe('memory-home');
      // Familia effect: max-hp +40, heal +50
      expect(memories[1].effect).toEqual({ type: 'max-hp', amount: 40, healAmount: 50 });
    });

    it('25. CHANGE-002 continues functioning (Guerra narrative works)', () => {
      const { coordinator, emitter } = createCoordinator();
      coordinator.processLevelUp({ leveledUp: true, showPanel: true, newLevel: 2 });
      emitter.trigger('upgrade-selected', { upgradeId: 'memory-war' });
      const fragmentEvents = emitter.emitted.filter((e) => e.event === 'memory-fragment-show');
      expect(fragmentEvents).toHaveLength(1);
      const payload = fragmentEvents[0].args[0] as MemoryFragmentPayload;
      expect(payload.memoryId).toBe('memory-war');
      expect(payload.title).toBe('Recuerdo I — Ecos de la guerra');
      expect(payload.text).toContain('Tambores');
      coordinator.destroy();
    });

    it('26. Previous suite still passes (import and validate)', () => {
      // Validate that all narrative functions remain accessible and correct
      expect(hasNarrativeContent('memory-war')).toBe(true);
      expect(hasNarrativeContent('memory-family')).toBe(true);
      expect(hasNarrativeContent('memory-home')).toBe(true);
      expect(getMemoryFragment('memory-war', 1)).not.toBeNull();
      expect(getMemoryFragment('memory-family', 1)).not.toBeNull();
      expect(getMemoryFragment('memory-home', 1)).not.toBeNull();
      // Unlock state functions work
      const state = createInitialUnlockedFragments();
      expect(unlockFragment(state, 'memory-family', 1)).toBe(true);
      expect(isFragmentUnlocked(state, 'memory-family', 1)).toBe(true);
      expect(getUnlockedFragments(state, 'memory-family')).toContain(1);
    });
  });
});
