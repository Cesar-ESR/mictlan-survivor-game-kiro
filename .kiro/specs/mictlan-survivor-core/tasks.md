# Implementation Plan: Mictlán Survivor Core

## Overview

Implementación incremental del núcleo de mecánicas survivor para "Mictlán - El honor del guerrero jaguar". Se construye sobre Phaser 3 + TypeScript + Vite, siguiendo la arquitectura Scene-based con sistemas modulares desacoplados. Cada tarea construye sobre las anteriores, culminando en la integración completa del game loop.

## Tasks

- [ ] 1. Set up project structure, core interfaces, and testing framework
  - [ ] 1.1 Create directory structure and core type definitions
    - Create `src/config/constants.ts` with `GAME_CONSTANTS` object
    - Create `src/config/types.ts` with all interfaces: `WaveConfig`, `EnemyConfig`, `EnemyTypeWeight`, `PlayerState`, `WeaponConfig`, `Upgrade`, `MapConfig`, `DifficultyScaling`
    - Create `src/entities/` directory for Player and Enemy classes
    - Create `src/systems/` directory for SpawnManager, WaveManager, DamageSystem, XPSystem, WeaponSystem, OrbCollector
    - Create `src/scenes/` directory for BootScene, GameScene, HUDScene, DefeatScene, VictoryScene
    - Create `src/registries/` directory for EnemyRegistry
    - _Requirements: 1.1, 1.5, 9.2, 9.5_

  - [ ] 1.2 Set up Vitest and fast-check testing framework
    - Install `vitest` and `fast-check` as dev dependencies
    - Create `vitest.config.ts` with appropriate configuration
    - Create `src/systems/__tests__/` directory for test files
    - Add test script to `package.json`
    - _Requirements: Non-Functional (Architecture)_

- [ ] 2. Implement Player entity and movement system
  - [ ] 2.1 Implement the Player class with movement and state
    - Create `src/entities/Player.ts` extending `Phaser.Physics.Arcade.Sprite`
    - Implement `move(direction)` with 8-directional input and normalized diagonal movement
    - Implement `takeDamage(amount)`, `heal(amount)`, `addXP(amount)` methods
    - Initialize with base stats: HP 100, speed 200 px/s, level 1, XP 0
    - Handle opposite key cancellation (vector zero)
    - Stop immediately when no keys pressed (within 1 frame)
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 1.5_

  - [ ]* 2.2 Write property test for movement speed normalization
    - **Property 1: Movement Speed Normalization**
    - For any valid direction input, verify resulting velocity magnitude equals 200 px/s
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 2.3 Write property test for player boundary clamping
    - **Property 2: Player Boundary Clamping**
    - For any player position and movement vector, resulting position stays within [0, 3200] × [0, 3200]
    - **Validates: Requirements 2.5**

- [ ] 3. Implement Enemy base class, archetypes, and EnemyRegistry
  - [ ] 3.1 Implement Enemy abstract class and EnemyRegistry
    - Create `src/entities/Enemy.ts` abstract class extending `Phaser.Physics.Arcade.Sprite` implementing `IEnemy`
    - Implement `takeDamage(amount)` and `onDefeat()` base methods
    - Create `src/registries/EnemyRegistry.ts` with `register()`, `create()`, `getRegisteredTypes()` methods
    - _Requirements: 9.2, 9.5_

  - [ ] 3.2 Implement the 4 enemy archetypes
    - Create `src/entities/enemies/Skeleton.ts` — direct chase, HP: 30, speed: 80, damage: 5, XP: 5
    - Create `src/entities/enemies/Bat.ts` — zigzag movement, HP: 15, speed: 150, damage: 3, XP: 3
    - Create `src/entities/enemies/FlamingSkull.ts` — explode on death (15 damage, 100px radius), HP: 50, speed: 60, damage: 10, XP: 10
    - Create `src/entities/enemies/FeatheredSerpent.ts` — accelerating chase, HP: 80, speed: 100, damage: 8, XP: 15
    - Register all archetypes in EnemyRegistry
    - _Requirements: 9.1, 9.3, 9.4_

  - [ ]* 3.3 Write property test for enemy pursuit direction
    - **Property 4: Enemy Pursuit Direction**
    - For any enemy at E and player at P (E ≠ P), velocity points from E to P with correct magnitude
    - **Validates: Requirements 3.2**

- [ ] 4. Implement SpawnManager system
  - [ ] 4.1 Implement SpawnManager with object pooling
    - Create `src/systems/SpawnManager.ts` with enemy pool using `Phaser.GameObjects.Group`
    - Implement spawn logic: positions outside camera bounds (50-300px from edge)
    - Implement spawn interval timer based on wave config
    - Implement max enemy cap (100) — stop spawning when reached
    - Implement despawn logic for enemies > 1500px from player (no XP, no orb)
    - Implement `setWaveConfig(config)` to update spawn parameters per wave
    - _Requirements: 3.1, 3.4, 3.5, 3.6_

  - [ ]* 4.2 Write property tests for spawn system
    - **Property 3: Spawn Position Bounds**
    - For any spawn event, enemy position is 50-300px from camera edge (outside viewport)
    - **Property 6: Pool Cap Invariants (enemies)**
    - Active enemy count never exceeds 100
    - **Property 7: Enemy Despawn by Distance**
    - Enemies > 1500px from player are removed without XP/orb
    - **Validates: Requirements 3.1, 3.4, 3.5**

