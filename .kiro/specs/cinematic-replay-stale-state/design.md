# Cinematic Replay Stale State Bugfix Design

## Overview

CinematicScene breaks on subsequent Story Mode launches because Phaser reuses scene instances across `scene.start()` calls — class field initializers only run once (in the constructor), so transient flags like `isTransitioningToNext` remain permanently `true` after the first playthrough. The fix resets all transient state in `init()`, registers the `shutdown()` method on Phaser's lifecycle event (matching GameScene's BUG-013 pattern), and adds defensive resets inside `shutdown()` itself.

## Glossary

- **Bug_Condition (C)**: CinematicScene is started on a reused Phaser scene instance where `isTransitioningToNext` remains `true` from a prior run
- **Property (P)**: On every CinematicScene launch, transient state (`isTransitioningToNext`, `cinematicPlayer`, `skipButton`) starts fresh, skip button is functional, and `transitionToNext()` is reachable
- **Preservation**: First-run cinematic playback, skip behavior, dialogue advancement, `cinematic-complete` event handling, and Modo Infinito flows remain unchanged
- **CinematicScene**: The Phaser scene class in `src/scenes/CinematicScene.ts` responsible for playing story cinematics before gameplay
- **isTransitioningToNext**: Boolean guard flag that prevents duplicate `transitionToNext()` calls during a single scene lifecycle
- **Phaser scene reuse**: Phaser instantiates scene classes once at boot; `scene.start()` calls `init()` → `create()` on the same object without re-running the constructor
- **shutdown event**: Phaser emits `'shutdown'` on a scene's event emitter when `scene.start(anotherScene)` or `scene.stop()` is called — it does NOT automatically invoke a method named `shutdown()`

## Bug Details

### Bug Condition

The bug manifests when CinematicScene is launched a second time (or subsequent times) within the same browser session. The `isTransitioningToNext` flag was set to `true` during the prior run's `transitionToNext()` call and is never reset because:

1. The constructor (field initializers) only runs once at boot
2. `init()` only assigns `sceneData` — no state reset
3. `create()` has no reset logic
4. `shutdown()` is defined but never registered on Phaser's `'shutdown'` event
5. Even if `shutdown()` were called, it doesn't reset the flag

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type CinematicSceneLaunch
  OUTPUT: boolean

  RETURN input.sceneInstance.isTransitioningToNext = true
         AND input.isSecondOrLaterLaunch = true
         AND input.sceneInstance.init() does NOT reset isTransitioningToNext
