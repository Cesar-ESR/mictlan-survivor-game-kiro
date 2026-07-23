# Implementation Plan: Mictlán Survivor Core

## Overview

Plan incremental para implementar el núcleo de mecánicas survivor de "Mictlán - El honor del guerrero jaguar". Cada tarea construye sobre las anteriores, priorizando tipos/interfaces base, luego generación procedural del mapa, sistemas core, y finalmente integración y tests. Se usa TypeScript, Phaser 3 y Vite. Todos los cálculos dependientes del tiempo usan Delta_Time.

## Tasks

- [x] 1. Tipos, interfaces y constantes base
  - [x] 1.1 Crear archivo `src/config/constants.ts` con el objeto `GAME_CONSTANTS`
    - Incluir todas las constantes definidas en el diseño: velocidades, dimensiones del mapa, umbrales, cooldowns, fórmulas
    - Exportar `XP_THRESHOLD_FORMULA` como función pura: `(level: number) => level * 10 + 5`
    - _Requirements: 2.1, 2.5, 3.1, 3.5, 3.6, 4.1, 4.6, 5.6, 5.7, 6.3, 8.2, 8.4, 8.5_

  - [x] 1.2 Crear archivo `src/types/interfaces.ts` con todas las interfaces del diseño
    - `GameModeConfig`, `WaveConfig`, `EnemyTypeWeight`, `DifficultyParams`
    - `EnemyConfig`, `EnemyBehaviorConfig` (union type con 4 variantes)
    - `EnemySpawnConfig`, `PlayerState`, `WeaponConfig`
    - `Upgrade`, `UpgradePool`, `MapConfig`, `LevelUpResult`
    - _Requirements: 6.4, 6.5, 9.1, 9.5, 5.2, 5.3_

  - [x] 1.3 Crear archivo `src/config/enemy-configs.ts` con la configuración de los 4 arquetipos
    - Esqueleto: HP 30, speed 80, damage 5, xpReward 5, behavior `direct_chase`
    - Murciélago: HP 15, speed 150, damage 3, xpReward 3, behavior `zigzag_chase`
    - Calavera Llameante: HP 50, speed 60, damage 10, xpReward 10, behavior `explode_on_death`
    - Serpiente Emplumada: HP 80, speed 100, damage 8, xpReward 15, behavior `accelerating_chase`
    - _Requirements: 9.1, 9.3_

  - [x] 1.4 Crear archivo `src/config/wave-configs.ts` con `WAVE_ENEMY_PROGRESSION` y configs de oleadas
    - Oleadas 1-3: solo Esqueletos
    - Oleadas 4-6: Esqueletos + Murciélagos
    - Oleadas 7-8: + Calavera Llameante
    - Oleadas 9-10: los 4 tipos
    - Función `buildWaveConfig(wave: number)` que aplica fórmulas exponenciales
    - _Requirements: 6.2, 6.3, 9.4_

  - [x] 1.5 Crear archivo `src/config/upgrades.ts` con el pool inicial de mejoras
    - Definir al menos 10 mejoras con `id`, `name`, `description` y función `apply`
    - Tipos: velocidad, HP máximo, daño arma, cadencia arma, rango arma, radio atracción orbes, etc.
    - _Requirements: 5.3, 5.8, 5.9_

- [ ] 2. Inicialización de Phaser, escenas y scaffolding
  - [x] 2.1 Crear archivo `src/main.ts` con la configuración de Phaser y arranque del juego
    - Configurar canvas 1024×768 (o responsive), physics arcade
    - Registrar todas las escenas: BootScene, GameScene, HUDScene, DefeatScene, VictoryScene
    - Iniciar con BootScene
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 Crear `src/scenes/BootScene.ts` para carga de assets y transición
    - Implementar `preload()`: cargar sprites placeholder (rectángulos coloreados por ahora)
    - Implementar `create()`: transicionar a GameScene al completar carga
    - Si la carga falla o excede 3 segundos, mostrar mensaje de error y opción de reintentar
    - _Requirements: 1.1, 1.4_

  - [ ] 2.3 Actualizar `src/scenes/GameScene.ts` — eliminar TileSprite de mapa e integrar MapGenerator
    - ELIMINAR el uso incorrecto de TileSprite que repite el sheet completo como fondo
    - El mapa ahora se genera proceduralmente via MapGenerator (Tarea 3)
    - Mantener estructura `create()`/`update()` existente, world bounds 3200×3200, lanzamiento de HUDScene
    - La inicialización del mapa se delegará a `MapGenerator.generate()` tras completar Tarea 3
    - Inicializar Player con: HP=100, nivel=1, levelXp=0, totalXp=0, threshold=15, arma base
    - _Requirements: 1.1, 1.3, 1.5, 2.5, 10.1_

  - [x] 2.4 Crear `src/scenes/HUDScene.ts` como escena overlay (estructura vacía con event listeners)
    - Crear escena que se lanza en paralelo sobre GameScene
    - Registrar listeners para eventos: `hp-changed`, `xp-changed`, `wave-changed`, `level-up`
    - Placeholder de elementos visuales (se llenan en tarea de HUD)
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 2.5 Crear `src/scenes/DefeatScene.ts` y `src/scenes/VictoryScene.ts`
    - DefeatScene: mostrar tiempo de supervivencia y XP total
    - VictoryScene: mostrar tiempo total, oleada máxima, enemigos derrotados, XP total, nivel alcanzado
    - Ambas con botón/opción de volver al menú principal
    - _Requirements: 4.5, 6.4_