- [ ] 5. Implement WeaponSystem and DamageSystem
  - [ ] 5.1 Implement WeaponSystem with projectile pooling
    - Create `src/systems/WeaponSystem.ts` with projectile pool using `Phaser.GameObjects.Group`
    - Implement `findClosestEnemy()` — Euclidean distance, range ≤ 800px
    - Implement auto-fire logic: fire every 1000ms toward closest enemy
    - Implement projectile max travel distance (1000px) — destroy if no hit
    - Base damage: 10, projectile speed configurable
    - _Requirements: 4.1, 4.6_

  - [ ] 5.2 Implement DamageSystem with collision handling
    - Create `src/systems/DamageSystem.ts`
    - Implement `checkProjectileEnemyCollisions()` — reduce enemy HP by weapon damage, destroy projectile
    - Implement `checkEnemyPlayerCollisions(delta)` — contact damage with 1000ms cooldown per enemy
    - Trigger enemy defeat when HP ≤ 0
    - Trigger player defeat when player HP ≤ 0
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [ ]* 5.3 Write property tests for combat system
    - **Property 8: Closest Enemy Targeting**
    - WeaponSystem targets enemy with smallest Euclidean distance ≤ 800px
    - **Property 9: Damage Application and Defeat**
    - Projectile-enemy collision reduces HP by damage; HP ≤ 0 → defeated
    - **Property 10: Contact Damage Cooldown**
    - Damage applied at most once per 1000ms per enemy regardless of frame rate
    - **Property 11: Projectile Max Travel Distance**
    - Projectile destroyed after 1000px cumulative travel without hit
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6**

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement XPSystem and OrbCollector
  - [ ] 7.1 Implement OrbCollector with pooling and attraction
    - Create `src/systems/OrbCollector.ts` with orb pool using `Phaser.GameObjects.Group`
    - Implement `spawnOrb(position, value)` — place orb at enemy defeat position
    - Implement attraction: orbs within 100px move toward player at 400 px/s
    - Implement collection: orb touches player → add XP value, remove orb
    - Implement lifetime: remove orbs after 30 seconds
    - Implement cap: max 200 orbs, remove oldest (FIFO) when exceeded
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 7.2 Implement XPSystem with leveling and upgrades
    - Create `src/systems/XPSystem.ts`
    - Implement `calculateThreshold(level)`: level × 10 + 5
    - Implement `tryLevelUp(player)`: check threshold, increment level, carry over excess XP
    - Implement `getRandomUpgrades(count)`: select 3 unique upgrades from pool (or all if < 3 available)
    - Cap at level 20 — no more level-ups beyond
    - Create `src/config/upgrades.ts` with upgrade pool definitions
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]* 7.3 Write property tests for XP and orb systems
    - **Property 5: Enemy Defeat Produces XP Orb**
    - Defeated enemy at position P spawns orb at P with correct xpReward value
    - **Property 12: XP Collection and Level-Up**
    - XP accumulates correctly; level increments when threshold reached; excess carries over
    - **Property 13: Upgrade Selection Uniqueness**
    - Level-up presents exactly 3 distinct upgrades (or all N if N < 3)
    - **Property 14: XP Threshold Formula**
    - For level L, threshold = L × 10 + 5
    - **Property 19: Orb Attraction Behavior**
    - Orb within 100px moves toward player at 400 px/s; beyond 100px stays stationary
    - **Property 20: Orb Lifetime Expiration**
    - Orb existing > 30 seconds without collection is removed
    - **Property 6: Pool Cap Invariants (orbs)**
    - Active orb count never exceeds 200; oldest removed first
    - **Validates: Requirements 3.3, 5.1, 5.2, 5.3, 5.5, 5.7, 8.1, 8.2, 8.3, 8.4, 8.5**

- [ ] 8. Implement WaveManager and difficulty scaling
  - [ ] 8.1 Implement WaveManager with wave progression
    - Create `src/systems/WaveManager.ts`
    - Implement wave timer: 30 seconds per wave
    - Implement wave transition: 2 second pause between waves
    - Implement victory condition: survive wave 10
    - Implement `getWaveConfig()` with enemy type mapping per wave (1-3: Skeleton, 4-6: +Bat, 7-8: +FlamingSkull, 9-10: +FeatheredSerpent)
    - Implement difficulty scaling: spawnInterval × 0.9^(N-1) (min 0.5s), HP × (1 + 0.15 × (N-1)) (max 5.0), speed × (1 + 0.05 × (N-1)) (max 2.0)
    - Handle overflow: repeat last wave config without further scaling
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 8.2 Write property tests for wave system
    - **Property 15: Difficulty Scaling with Clamping**
    - Verify scaling formulas and floor/ceiling values for all wave numbers
    - **Property 16: Wave-to-Enemy-Type Mapping**
    - Verify correct enemy type sets for each wave range
    - **Validates: Requirements 6.2, 6.3, 9.4**

