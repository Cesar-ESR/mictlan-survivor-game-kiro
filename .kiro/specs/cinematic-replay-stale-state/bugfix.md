# Bugfix Requirements Document

## Introduction

The cinematic replay system in CinematicScene breaks on the second Story Mode launch. After losing a game and returning to the Main Menu, starting Story Mode again results in: the Skip button becoming unresponsive, the final dialogue getting stuck, and gameplay never starting. The root cause is stale instance state — Phaser reuses scene instances across `scene.start()` calls, but class field initializers only execute once in the constructor, leaving flags like `isTransitioningToNext` permanently set to `true` after the first playthrough.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the CinematicScene is started a second time (after a previous complete playthrough) THEN the system ignores skip button presses because `isTransitioningToNext` remains `true` from the first run

1.2 WHEN the CinematicScene reaches its final dialogue step on the second run THEN the system cannot call `transitionToNext()` because the early-return guard (`if (this.isTransitioningToNext) return`) blocks execution, leaving the cinematic permanently stuck

1.3 WHEN the CinematicScene transitions away via `scene.start()` THEN the system does not invoke the `shutdown()` cleanup method because it is never registered as a Phaser lifecycle event handler, leaving the CinematicPlayer instance and event listeners from the previous run potentially dangling

1.4 WHEN the player returns to the Main Menu and starts a new Story Mode campaign THEN the system retains the previous `BlessingManager.selection` singleton state, carrying stale blessing data into the new session

### Expected Behavior (Correct)

2.1 WHEN the CinematicScene is started a second time (after a previous complete playthrough) THEN the system SHALL reset `isTransitioningToNext` to `false` so that skip and transition logic function correctly

2.2 WHEN the CinematicScene reaches its final dialogue step on any run THEN the system SHALL successfully execute `transitionToNext()` and transition to the next scene (BlessingSelectionScene)

2.3 WHEN the CinematicScene is stopped or transitions away THEN the system SHALL properly clean up the CinematicPlayer instance, remove all event listeners, and reset internal state by registering the shutdown handler on the Phaser `shutdown` event

2.4 WHEN the player returns to the Main Menu and starts a new Story Mode campaign THEN the system SHALL clear `BlessingManager.selection` so no stale blessing data persists into the new session

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the CinematicScene is started for the first time in a session THEN the system SHALL CONTINUE TO play the cinematic normally with working skip, dialogue advancement, and scene transition

3.2 WHEN the player clicks the Skip button during the first playthrough of a cinematic THEN the system SHALL CONTINUE TO immediately skip remaining dialogue and transition to the next scene

3.3 WHEN the player advances through dialogue using click, Space, or Enter THEN the system SHALL CONTINUE TO progress the typewriter effect and move to the next dialogue step

3.4 WHEN the CinematicPlayer emits the `cinematic-complete` event THEN the system SHALL CONTINUE TO trigger `transitionToNext()` and move to BlessingSelectionScene on first run

3.5 WHEN the player selects Modo Infinito (which does not use CinematicScene) THEN the system SHALL CONTINUE TO start GameScene directly without any cinematic involvement

---

## Bug Condition (Formal)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type CinematicSceneLaunch
  OUTPUT: boolean

  // Returns true when CinematicScene is launched on a reused instance
  // where isTransitioningToNext was set to true in a previous run
  RETURN X.isSecondOrLaterLaunch AND X.instance.isTransitioningToNext = true
END FUNCTION
```

```pascal
// Property: Fix Checking — Scene state resets on re-entry
FOR ALL X WHERE isBugCondition(X) DO
  result ← CinematicScene'.init(X.sceneData)
  ASSERT result.isTransitioningToNext = false
  ASSERT result.cinematicPlayer = null
  ASSERT skip_button_is_functional(result)
  ASSERT transitionToNext_is_reachable(result)
END FOR
```

```pascal
// Property: Preservation Checking — First launch unaffected
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT CinematicScene(X) = CinematicScene'(X)
END FOR
```