- [ ] 3. Generación Procedural del Mapa
  - [ ] 3.1 Inspeccionar dimensiones reales de los 5 tilesets y documentar metadatos
    - Cargar las imágenes: `michlan_tiled_ground.png`, `michlan_tiled_borders.png`, `michlan_tiled_liquids.png`, `michlan_tiled_walls_cliff.png`, `Mictlan_decoration.png`
    - Registrar dimensiones (width×height), calcular cantidad de frames (32×32) por tileset
    - Documentar nombres normalizados y paths en `src/config/tile-catalog-data.ts`
    - _Requirements: 10.14_

  - [ ] 3.2 Crear escena de debug para visualizar frames de cada tileset
    - Crear `src/scenes/TileDebugScene.ts` que muestre cada frame con: tileset key, frame index, posición en el sheet
    - Permitir identificar visualmente frames vacíos/transparentes vs. frames útiles
    - Esta escena es herramienta de desarrollo, no se incluye en el build de producción
    - _Requirements: 10.14_

  - [x] 3.3 Clasificar frames manualmente en categorías del TileCatalog
    - Asignar cada frame de los 5 tilesets a una categoría: `groundBase`, `groundVariations`, `liquidCenters`, `liquidEdges`, `borders`, `wallTops`, `wallSides`, `wallCorners`, `cliffs`, `obstacles`, `decorations`, `emptyOrTransparent`
    - Documentar la clasificación en `src/config/tile-catalog-data.ts` como constante exportada
    - Identificar y registrar todos los frames vacíos/transparentes para exclusión
    - _Requirements: 10.3, 10.14_

  - [ ] 3.4 Implementar interfaces `TileReference` y `TileCatalogDefinition`
    - Crear `src/map/TileCatalog.ts` con la clase TileCatalog
    - Implementar métodos: `getGroundTiles()`, `getByCategory()`, `isPermittedForLayer()`, `isValidGroundTile()`, `getPermittedCategories()`, `debugListAllFrames()`
    - Instanciar con los datos clasificados en 3.3
    - _Requirements: 10.14, Property 30_

  - [x] 3.5 Implementar `SeededRandom` con API completa
    - Crear `src/map/SeededRandom.ts` con métodos: `next()`, `integer(min, max)`, `pick()`, `weightedPick()`, `chance(p)`, `shuffle()`
    - Garantizar determinismo: misma seed + misma secuencia = mismos resultados
    - NO usar Math.random() — toda aleatoriedad del mapa pasa por esta clase
    - _Requirements: 10.13, Property 32_

  - [x] 3.6 Escribir property tests para SeededRandom (`src/map/__tests__/seeded-random.property.test.ts`)
    - **Property 32: Deterministic Generation** — misma seed produce misma secuencia de valores
    - Test: `next()` retorna valores en [0, 1)
    - Test: `integer(min, max)` siempre retorna valor en rango inclusive
    - Test: `shuffle()` produce misma permutación para misma seed
    - **Validates: Requirements 10.13**

  - [x] 3.7 Implementar `MapGenerationConfig` y constantes de generación
    - Crear `src/map/MapGenerationConfig.ts` con interface y defaults
    - Defaults: widthInTiles=100, heightInTiles=100, tileSize=32, safeZoneRadius=5, minimumReachableRatio=0.85, maxGenerationAttempts=5, maxGenerationTimeMs=3000
    - Density params (wallDensity, obstacleDensity, liquidDensity, decorationDensity) son tunables configurables
    - _Requirements: 10.1, 10.8, 10.11, 10.15_

  - [x] 3.8 Implementar grid lógica de MapCell (100×100)
    - Crear `src/map/MapCell.ts` con interface MapCell según design.md
    - Inicializar grid 100×100 con celdas base (walkable=true, ground=null, etc.)
    - Crear helper `createEmptyGrid(width, height): MapCell[][]`
    - _Requirements: 10.1, Property 27_

  - [x] 3.9 Implementar generación de Ground completo
    - En MapGenerator: fase `generateGround()` que llena TODAS las celdas con tiles de `groundBase`
    - Ninguna celda walkable queda sin ground tile
    - NO usar tiles clasificados como `emptyOrTransparent`
    - Validar con `TileCatalog.isValidGroundTile()` cada tile asignado
    - _Requirements: 10.3, Property 28_

  - [x] 3.10 Implementar variaciones visuales de Ground
    - Usar `groundVariations` del TileCatalog para romper repetición visual
    - Aplicar variaciones con probabilidad configurable via SeededRandom
    - _Requirements: 10.3_

  - [x] 3.11 Implementar generación de regiones de líquidos contiguos
    - Fase `generateLiquidRegions()`: seleccionar N puntos semilla aleatorios, expandir con flood-fill limitado por liquidDensity
    - Cada región debe ser contigua (4-connected): ningún tile de líquido aislado
    - Asignar `LiquidConfig` (behavior: walkable/blocking/damaging, damagePerSecond configurable) a cada región
    - _Requirements: 10.4, Property 36_

  - [ ] 3.12 Implementar Borders y transiciones visuales
    - Fase que analiza vecindad y coloca tiles de `borders` en transiciones suelo↔líquido, suelo↔muro
    - Los borders NO son sustituto del suelo base ni aplican colisión
    - Topología lógica implementada (borderMask, BorderKind); selección visual de frames queda PROVISIONAL hasta verificar correspondencia máscara→frame
    - _Requirements: 10.5_

  - [x] 3.13 Implementar generación de Walls y Cliffs
    - Fase `generateWallsAndCliffs()`: generar estructuras coherentes usando reglas de vecindad o templates
    - Usar categorías `wallTops`, `wallSides`, `wallCorners`, `cliffs` del TileCatalog
    - Respetar wallDensity como porcentaje máximo de tiles
    - Marcar celdas como `walkable=false`
    - NO usar placement puramente aleatorio sin estructura
    - Visual frame selection es PROVISIONAL (clasificación semántica pendiente de confirmación visual)
    - _Requirements: 10.6, Property 30_

  - [x] 3.14 Implementar generación de Obstacles
    - Fase `generateObstacles()`: colocar obstáculos en celdas walkable fuera de safeZone
    - Respetar obstacleDensity, marcar celdas como `walkable=false`
    - Evitar bloquear paths principales (validación posterior por MapValidator)
    - _Requirements: 10.6_

  - [ ] 3.15 Implementar generación de Decorations sin colisión
    - Fase `generateDecorations()`: colocar en celdas walkable sin obstáculos
    - Respetar decorationDensity
    - NO marcar como blocking, NO aplicar colisión
    - Elementos decorativos que deban bloquear van en Obstacles (Req 10.7)
    - _Requirements: 10.7_

  - [ ] 3.16 Implementar limpieza de zona central segura (safe zone)
    - Fase `clearSafeZone()`: limpiar radio `safeZoneRadius` tiles desde centro (50,50)
    - Eliminar walls, obstacles, blocking liquids del área
    - Todas las celdas en safe zone deben tener `walkable=true` y `inSafeZone=true`
    - _Requirements: 10.8, Property 29_

  - [ ] 3.17 Implementar MapValidator con BFS/flood-fill
    - Crear `src/map/MapValidator.ts` con clase MapValidator
    - Implementar `validate(grid, config): MapValidationResult`
    - Checks: centro walkable, safe zone libre, reachableRatio >= minimumReachableRatio (0.85)
    - Implementar `floodFill()` desde centro para contar celdas accesibles
    - _Requirements: 10.9, 10.10, Property 33_

  - [ ] 3.18 Implementar cálculo de reachableRatio
    - `reachableRatio = reachableTiles / totalWalkableTiles`
    - Si ratio < minimumReachableRatio → mapa inválido
    - Retornar `MapValidationResult` con métricas detalladas
    - _Requirements: 10.10, Property 33_

  - [ ] 3.19 Implementar bounded retries con seeds derivadas
    - En MapGenerator: si validación falla, derivar nueva seed (hash(originalSeed + attempt))
    - Máximo `maxGenerationAttempts` intentos (default 5)
    - Si todos fallan → retornar error `MAX_ATTEMPTS_REACHED` con `layers=null`
    - _Requirements: 10.11, 10.12, Property 34_

  - [ ] 3.20 Implementar límite de tiempo de generación (3000ms)
    - Medir tiempo total de generación + validación de todos los intentos
    - Si excede `maxGenerationTimeMs` → abortar con error `GENERATION_TIMEOUT`
    - _Requirements: 10.15, Property 35_

  - [ ] 3.21 Construir Phaser Tilemap layers desde grid lógica
    - Implementar `buildPhaserLayers()`: crear tilemap con 6 capas independientes
    - Capas: Ground (depth 0), Liquids (depth 1), Borders (depth 2), Walls (depth 4), Obstacles (depth 4), Decorations (depth 3/6)
    - Actualizar BootScene para cargar tilesets como spritesheets (frameWidth: 32, frameHeight: 32) en lugar de imágenes completas
    - _Requirements: 10.2, Property 30_

  - [ ] 3.22 Asignar colisiones por capa según requirements.md y design.md
    - Walls layer: colisión habilitada (bloquea jugador y enemigos)
    - Obstacles layer: colisión habilitada (bloquea jugador y enemigos)
    - Liquids layer: colisión solo si `LiquidConfig.behavior === 'blocking'`
    - Ground, Borders, Decorations: SIN colisión
    - PENDING: colisiones proyectil↔muro NO implementadas (decisión pendiente)
    - _Requirements: 10.6, 10.7, Property 31_

  - [ ] 3.23 Integrar MapGenerator en GameScene
    - En `GameScene.create()`: construir MapGenerationConfig, invocar `MapGenerator.generate()`
    - Si éxito: configurar world bounds (3200×3200), configurar colisiones con capas
    - Si fallo: mostrar error, permitir retry sin recargar página
    - Configurar player/enemies collide con Walls y Obstacles layers
    - _Requirements: 10.1, 10.11, 10.12_

  - [ ] 3.24 Eliminar el uso incorrecto de TileSprite en GameScene
    - Remover toda referencia a TileSprite para el fondo/mapa
    - El mapa ahora se renderiza exclusivamente via las 6 capas del Tilemap generado
    - Verificar que no queden assets cargados como imagen completa para el mapa
    - _Requirements: 10.2, 10.3_

  - [ ]* 3.25 Escribir property tests para generación de mapa (`src/map/__tests__/map-generation.property.test.ts`)
    - **Property 27: Map Dimensions Invariant** — grid siempre 100×100, mundo 3200×3200
    - **Property 28: No Transparent Ground** — toda celda walkable tiene ground tile válido (no null, no transparente)
    - **Property 29: Safe Zone Clear** — celdas en safeZoneRadius desde centro son walkable sin walls/obstacles/blocking liquids
    - **Property 30: Tile Category Integrity** — tiles en cada capa pertenecen a categorías permitidas
    - **Validates: Requirements 10.1, 10.3, 10.8, 10.14**

  - [ ]* 3.26 Escribir property tests para validación y colisiones (`src/map/__tests__/map-validation.property.test.ts`)
    - **Property 31: Collision Layer Integrity** — Walls/Obstacles CON colisión, Decorations/Ground/Borders SIN colisión
    - **Property 33: Accessibility Validation** — centro walkable, reachableRatio >= 0.85
    - **Property 34: Generation Attempts Bounded** — nunca excede maxGenerationAttempts
    - **Property 35: Generation Time Limit** — nunca excede maxGenerationTimeMs
    - **Property 36: Contiguous Liquid Regions** — tiles líquidos 4-connected, no aislados
    - **Validates: Requirements 10.4, 10.6, 10.7, 10.9, 10.10, 10.11, 10.15**

  - [ ]* 3.27 Escribir unit tests para MapGenerator y MapValidator (`src/map/__tests__/map-generator.unit.test.ts`)
    - Test: mapa generado con seed conocida produce resultado determinista
    - Test: safe zone completamente libre tras generación
    - Test: MapValidator rechaza mapa con centro no-walkable
    - Test: MapValidator rechaza mapa con reachableRatio < 0.85
    - Test: retry con nueva seed derivada tras mapa inválido
    - Test: error MAX_ATTEMPTS_REACHED si todos los intentos fallan
    - Test: error GENERATION_TIMEOUT si se excede maxGenerationTimeMs
    - **Validates: Requirements 10.9, 10.10, 10.11, 10.12, 10.13, 10.15**

  - [ ] 3.28 Validación visual del mapa generado
    - Ejecutar GameScene y verificar visualmente que el mapa renderiza correctamente
    - Confirmar que no hay tiles transparentes visibles en Ground
    - Confirmar que las 6 capas se superponen correctamente según depth order
    - Confirmar que colisiones funcionan (jugador no atraviesa muros/obstáculos)
    - Confirmar que decoraciones NO bloquean al jugador
    - _Requirements: 10.2, 10.3, 10.6, 10.7_

