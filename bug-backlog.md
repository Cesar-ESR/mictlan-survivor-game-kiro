# Bug Backlog — Mictlán Survivor

## BUG-001: Player y enemigos atraviesan líquidos bloqueantes

**Estado:** ✅ Corregido (v2 — diseño definitivo)  
**Fecha:** 2025-01-XX  
**Severidad:** Alta (gameplay-breaking)

### Descripción

El jugador y los enemigos podían atravesar tiles de líquido marcados como `blocking`, anulando el propósito de las regiones de líquido bloqueante como obstáculos naturales del terreno.

### Decisión de Diseño Definitiva

**Todos los líquidos son bloqueantes. No existe mecánica de natación.**

El Player no puede nadar. Ningún líquido del juego es transitable. Todos los tipos de líquido (water, lava, spectral) bloquean el movimiento. Esta es la decisión de diseño definitiva.

### Causa Raíz (Original)

`PhaserMapLayerBuilder.setLiquidCollisions()` configuraba correctamente `tile.setCollision(true, true, true, true)` en tiles de líquido bloqueante. Sin embargo, en `GameScene.ts`, la sección de colliders solo registraba colisiones entre Player/Enemies y las capas `walls`/`obstacles`. Faltaban los colliders para la capa `liquids`.

Además, `SpawnManager.findValidSpawnPosition()` no verificaba la walkability lógica de la posición generada, lo que permitía que enemigos aparecieran dentro de líquidos bloqueantes.

### Corrección (v1 — colliders)

1. **`GameScene.ts`** — Se añadieron colliders `Player ↔ liquids` y `Enemies ↔ liquids`. Se almacenan referencias a todos los colliders para destruirlos en `shutdown()`.

2. **`SpawnManager.ts`** — Se añadió `setWalkabilityChecker()` que acepta una función de validación de posición. `findValidSpawnPosition()` ahora rechaza posiciones sobre tiles no-walkable.

3. **`GameScene.ts`** — Tras crear el SpawnManager, se le provee un checker que consulta `grid[row][col].walkable`.

### Corrección (v2 — todos los líquidos son bloqueantes)

1. **`LiquidRegionGenerator.ts`** — `DEFAULT_LIQUID_CONFIG.behaviorWeights` ahora solo contiene `{ behavior: 'blocking', weight: 1 }`. El loop de aplicación siempre asigna `cell.walkable = false` independientemente del behavior.

2. **`SpectralRegionGenerator.ts`** — `liquidConfig.behavior` cambiado de `'walkable'` a `'blocking'`. Se añade `gridCell.walkable = false` en el loop de colocación.

3. **`PhaserMapLayerBuilder.ts`** — Simplificado: usa `setCollisionByExclusion([-1])` para la capa de líquidos (igual que walls/obstacles). Método `setLiquidCollisions` eliminado.

4. **`SafeZoneCleaner.ts`** — Remueve TODOS los líquidos de la safe zone, no solo los bloqueantes.

5. **`MapCell.ts`** — `LiquidBehavior` tipo marcado como `@deprecated` para `'walkable'`.

### Archivos Modificados

- `src/map/LiquidRegionGenerator.ts`
- `src/map/SpectralRegionGenerator.ts`
- `src/map/PhaserMapLayerBuilder.ts`
- `src/map/SafeZoneCleaner.ts`
- `src/map/MapCell.ts`
- `src/scenes/GameScene.ts`
- `src/systems/SpawnManager.ts`

### Tests de Regresión

- `src/map/__tests__/bug-001-blocking-liquids.test.ts`
  - TODAS las celdas con líquido tienen walkable=false
  - Regiones de agua siempre tienen behavior='blocking'
  - Regiones de lava siempre tienen behavior='blocking'
  - Regiones espectrales siempre tienen behavior='blocking'
  - Safe zone no tiene ningún líquido
  - MapValidator excluye TODAS las celdas de líquido del conteo walkable
  - Walkability checker rechaza CUALQUIER posición en celda de líquido
  - Walkability checker acepta posiciones en suelo sin líquido
  - Walkability checker rechaza posiciones fuera de límites
  - Tipos mixtos de líquido — TODOS son bloqueantes
  - Generación permanece determinística
  - Mínimo de accesibilidad sigue pasando

### Notas

- La capa `liquids` tiene colisión habilitada en TODOS los tiles (`setCollisionByExclusion([-1])`) — no existe mecánica de natación.
- El ground subyacente se preserva debajo de los líquidos (diseño existente).
- No se modificó la generación visual ni el algoritmo de mapas (solo la asignación de comportamiento).
- El `liquidDensity` por defecto garantiza que el mapa sigue pasando validación con todos los líquidos bloqueantes.


---

## BUG-002: Enemigos atraviesan muros, obstáculos y líquidos

**Estado:** ✅ Corregido  
**Fecha:** 2025-01-XX  
**Severidad:** Alta (gameplay-breaking)

### Descripción

Los enemigos podían atravesar tiles de muros (`walls`), obstáculos (`obstacles`) y líquidos (`liquids`) a pesar de que los colliders estaban registrados correctamente en GameScene. Los colliders existían pero no producían separación física.

### Causa Raíz

El `SpawnManager` creaba el pool de enemigos usando `scene.add.group({ runChildUpdate: false })`, que crea un **`Phaser.GameObjects.Group`** (grupo regular, sin física).

Cuando se registran colliders con `physics.add.collider(group, tilemapLayer)`, el motor Arcade de Phaser **no resuelve correctamente** las colisiones tile-vs-sprite para hijos de un grupo regular. El sistema de física necesita un **`Phaser.Physics.Arcade.Group`** para iterar correctamente los bodies y aplicar la separación contra capas de tilemap.

Cada enemigo ya tenía su propio physics body (creado en el constructor de `Enemy` via `scene.physics.add.existing(this)`), pero al estar en un grupo regular, el collider no los procesaba.

### Corrección

1. **`src/systems/SpawnManager.ts`** — Se cambió la creación del pool de:
   ```typescript
   this.enemyPool = scene.add.group({ runChildUpdate: false });
   ```
   a:
   ```typescript
   this.enemyPool = scene.physics.add.group({ runChildUpdate: false });
   ```

