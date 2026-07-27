# Implementation Plan: Realm Transition System

## Overview

Plan de implementación del Sistema de Transición de Reinos que muestra transiciones narrativas entre reinos del Mictlán durante level-ups. El sistema carga datos desde LevelProgressText.json, los transforma al formato CinematicData, y los muestra en una RealmTransitionScene dedicada antes de la Blessing Selection.

## Tasks

- [x] 1. Create TypeScript interfaces for realm transition data
  - Create `src/realm-transition/realm-transition-types.ts`
  - Define interface RealmInfo with fields: order (number), title (string), name (string), background (string)
  - Define interface GuideInfo with fields: name (string), portrait (string)
  - Define interface DialogLine with fields: speaker (string), text (string)
  - Define interface CultureInfo with fields: title (string), description (string)
  - Define interface RealmTransition with fields: id, isIntroduction, triggerLevel, realm, guide, dialog, culture
  - Define interface LevelProgressData with field: transitions (RealmTransition[])
  - Define interface RealmTransitionSceneData with fields: transition, levelUpResult
  - Export all interfaces
  Requirements: REQ-1, REQ-9

- [x] 2. Implement RealmTransitionDataLoader
  - Create `src/realm-transition/RealmTransitionDataLoader.ts`
  - Import RealmTransition and LevelProgressData from realm-transition-types
  - Implement class with constructor that takes Phaser.Cache.CacheManager
  - In constructor read 'LevelProgressText' JSON from cache and build Map<number, RealmTransition> indexed by triggerLevel
  - Handle cache miss gracefully with empty map when JSON is undefined
  - Expose method getTransitionForLevel(level: number): RealmTransition | null
  - Export the class
  Requirements: REQ-1, REQ-2, REQ-9

- [x] 3. Implement realm-transition-transformer
  - Create `src/realm-transition/realm-transition-transformer.ts`
  - Import CinematicData and CinematicStep from '../cinematic/cinematic-types'
  - Import RealmTransition from './realm-transition-types'
  - Implement pure function transformTransitionToCinematicData(transition: RealmTransition): CinematicData
  - First step is BackgroundStep with image = transition.realm.background
  - Subsequent steps are DialogStep for each dialog entry using guide.name and guide.portrait
  - Set id to `realm-transition-${transition.id}` and title to transition.realm.name
  - Export the function
  Requirements: REQ-5, REQ-9

- [x] 4. Register realm transition assets in cinematic-assets.ts and splash-art-config.ts
  - Add 9 realm background entries to CINEMATIC_BACKGROUNDS: realm_chiconahuapan → BackgroundNivel9Dialogs.png, realm_apanohuayan → BackgroundNivel8Dialogs.png, realm_tepectli_monamictlan → BackgroundNivel7Dialogs.png, realm_iztepetl → BackgroundNivel6Dialogs.png, realm_itzehecayan → BackgroundNivel5Dialogs.png, realm_paniecatacoyan → BackgroundNivel4Dialogs.png, realm_timiminaloayan → BackgroundNivel3Dialogs.png, realm_teocoyohuehualoyan → BackgroundNivel2Dialogs.png, realm_chicunamictlan → BackgroundNivel1Dialogs.png
  - Add 'xolotl' entry to CINEMATIC_SPLASH_ARTS pointing to PerroGuiaSplashArt.png
  - Add LevelProgressText.json entry to CINEMATIC_JSON_FILES with key 'LevelProgressText'
  - Add 'xolotl' config entry in splash-art-config.ts with same values as PerroGuiaSplashArt
  Requirements: REQ-6

- [x] 5. Implement RealmTransitionScene
  - Create `src/realm-transition/RealmTransitionScene.ts` as Phaser.Scene with key 'RealmTransitionScene'
  - Accept RealmTransitionSceneData in init()
  - Implement state machine: 'dialog' → 'culture' → 'complete'
  - In create(): set up visual layers (background depth 0, splash art depth 10, realm title depth 15, dialog box depth 20, texts depth 30, culture panel depth 40, skip button depth 50)
  - In 'dialog' state: transform data with transformTransitionToCinematicData, instantiate CinematicPlayer, show realm title
  - Register click/Space/Enter input to advance CinematicPlayer
  - On 'cinematic-complete': transition to 'culture' state, show cultural info panel with culture.title and culture.description
  - In 'culture' state: show "Continuar" button, on confirm emit 'realm-transition-complete' to parent GameScene.events and stop scene
  - Implement "Saltar" skip button: destroy CinematicPlayer, emit 'realm-transition-complete' immediately, stop scene
  - Wrap create() in try-catch to emit 'realm-transition-complete' on error preventing soft-lock
  - Handle missing background texture with fallback dark rectangle
  Requirements: REQ-3, REQ-4, REQ-5, REQ-8

- [x] 6. Register RealmTransitionScene in main.ts
  - Import RealmTransitionScene from '../realm-transition/RealmTransitionScene'
  - Add RealmTransitionScene to the scene array in getScenes() for normal game mode
  Requirements: REQ-6, REQ-9

- [x] 7. Integrate realm transition into GameScene flow
  - Import RealmTransitionDataLoader and RealmTransition type in GameScene.ts
  - Add private property realmTransitionDataLoader
  - In create() instantiate RealmTransitionDataLoader with this.cache after systems are built
  - Modify onOrbCollected: when leveledUp and showPanel, query getTransitionForLevel(newLevel)
  - If transition found: pause, launch RealmTransitionScene with data, register events.once('realm-transition-complete') to resume and processLevelUp
  - If no transition: call processLevelUp directly (existing behavior unchanged)
  - Add 15-second safety timeout that forces resume + processLevelUp if scene fails to emit completion
  - In shutdown(): remove 'realm-transition-complete' listener and destroy safety timeout
  Requirements: REQ-2, REQ-3, REQ-4, REQ-7

- [x] 8. Build verification and integration testing
  - Run TypeScript compilation (npx tsc --noEmit) and verify no type errors
  - Run project build (npm run build) and verify it completes without errors
  - Verify no existing tests are broken
  - Confirm realm transition assets load correctly during BootScene
  Requirements: REQ-7, REQ-10

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": [1, 4],
      "description": "Foundation: types and asset registration (independent)"
    },
    {
      "wave": 2,
      "tasks": [2, 3],
      "description": "Data layer: loader and transformer (depend on Task 1 types)"
    },
    {
      "wave": 3,
      "tasks": [5],
      "description": "Scene implementation (depends on Tasks 1-4)"
    },
    {
      "wave": 4,
      "tasks": [6],
      "description": "Scene registration (depends on Task 5)"
    },
    {
      "wave": 5,
      "tasks": [7],
      "description": "GameScene integration (depends on Tasks 2, 5, 6)"
    },
    {
      "wave": 6,
      "tasks": [8],
      "description": "Build verification (depends on all previous tasks)"
    }
  ]
}
```

## Notes

- Tasks 1 and 4 can be implemented in parallel since they have no interdependencies
- Task 5 depends on Tasks 1-4 being complete (uses types, loader, transformer, and assets)
- Task 7 modifies GameScene.onOrbCollected to intercept level-ups with transitions before calling LevelUpCoordinator
- LevelUpCoordinator remains unmodified; the integration point is exclusively in GameScene
- The safety timeout in Task 7 prevents soft-lock if RealmTransitionScene crashes without emitting completion