- [ ] 4. Checkpoint - Verificar mapa procedural completo
  - Ensure all tests pass, ask the user if questions arise.
  - **Done criteria**:
    1. No se repite un sheet completo como TileSprite
    2. Mapa tiene exactamente 100×100 celdas
    3. Ground cubre todo el mapa sin frames transparentes
    4. Las 6 capas definidas en design.md existen
    5. Zona central permanece segura
    6. Mapa pasa MapValidator
    7. Misma seed produce mismo logicalGrid
    8. TypeScript, build y tests pasan
    9. Mapa renderiza correctamente en browser
    10. Tile indices usados están registrados en TileCatalog

- [ ] 5. Guerrero Jaguar y movimiento normalizado
  - [ ] 5.1 Crear `src/entities/Player.ts` con la clase Player extendiendo Phaser.Physics.Arcade.Sprite
    - Propiedades: hp, maxHp, level, levelXp, totalXp, xpThreshold, speed
    - Métodos: `takeDamage(amount)`, `heal(amount)`, `addXP(value): LevelUpResult`
    - `addXP` implementa lógica dual: incrementa levelXp y totalXp, detecta level-up con carry-over de exceso
    - En nivel 20: solo incrementa totalXp, levelXp queda clamped al threshold
    - _Requirements: 1.5, 5.1, 5.2, 5.6, 5.7, 5.10, 5.11_

  - [ ] 5.2 Crear `src/systems/PlayerManager.ts` con lógica de input y movimiento
    - Capturar input WASD y flechas
    - `calculateDirection()`: cancelación independiente por eje (W+S→0 en Y, pero D→1 en X)
    - Normalizar vector resultante para mantener magnitud = speed en diagonales
    - Si no hay input activo: velocidad = (0,0) (parada en 1 frame)
    - Aplicar movimiento con delta time: `position += direction * speed * (delta/1000)`
    - Clamp posición a [0, 3200]×[0, 3200]
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

  - [ ]* 5.3 Escribir property tests para movimiento (`src/systems/__tests__/movement.property.test.ts`)
    - **Property 1: Movement Speed Normalization** — magnitud del vector siempre = 200 para cualquier input válido
    - **Property 2: Axis-Independent Opposing Key Cancellation** — W+S+D→(200,0), A+D→(0,0)
    - **Property 3: Player Boundary Clamping** — posición siempre dentro de [0,3200]×[0,3200]
    - **Validates: Requirements 2.1, 2.2, 2.5, 2.6**

  - [ ]* 5.4 Escribir unit tests para PlayerManager (`src/systems/__tests__/movement.unit.test.ts`)
    - Test: parada inmediata al soltar teclas (1 frame)
    - Test: 8 direcciones cardinales y diagonales producen velocidad correcta
    - Test: input diagonal produce magnitud normalizada igual a velocidad base
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [ ] 6. Cámara y límites del mapa
  - [ ] 6.1 Configurar cámara en `GameScene.ts` para seguir al Player
    - `this.cameras.main.startFollow(player)` con bounds del mapa
    - Configurar `this.cameras.main.setBounds(0, 0, 3200, 3200)`
    - La cámara se detiene en los bordes del mapa (comportamiento nativo de Phaser con setBounds)
    - Nota: depende de que el mapa ya esté generado (Tarea 3) para que bounds tengan sentido visual
    - _Requirements: 2.4, 2.5_