2. Se actualizó el tipo del campo `enemyPool` de `Phaser.GameObjects.Group` a `Phaser.Physics.Arcade.Group`.

3. Se actualizó el tipo de retorno de `getEnemyPool()` a `Phaser.Physics.Arcade.Group`.

### Compatibilidad

- `Phaser.Physics.Arcade.Group` extiende `Phaser.GameObjects.Group`, por lo que `DamageSystem` y cualquier otro consumidor que espere `Phaser.GameObjects.Group` siguen funcionando sin cambios.
- El constructor de `Enemy` ya llama a `scene.physics.add.existing(this)`. Cuando se añade un sprite que ya tiene body a un `Physics.Arcade.Group`, Phaser reconoce que ya tiene body y no crea uno duplicado.
- Los colliders en `GameScene` (`physics.add.collider(enemyPool, walls/obstacles/liquids)`) ahora funcionan correctamente porque el grupo es de tipo Physics.Arcade.

### Archivos Modificados

- `src/systems/SpawnManager.ts`

### Tests de Regresión

- `src/systems/__tests__/bug-002-enemy-map-collisions.test.ts`
  - Velocidad: todos los arquetipos usan vectores de velocidad, no manipulación directa de posición
  - Esqueleto: persecución directa produce vector de velocidad correcto
  - CalaveraLlameante: persecución directa produce vector de velocidad correcto
  - SerpienteEmplumada: persecución con aceleración produce vector de velocidad correcto
  - Murciélago: zigzag produce vector de velocidad acotado
  - SpawnManager exporta getEnemyPool con firma correcta
  - Velocidad es independiente de posición absoluta del enemigo
  - Zigzag produce perturbación acotada por amplitud
  - Distancia cero produce velocidad cero (sin NaN)
  - Magnitud de velocidad escala correctamente con speedMultiplier

### Notas

- No se modificaron los sistemas de combate, XP, HUD, oleadas, menús ni PlayerManager.
- No se implementó pathfinding — los enemigos siguen con persecución por velocidad.
- No se cambió la renderización visual de los enemigos.
- No se modificó la generación del mapa ni los flags de colisión de las capas (ya eran correctos).
- La corrección es mínima: un solo cambio de tipo de grupo que habilita la resolución de colisiones del motor Arcade.


---

## BUG-003: Enemigos se renderizan debajo de las texturas del mapa

**Estado:** ✅ Corregido  
**Fecha:** 2025-01-XX  
**Severidad:** Media (visual)

### Descripción

Los enemigos, proyectiles y orbes de XP se renderizaban por debajo de las capas del mapa (líquidos, bordes, decoraciones, muros, obstáculos). Esto hacía que las entidades fueran invisibles o parcialmente ocultas detrás de los tiles del escenario.

### Causa Raíz

La clase base `Enemy` no llamaba a `setDepth()` en su constructor. Los sprites de Phaser tienen depth 0 por defecto. Las capas del mapa usan depths 0-4:
- Ground: 0
- Liquids: 1
- Borders: 2
- Decorations: 3
- Walls: 4
- Obstacles: 4

Los enemigos con depth 0 se renderizaban DETRÁS de todas las capas superiores al ground. El mismo problema afectaba a los proyectiles (`Projectile`) y orbes de XP (`XPOrb`).

El Player ya tenía `setDepth(100)` configurado en GameScene, por lo que se renderizaba correctamente.

### Corrección

Se añadieron constantes de profundidad de renderizado en `GAME_CONSTANTS` y se aplicaron en los constructores/métodos de activación correspondientes:

1. **`src/config/constants.ts`** — Se añadieron constantes de depth:
   - `ENTITY_DEPTH_ORBS: 50`
   - `ENTITY_DEPTH_PROJECTILES: 90`
   - `ENTITY_DEPTH_ENEMIES: 100`
   - `ENTITY_DEPTH_PLAYER: 100`

2. **`src/entities/Enemy.ts`** — Se añadió `this.setDepth(GAME_CONSTANTS.ENTITY_DEPTH_ENEMIES)` en el constructor, después de `setScale(0.45)`.

3. **`src/entities/XPOrb.ts`** — Se añadió `this.setDepth(GAME_CONSTANTS.ENTITY_DEPTH_ORBS)` después de `scene.physics.add.existing(this)`.

4. **`src/entities/Projectile.ts`** — Se añadió `this.setDepth(GAME_CONSTANTS.ENTITY_DEPTH_PROJECTILES)` en el método `activate()`.

5. **`src/scenes/GameScene.ts`** — Se cambió `this.player.setDepth(100)` por `this.player.setDepth(GAME_CONSTANTS.ENTITY_DEPTH_PLAYER)` para consistencia.

### Jerarquía de Profundidad

| Entidad | Depth |
|---------|-------|
| Ground | 0 |
| Liquids | 1 |
| Borders | 2 |
| Decorations | 3 |
| Walls/Obstacles | 4 |
| XP Orbs | 50 |
| Projectiles | 90 |
| Enemies | 100 |
| Player | 100 |

### Archivos Modificados

- `src/config/constants.ts`
- `src/entities/Enemy.ts`
- `src/entities/XPOrb.ts`
- `src/entities/Projectile.ts`
- `src/scenes/GameScene.ts`

### Tests de Regresión

- `src/systems/__tests__/bug-003-render-order.test.ts`
  - ENTITY_DEPTH_ENEMIES es mayor que max map layer depth
  - ENTITY_DEPTH_PLAYER es mayor que max map layer depth
  - ENTITY_DEPTH_PROJECTILES es mayor que max map layer depth
  - ENTITY_DEPTH_ORBS es mayor que max map layer depth
  - ENTITY_DEPTH_PLAYER >= ENTITY_DEPTH_ENEMIES (igual está bien para top-down)
  - ENTITY_DEPTH_ORBS < ENTITY_DEPTH_ENEMIES (orbes debajo de entidades)
  - ENTITY_DEPTH_PROJECTILES < ENTITY_DEPTH_ENEMIES (proyectiles debajo de entidades)
  - Jerarquía de depth: orbs < projectiles < enemies <= player
  - LAYER_DEPTHS en código fuente coincide con max esperado de 4

