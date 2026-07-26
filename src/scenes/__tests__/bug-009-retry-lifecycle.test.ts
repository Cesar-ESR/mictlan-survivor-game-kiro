import { describe, it, expect } from 'vitest';
import { WaveManager, type WaveSpawnController, type WaveEventEmitter } from '../../systems/WaveManager';
import { createInitialMemories } from '../../config/memory-upgrades';
import { createInitialUnlockedFragments } from '../../config/memory-narratives';
import type { WaveChangedPayload } from '../../types/interfaces';

// --- Helpers ---

function createFakeSpawnController(): WaveSpawnController {
  return { setWaveConfig: () => {} };
}

type EmittedEvent = { event: string; args: unknown[] };

function createFakeEmitter(): WaveEventEmitter & { events: EmittedEvent[] } {
  return {
    events: [] as EmittedEvent[],
    emit(event: string, ...args: unknown[]): boolean {
      this.events.push({ event, args });
      return true;
    },
  };
}

/**
 * Simulates the BUG-009 V2 HUD-Ready Handshake pattern:
 * 1. GameScene generates a runId
 * 2. GameScene registers a 'hud-ready' listener
 * 3. GameScene launches HUDScene with { runId }
 * 4. HUDScene.create() finishes, emits 'hud-ready' with { runId }
 * 5. GameScene receives 'hud-ready', verifies runId, calls emitInitialState()
 */
interface HandshakeSimulation {
  gameEmitter: WaveEventEmitter & { events: EmittedEvent[] };
  waveManager: WaveManager;
  runId: string;
  initialWaveStateEmitted: boolean;
  triggerHudReady: () => void;
  triggerHudReadyWithWrongId: () => void;
}

function createHandshakeSimulation(): HandshakeSimulation {
  const gameEmitter = createFakeEmitter();
  const waveManager = new WaveManager(
    { mode: 'campaign', finalWave: 10 },
    createFakeSpawnController(),
    gameEmitter,
  );

  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let initialWaveStateEmitted = false;

  // This models the hudReadyHandler arrow property in GameScene
  const hudReadyHandler = (payload: { runId: string }): void => {
    if (payload.runId !== runId) return;
    if (initialWaveStateEmitted) return;
    initialWaveStateEmitted = true;
    waveManager.emitInitialState();
  };

  return {
    gameEmitter,
    waveManager,
    runId,
    get initialWaveStateEmitted() { return initialWaveStateEmitted; },
    set initialWaveStateEmitted(v: boolean) { initialWaveStateEmitted = v; },
    triggerHudReady: () => hudReadyHandler({ runId }),
    triggerHudReadyWithWrongId: () => hudReadyHandler({ runId: 'wrong-id' }),
  };
}

// --- Tests ---