- [x] 7. Enemy base y EnemyRegistry
  - [x] 7.1 Crear `src/entities/Enemy.ts` con la clase abstracta Enemy
    - Extender `Phaser.Physics.Arcade.Sprite`, implementar `IEnemy`
    - Propiedades abstractas: hp, maxHp, speed, damage, xpReward
    - `takeDamage(amount)`: reduce HP, si HP ≤ 0 llama `onDefeat()`
    - `onDefeat()`: emite evento `enemy-defeated` con posición y xpReward, desactiva sprite
    - Método abstracto `update(delta, playerPos)` para comportamiento específico
    - _Requirements: 9.2, 9.3_

  - [x] 7.2 Crear `src/systems/EnemyRegistry.ts` con el patrón factory/registry
    - Map de `string → EnemyFactory`
    - Métodos: `register(type, factory)`, `create(type, scene, x, y, config)`, `has(type)`, `getRegisteredTypes()`
    - Permite agregar nuevos tipos sin modificar código existente (Open/Closed Principle)
    - _Requirements: 9.5_

- [x] 8. Arquetipos de enemigos
  - [x] 8.1 Crear `src/entities/enemies/Esqueleto.ts`
    - HP=30, speed=80, damage=5, xpReward=5
    - `update(delta, playerPos)`: calcular dirección directa hacia playerPos, mover con delta time
    - Aplicar speedMultiplier de la oleada
    - _Requirements: 9.1 (Esqueleto)_

  - [x] 8.2 Crear `src/entities/enemies/Murcielago.ts`
    - HP=15, speed=150, damage=3, xpReward=3
    - `update(delta, playerPos)`: persecución con zigzag perpendicular a dirección de avance
    - Implementar oscilación sinusoidal con `zigzagPhase` incrementada por delta time
    - Amplitud y frecuencia configurables
    - _Requirements: 9.1 (Murciélago)_

  - [x] 8.3 Crear `src/entities/enemies/CalaveraLlameante.ts`
    - HP=50, speed=60, damage=10, xpReward=10
    - `update(delta, playerPos)`: persecución directa (como Esqueleto)
    - `onDefeat()`: override que verifica distancia al jugador, si ≤ 100px aplica 15 de daño
    - Emitir evento `explosion-damage` con posición y radio
    - _Requirements: 9.1 (Calavera Llameante)_

  - [x] 8.4 Crear `src/entities/enemies/SerpienteEmplumada.ts`
    - HP=80, speed=100 (inicial), damage=8, xpReward=15
    - `update(delta, playerPos)`: persecución con aceleración progresiva
    - `currentSpeed` incrementa por `acceleration * delta` hasta `maxSpeed` (configurable)
    - Dirección hacia playerPos, velocidad = min(currentSpeed, maxSpeed)
    - _Requirements: 9.1 (Serpiente Emplumada)_

  - [x] 8.5 Registrar los 4 arquetipos en EnemyRegistry dentro de `GameScene.create()`
    - Crear factories para cada tipo que instancian con hpMultiplier y speedMultiplier
    - Registrar: `esqueleto`, `murcielago`, `calavera_llameante`, `serpiente_emplumada`
    - _Requirements: 9.5, 9.4_

  - [x]* 8.6 Escribir property tests para comportamiento de enemigos (`src/systems/__tests__/enemy-behavior.property.test.ts`)
    - **Property 5: Enemy Pursuit Direction** — vector velocidad apunta de E hacia P con magnitud = speed × speedMultiplier
    - **Property 6: Enemy Defeat Produces Correctly Valued XP Orb** — derrota genera exactamente 1 orbe con xpReward correcto
    - **Validates: Requirements 3.3, 3.4, 8.1**

  - [x]* 8.7 Escribir unit tests para arquetipos (`src/entities/__tests__/enemies.unit.test.ts`)
    - Test: Murciélago genera oscilación perpendicular a dirección de avance
    - Test: CalaveraLlameante aplica 15 daño si jugador dentro de 100px al morir
    - Test: CalaveraLlameante NO aplica daño si jugador fuera de 100px
    - Test: SerpienteEmplumada acelera progresivamente y no supera maxSpeed
    - **Validates: Requirements 9.1**