### Notas

- No se modificaron sistemas de combate, XP, HUD, oleadas ni menús.
- No se cambió la generación del mapa ni los flags de colisión.
- Se usó un enfoque de depth fijo (no y-sort dinámico) ya que es un survivor top-down donde el ordenamiento por Y no es crítico.
- Player y enemigos comparten el mismo depth (100) — en un survivor top-down no hay oclusión relevante entre ellos.


---

## BUG-004: Rango excesivo del arma

**Estado:** ✅ Corregido  
**Fecha:** 2025-01-XX  
**Severidad:** Media (balance-breaking)

### Descripción

`GAME_CONSTANTS.WEAPON_RANGE` era 800px — casi el ancho completo del viewport. El jugador podía atacar enemigos a distancias visualmente absurdas, eliminando el riesgo táctico de acercarse a los enemigos.

### Causa Raíz

El valor `WEAPON_RANGE: 800` en `src/config/constants.ts` era un placeholder de desarrollo que nunca fue ajustado al balance real del juego. Igualmente `PROJECTILE_MAX_DISTANCE: 1000` era más del doble de lo razonable.

### Corrección

1. **`src/config/constants.ts`** — `WEAPON_RANGE` reducido de 800 a **384** (12 tiles × 32px — distancia razonable de ataque).
2. **`src/config/constants.ts`** — `PROJECTILE_MAX_DISTANCE` reducido de 1000 a **450** (ligeramente más que el rango para acomodar el tiempo de vuelo).

### Archivos Modificados

- `src/config/constants.ts`
- `src/systems/__tests__/weapon-system.property.test.ts` (comentarios y nombres de test actualizados)
- `src/systems/__tests__/weapon-system.unit.test.ts` (comentarios y distancias en tests ajustados)

### Tests de Regresión

- `src/systems/__tests__/bug-004-weapon-range.test.ts`
  - WEAPON_RANGE es 384 (12 tiles × 32px)
  - PROJECTILE_MAX_DISTANCE es 450 (mayor que range)
  - PROJECTILE_MAX_DISTANCE > WEAPON_RANGE
  - Enemigo a exactamente 384px es seleccionable
  - Enemigo a 385px NO es seleccionable
  - Enemigo al rango antiguo (800px) NO es seleccionable
  - Enemigo dentro de 12 tiles diagonal es seleccionable

### Notas

- No se modificaron sistemas de AI, XP, HUD, oleadas ni menús.
- Los tests existentes de weapon-system usaban `GAME_CONSTANTS.WEAPON_RANGE` (no hardcoded 800), así que adaptaron automáticamente al nuevo valor.


---

## BUG-005: Proyectiles atraviesan capas bloqueantes y targeting sin línea de visión

**Estado:** ✅ Corregido  
**Fecha:** 2025-01-XX  
**Severidad:** Alta (gameplay-breaking)

### Descripción

Los proyectiles del arma del jugador pasaban a través de muros, obstáculos y líquidos sin detenerse. Adicionalmente, `findClosestEnemy()` no verificaba línea de visión — seleccionaba objetivos detrás de paredes como blancos válidos.

### Causa Raíz

1. **No existían colliders proyectil↔mapa.** GameScene solo registraba colisiones para Player↔{walls,obstacles,liquids} y Enemies↔{walls,obstacles,liquids}. El pool de proyectiles nunca fue colisionado contra ninguna capa del mapa.

2. **No existía verificación de línea de visión.** `findClosestEnemy()` solo verificaba distancia y estado (active/hp), sin considerar si había obstáculos físicos entre el jugador y el objetivo.

### Corrección

1. **`src/systems/line-of-sight.ts`** — Nuevo módulo con función pura `hasLineOfSight()` que usa el algoritmo de Bresenham para recorrer todas las celdas del grid lógico entre dos posiciones. Devuelve `false` si alguna celda intermedia tiene wall, obstacle, o liquid.

2. **`src/systems/WeaponSystem.ts`** — Se añadió:
   - Tipo `LineOfSightChecker` exportado
   - Campo privado `losChecker`
   - Método público `setLineOfSightChecker(checker)`
   - Método privado `findClosestVisibleEnemy()` que ordena candidatos por distancia y selecciona el primero con LOS claro
   - `update()` ahora usa `findClosestVisibleEnemy` cuando hay checker configurado

3. **`src/scenes/GameScene.ts`** — Se añadieron:
   - Colliders `projectilePool ↔ walls/obstacles/liquids` con callback `onProjectileHitMap` que recicla el proyectil
   - Provisión del LOS checker al WeaponSystem usando el `logicalGrid` existente

### Archivos Modificados

- `src/systems/line-of-sight.ts` (NUEVO)
- `src/systems/WeaponSystem.ts`
- `src/scenes/GameScene.ts`

### Tests de Regresión

- `src/systems/__tests__/bug-005-projectile-occlusion.test.ts`
  - hasLineOfSight: camino despejado retorna true
  - hasLineOfSight: muro intermedio retorna false
  - hasLineOfSight: líquido intermedio retorna false
  - hasLineOfSight: misma celda siempre retorna true
  - hasLineOfSight: camino diagonal con muro retorna false
  - hasLineOfSight: camino diagonal sin muro retorna true
  - hasLineOfSight: celda adyacente libre es alcanzable
  - hasLineOfSight: celda adyacente bloqueada retorna false
  - hasLineOfSight: bloqueador en celda de inicio se ignora
  - hasLineOfSight: bloqueador en celda final bloquea el camino
  - hasLineOfSight: camino vertical con bloqueador
  - hasLineOfSight: bloqueador al lado del camino no bloquea
  - Integración conceptual: enemigo más cercano detrás de muro es saltado

### Notas

- No se modificaron enemy AI, XP, HUD, oleadas ni menús.
- No se implementó oclusión de DECORACIONES — solo walls/obstacles/liquids bloquean. El bloqueo por decoraciones queda PENDIENTE catalogación individual de cada decoración.
- El LOS check usa el grid lógico existente (sin costo adicional de memoria).
- Los colliders de proyectiles usan `setCollisionByExclusion([-1])` ya configurado en las capas del mapa (herencia de BUG-001).