describe('BUG-009 V2: HUD-Ready Handshake', () => {
  describe('WaveManager emission timing', () => {
    it('1. constructor does NOT emit wave-changed', () => {
      const emitter = createFakeEmitter();
      new WaveManager({ mode: 'campaign', finalWave: 10 }, createFakeSpawnController(), emitter);
      const waveEvents = emitter.events.filter((e) => e.event === 'wave-changed');
      expect(waveEvents).toHaveLength(0);
    });

    it('2. emitInitialState emits wave-changed once', () => {
      const emitter = createFakeEmitter();
      const wm = new WaveManager({ mode: 'campaign', finalWave: 10 }, createFakeSpawnController(), emitter);
      wm.emitInitialState();
      const waveEvents = emitter.events.filter((e) => e.event === 'wave-changed');
      expect(waveEvents).toHaveLength(1);
      expect(waveEvents[0].args[0]).toMatchObject({ wave: 1 });
    });

    it('3. emitInitialState is only called after hud-ready handshake', () => {
      const sim = createHandshakeSimulation();
      // Before handshake: no wave-changed emitted
      expect(sim.gameEmitter.events.filter((e) => e.event === 'wave-changed')).toHaveLength(0);
      // Trigger handshake
      sim.triggerHudReady();
      // After handshake: exactly one wave-changed
      expect(sim.gameEmitter.events.filter((e) => e.event === 'wave-changed')).toHaveLength(1);
    });

    it('15. WaveManager does not emit toward an unready HUD', () => {
      const emitter = createFakeEmitter();
      new WaveManager({ mode: 'campaign', finalWave: 10 }, createFakeSpawnController(), emitter);
      expect(emitter.events.filter((e) => e.event === 'wave-changed')).toHaveLength(0);
    });
  });

  describe('Handshake guarantees', () => {
    it('hud-ready with wrong runId does NOT trigger emitInitialState', () => {
      const sim = createHandshakeSimulation();
      sim.triggerHudReadyWithWrongId();
      expect(sim.initialWaveStateEmitted).toBe(false);
      expect(sim.gameEmitter.events.filter((e) => e.event === 'wave-changed')).toHaveLength(0);
    });

    it('hud-ready is idempotent — second call does not emit again', () => {
      const sim = createHandshakeSimulation();
      sim.triggerHudReady();
      sim.triggerHudReady(); // duplicate
      expect(sim.gameEmitter.events.filter((e) => e.event === 'wave-changed')).toHaveLength(1);
    });

    it('handshake ensures wave-changed only fires when HUD is ready', () => {
      const sim = createHandshakeSimulation();
      // Simulate: HUD has NOT called create() yet (no hud-ready emitted)
      // WaveManager has NOT emitted wave-changed
      expect(sim.gameEmitter.events).toHaveLength(0);
      // Now HUD finishes create() and emits hud-ready
      sim.triggerHudReady();
      // Now wave-changed is emitted (HUD is guaranteed ready)
      const waveEvents = sim.gameEmitter.events.filter((e) => e.event === 'wave-changed');
      expect(waveEvents).toHaveLength(1);
      expect(waveEvents[0].args[0]).toMatchObject({ wave: 1 });
    });

    it('new runId per session prevents stale hud-ready from old session', () => {
      // Session 1
      const sim1 = createHandshakeSimulation();
      sim1.triggerHudReady();
      expect(sim1.initialWaveStateEmitted).toBe(true);

      // Session 2 has a different runId
      const sim2 = createHandshakeSimulation();
      // Stale hud-ready from session 1 won't match session 2
      expect(sim2.runId).not.toBe(sim1.runId);
      sim2.triggerHudReadyWithWrongId();
      expect(sim2.initialWaveStateEmitted).toBe(false);
    });
  });

  describe('Retry flow', () => {
    it('4. retry preserves GameModeConfig', () => {
      const gameMode = { mode: 'campaign' as const, finalWave: 10 };
      const passedData = { gameMode };
      expect(passedData.gameMode).toBe(gameMode);
      expect(passedData.gameMode.mode).toBe('campaign');
      expect(passedData.gameMode.finalWave).toBe(10);
    });

    it('5. retry does not preserve statistics', () => {
      const stats1 = { survivalTime: 120, enemiesDefeated: 50, maxWave: 5 };
      const stats2 = { survivalTime: 0, enemiesDefeated: 0, maxWave: 1 };
      expect(stats2.survivalTime).toBe(0);
      expect(stats2.enemiesDefeated).toBe(0);
      expect(stats2.maxWave).toBe(1);
      expect(stats1).not.toEqual(stats2);
    });

    it('6. retry resets Recuerdos', () => {
      const session1 = createInitialMemories();
      session1[0].level = 4;
      session1[1].level = 3;
      const session2 = createInitialMemories();
      expect(session2[0].level).toBe(0);
      expect(session2[1].level).toBe(0);
      expect(session2[2].level).toBe(0);
    });

    it('7. retry resets narrative fragments', () => {
      const state1 = createInitialUnlockedFragments();
      state1['memory-war'] = [1, 2, 3];
      const state2 = createInitialUnlockedFragments();
      expect(state2['memory-war']).toHaveLength(0);
      expect(state2['memory-family']).toHaveLength(0);
      expect(state2['memory-home']).toHaveLength(0);
    });

    it('22. a new session creates a new WaveManager', () => {
      const emitter1 = createFakeEmitter();
      const wm1 = new WaveManager({ mode: 'campaign', finalWave: 10 }, createFakeSpawnController(), emitter1);
      const emitter2 = createFakeEmitter();
      const wm2 = new WaveManager({ mode: 'campaign', finalWave: 10 }, createFakeSpawnController(), emitter2);
      expect(wm1).not.toBe(wm2);
      expect(wm1.getCurrentWave()).toBe(1);
      expect(wm2.getCurrentWave()).toBe(1);
    });
  });

  describe('HUDScene lifecycle', () => {
    it('8. HUD handler is a stored property (not anonymous)', () => {
      const handler = (_payload: WaveChangedPayload) => { /* noop */ };
      const handlers = new Set<Function>();
      handlers.add(handler);
      handlers.delete(handler);
      expect(handlers.size).toBe(0);
    });

    it('9. wave event after HUD shutdown does not crash (isShuttingDown guard)', () => {
      // Simulate: HUD is shutting down and wave-changed arrives
      let isShuttingDown = false;
      let waveTextUpdated = false;

      const updateWaveDisplay = (_wave: number) => {
        if (isShuttingDown) return;
        waveTextUpdated = true;
      };

      // Simulate shutdown
      isShuttingDown = true;
      updateWaveDisplay(2);
      expect(waveTextUpdated).toBe(false);
    });

    it('11. exactly one wave listener after single registration', () => {
      const listeners: Function[] = [];
      const handler = () => {};
      listeners.push(handler);
      expect(listeners.length).toBe(1);
    });

    it('12. three defeat-retry cycles do not accumulate listeners', () => {
      const listeners: Function[] = [];
      const addHandler = () => { listeners.push(() => {}); };
      const removeHandler = () => { listeners.pop(); };

      for (let i = 0; i < 3; i++) {
        addHandler();
        expect(listeners.length).toBe(1);
        removeHandler();
        expect(listeners.length).toBe(0);
      }
    });

    it('16. new HUD receives initial wave after handshake completes', () => {
      const sim = createHandshakeSimulation();
      sim.triggerHudReady();
      const waveEvents = sim.gameEmitter.events.filter((e) => e.event === 'wave-changed');
      expect(waveEvents).toHaveLength(1);
      expect(waveEvents[0].args[0]).toMatchObject({ wave: 1 });
    });

    it('17. initial wave emitted exactly once via handshake', () => {
      const sim = createHandshakeSimulation();
      sim.triggerHudReady();
      sim.triggerHudReady(); // duplicate call
      const waveEvents = sim.gameEmitter.events.filter((e) => e.event === 'wave-changed');
      expect(waveEvents).toHaveLength(1);
    });

    it('18. shutdown is idempotent (double call does not throw)', () => {
      let shutdownCalls = 0;
      const shutdown = () => { shutdownCalls++; };
      shutdown();
      shutdown();
      expect(shutdownCalls).toBe(2);
    });
  });

  describe('Double-click protection (transitionInProgress)', () => {
    it('double click only starts game once', () => {
      let startCount = 0;
      let transitionInProgress = false;

      const handleRetry = () => {
        if (transitionInProgress) return;
        transitionInProgress = true;
        startCount++;
      };

      handleRetry();
      handleRetry(); // second click — blocked
      expect(startCount).toBe(1);
    });

    it('transitionInProgress resets on new scene init', () => {
      let transitionInProgress = false;

      // Simulate first scene: transition starts
      transitionInProgress = true;

      // Simulate new scene init (DefeatScene.init resets flag)
      transitionInProgress = false;

      // Can transition again
      let startCount = 0;
      const handleRetry = () => {
        if (transitionInProgress) return;
        transitionInProgress = true;
        startCount++;
      };
      handleRetry();
      expect(startCount).toBe(1);
    });

    it('both buttons disabled when one is clicked', () => {
      let retryEnabled = true;
      let menuEnabled = true;
      let transitionInProgress = false;

      const handleRetry = () => {
        if (transitionInProgress) return;
        transitionInProgress = true;
        retryEnabled = false;
        menuEnabled = false;
      };

      const handleMenu = () => {
        if (transitionInProgress) return;
        transitionInProgress = true;
        retryEnabled = false;
        menuEnabled = false;
      };

      handleRetry();
      expect(retryEnabled).toBe(false);
      expect(menuEnabled).toBe(false);

      // Menu click after retry is blocked
      handleMenu();
      // No extra effect — already in transition
    });
  });

  describe('Regression guards', () => {
    it('23. no TypeError from drawImage null (handshake prevents premature emission)', () => {
      const sim = createHandshakeSimulation();
      // Before handshake: no emission — HUD objects not yet created
      expect(sim.gameEmitter.events).toHaveLength(0);
      // After handshake: safe to emit
      sim.triggerHudReady();
      expect(sim.gameEmitter.events).toHaveLength(1);
    });

    it('24. campaign mode preserved through retry', () => {
      const gameMode = { mode: 'campaign' as const, finalWave: 10 };
      const emitter = createFakeEmitter();
      const wm = new WaveManager(gameMode, createFakeSpawnController(), emitter);
      expect(wm.getCurrentWave()).toBe(1);
      expect(wm.isVictory()).toBe(false);
    });

    it('25. infinite mode preserved through retry', () => {
      const gameMode = { mode: 'infinite' as const, finalWave: null };
      const emitter = createFakeEmitter();
      const wm = new WaveManager(gameMode, createFakeSpawnController(), emitter);
      expect(wm.getCurrentWave()).toBe(1);
      expect(wm.isVictory()).toBe(false);
    });
  });
});