- [ ] 9. Checkpoint - Verificar entidades base
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. SpawnManager y gestión de límite de enemigos
  - [ ] 10.1 Crear `src/systems/SpawnManager.ts`
    - Acumular delta time en `spawnTimer`; cuando `spawnTimer >= spawnInterval`, intentar spawn
    - `findValidSpawnPosition(camera)`: generar posición que cumple 3 condiciones simultáneas:
      1. Fuera del viewport de la cámara
      2. Dentro de límites del mapa [0, 3200]×[0, 3200]
      3. Entre 50 y 300px del borde visible de la cámara
    - Si no hay posición válida → retornar null, cancelar spawn, reintentar en siguiente intervalo
    - `setWaveConfig(config)`: actualizar spawnInterval, maxEnemies, enemyTypes
    - Nota: spawn en celdas walkable del mapa generado (consultar grid lógica si necesario)
    - _Requirements: 3.1, 3.2_

  - [ ] 10.2 Implementar cap de enemigos y despawn por distancia en SpawnManager
    - Si `getActiveEnemyCount() >= maxEnemies` (default 100, configurable por oleada): NO generar nuevos
    - `despawnDistantEnemies(playerPos)`: eliminar enemigos a >1500px sin XP ni orbe
    - Ejecutar despawn check cada frame en `update(delta)`
    - _Requirements: 3.5, 3.6_

  - [ ] 10.3 Implementar selección de tipo de enemigo según pesos de la oleada
    - Usar `EnemyTypeWeight[]` de WaveConfig para selección ponderada aleatoria
    - Crear enemigo via `EnemyRegistry.create(type, scene, x, y, spawnConfig)`
    - Pasar hpMultiplier y speedMultiplier de la oleada actual
    - _Requirements: 6.2, 9.4_

  - [ ]* 10.4 Escribir property tests para SpawnManager (`src/systems/__tests__/spawn-manager.property.test.ts`)
    - **Property 4: Spawn Position Triple Constraint** — posición siempre fuera viewport, dentro mapa, 50-300px del borde visible; null si no existe
    - **Property 7: Max Enemies Cap per Wave** — nunca excede maxEnemies configurado
    - **Property 8: Enemy Despawn by Distance** — enemigos a >1500px eliminados sin XP/orbe
    - **Validates: Requirements 3.1, 3.2, 3.5, 3.6**

- [ ] 11. Sistema de oleadas y modos Campaña/Infinito
  - [ ] 11.1 Crear `src/systems/WaveManager.ts`
    - `waveTimer` acumula delta time; al alcanzar `waveDuration` (30s) → transición
    - `transitionTimer`: pausa de ≤2s entre oleadas, emitir evento `wave-changed`
    - `calculateDifficulty(wave)`: aplicar fórmulas exponenciales
      - `spawnInterval = max(2 × 0.9^(wave-1), 0.5)`
      - `hpMultiplier = min(1.15^(wave-1), 5)`
      - `speedMultiplier = min(1.05^(wave-1), 2)`
    - Notificar SpawnManager con nueva config al iniciar oleada
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 11.2 Implementar lógica de Modo Campaña y Modo Infinito en WaveManager
    - `isVictory()`: Campaña retorna true si currentWave > finalWave; Infinito siempre false
    - `resolveWaveConfig(wave)`: si wave > última oleada configurada, repetir parámetros de la última SIN escalado adicional
    - Al detectar victoria → emitir evento para transicionar a VictoryScene con stats
    - Preservar enemigos existentes entre oleadas (NO limpiar pool al cambiar oleada)
    - _Requirements: 6.4, 6.5, 3.7_

  - [ ]* 11.3 Escribir property tests para WaveManager (`src/systems/__tests__/wave-manager.property.test.ts`)
    - **Property 17: Exponential Difficulty Scaling with Clamping** — fórmulas correctas con floor/ceiling
    - **Property 18: Infinite Mode Repeats Last Wave Config** — wave > C usa parámetros de C sin escalado extra
    - **Property 19: Wave-to-Enemy-Type Mapping** — tipos correctos por rango de oleada
    - **Validates: Requirements 6.2, 6.3, 6.5, 9.4**

  - [ ]* 11.4 Escribir unit tests para WaveManager (`src/systems/__tests__/wave-manager.unit.test.ts`)
    - Test: transición de oleada en ≤2s
    - Test: display de número de oleada emitido tras transición
    - Test: enemigos de oleada anterior sobreviven la transición
    - Test: victoria en Modo Campaña al completar oleada final
    - Test: modo infinito nunca retorna victoria
    - **Validates: Requirements 6.1, 6.4, 6.5, 3.7**