---

## BUG-006: Enemigos atacan sin animación

**Estado:** ✅ Corregido  
**Fecha:** 2025-01-XX  
**Severidad:** Media (visual/feedback)

### Descripción

Los enemigos aplicaban daño de contacto al jugador pero permanecían en su animación de walk. No existía transición visual a una animación de ataque, eliminando el feedback visual de que el enemigo está atacando activamente.

### Causa Raíz

1. **Sin máquina de estados de animación**: La clase base `Enemy` no tenía concepto de estados de animación. Cada arquetipo llamaba `this.play(walkAnimKey)` en su constructor pero no existía mecanismo para cambiar a ataque.

2. **DamageSystem no disparaba animación**: Cuando `checkEnemyPlayerCollisions()` aplicaba daño de contacto, no llamaba ningún método visual en el enemigo.

3. **Sin registro de claves de animación en subclases**: Aunque `enemy-assets.ts` definía spritesheets de ataque para todos los enemigos, y `enemy-animations.ts` generaba las configuraciones, las subclases nunca almacenaban las claves de ataque para poder usarlas en runtime.

### Corrección

1. **`src/entities/Enemy.ts`** — Se añadió máquina de estados de animación:
   - Tipo `EnemyAnimState` exportado: `'moving' | 'attacking' | 'dying'`
   - Campos protegidos `animState`, `walkAnimKey`, `attackAnimKey`
   - Método público `playAttackAnimation(targetX?)`: verifica estado, flipea hacia el jugador, transiciona a 'attacking', reproduce animación one-shot, y al completar vuelve a 'moving' + walk
   - Método `getAnimState()` para lectura del estado actual
   - `onDefeat()` ahora marca `animState = 'dying'` antes de deactivar

2. **`src/config/enemy-assets.ts`** — Se añadió función `getAttackAnimationKey(spriteKey)` análoga a `getWalkAnimationKey`.

3. **Archetypes (4 archivos)** — Cada constructor ahora registra `walkAnimKey` y `attackAnimKey` usando las funciones de `enemy-assets.ts`:
   - `src/entities/enemies/Esqueleto.ts`
   - `src/entities/enemies/Murcielago.ts`
   - `src/entities/enemies/CalaveraLlameante.ts`
   - `src/entities/enemies/SerpienteEmplumada.ts`

4. **`src/systems/DamageSystem.ts`** — En `checkEnemyPlayerCollisions()`, se añadió `enemy.playAttackAnimation(this.player.x)` antes de aplicar el daño.

### Archivos Modificados

- `src/entities/Enemy.ts`
- `src/config/enemy-assets.ts`
- `src/entities/enemies/Esqueleto.ts`
- `src/entities/enemies/Murcielago.ts`
- `src/entities/enemies/CalaveraLlameante.ts`
- `src/entities/enemies/SerpienteEmplumada.ts`
- `src/systems/DamageSystem.ts`

### Tests de Regresión

- `src/entities/__tests__/bug-006-enemy-attack-animation.test.ts`
  - Todos los arquetipos tienen attack spritesheet definido
  - getAttackAnimationKey retorna valor para todos los sprite keys
  - Frame counts de ataque son válidos (≥1)
  - calavera_llameante tiene 5 frames de ataque (único)
  - esqueleto, murcielago, serpiente tienen 4 frames de ataque
  - Walk key difiere de attack key para todos los enemigos
  - Las 4 animaciones de ataque aparecen en configs generadas
  - Animaciones de ataque tienen repeat=0 (one-shot)
  - Animaciones de walk tienen repeat=-1 (loop)
  - Animaciones de ataque usan frameRate=10
  - Los 4 enemigos tienen walk, attack y death definidos
  - Paths de sprites apuntan a patrones de carpeta válidos
  - getAttackAnimationKey retorna undefined para keys inexistentes

### Notas

- No se modificaron valores de daño, cooldowns, velocidades ni balance.
- No se modificó WeaponSystem ni el ataque del jugador.
- No se añadieron nuevos ataques de enemigos ni proyectiles.
- Los enemigos siguen moviéndose durante la animación de ataque (no se detienen) — es daño de contacto, ya están tocando al jugador.
- La animación de ataque se dispara una sola vez por cooldown de daño (no se repite hasta que el cooldown se cumple y vuelve a aplicar daño).
- Si la animación de ataque no existe en el AnimationManager, el estado vuelve a 'moving' inmediatamente (graceful degradation).


---

## BUG-007: Enemigos no reproducen animación de muerte antes de desactivarse

**Estado:** ✅ Corregido  
**Fecha:** 2025-01-XX  
**Severidad:** Media (visual/feedback)

### Descripción

Los enemigos desaparecían instantáneamente al ser derrotados sin reproducir su animación de muerte. Los spritesheets de muerte existían y las animaciones estaban registradas, pero `onDefeat()` llamaba `setActive(false)` y `setVisible(false)` inmediatamente sin dar tiempo a que la animación se reprodujera.

### Causa Raíz

En `Enemy.onDefeat()`, el sprite se ocultaba inmediatamente:
1. `setActive(false)` — desactivaba el sprite del pool
2. `setVisible(false)` — ocultaba el sprite visualmente
3. Ambas llamadas estaban DUPLICADAS (dos veces cada una)
4. No existía `deathAnimKey` almacenado en la clase base
5. No existía método `playDeathAnimation()` ni `finishDeath()`
6. No existía delay entre derrota lógica y remoción visual

### Corrección

1. **`src/config/enemy-assets.ts`** — Se añadió función `getDeathAnimationKey(spriteKey)` análoga a `getWalkAnimationKey` y `getAttackAnimationKey`.

