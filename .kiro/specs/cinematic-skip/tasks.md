# Implementation Plan: Cinematic Skip

## Overview

Add a "Skip" button to CinematicScene that allows players to immediately skip cinematics and transition to the next scene. The implementation modifies only `CinematicScene.ts`, adding a guard flag (`isTransitioningToNext`), a Skip button with hover feedback, and a `handleSkip()` method that cancels all active effects before reusing the existing `transitionToNext()` flow.

## Tasks

- [x] 1. Add Skip button and guard flag to CinematicScene
  - [x] 1.1 Add `isTransitioningToNext` guard flag and `skipButton` property to CinematicScene
    - Add `private skipButton: Phaser.GameObjects.Text | null = null;` property
    - Add `private isTransitioningToNext = false;` property
    - Modify `transitionToNext()` to include guard: if `isTransitioningToNext` is true, return early; otherwise set it to true
    - Call `this.hideSkipButton()` at the start of `transitionToNext()` (after guard)
    - _Requirements: 2.4, 4.1, 4.3, 5.3_

  - [x] 1.2 Implement `createSkipButton()` method
    - Create text element "Skip" using `GAME_FONT_FAMILY`, fontSize 14px, color #ffffff
    - Position at `(width - 20, 20)` with origin `(1, 0)` (top-right, 20px margin)
    - Set depth to 50, alpha to 0.7
    - Set interactive with `useHandCursor: true`
    - Add `pointerover` handler to set alpha 1.0
    - Add `pointerout` handler to set alpha 0.7
    - Add `pointerdown` handler bound to `this.handleSkip`
    - Call `createSkipButton()` in `create()` after setting up the CinematicPlayer
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.3 Implement `hideSkipButton()` method
    - Call `disableInteractive()` on skipButton
    - Set `visible` to false on skipButton
    - Guard against null skipButton reference
    - _Requirements: 4.1, 4.2_

  - [x] 1.4 Implement `handleSkip()` method
    - Return early if `isTransitioningToNext` is true (guard)
    - Call `hideSkipButton()` to disable and hide the button immediately
    - Call `this.tweens.killAll()` to cancel all active scene tweens
    - Call `this.time.removeAllEvents()` to cancel all scheduled timers
    - Call `this.transitionToNext()` to reuse the normal transition flow
    - _Requirements: 2.1, 2.2, 2.3, 3.3, 3.4, 3.5_

- [~] 2. Checkpoint - Verify compilation
  - Ensure `npx tsc --noEmit` completes with exit code 0
  - Ensure `npx vite build` completes with exit code 0
  - _Requirements: 6.5, 6.6_

- [ ] 3. Write tests for cinematic skip logic
  - [~] 3.1 Create test file with Phaser scene mocks
    - Create `src/scenes/__tests__/CinematicScene.skip.test.ts`
    - Set up mock objects for Phaser scene (tweens.killAll, time.removeAllEvents, scene.start, input, events)
    - Mock CinematicPlayer with destroy method
    - Create helper to instantiate CinematicScene logic under test
    - _Requirements: 2.1, 2.3, 5.4_

  - [ ]* 3.2 Write property test: Guard against double transition (Property 1)
    - **Property 1: Guard contra doble transición**
    - Generate random sequences of (handleSkip, emit cinematic-complete) calls using fast-check
    - Assert `scene.start` is invoked exactly once regardless of call order/count
    - Minimum 100 iterations
    - **Validates: Requirements 2.4, 4.3**

  - [ ]* 3.3 Write property test: Complete effect cancellation in any state (Property 2)
    - **Property 2: Cancelación completa de efectos en cualquier estado**
    - Generate random CinematicPlayer states (isTypewriting on/off, isTransitioning on/off, talkingTween active/stopped)
    - Execute handleSkip and assert tweens.killAll called, time.removeAllEvents called, player.destroy called
    - Assert no dangling timers or tweens remain
    - Minimum 100 iterations
    - **Validates: Requirements 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5**

  - [ ]* 3.4 Write property test: Skip vs normal flow equivalence (Property 3)
    - **Property 3: Equivalencia de flujo skip vs normal**
    - Generate random cinematic data (varying step counts) and random interruption points
    - Assert scene.start is called with same nextScene and nextSceneData as normal completion
    - Minimum 100 iterations
    - **Validates: Requirements 2.3, 5.3**

  - [ ]* 3.5 Write unit tests for Skip button creation and visibility
    - Test createSkipButton sets correct position, font, depth, alpha
    - Test hideSkipButton disables interactive and sets visible to false
    - Test handleSkip calls hideSkipButton before tweens.killAll
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2_

- [~] 4. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass with `npm run test`
  - Ensure `npx tsc --noEmit` still completes with exit code 0
  - Ensure no JSON files in `src/assets/History/` were modified
  - Ensure `src/scenes/GameScene.ts` and `src/config/audio-assets.ts` remain unchanged
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Only `src/scenes/CinematicScene.ts` is modified — no changes to CinematicPlayer.ts, font-config.ts, or JSON files
- The guard flag `isTransitioningToNext` is the single mechanism preventing double transitions
- `tweens.killAll()` handles both scene-level tweens (fade transitions, continue indicator blink) and any tweens created by CinematicPlayer via `this.scene.tweens.add`
- `CinematicPlayer.destroy()` already handles cleanup of typewriterTimer and talkingTween
- Property tests use `fast-check` (already installed) with Vitest

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["3.2", "3.3", "3.4", "3.5"] }
  ]
}
```