- [ ] 12. DamageSystem y colisiones
  - [ ] 12.1 Crear `src/systems/DamageSystem.ts`
    - `checkProjectileEnemyCollisions()`: overlap proyectil↔enemigo → `enemy.takeDamage(weaponDamage)`, destruir proyectil
    - Si `enemy.hp <= 0` → `handleEnemyDefeat(enemy, playerPos)`
    - `handleEnemyDefeat`: emitir `enemy-defeated`, manejar explosión de CalaveraLlameante
    - _Requirements: 4.2, 4.3_

  - [ ] 12.2 Implementar colisión enemigo↔jugador con cooldown de contacto
    - `checkEnemyPlayerCollisions(delta)`: overlap enemigo↔jugador
    - Map `contactCooldowns: Map<string, number>` — almacena timestamp del último daño por enemigo
    - Aplicar daño solo si han pasado ≥1000ms desde último contacto de ESE enemigo
    - Actualizar cooldowns con delta time
    - Emitir evento `hp-changed` tras aplicar daño
    - Si HP jugador ≤ 0 → emitir evento `player-defeated` → transicionar a DefeatScene
    - _Requirements: 4.4, 4.5_

  - [ ]* 12.3 Escribir property tests para DamageSystem (`src/systems/__tests__/damage-system.property.test.ts`)
    - **Property 10: Damage Application and Defeat Trigger** — HP se reduce por daño del arma, proyectil destruido, defeat si HP≤0
    - **Property 11: Contact Damage Cooldown** — máximo 1 daño por 1000ms por enemigo individual
    - **Validates: Requirements 4.2, 4.3, 4.4**

  - [ ]* 12.4 Escribir unit tests para DamageSystem (`src/systems/__tests__/damage-system.unit.test.ts`)
    - Test: CalaveraLlameante explota y daña al jugador si ≤100px
    - Test: jugador con HP=0 transiciona a DefeatScene
    - Test: cooldown se respeta independientemente del frame rate
    - **Validates: Requirements 4.4, 4.5, 9.1**

- [ ] 13. Arma automática y proyectiles
  - [ ] 13.1 Crear `src/systems/WeaponSystem.ts`
    - `fireTimer` acumula delta time; al alcanzar `fireRate` (1000ms base) → disparar
    - `findClosestEnemy(playerPos, enemies)`: enemigo con menor distancia euclidiana, dentro de 800px
    - Si no hay enemigo en rango → no dispara
    - `fireProjectile(from, target)`: obtener proyectil del pool, setear velocidad hacia target
    - _Requirements: 4.1_

  - [ ] 13.2 Implementar pool de proyectiles y destrucción por distancia
    - Usar `Phaser.GameObjects.Group` como pool (create con maxSize)
    - `updateProjectiles(delta)`: mover proyectiles, acumular distancia recorrida
    - Si distancia recorrida ≥ 1000px sin colisión → destruir/reciclar proyectil
    - _Requirements: 4.6_

  - [ ]* 13.3 Escribir property tests para WeaponSystem (`src/systems/__tests__/weapon-system.property.test.ts`)
    - **Property 9: Closest Enemy Targeting** — siempre selecciona el más cercano dentro de 800px; null si ninguno en rango
    - **Property 12: Projectile Max Travel Distance** — proyectil destruido al recorrer ≥1000px
    - **Validates: Requirements 4.1, 4.6**

- [ ] 14. Checkpoint - Verificar combate completo
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Orbes de XP
  - [ ] 15.1 Crear `src/entities/XPOrb.ts` como sprite con valor de XP
    - Propiedades: value, creationTime, isAttracted
    - Sprite simple (círculo verde/dorado)
    - _Requirements: 8.1_

  - [ ] 15.2 Crear `src/systems/OrbCollector.ts`
    - `spawnOrb(position, value)`: crear orbe en posición del enemigo derrotado (pool)
    - `update(delta, playerPos)`:
      - Para cada orbe: calcular distancia al jugador
      - Si distancia ≤ 100px → mover orbe hacia jugador a 400px/s (scaled por delta)
      - Si colisiona con hitbox del jugador → recoger (emitir `xp-changed`)
    - `removeExpiredOrbs(currentTime)`: eliminar orbes con lifetime > 30s
    - `enforceOrbCap()`: si orbes > 200, eliminar los más antiguos (FIFO)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 15.3 Integrar OrbCollector con sistema de derrota de enemigos
    - Escuchar evento `enemy-defeated` → llamar `spawnOrb(pos, xpReward)`
    - Al recoger orbe → llamar `XPSystem.addXP(player, value)`
    - En nivel 20: solo incrementar totalXp al recoger orbe
    - _Requirements: 3.4, 8.3, 8.6_

  - [ ]* 15.4 Escribir property tests para OrbCollector (`src/systems/__tests__/orb-collector.property.test.ts`)
    - **Property 23: Orb Attraction Behavior** — orbe se mueve a 400px/s si distancia ≤100px, estático si >100px
    - **Property 24: Orb Lifetime Expiration** — orbes eliminados después de 30s
    - **Property 25: Orb Pool Cap with FIFO Removal** — nunca más de 200 orbes, elimina más antiguos primero
    - **Validates: Requirements 8.2, 8.4, 8.5**

- [ ] 16. Modelo XP dual y sistema de nivelación
  - [ ] 16.1 Crear `src/systems/XPSystem.ts`
    - `calculateThreshold(level)`: `level * 10 + 5`
    - `addXP(player, value)`: incrementar levelXp y totalXp
      - Si level = 20: solo totalXp, levelXp = threshold (clamped)
      - Si levelXp >= threshold y level < 20:
        - level++, levelXp -= threshold (carry-over de exceso)
        - Nuevo threshold = calculateThreshold(newLevel)
        - Si newLevel < 20 Y upgradePool no vacío → retornar `{leveledUp: true, showPanel: true}`
        - Si newLevel = 20 O upgradePool vacío → retornar `{leveledUp: true, showPanel: false}`
    - `getRandomUpgrades(count)`: retornar min(3, pool.length) mejoras únicas aleatorias
    - `applyUpgrade(player, upgrade)` y `removeUpgradeFromPool(upgradeId)`
    - _Requirements: 5.1, 5.2, 5.3, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11_

  - [ ]* 16.2 Escribir property tests para XPSystem (`src/systems/__tests__/xp-system.property.test.ts`)
    - **Property 13: XP Dual Counter Increment** — levelXp y totalXp incrementan por V; en nivel 20 solo totalXp
    - **Property 14: Level-Up Excess Carry-Over** — exceso = levelXp - threshold, se conserva como progreso
    - **Property 15: Upgrade Selection Uniqueness and Count** — 3 si N≥3, N si 0<N<3, vacío si N=0
    - **Property 16: XP Threshold Formula** — threshold = level × 10 + 5, inicial = 15
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.6, 5.7, 5.8, 5.9, 8.3, 8.6**

  - [ ]* 16.3 Escribir unit tests para XPSystem (`src/systems/__tests__/xp-system.unit.test.ts`)
    - Test: nivel 20 no incrementa level, no muestra panel
    - Test: pool vacío → omite panel, reanuda inmediatamente
    - Test: pool con 1-2 opciones → muestra todas
    - Test: carry-over de exceso correcto (e.g., threshold=15, xp=20 → excess=5)
    - Test: barra XP no se reinicia a 0% tras level-up (muestra excess/newThreshold)
    - **Validates: Requirements 5.8, 5.9, 5.10, 5.11, 7.6**