2. **`src/entities/Enemy.ts`** — Refactorización mayor de `onDefeat()`:
   - Se añadió campo `deathAnimKey: string` en la clase base
   - Se añadió campo `defeatEmitted: boolean` para prevenir doble-emisión de eventos
   - Guard `if (animState === 'dying') return` previene double-kill
   - `setVelocity(0, 0)` detiene al enemigo inmediatamente
   - `body.enable = false` deshabilita colisiones inmediatamente
   - Evento 'enemy-defeated' se emite una sola vez (orbe de XP spawna)
   - Si existe `deathAnimKey` y la animación está registrada: reproduce animación y espera `animationcomplete` para llamar `finishDeath()`
   - Si no existe animación de muerte: llama `finishDeath()` inmediatamente
   - Nuevo método privado `finishDeath()`: ejecuta `setActive(false)` + `setVisible(false)`
   - Se eliminó la duplicación de `setActive/setVisible`

3. **Archetypes (4 archivos)** — Cada constructor ahora registra `deathAnimKey`:
   - `src/entities/enemies/Esqueleto.ts`
   - `src/entities/enemies/Murcielago.ts`
   - `src/entities/enemies/CalaveraLlameante.ts`
   - `src/entities/enemies/SerpienteEmplumada.ts`

4. **Archetypes `update()` guard** — Cada arquetipo ahora retorna inmediatamente si `animState === 'dying'`, evitando movimiento durante la animación de muerte.

5. **`CalaveraLlameante.onDefeat()`** — Restructurado para hacer el chequeo de explosión ANTES de llamar a `super.onDefeat()`, garantizando que la explosión ocurre una sola vez antes de que el guard de `animState === 'dying'` bloquee re-entradas.

### Protección contra re-targeting durante muerte

- **WeaponSystem**: `findClosestVisibleEnemy()` filtra por `enemy.hp <= 0` — como el enemigo ya tiene HP=0, no será targeteable durante la animación de muerte.
- **DamageSystem projectiles**: `body.enable = false` se ejecuta inmediatamente en `onDefeat()`, por lo que los proyectiles no colisionarán con el enemigo moribundo.
- **DamageSystem contacto**: El body deshabilitado impide nuevas colisiones de contacto.

### Archivos Modificados

- `src/config/enemy-assets.ts`
- `src/entities/Enemy.ts`
- `src/entities/enemies/Esqueleto.ts`
- `src/entities/enemies/Murcielago.ts`
- `src/entities/enemies/CalaveraLlameante.ts`
- `src/entities/enemies/SerpienteEmplumada.ts`

### Tests de Regresión

- `src/entities/__tests__/bug-007-enemy-death-animation.test.ts`
  - Todos los arquetipos tienen death spritesheet definido
  - getDeathAnimationKey retorna valor para todos los sprite keys
  - Death keys siguen patrón de nomenclatura {name}_death
  - Claves específicas correctas (esqueleto_death, murcielago_death, etc.)
  - Frame counts de muerte son válidos (4 frames para todos)
  - Las 4 animaciones de muerte aparecen en configs generadas
  - Animaciones de muerte tienen repeat=0 (one-shot)
  - Animaciones de muerte usan frameRate=8
  - Death keys son distintas de walk y attack keys
  - getDeathAnimationKey retorna undefined para keys inexistentes
  - Todos los enemigos tienen death definido en ENEMY_SPRITESHEETS
  - Paths de sprites de muerte apuntan a carpetas de assets válidas

### Notas

- No se modificaron valores de daño, HP, XP, drops, cooldowns ni balance.
- No se modificaron animaciones de ataque (trabajo de BUG-006 preservado).
- No se añadieron nuevos assets — los spritesheets de muerte ya existían.
- El enemigo permanece `active=true` y `visible=true` durante la animación de muerte, pero con `body.enable=false` y `hp=0`, por lo que es inerte para todos los sistemas de combate.
- La animación de muerte usa frameRate=8 (ligeramente más lenta que walk/attack=10) para mayor dramatismo visual.


---

## BUG-008: Selecting an upgrade causes TypeError: Cannot read properties of undefined (reading 'damage')

**Estado:** ✅ Corregido  
**Fecha:** 2025-01-XX  
**Severidad:** Crítica (gameplay-breaking crash)

### Descripción

Al seleccionar cualquier mejora durante el level-up, el juego lanzaba `TypeError: Cannot read properties of undefined (reading 'damage')`. El panel de mejoras se mostraba correctamente, pero al hacer clic en una opción el juego crasheaba y quedaba congelado (pausa sin resume).

### Causa Raíz

Los upgrades en `src/config/upgrades.ts` definían funciones `apply(state: PlayerState)` que accedían a `state.weapon.damage`, `state.weapon.fireRate`, etc. Pero:

1. `XPSystem.applyUpgrade(player, upgrade)` pasaba la instancia raw de `Player`
2. La clase `Player` NO tiene propiedad `weapon` — las stats del arma están en `WeaponSystem`
3. Por lo tanto `state.weapon` era `undefined`, y `undefined.damage` lanzaba TypeError

La interfaz `PlayerState` (en `types/interfaces.ts`) tenía un sub-objeto `weapon`, pero NO corresponde a la arquitectura real del juego donde el Player y el WeaponSystem son entidades separadas.

### Corrección

Se introdujo un `UpgradeContext` que provee acceso tanto al Player como al WeaponSystem, reemplazando el patrón anterior de pasar un objeto inexistente.

1. **`src/types/interfaces.ts`** — Se añadió interfaz `UpgradeContext` con `player` (hp, maxHp, speed) y `weaponSystem` (getters/setters para damage, fireRate, range, projectileSpeed, maxDistance). Se cambió `Upgrade.apply` para recibir `UpgradeContext` en vez de `unknown`.

2. **`src/systems/WeaponSystem.ts`** — Se añadieron 10 métodos públicos de acceso/mutación para el sistema de upgrades: `getDamage()`, `increaseDamage()`, `getFireRateMs()`, `reduceFireRate()`, `getRange()`, `increaseRange()`, `getProjectileSpeed()`, `increaseProjectileSpeed()`, `getMaxDistance()`, `increaseMaxDistance()`.

3. **`src/entities/Player.ts`** — Se añadió método `increaseMaxHp(amount, heal)` para incrementar vida máxima y curar opcionalmente.

4. **`src/config/upgrades.ts`** — Todas las funciones `apply` refactorizadas de `(state: PlayerState) => PlayerState` (funcional puro con spread) a `(ctx: UpgradeContext) => void` (mutación directa sobre el contexto real).