- [ ] 9. Implement Scenes (Boot, Game, Defeat, Victory)
  - [ ] 9.1 Implement BootScene with asset loading
    - Create `src/scenes/BootScene.ts` extending `Phaser.Scene`
    - Implement `preload()` — load all sprite assets, placeholder graphics
    - Implement error handling: timeout after 3 seconds, show error, allow retry
    - Transition to GameScene on success
    - _Requirements: 1.1, 1.4_

  - [ ] 9.2 Implement GameScene wiring all systems together
    - Create `src/scenes/GameScene.ts` extending `Phaser.Scene`
    - Initialize Player at map center (1600, 1600)
    - Initialize all systems: SpawnManager, WaveManager, DamageSystem, XPSystem, WeaponSystem, OrbCollector
    - Wire `update()` loop: PlayerManager → SpawnManager → Enemies → WeaponSystem → DamageSystem → OrbCollector
    - Set up camera following player with map bounds (3200 × 3200)
    - Set up physics colliders and overlap handlers
    - Launch HUDScene as parallel scene
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.4_

  - [ ] 9.3 Implement DefeatScene and VictoryScene
    - Create `src/scenes/DefeatScene.ts` — show survival time, total XP
    - Create `src/scenes/VictoryScene.ts` — show stats: time, max wave, enemies killed, XP, level
    - Both allow restart (return to BootScene)
    - _Requirements: 4.5, 6.4_

- [ ] 10. Implement HUDScene with reactive UI
  - [ ] 10.1 Implement HUDScene with health bar, XP bar, wave display, and timer
    - Create `src/scenes/HUDScene.ts` extending `Phaser.Scene`
    - Implement `HealthBar` — horizontal fill representing hp/maxHp (top-left)
    - Implement `XPBar` — horizontal fill representing currentXP/threshold
    - Implement `WaveDisplay` — current wave number
    - Implement `TimerDisplay` — elapsed time as MM:SS format
    - Listen to events: `hp-changed`, `xp-changed`, `wave-changed`, `level-up` — update in same frame
    - Reset XP bar to 0% on level-up
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ] 10.2 Implement LevelUpPanel with upgrade selection
    - Create level-up overlay panel in HUDScene
    - Display 3 upgrade options (or fewer if pool exhausted)
    - Pause game on show, resume on selection
    - Apply selected upgrade to player
    - Don't show panel if player is level 20
    - _Requirements: 5.3, 5.4, 5.7, 5.8_

  - [ ]* 10.3 Write property tests for HUD calculations
    - **Property 17: HUD Proportional Bar Fill**
    - Health bar fill = hp/maxHp clamped to [0,1]; XP bar fill = xp/threshold clamped to [0,1]
    - **Property 18: Time Formatting**
    - For any seconds S ≥ 0, format as MM:SS with zero-padding
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [ ] 11. Integration and main entry point
  - [ ] 11.1 Wire Phaser game config and main entry point
    - Update `src/main.ts` to create Phaser.Game with Arcade physics
    - Configure game dimensions, physics settings, and scene list [BootScene, GameScene, HUDScene, DefeatScene, VictoryScene]
    - Update `index.html` if needed to host the canvas
    - Create placeholder assets (colored rectangles) for all sprites so the game is playable
    - _Requirements: 1.1, 1.2, Non-Functional (Architecture)_

  - [ ]* 11.2 Write integration tests for game flow
    - Test: player defeat triggers DefeatScene
    - Test: surviving wave 10 triggers VictoryScene
    - Test: level-up pauses game and shows upgrade panel
    - Test: wave transitions happen after 30s with 2s gap
    - _Requirements: 4.5, 5.2, 6.1, 6.4_

- [ ] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Pure logic functions (vector normalization, threshold calculation, scaling formulas, time formatting) are extracted from Phaser classes for testability
- Object pooling is used for projectiles, enemies, and orbs to maintain 60fps performance
- The EnemyRegistry pattern allows adding new enemy types without modifying existing code

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2"] },
    { "id": 3, "tasks": ["3.3", "4.1", "5.1"] },
    { "id": 4, "tasks": ["4.2", "5.2"] },
    { "id": 5, "tasks": ["5.3", "7.1", "7.2", "8.1"] },
    { "id": 6, "tasks": ["7.3", "8.2", "9.1"] },
    { "id": 7, "tasks": ["9.2", "9.3"] },
    { "id": 8, "tasks": ["10.1", "10.2"] },
    { "id": 9, "tasks": ["10.3", "11.1"] },
    { "id": 10, "tasks": ["11.2"] }
  ]
}
```