- [ ] 17. Pool de mejoras y selección
  - [ ] 17.1 Integrar flujo completo de level-up en GameScene
    - Cuando `addXP` retorna `showPanel: true`:
      1. Llamar `PauseSystem.pause()`
      2. Obtener `getRandomUpgrades(3)` del XPSystem
      3. Emitir evento `level-up` con array de upgrades hacia HUDScene
      4. HUDScene muestra LevelUpPanel con las opciones
    - Al seleccionar mejora:
      1. `XPSystem.applyUpgrade(player, selectedUpgrade)`
      2. `XPSystem.removeUpgradeFromPool(upgrade.id)`
      3. `PauseSystem.resume()`
    - Si pool vacío o nivel 20: NO pausar, NO mostrar panel
    - _Requirements: 5.3, 5.4, 5.5, 5.8, 5.9, 5.10, 5.11_

- [ ] 18. PauseSystem
  - [ ] 18.1 Crear `src/systems/PauseSystem.ts`
    - Propiedad `isPaused: boolean` (getter público)
    - `pause()`: setear flag, congelar TODOS los sistemas:
      - Movimiento del jugador y enemigos
      - Proyectiles (parar movimiento)
      - Armas automáticas y sus cooldowns
      - Físicas y colisiones
      - Aplicación de daño
      - Generación de enemigos (spawns)
      - Temporizadores de oleada y supervivencia
      - Movimiento y recolección de orbes
    - `resume()`: restaurar flag, reanudar desde el estado anterior (timers conservan tiempo restante)
    - _Requirements: 5.4, 5.5_

  - [ ]* 18.2 Escribir unit tests para PauseSystem (`src/systems/__tests__/pause-system.unit.test.ts`)
    - Test: durante pausa ningún sistema actualiza posiciones ni timers
    - Test: al reanudar, timers conservan su progreso (no reinician)
    - Test: pausa congela spawns, orbes, proyectiles simultáneamente
    - **Validates: Requirements 5.4, 5.5**

- [ ] 19. HUD completo
  - [ ] 19.1 Implementar `HealthBar` en HUDScene
    - Barra en esquina superior izquierda
    - `fillRatio = hp / maxHp`, clamped [0, 1]
    - Actualizar en el mismo frame vía evento `hp-changed`
    - _Requirements: 7.1, 7.4_

  - [ ] 19.2 Implementar `XPBar` en HUDScene
    - Barra de experiencia con `fillRatio = levelXp / threshold`, clamped [0, 1]
    - Tras level-up: mostrar `excessXp / newThreshold` (NO reiniciar a 0%)
    - En nivel 20: permanece a 100%
    - Actualizar en el mismo frame vía evento `xp-changed`
    - _Requirements: 7.2, 7.5, 7.6_

  - [ ] 19.3 Implementar `WaveDisplay` y `TimerDisplay` en HUDScene
    - WaveDisplay: número de oleada actual, anuncio breve al cambiar
    - TimerDisplay: formato MM:SS (floor(s/60) pad 2 : floor(s%60) pad 2)
    - Timer usa delta time para acumulación (independiente de frame rate)
    - _Requirements: 7.3_

  - [ ] 19.4 Implementar `LevelUpPanel` en HUDScene
    - Panel overlay que muestra 1-3 opciones de mejora (cards clickeables)
    - Al click → emitir evento `upgrade-selected` con la mejora elegida
    - Desaparecer tras selección
    - _Requirements: 5.3, 5.5, 5.8_

  - [ ]* 19.5 Escribir property tests para HUD (`src/systems/__tests__/hud.property.test.ts`)
    - **Property 20: Health Bar Proportional Fill** — fillRatio = hp/maxHp clamped [0,1]
    - **Property 21: XP Bar Proportional Fill with Level-Up Excess** — levelXp/threshold; excess/newThreshold tras level-up; 100% en nivel 20
    - **Property 22: Timer Format MM:SS** — formato correcto para cualquier S≥0
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.6, 5.10**

- [ ] 20. Checkpoint - Verificar progresión y HUD
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 21. Victoria, derrota y estadísticas
  - [ ] 21.1 Implementar flujo completo de derrota
    - DamageSystem detecta HP ≤ 0 → emitir `player-defeated`
    - GameScene escucha evento → pasar stats a DefeatScene (survivalTime, totalXp)
    - DefeatScene muestra estadísticas con opción de reintentar
    - _Requirements: 4.5_

  - [ ] 21.2 Implementar flujo completo de victoria (Modo Campaña)
    - WaveManager detecta currentWave > finalWave → emitir `victory`
    - GameScene escucha evento → pasar stats a VictoryScene
    - VictoryScene muestra: tiempo total, oleada máxima, enemigos derrotados, XP total, nivel
    - _Requirements: 6.4_

  - [ ] 21.3 Implementar contador de estadísticas en GameScene
    - Tracker: survivalTime (acumula delta), enemiesDefeated (incrementa en defeat), maxWave
    - Pasar struct de stats a las escenas de fin de juego
    - _Requirements: 6.4, 4.5_

- [ ] 22. Integración Delta Time en todos los sistemas
  - [ ] 22.1 Auditar y garantizar uso de Delta Time en todos los cálculos temporales
    - PlayerManager: `position += direction * speed * (delta/1000)`
    - Enemy.update: `position += direction * speed * (delta/1000)`
    - SerpienteEmplumada: `currentSpeed += acceleration * (delta/1000)`
    - WeaponSystem: `fireTimer += delta`
    - SpawnManager: `spawnTimer += delta`
    - WaveManager: `waveTimer += delta/1000`
    - OrbCollector: `orbPosition += direction * attractSpeed * (delta/1000)`
    - OrbCollector: lifetime tracking con delta
    - DamageSystem: cooldown tracking con delta
    - TimerDisplay: survivalTime acumula delta
    - Proyectiles: `distance += speed * (delta/1000)`
    - _Requirements: NFR-DeltaTime (todos los sistemas)_

  - [ ]* 22.2 Escribir property test para Delta Time (`src/systems/__tests__/delta-time.property.test.ts`)
    - **Property 26: Delta Time Independence** — duplicar delta duplica desplazamiento; escala lineal
    - Testear con deltas variados (1ms, 16ms, 33ms, 100ms) para movimiento, cooldowns, timers
    - **Validates: Requirements 2.1, 3.3, 4.1, 4.4, 6.1, 6.3, 8.2, 8.4**