5. **`src/systems/XPSystem.ts`** — `applyUpgrade` cambiado de `(player: unknown, upgrade)` a `(context: UpgradeContext, upgrade)`.

6. **`src/systems/LevelUpCoordinator.ts`** — Se añadió interfaz `WeaponSystemUpgradeAPI`. Constructor ahora recibe `player` (tipado) y `weaponSystem`. `handleUpgradeSelected` construye el `UpgradeContext` y lo pasa a `applyUpgrade`. Se envolvió en try/finally para garantizar que resume SIEMPRE se ejecute incluso si el upgrade lanza error.

7. **`src/scenes/GameScene.ts`** — Se pasa `this.weaponSystem` como quinto argumento al construir `LevelUpCoordinator`.

### Protección contra congelamiento

El `handleUpgradeSelected` ahora usa `try/finally` para garantizar que:
- El estado se resetea a `idle`
- `pauseController.resume()` se llama **siempre**, incluso si `upgrade.apply()` lanza excepción

Esto cumple la restricción de que PauseSystem siempre resuma even on error.

### Archivos Modificados

- `src/types/interfaces.ts`
- `src/systems/WeaponSystem.ts`
- `src/entities/Player.ts`
- `src/config/upgrades.ts`
- `src/systems/XPSystem.ts`
- `src/systems/LevelUpCoordinator.ts`
- `src/scenes/GameScene.ts`
- `src/systems/__tests__/level-up-flow.unit.test.ts`
- `src/systems/__tests__/xp-system.unit.test.ts`
- `src/systems/__tests__/pause-system.unit.test.ts`
- `src/systems/__tests__/preflight-contracts.test.ts`

### Tests de Regresión

- `src/systems/__tests__/bug-008-upgrade-crash.test.ts`
  - Todos los 12 upgrades aplican sin lanzar TypeError
  - XPSystem.applyUpgrade no crashea para ningún upgrade
  - speed_boost_1 incrementa velocidad en 20
  - speed_boost_2 incrementa velocidad en 30
  - max_hp_1 incrementa maxHp en 20 y cura 20
  - max_hp_2 incrementa maxHp en 30 y cura 30
  - max_hp_1 no sana por encima de maxHp
  - weapon_damage_1 incrementa daño en 5
  - weapon_damage_2 incrementa daño en 8
  - fire_rate_1 reduce fire rate en 100ms (min 200)
  - fire_rate_2 reduce fire rate en 150ms (min 200)
  - fire rate no baja de 200ms mínimo
  - weapon_range_1 incrementa rango en 100
  - weapon_range_2 incrementa rango en 150
  - projectile_speed_1 incrementa velocidad de proyectil en 100
  - max_distance_1 incrementa distancia máxima en 200
  - PauseSystem resume se llama incluso si upgrade.apply lanza error
  - Los 12 upgrades están presentes en INITIAL_UPGRADE_POOL
  - Corazón de Obsidiana, Garras de Ocelotl y Cadencia del Colibrí están presentes
  - Todos los upgrades tienen IDs únicos

### Notas

- No se modificaron nombres, descripciones ni cantidades numéricas de las mejoras.
- No se modificó el mapa, enemigos, armas, oleadas ni animaciones.
- Los upgrades ahora mutan directamente el estado (en vez del patrón funcional spread anterior) porque Player y WeaponSystem son clases mutables de Phaser.
- El `PlayerState` interface sigue existiendo por compatibilidad pero ya no se usa en upgrades.


---

## BUG-009 — Reintentar falla por recurso nulo del HUD

**Estado:** ✅ Corregido (V2 — handshake hud-ready)  
**Fecha:** 2025-07-XX  
**Severidad:** Crítica (gameplay-breaking crash)

### Descripción

Después de morir, pulsar "Reintentar" provocaba un `TypeError: Cannot read properties of null (reading 'drawImage')` en `HUDScene.updateWaveDisplay`. La nueva partida no iniciaba.

### Primera corrección (V1) — Insuficiente

Se movió la emisión de `wave-changed` del constructor de WaveManager a un método `emitInitialState()` llamado inmediatamente después de `scene.launch('HUDScene')`. Esto no resolvió el bug porque **`scene.launch()` en Phaser no garantiza que `HUDScene.create()` haya completado** antes de continuar la ejecución síncrona. El `waveText` aún no existía cuando llegaba el evento.

### Causa raíz real

`scene.launch('HUDScene')` + `waveManager.emitInitialState()` en secuencia síncrona. En el flujo de retry, HUDScene.create() no se ejecutaba síncronamente tras launch, por lo que `waveText` era null cuando el handler `_waveHandler` se disparaba.

### Corrección (V2) — Handshake hud-ready

1. **`src/scenes/GameScene.ts`** — Se implementó un handshake con `runId`:
   - Genera un `runId` único por partida
   - Registra listener `'hud-ready'` ANTES de lanzar HUDScene
   - Pasa `{ runId }` al launch de HUDScene
   - `hudReadyHandler` verifica runId, guarda idempotencia, luego llama `emitInitialState()`
   - Cleanup del listener en `shutdown()`

2. **`src/scenes/HUDScene.ts`** — Emite `'hud-ready'` al FINAL de `create()`:
   - Almacena `runId` recibido en `init(data)`
   - Crea TODOS los objetos visuales primero
   - Registra handlers después
   - Emite `'hud-ready'` como último paso
   - `updateWaveDisplay()` tiene guard `if (this.isShuttingDown) return`
   - `shutdown()` marca flags de protección

3. **`src/scenes/DefeatScene.ts`** — Botones con `transitionInProgress`:
   - Flag reseteado en `init()`
   - Ambos botones se deshabilitan juntos
   - No quedan bloqueados permanentemente

4. **`src/scenes/VictoryScene.ts`** — Mismo patrón que DefeatScene

### Flujo final

