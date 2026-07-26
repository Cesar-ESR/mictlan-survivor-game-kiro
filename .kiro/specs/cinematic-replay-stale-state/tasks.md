# Implementation Plan

## Overview

This task list implements the bugfix for CinematicScene stale state on replay. The bug causes CinematicScene to break on subsequent Story Mode launches because `isTransitioningToNext` remains permanently `true` after the first playthrough. The fix resets transient state in `init()`, registers `shutdown()` on Phaser's lifecycle event, and adds defensive cleanup in `shutdown()`.

## Tasks

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Stale isTransitioningToNext blocks scene reuse
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to a concrete sequence — call `transitionToNext()` on first run, then simulate a second `init()` call and assert state is reset
  - Create test file `src/scenes/__tests__/CinematicScene.staleState.test.ts`
  - Mock Phaser dependencies (Scene, Input, Camera, Events, Cache) minimally to instantiate CinematicScene
  - Test property: after a first run sets `isTransitioningToNext = true`, calling `init()` again SHALL reset `isTransitioningToNext` to `false`, `cinematicPlayer` to `null`, and `skipButton` to `null`
  - Use fast-check to generate arbitrary `CinematicSceneData` objects (`cinematicKey`, `nextScene`, `nextSceneData`) and verify the property holds for all generated inputs
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists because `init()` does not reset state)
  - Document counterexamples found (e.g., "after transitionToNext(), init({cinematicKey: 'x', nextScene: 'y'}) leaves isTransitioningToNext === true")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 2.1_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - First-launch cinematic behavior unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Create test in same file or adjacent `CinematicScene.preservation.test.ts`
  - Observe on UNFIXED code: on a fresh CinematicScene instance (never previously used), `init()` sets `sceneData` correctly, `isTransitioningToNext` remains `false`, `cinematicPlayer` is `null` before `create()`, and `create()` sets up the player and skip button
  - Write property-based test with fast-check: for all valid `CinematicSceneData` inputs on a fresh (first-launch) scene instance, `init(data)` correctly assigns `sceneData` and transient state starts clean (`isTransitioningToNext === false`)
  - Additionally test: `handleSkip()` calls `transitionToNext()` successfully when `isTransitioningToNext` is `false`
  - Verify tests pass on UNFIXED code (first-launch path is not affected by the bug)
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline first-launch behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. Fix for CinematicScene stale state on replay

  - [ ] 3.1 Reset transient state in `init()`
    - At the beginning of `init()`, before `this.sceneData = data`, add:
      - `this.isTransitioningToNext = false`
      - `this.cinematicPlayer = null`
      - `this.skipButton = null`
    - This ensures every `scene.start('CinematicScene', data)` produces a clean initial state
    - _Bug_Condition: isBugCondition(input) where input.isSecondOrLaterLaunch AND instance.isTransitioningToNext = true_
    - _Expected_Behavior: After init(), isTransitioningToNext = false, cinematicPlayer = null, skipButton = null_
    - _Preservation: First-launch behavior unchanged — these fields already start as false/null on fresh instances_
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.2 Register `shutdown()` on Phaser lifecycle event in `create()`
    - At the end of `create()`, add: `this.events.once('shutdown', this.shutdown, this)`
    - Uses `once` to prevent listener accumulation across multiple create cycles
    - Matches the pattern from GameScene's BUG-013 fix
    - _Bug_Condition: shutdown() never fires because it is not registered as a Phaser event handler_
    - _Expected_Behavior: When scene transitions away, shutdown() is called automatically by Phaser_
    - _Preservation: Does not affect first-run behavior — shutdown only fires when scene exits_
    - _Requirements: 2.3_

  - [ ] 3.3 Extend `shutdown()` with full cleanup
    - Add `this.isTransitioningToNext = false` (defensive reset)
    - Add removal of input listeners: `this.input.off('pointerdown', this.onAdvance, this)`
    - Add removal of keyboard listeners: `this.input.keyboard?.off('keydown-SPACE', this.onAdvance, this)` and `this.input.keyboard?.off('keydown-ENTER', this.onAdvance, this)`
    - Add `this.skipButton = null` after existing cleanup
    - _Bug_Condition: Without cleanup, stale listeners and references persist across scene reuse_
    - _Expected_Behavior: All transient state cleared, no dangling listeners or references_
    - _Preservation: shutdown() already destroys cinematicPlayer and removes cinematic-complete listener — those remain unchanged_
    - _Requirements: 2.1, 2.3_

  - [ ] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Stale isTransitioningToNext resets on scene reuse
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (init resets state)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [ ] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - First-launch cinematic behavior unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run `npm test` to execute full test suite
  - Run `npx tsc --noEmit` to verify TypeScript compilation
  - Ensure all tests pass, ask the user if questions arise

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 2, "tasks": ["3.4", "3.5"] },
    { "id": 3, "tasks": ["4"] }
  ]
}
```

## Notes

- Tasks 1 and 2 can run in parallel since they are independent exploration/preservation tests on unfixed code.
- All implementation sub-tasks (3.1–3.3) must complete before verification sub-tasks (3.4–3.5).
- The fix follows the same `shutdown()` registration pattern established in GameScene's BUG-013 fix.
- Property-based tests use fast-check to generate arbitrary `CinematicSceneData` configurations for stronger guarantees.