- [ ] 23. Integración final y wiring de sistemas en GameScene
  - [ ] 23.1 Cablear todos los sistemas en `GameScene.create()` y `GameScene.update()`
    - Instanciar: PauseSystem, PlayerManager, SpawnManager, WaveManager, DamageSystem, XPSystem, WeaponSystem, OrbCollector
    - En `update(time, delta)`:
      - Si `pauseSystem.isPaused` → return (skip all)
      - Llamar en orden: PlayerManager, WaveManager, SpawnManager, enemies.update, WeaponSystem, DamageSystem, OrbCollector
    - Registrar event listeners entre sistemas (enemy-defeated, hp-changed, xp-changed, wave-changed, level-up, player-defeated, victory)
    - _Requirements: 1.1, 1.2_

  - [ ] 23.2 Configurar physics overlaps y colliders en GameScene
    - Overlap: proyectiles ↔ grupo enemigos → DamageSystem.checkProjectileEnemyCollisions
    - Overlap: grupo enemigos ↔ player → DamageSystem.checkEnemyPlayerCollisions
    - Overlap: grupo orbes ↔ player → OrbCollector collectOrb
    - Player y enemigos collide con Walls y Obstacles layers del mapa generado
    - Player collide con world bounds
    - _Requirements: 4.2, 4.4, 8.3, 10.6_

  - [ ] 23.3 Implementar GameModeConfig y selección de modo
    - Soporte para configurar `{ mode: 'campaign', finalWave: 10 }` o `{ mode: 'infinite', finalWave: null }`
    - Pasar config al WaveManager en create()
    - _Requirements: 6.4, 6.5_

- [ ] 24. Configuración de testing y framework
  - [ ] 24.1 Instalar y configurar Vitest + fast-check
    - Agregar `vitest` y `fast-check` como devDependencies
    - Crear `vitest.config.ts` con configuración para TypeScript
    - Agregar script `"test": "vitest --run"` en package.json
    - Crear estructura de directorios `src/systems/__tests__/`, `src/entities/__tests__/`, `src/map/__tests__/`
    - _Requirements: NFR-Architecture_

- [ ] 25. Checkpoint final - Verificar integración completa
  - Ensure all tests pass, ask the user if questions arise.
  - Verificar que las 36 propiedades de correctness tienen cobertura de tests
  - Verificar que todos los requisitos 1-10 están cubiertos por tareas de implementación

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Property tests validan las **36 propiedades universales** de correctness del diseño (Properties 1-36)
- Unit tests validan escenarios específicos, edge cases y comportamientos de arquetipos
- Todos los sprites usan placeholders (rectángulos coloreados) — assets finales se integran después
- Object pooling (proyectiles, orbes) es esencial para mantener 60fps con 100 enemigos + 200 orbes
- La lógica pura (normalización, fórmulas, threshold, SeededRandom, MapValidator) se extrae en funciones testables sin Phaser
- El orden de ejecución en `update()` es crítico: PlayerManager → WaveManager → SpawnManager → Enemies → WeaponSystem → DamageSystem → OrbCollector
- **El mapa DEBE estar generado antes de instanciar Player, configurar cámara, y habilitar sistemas de spawn/navegación**
- **Balance decisions (no bloquean implementación)**:
  - `damagePerSecond` de líquidos: configurable, valores concretos se ajustan en fase de balanceo
  - Colisiones proyectil↔muro: NO implementadas, pendiente de definición en requisitos
  - Density defaults (wallDensity, obstacleDensity, liquidDensity, decorationDensity): parámetros de tuning configurables, valores iniciales se ajustan visualmente

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "1.5", "24.1"] },
    { "id": 2, "tasks": ["2.1", "2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5"] },
    { "id": 4, "tasks": ["3.1", "3.2"] },
    { "id": 5, "tasks": ["3.3", "3.4", "3.5"] },
    { "id": 6, "tasks": ["3.6", "3.7", "3.8"] },
    { "id": 7, "tasks": ["3.9", "3.10", "3.11"] },
    { "id": 8, "tasks": ["3.12", "3.13", "3.14", "3.15"] },
    { "id": 9, "tasks": ["3.16", "3.17"] },
    { "id": 10, "tasks": ["3.18", "3.19", "3.20"] },
    { "id": 11, "tasks": ["3.21", "3.22"] },
    { "id": 12, "tasks": ["3.23", "3.24"] },
    { "id": 13, "tasks": ["3.25", "3.26", "3.27", "3.28"] },
    { "id": 14, "tasks": ["5.1", "5.2", "7.1", "7.2"] },
    { "id": 15, "tasks": ["5.3", "5.4", "6.1", "8.1", "8.2", "8.3", "8.4"] },
    { "id": 16, "tasks": ["8.5", "8.6", "8.7", "18.1"] },
    { "id": 17, "tasks": ["10.1", "11.1", "13.1"] },
    { "id": 18, "tasks": ["10.2", "10.3", "11.2", "13.2", "12.1"] },
    { "id": 19, "tasks": ["10.4", "11.3", "11.4", "12.2", "13.3"] },
    { "id": 20, "tasks": ["12.3", "12.4", "15.1", "15.2", "16.1"] },
    { "id": 21, "tasks": ["15.3", "15.4", "16.2", "16.3", "18.2"] },
    { "id": 22, "tasks": ["17.1", "19.1", "19.2", "19.3"] },
    { "id": 23, "tasks": ["19.4", "19.5", "21.1", "21.2", "21.3"] },
    { "id": 24, "tasks": ["22.1", "22.2"] },
    { "id": 25, "tasks": ["23.1", "23.2", "23.3"] }
  ]
}
```