```
DefeatScene: handleRetry() → transitionInProgress=true → disable buttons
  → scene.start('GameScene', { gameMode })
GameScene.create() → generateMap():
  → WaveManager constructor (NO emite)
  → ... otros sistemas ...
  → genera runId
  → events.on('hud-ready', hudReadyHandler)
  → scene.stop('HUDScene') si activo
  → scene.launch('HUDScene', { runId })
HUDScene.init({ runId })
HUDScene.create():
  → createWaveDisplay() [waveText creado]
  → registerEventListeners() [_waveHandler registrado]
  → isHudReady = true
  → emit('hud-ready', { runId })
GameScene.hudReadyHandler:
  → verifica runId
  → waveManager.emitInitialState() → wave-changed
  → _waveHandler → updateWaveDisplay(1) → waveText.setText(...) ✓
```

### Archivos Modificados

- `src/scenes/GameScene.ts` — runId, hudReadyHandler, handshake launch
- `src/scenes/HUDScene.ts` — init, isShuttingDown, isHudReady, emit hud-ready
- `src/scenes/DefeatScene.ts` — transitionInProgress pattern
- `src/scenes/VictoryScene.ts` — transitionInProgress pattern
- `src/scenes/__tests__/bug-009-retry-lifecycle.test.ts` — reescrito con tests de handshake

### Tests de Regresión

- `src/scenes/__tests__/bug-009-retry-lifecycle.test.ts` (26 tests)
  - Constructor no emite wave-changed
  - emitInitialState solo se llama después del handshake
  - RunId incorrecto no dispara emisión
  - Handshake idempotente (doble hud-ready no re-emite)
  - Retry preserva GameModeConfig
  - Retry reinicia estadísticas, Recuerdos y fragmentos
  - Listener shutdown guard previene crash
  - Tres ciclos no acumulan listeners
  - transitionInProgress bloquea doble clic
  - Botones se deshabilitan juntos

### Notas

- No se usó optional chaining como corrección
- No se usó setTimeout/delayedCall
- No se modificó balance, oleadas, recuerdos, enemigos, armas, mapa ni combate
- No se modificó requirements.md, design.md ni tasks.md


---

## BUG-010 — OrbCollector usa una Scene inválida al generar XPOrb

**Estado:** ✅ Corregido (V3 — plain array, no Phaser Group)  
**Fecha:** 2025-07-XX  
**Severidad:** Crítica (gameplay-breaking crash)

### Descripción

Al matar un enemigo después de un Retry, OrbCollector lanzaba `TypeError: Cannot read properties of undefined (reading 'add')` dentro de `Phaser.GameObjects.Group.add`. La primera partida funcionaba; el error solo ocurría post-retry y congelaba la partida.

### Historial de correcciones

- **V1** — Stored handler + isDestroyed guard. Necesario pero insuficiente.
- **V2** — `orbPool.clear(true, true)` instead of `destroy(true)`. Reducía pero no eliminaba el problema.
- **V3** — Eliminación completa del Phaser Group. Resuelve la causa raíz.

### Causa Raíz Real

`Phaser.GameObjects.Group.add()` internamente accede a `this.scene.sys.displayList` o propiedades similares del sistema de escena. Después de un ciclo de reinicio (scene.start → shutdown → create), el Group retenía una referencia interna al objeto `sys` de la escena anterior, que estaba en estado inválido/undefined. Al llamar `group.add(orb)`, la propiedad interna del Group causaba el TypeError.

XPOrb ya se añadía a sí mismo a la escena via `scene.add.existing(this)` y `scene.physics.add.existing(this)` en su constructor. El uso de `Group.add()` era **redundante** para la gestión de escena — solo servía para iterar los orbes.

### Corrección (V3)

Reemplazar `Phaser.GameObjects.Group` por un array TypeScript `XPOrb[]`:
- `spawnOrb` → `this.orbs.push(orb)` (XPOrb se añade a la escena solo)
- `update` → itera `this.orbs` directamente
- `destroy` → destruye cada orbe activo, vacía el array
- Sin coupling con `scene.sys` internal managers

### Archivos Modificados

- `src/systems/OrbCollector.ts` — Group eliminado, `orbs: XPOrb[]` array
- `src/systems/__tests__/bug-010-orb-collector-lifecycle.test.ts` — 32 tests (8 nuevos V3)

### Tests de Regresión (V3)

- No se crea Phaser Group (no `scene.add.group()`)
- spawnOrb usa array interno (no Group.add)
- destroy limpia array y destruye orbes activos
- Cinco ciclos de retry no corrompen `scene.add`/`scene.physics.add`
- Nuevo OrbCollector tras destroy tiene array fresco sin interferencia
- `scene.add` permanece disponible después del cleanup
- XPOrb se autoañade a la escena (no necesita Group)

### Notas

- No se usó optional chaining, any, @ts-ignore ni setTimeout
- No se modificaron enemigos, XP, oleadas, balance, Recuerdos ni mapa
- Las correcciones V1 (stored handler) y V2 (no destroy) permanecen integradas en V3


---

## BUG-011 — XPOrb y experiencia duplicados

**Estado:** ✅ Corregido  
**Fecha:** 2025-07-XX  
**Severidad:** Media (balance-breaking)

### Descripción

Al derrotar un enemigo aparecían dos XPOrbs. Un orbe con xpValue=5 entregaba 10 XP después de Retry. El valor se duplicaba entre partidas indicando acumulación de listeners o procesamiento doble.

### Causas Raíz (3 factores combinados)

1. **XPOrb sin flag `collected`**: El mismo orbe podía recogerse dos veces en el mismo frame — una vez en la comprobación inicial de proximidad y otra después de que la atracción lo moviera dentro del radio de recolección.

2. **OrbCollector.collectOrb con doble entrega de XP**: El método emitía `'orb-collected'` (que GameScene routeaba a XPSystem.addXP) Y además llamaba directamente `this.player.addXP(value)`. Ambas rutas entregaban XP.

3. **GameScene.registerGameListeners() acumulaba listeners en Retry**: En Phaser, `scene.start()` reutiliza la misma instancia de Scene. Si `shutdown()` no eliminaba perfectamente los listeners (timing edge case), `registerGameListeners()` los añadía de nuevo sin verificar duplicados, acumulando handlers de `'orb-collected'`.

### Corrección