END FUNCTION
```

### Examples

- **Example 1**: Player completes Story Mode level 1, loses in GameScene, returns to MainMenu, starts Story Mode again → Skip button does nothing because `handleSkip()` early-returns at `if (this.isTransitioningToNext) return`
- **Example 2**: Player reaches the final dialogue step on second run → `cinematic-complete` fires → `transitionToNext()` early-returns at `if (this.isTransitioningToNext) return` → scene stuck permanently
- **Example 3**: Player starts Story Mode, watches cinematic to completion, plays game, dies, starts Story Mode again → same stuck behavior as above
- **Edge case**: First ever launch in session → works correctly because `isTransitioningToNext` starts as `false` from field initializer

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- First-time cinematic playback with working skip, dialogue advancement, and scene transition
- Skip button click immediately skips remaining dialogue and transitions to next scene
- Click, Space, or Enter advances the typewriter effect and moves to the next dialogue step
- `cinematic-complete` event triggers `transitionToNext()` on first run
- Modo Infinito (which does not use CinematicScene) starts GameScene directly
- CinematicPlayer typewriter, splash art transitions, and talking animations function normally
- AudioManager plays cinematic music when scene starts

**Scope:**
All inputs on the first CinematicScene launch in a session are completely unaffected by this fix. The fix only adds reset logic that brings the scene back to its initial state — identical to first-launch behavior.

## Hypothesized Root Cause

Based on the bug analysis, the confirmed root cause chain is:

1. **No state reset in `init()`**: The `init()` method only sets `this.sceneData = data`. It does not reset `isTransitioningToNext`, `cinematicPlayer`, or `skipButton`. Since Phaser reuses scene instances, these fields retain values from the previous run.

2. **No shutdown event registration**: Unlike GameScene (which has `this.events.once('shutdown', this.shutdown, this)` per BUG-013 fix), CinematicScene never registers its `shutdown()` method. When the scene transitions away via `scene.start()`, Phaser emits `'shutdown'` but nobody is listening — so cleanup never runs.

3. **Guard flag permanently blocks execution**: `isTransitioningToNext = true` is a one-way latch. Once set in `transitionToNext()`, it blocks all subsequent calls to both `transitionToNext()` and `handleSkip()`, making the scene permanently stuck on reuse.

4. **Potential stale references**: `cinematicPlayer` and `skipButton` from the previous run may still reference destroyed Phaser game objects, though the primary symptom is the guard flag issue.

## Correctness Properties

Property 1: Bug Condition - Scene state resets on re-entry

_For any_ CinematicScene launch where the scene instance was previously used (isBugCondition returns true), the fixed `init()` method SHALL reset `isTransitioningToNext` to `false`, `cinematicPlayer` to `null`, and `skipButton` to `null`, ensuring skip and transition logic function correctly on every subsequent launch.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - First-launch and non-cinematic behavior unchanged

_For any_ CinematicScene launch that is the first in a session (isBugCondition returns false), OR any game flow that does not involve CinematicScene (Modo Infinito), the fixed code SHALL produce exactly the same behavior as the original code, preserving cinematic playback, skip functionality, dialogue advancement, event handling, and non-cinematic game flows.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct (validated):

**File**: `src/scenes/CinematicScene.ts`

**Scope**: All changes within a single file, minimal impact.

**Specific Changes**:

1. **Reset transient state in `init()`**: Add resets for all transient fields at the beginning of the `init()` method, before assigning `sceneData`:
   - `this.isTransitioningToNext = false`
   - `this.cinematicPlayer = null`
   - `this.skipButton = null`

   This ensures every `scene.start('CinematicScene', data)` call produces a clean initial state regardless of prior usage.

2. **Register `shutdown()` on Phaser lifecycle event in `create()`**: Add `this.events.once('shutdown', this.shutdown, this)` at the end of the `create()` method, matching the exact pattern established by GameScene's BUG-013 fix. Using `once` prevents listener accumulation across multiple create cycles.

3. **Add defensive reset in `shutdown()`**: Extend the existing `shutdown()` method to include `this.isTransitioningToNext = false` as a defensive measure, ensuring the flag is cleared even if shutdown fires before the next `init()` call.

4. **Ensure `shutdown()` removes input listeners**: Add cleanup for `pointerdown`, `keydown-SPACE`, and `keydown-ENTER` listeners inside `shutdown()` to prevent stale listener accumulation.

5. **Ensure `shutdown()` cleans up the skip button**: Add `this.skipButton = null` after destroying/hiding the skip button in shutdown.

### State Lifecycle After Fix

| Lifecycle Phase | State | Responsibility |
|----------------|-------|----------------|
| `init()` | Reset all transient fields to initial values | **State initialization** |
| `create()` | Build game objects, register listeners, register shutdown | **Runtime setup** |
| Runtime | `isTransitioningToNext` set to `true` in `transitionToNext()` | **Runtime state** |
| `shutdown` event | Destroy player, remove listeners, reset flag | **Cleanup** |
| Next `init()` | Reset again (defensive — belt-and-suspenders) | **State initialization** |

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that `isTransitioningToNext` remains `true` across scene restarts on UNFIXED code.

**Test Plan**: Create a test that instantiates CinematicScene, simulates a full playthrough (triggering `transitionToNext()`), then simulates a second `init()` + `create()` cycle and asserts that the guard flag blocks execution.

**Test Cases**:
1. **Stale flag test**: After first `transitionToNext()` call, assert `isTransitioningToNext === true` persists into second `init()` call (will demonstrate bug on unfixed code)
2. **Skip blocked test**: After first run, simulate second run and attempt `handleSkip()` → assert it early-returns without transitioning (will demonstrate bug on unfixed code)
3. **Transition blocked test**: After first run, simulate second run and fire `cinematic-complete` → assert `transitionToNext()` early-returns (will demonstrate bug on unfixed code)
4. **Shutdown never fires test**: Confirm that without `events.once('shutdown', ...)`, the shutdown method is never called when scene transitions away (will demonstrate bug on unfixed code)

**Expected Counterexamples**:
- `isTransitioningToNext` remains `true` after scene restart
- `handleSkip()` returns without effect on second run
- `transitionToNext()` returns without effect on second run

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed scene produces correct behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := CinematicScene_fixed.init(input.sceneData)
  ASSERT result.isTransitioningToNext = false
  ASSERT result.cinematicPlayer = null
  ASSERT result.skipButton = null
  ASSERT handleSkip_is_functional(result)
  ASSERT transitionToNext_is_reachable(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT CinematicScene_original(input) = CinematicScene_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many scene data configurations automatically
- It catches edge cases with different `cinematicKey`, `nextScene`, and `nextSceneData` values
- It provides strong guarantees that first-launch behavior is unchanged

**Test Plan**: Observe behavior on UNFIXED code first for first-launch scenarios, then write property-based tests capturing that exact behavior after the fix.

**Test Cases**:
1. **First-launch preservation**: Verify first-time CinematicScene launch plays cinematic, responds to skip, and transitions correctly — identical before and after fix
2. **Skip functionality preservation**: Verify skip button works on first run after fix is applied
3. **Dialogue advancement preservation**: Verify click/Space/Enter advances dialogue on first run
4. **Event emission preservation**: Verify `cinematic-complete` triggers transition on first run

### Unit Tests

- Test that `init()` resets `isTransitioningToNext` to `false`
- Test that `init()` resets `cinematicPlayer` to `null`
- Test that `init()` resets `skipButton` to `null`
- Test that `shutdown()` resets `isTransitioningToNext` to `false`
- Test that `shutdown()` removes event listeners
- Test that `create()` registers shutdown handler via `events.once`
- Test that `handleSkip()` works after state reset (second run)
- Test that `transitionToNext()` works after state reset (second run)

### Property-Based Tests

- Generate random sequences of scene start/stop cycles and verify `isTransitioningToNext` is always `false` at the beginning of each `init()` call
- Generate random `CinematicSceneData` configurations and verify first-launch behavior is identical between original and fixed code
- Generate random numbers of consecutive scene reuses (2-10 times) and verify the scene never gets stuck

### Integration Tests

- Test full Story Mode flow: MainMenu → CinematicScene → BlessingSelection → GameScene → Death → MainMenu → CinematicScene (second run works)
- Test that skip button works on second cinematic playthrough
- Test that dialogue advances correctly on second cinematic playthrough
- Test that Modo Infinito remains completely unaffected by the fix