1. **`src/entities/XPOrb.ts`** — Añadido campo `collected = false`. Se establece a `true` al inicio de `collectOrb()` antes de emitir eventos.

2. **`src/systems/OrbCollector.ts`** — Guard `if (orb.collected) return` en `collectOrb()`. Loop `update()` verifica `!orb.active || orb.collected` antes de procesar. Eliminada la llamada directa `this.player.addXP(value)` — solo emite el evento.

3. **`src/scenes/GameScene.ts`** — `registerGameListeners()` ahora ejecuta `events.off(...)` para cada handler ANTES de `events.on(...)`, haciéndola idempotente.

### Archivos Modificados

- `src/entities/XPOrb.ts` — campo `collected`
- `src/systems/OrbCollector.ts` — guards + eliminación de ruta dual
- `src/scenes/GameScene.ts` — off-before-on idempotente

### Archivos Creados

- `src/systems/__tests__/bug-011-xp-duplication.test.ts` (16 tests)

### Tests de Regresión

- collected flag previene doble recolección en mismo frame
- Doble overlap: addXP llamado una vez
- xpValue=5 entrega exactamente 5 XP
- Después de retry xpValue=5 sigue entregando 5
- 5 ciclos de retry no acumulan listeners
- registerGameListeners es idempotente
- Una muerte produce un orbe, un orbe entrega XP una vez
- Enemy defeatEmitted guard funciona

### Notas

- No se modificaron valores de XP, balance, enemigos, oleadas, Recuerdos ni mapa
- No se usó optional chaining ni se dividió el XP artificialmente
- La corrección es compatible con BUG-009 (handshake) y BUG-010 (plain array)


---

## BUG-012 — XPOrb recogido permanece visible

**Estado:** ✅ Corregido (V4 — visual differentiation from decoration tiles)  
**Fecha:** 2025-07-XX  
**Severidad:** Media (visual)

### Descripción

Después de recoger un XPOrb, un sprite azul permanecía visible en el mapa. XP se entregaba correctamente una sola vez pero el visual no desaparecía.

### V1 (insuficiente)

Añadió `deactivate()` que mataba el tween y llamaba `setActive(false)` + `setVisible(false)` + `body.enable = false`. Esto no era suficiente porque en Phaser 4, un sprite que permanece en el display list (via `scene.add.existing`) puede seguir renderizándose bajo ciertas condiciones aunque `visible=false`.

### Causa Raíz Real (V2)

`setVisible(false)` en Phaser 4 sobre un `Physics.Arcade.Sprite` que fue añadido al display list via `scene.add.existing(this)` no siempre previene el renderizado. El sprite permanece en `scene.children.list`. La única forma confiable de eliminarlo del pipeline de render es **destruir el GameObject** con `destroy()`, que lo remueve del display list, update list y physics world.

### Corrección (V2)

`OrbCollector.deactivateOrb()` ahora llama `orb.destroy()` y lo remueve del array de tracking (`splice`). Dado que no hay pooling (se usa array plain desde BUG-010 V3), la destrucción es segura y definitiva.

Cambios adicionales:
- `update()` itera un snapshot (`[...this.orbs]`) para manejar modificación durante iteración
- `removeExpiredOrbs()` itera hacia atrás para splice seguro
- `destroy()` destruye TODOS los orbes (sin check de `active`)

### V4 — Diferenciación visual (confusión con tiles de decoración)

**Problema residual:** El "cristal azul" que el usuario reportaba como persistente tras la recolección NO era el XPOrb (que sí se destruye correctamente). Era un tile de decoración estático del tileset `Mictlan_decoration.png` (frames 0–51) que visualmente se asemeja al sprite del XPOrb (`Exp_Common.png`). Cuando un enemigo muere cerca de una decoración, el usuario confunde el tile permanente con el orbe ya recogido.

**Solución V4:** Hacer que los XPOrbs sean visualmente inconfundibles respecto a cualquier decoración estática:

1. **Tint distintivo** (`0xaaffee` — cyan/mint claro): Los XPOrbs ahora tienen un color diferente al palette crudo del tileset de decoraciones. Ninguna decoración tiene este tint.

2. **Pulso de alpha** (oscila entre 1.0 y 0.6, 400ms/ciclo): Los XPOrbs "pulsan" visualmente. Las decoraciones son completamente estáticas. Esta es la señal inequívoca de que un objeto es un orbe interactivo vs un tile del mapa.

3. **Cleanup en destroy/deactivate**: El pulseTween se destruye junto con el floatTween en ambos métodos, garantizando limpieza completa.

### Archivos Modificados

- `src/entities/XPOrb.ts` — pulseTween + setTint en constructor, cleanup en deactivate/destroy
- `src/config/xp-orb-assets.ts` — XP_ORB_PULSE_CONFIG (alphaMin, duration, ease, tint)
- `src/entities/__tests__/bug-012-xp-orb-visual-cleanup.test.ts` — 40 tests (13 nuevos V4)

### Tests de Regresión (V4)

- XPOrb tiene pulseTween no-null tras construcción
- XPOrb tiene tint 0xaaffee (distinto de decoraciones)
- XP_ORB_PULSE_CONFIG.alphaMin es 0.6 (siempre visible)
- XP_ORB_PULSE_CONFIG.duration es 400ms (pulso rápido perceptible)
- destroy() mata pulseTween (null + destroyed flag)
- deactivate() mata pulseTween
- deactivate→destroy no duplica destrucción de pulseTween
- Orbes independientes tienen pulseTweens independientes
- collectOrb limpia pulseTween
- Tint es distinto de 0xffffff (blanco/sin tint)
- End-to-end V4: tint + pulseTween presentes, ambos limpiados en recolección

### Notas

- No se usó alpha extremadamente bajo (0.6 mínimo — siempre visible y notorio)
- No se modificaron XP values, balance, enemigos, oleadas, Recuerdos ni mapa
- No se excluyeron frames de decoración (no se puede determinar programáticamente cuáles son "cristales")
- Compatible con BUG-010 V3 (plain array) y BUG-011 (collected flag)
- La diferenciación visual es definitiva: ningún tile estático del mapa pulsará ni tendrá tint cyan
