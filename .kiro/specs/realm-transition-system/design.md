# Design Document

## Overview

Sistema de transición narrativa entre reinos del Mictlán que se activa durante el gameplay al subir de nivel. Transforma datos del archivo `LevelProgressText.json` al formato `CinematicData` existente, reutiliza `CinematicPlayer` para el efecto typewriter/diálogos, y añade un panel de información cultural posterior al diálogo. La integración se realiza exclusivamente en `GameScene.onOrbCollected`, manteniendo `LevelUpCoordinator` sin modificaciones.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          GameScene                                   │
│                                                                     │
│  onOrbCollected()                                                   │
│    ├── XPSystem.addXP()                                             │
│    ├── RealmTransitionDataLoader.getTransitionForLevel(newLevel)     │
│    │     ├── transition found → pause + launch RealmTransitionScene │
│    │     └── no transition   → LevelUpCoordinator.processLevelUp()  │
│    └── on 'realm-transition-complete'                               │
│          └── resume + LevelUpCoordinator.processLevelUp()           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    RealmTransitionScene                              │
│                                                                     │
│  Estado: dialog → culture → complete                                │
│                                                                     │
│  ┌──────────────────────┐    ┌──────────────────────────┐          │
│  │  CinematicPlayer      │───▶│  Panel Ficha Cultural    │          │
│  │  (typewriter/dialog)  │    │  (título + descripción)  │          │
│  └──────────────────────┘    └──────────────────────────┘          │
│                                        │                            │
│                                        ▼                            │
│                              emit 'realm-transition-complete'       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│               realm-transition-transformer                           │
│                                                                     │
│  RealmTransition → CinematicData                                    │
│  (función pura, sin dependencias de Phaser)                         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│             RealmTransitionDataLoader                                │
│                                                                     │
│  cache.json.get('LevelProgressText') → Map<triggerLevel, transition>│
└─────────────────────────────────────────────────────────────────────┘
```

## Data Models

### Interfaces de datos de transición (`realm-transition-types.ts`)

```typescript
export interface RealmInfo {
  order: number;
  title: string;      // ej: "NOVENO NIVEL"
  name: string;       // ej: "Chiconahuapan"
  background: string; // key del asset de fondo
}

export interface GuideInfo {
  name: string;       // "Xólotl"
  portrait: string;   // key del splash art
}

export interface DialogLine {
  speaker: string;
  text: string;
}

export interface CultureInfo {
  title: string;
  description: string;
}

export interface RealmTransition {
  id: number;
  isIntroduction: boolean;
  triggerLevel: number;
  realm: RealmInfo;
  guide: GuideInfo;
  dialog: DialogLine[];
  culture: CultureInfo;
}

export interface LevelProgressData {
  transitions: RealmTransition[];
}
```

### Datos de inicialización de escena

```typescript
interface RealmTransitionSceneData {
  transition: RealmTransition;
  levelUpResult: { leveledUp: boolean; showPanel: boolean; newLevel: number };
}
```

### Estado interno de RealmTransitionScene

```typescript
type RealmTransitionState = 'dialog' | 'culture' | 'complete';
```

## Components and Interfaces

### 1. `src/realm-transition/realm-transition-types.ts`

Define las interfaces TypeScript que modelan la estructura del JSON de `LevelProgressText.json`. Las interfaces se documentan en la sección **Data Models** anterior.

### 2. `src/realm-transition/RealmTransitionDataLoader.ts`

Responsabilidad: leer `LevelProgressText.json` del cache de Phaser y exponer consultas por nivel.

```typescript
export class RealmTransitionDataLoader {
  private transitionMap: Map<number, RealmTransition> = new Map();

  constructor(cache: Phaser.Cache.CacheManager) {
    const data = cache.json.get('LevelProgressText') as LevelProgressData | undefined;
    if (data?.transitions) {
      for (const t of data.transitions) {
        this.transitionMap.set(t.triggerLevel, t);
      }
    }
  }

  getTransitionForLevel(level: number): RealmTransition | null {
    return this.transitionMap.get(level) ?? null;
  }
}
```

Decisiones clave:
- Se indexa por `triggerLevel` al instanciar, O(1) de consulta en cada level-up.
- Si el JSON no está en cache (fallo de carga), el mapa queda vacío y `getTransitionForLevel` siempre retorna `null` → flujo normal sin transición.

### 3. `src/realm-transition/realm-transition-transformer.ts`

Función pura que convierte `RealmTransition` al formato `CinematicData` que `CinematicPlayer` consume:

```typescript
import type { CinematicData, CinematicStep } from '../cinematic/cinematic-types';
import type { RealmTransition } from './realm-transition-types';

export function transformTransitionToCinematicData(transition: RealmTransition): CinematicData {
  const steps: CinematicStep[] = [
    { type: 'background', image: transition.realm.background },
    ...transition.dialog.map(d => ({
      type: 'dialog' as const,
      speaker: d.speaker,
      name: transition.guide.name,
      portrait: transition.guide.portrait,
      text: d.text,
    })),
  ];

  return {
    id: `realm-transition-${transition.id}`,
    title: transition.realm.name,
    steps,
  };
}
```

Decisiones clave:
- Se inserta un `BackgroundStep` al inicio para que `CinematicPlayer` configure el fondo automáticamente.
- Todos los `DialogStep` usan el mismo `guide.name` y `guide.portrait` (Xólotl en todos los reinos actuales), pero la estructura soporta guías diferentes por si el JSON evoluciona.
- Es función pura → fácilmente testeable sin mocks de Phaser.

### 4. `src/realm-transition/RealmTransitionScene.ts`

Escena Phaser independiente que orquesta el flujo visual completo.

**Datos de entrada (init data):**
```typescript
interface RealmTransitionSceneData {
  transition: RealmTransition;
  levelUpResult: { leveledUp: boolean; showPanel: boolean; newLevel: number };
}
```

**Máquina de estados interna:**
```
'dialog' → 'culture' → 'complete'
```

**Comportamiento por estado:**

| Estado | Descripción |
|--------|-------------|
| `dialog` | CinematicPlayer reproduce los diálogos con typewriter. Input avanza diálogos. |
| `culture` | Panel cultural visible (título + descripción + botón "Continuar"). Input en botón avanza. |
| `complete` | Emite `realm-transition-complete` a GameScene y se detiene. |

**Capas visuales (depth order):**
1. Fondo a pantalla completa (depth 0)
2. Splash art de Xólotl (depth 10)
3. Título del reino — `realm.title` + `realm.name` (depth 15, posición superior)
4. Caja de diálogo con borde estilizado (depth 20)
5. Nombre del personaje (depth 30)
6. Texto de diálogo (depth 30)
7. Panel de ficha cultural (depth 40, inicialmente invisible)
8. Botón "Saltar" (depth 50, siempre visible)

**Flujo create():**
1. Leer `transition` de init data.
2. Llamar `transformTransitionToCinematicData(transition)` para obtener `CinematicData`.
3. Crear capas visuales (background, splash art, dialog box, textos).
4. Mostrar título del reino (fade in).
5. Instanciar `CinematicPlayer` con los datos transformados.
6. Llamar `cinematicPlayer.start(background, splashArt, nameText, dialogText)`.
7. Registrar listener `'cinematic-complete'` → transicionar a estado `culture`.
8. Crear botón "Saltar" con handler de skip.

**Transición dialog → culture:**
- Fade out de la caja de diálogo y textos.
- Fade in del panel cultural con `culture.title` como encabezado y `culture.description` como cuerpo.
- Mostrar botón "Continuar".

**Transición culture → complete:**
- Al presionar "Continuar", emitir evento `'realm-transition-complete'` en la escena padre (GameScene).
- Llamar `this.scene.stop()` para cerrar RealmTransitionScene.

**Botón "Saltar":**
- Visible durante estados `dialog` y `culture`.
- Al presionarlo, destruye `CinematicPlayer`, emite `'realm-transition-complete'` inmediatamente y se detiene.

### 5. Registro de Assets — `cinematic-assets.ts`

Nuevas entradas a agregar:

**Fondos de reinos (9 imágenes):**
```typescript
{ key: 'realm_chiconahuapan', path: 'src/assets/BackgroundsLevelsMenu/BackgroundNivel1Dialogs.png' },
{ key: 'realm_apanohuayan', path: 'src/assets/BackgroundsLevelsMenu/BackgroundNivel2Dialogs.png' },
{ key: 'realm_tepectli_monamictlan', path: 'src/assets/BackgroundsLevelsMenu/BackgroundNivel3Dialogs.png' },
{ key: 'realm_iztepetl', path: 'src/assets/BackgroundsLevelsMenu/BackgroundNivel4Dialogs.png' },
{ key: 'realm_itzehecayan', path: 'src/assets/BackgroundsLevelsMenu/BackgroundNivel5Dialogs.png' },
{ key: 'realm_paniecatacoyan', path: 'src/assets/BackgroundsLevelsMenu/BackgroundNivel6Dialogs.png' },
{ key: 'realm_timiminaloayan', path: 'src/assets/BackgroundsLevelsMenu/BackgroundNivel7Dialogs.png' },
{ key: 'realm_teocoyohuehualoyan', path: 'src/assets/BackgroundsLevelsMenu/BackgroundNivel8Dialogs.png' },
{ key: 'realm_chicunamictlan', path: 'src/assets/BackgroundsLevelsMenu/BackgroundNivel9Dialogs.png' },
```

**JSON de transiciones:**
```typescript
{ key: 'LevelProgressText', path: 'src/assets/History/LevelProgressText.json' },
```

**Splash art de Xólotl:** ya registrado como `PerroGuiaSplashArt`. El campo `guide.portrait` en el JSON usa `"xolotl"`, por lo que se necesita mapear este key. Opción elegida: agregar una entrada adicional con key `xolotl` apuntando al mismo asset, o bien usar `PerroGuiaSplashArt` directamente en el JSON. Se opta por registrar un alias:
```typescript
{ key: 'xolotl', path: 'src/assets/BackgroundsLevelsMenu/PerroGuiaSplashArt.png' },
```

### 6. Registro de Escena — `main.ts`

Agregar `RealmTransitionScene` al array retornado por `getScenes()`:

```typescript
return [BootScene, MainMenuScene, CinematicScene, BlessingSelectionScene, GameScene, HUDScene, DefeatScene, VictoryScene, RealmTransitionScene];
```

## Data Flow

```
1. Jugador recoge orbe de XP
       │
       ▼
2. GameScene.onOrbCollected(value)
       │
       ├── XPSystem.addXP(player, value) → XPAddResult
       │
       ├── [Si leveledUp && showPanel]
       │     │
       │     ├── RealmTransitionDataLoader.getTransitionForLevel(newLevel)
       │     │     │
       │     │     ├── [transition encontrada]
       │     │     │     │
       │     │     │     ├── PauseSystem.pause()
       │     │     │     ├── scene.launch('RealmTransitionScene', { transition, levelUpResult })
       │     │     │     └── events.once('realm-transition-complete', () => {
       │     │     │           PauseSystem.resume()
       │     │     │           LevelUpCoordinator.processLevelUp(result)
       │     │     │         })
       │     │     │
       │     │     └── [sin transición]
       │     │           └── LevelUpCoordinator.processLevelUp(result)
       │     │
       │     └── (LevelUpCoordinator pausa nuevamente internamente para Blessing Selection)
       │
       └── [Si no leveledUp] → nada

3. Dentro de RealmTransitionScene:
       │
       ├── transformTransitionToCinematicData(transition) → CinematicData
       ├── CinematicPlayer.start(...) → typewriter de diálogos
       ├── [cinematic-complete] → mostrar panel cultural
       ├── [Continuar / Saltar] → emit 'realm-transition-complete' via GameScene.events
       └── scene.stop()
```

**Nota sobre la pausa:** `PauseSystem.resume()` se llama brevemente entre la transición y el level-up. `LevelUpCoordinator.processLevelUp()` llama `PauseSystem.pause()` inmediatamente al entrar en estado `choosing`, por lo que el jugador nunca experimenta gameplay entre transición y panel de selección. El resume es necesario por el guard de idempotencia de `PauseSystem` (si ya está pausado, `pause()` no hace nada).

## Integration Points

### GameScene — Punto de integración principal

**Archivo:** `src/scenes/GameScene.ts`

**Cambios:**
1. Importar `RealmTransitionDataLoader` y `RealmTransition`.
2. Agregar propiedad `private realmTransitionDataLoader!: RealmTransitionDataLoader`.
3. En `create()`, después de construir los sistemas, instanciar el loader: `this.realmTransitionDataLoader = new RealmTransitionDataLoader(this.cache)`.
4. Modificar `onOrbCollected`:

```typescript
private onOrbCollected = (data: { value: number }): void => {
  const result = this.xpSystem.addXP(this.player, data.value);

  this.events.emit(
    'xp-changed',
    this.player.levelXp,
    this.player.xpThreshold,
    this.player.level,
    result.reachedMaxLevel,
  );

  if (result.leveledUp && result.showPanel) {
    const transition = this.realmTransitionDataLoader.getTransitionForLevel(result.newLevel);
    if (transition) {
      this.pauseSystem.pause();
      this.scene.launch('RealmTransitionScene', { transition, levelUpResult: result });
      this.events.once('realm-transition-complete', () => {
        this.pauseSystem.resume();
        this.levelUpCoordinator.processLevelUp(result);
      });
    } else {
      this.levelUpCoordinator.processLevelUp(result);
    }
  }
};
```

5. En `shutdown()`, agregar limpieza del listener `'realm-transition-complete'`.

### cinematic-assets.ts — Registro de assets

**Archivo:** `src/cinematic/cinematic-assets.ts`

Agregar las 9 entradas de fondos de reinos a `CINEMATIC_BACKGROUNDS`, el alias `xolotl` a `CINEMATIC_SPLASH_ARTS`, y la entrada JSON a `CINEMATIC_JSON_FILES`.

### main.ts — Registro de escena

**Archivo:** `src/main.ts`

Importar y agregar `RealmTransitionScene` al array de escenas.

### splash-art-config.ts — Configuración de portrait

**Archivo:** `src/cinematic/splash-art-config.ts`

Agregar configuración de posición/escala para el key `xolotl` (mismo que `PerroGuiaSplashArt`).

## Error Handling

### JSON no cargado (cache miss)

- **Condición:** `cache.json.get('LevelProgressText')` retorna `undefined`.
- **Comportamiento:** `RealmTransitionDataLoader` inicializa con mapa vacío.
- **Resultado:** `getTransitionForLevel()` siempre retorna `null` → flujo normal sin transición.
- **Impacto en jugador:** Ninguno. El gameplay continúa sin interrupciones narrativas.

### Imagen de fondo no cargada

- **Condición:** El key de `realm.background` no existe en el texture cache de Phaser.
- **Comportamiento:** `RealmTransitionScene` detecta textura faltante en `create()`.
- **Recuperación:** Usa una textura de fallback (rectángulo oscuro generado via `this.add.rectangle()`).
- **Impacto en jugador:** Ve un fondo negro en lugar de la ilustración, pero el diálogo y la ficha cultural funcionan normalmente.

### CinematicPlayer recibe datos inválidos

- **Condición:** Array de `steps` vacío o `CinematicData` malformado (ej: diálogo sin text).
- **Comportamiento:** `CinematicPlayer` emite `'cinematic-complete'` inmediatamente si no hay steps válidos.
- **Recuperación:** `RealmTransitionScene` transiciona directamente al estado `culture` mostrando la ficha cultural.
- **Impacto en jugador:** Se salta el diálogo pero ve la información cultural.

### RealmTransitionScene falla al iniciar

- **Condición:** Datos de init inválidos o excepción no capturada en `create()`.
- **Comportamiento:** Try-catch en `create()` que emite `'realm-transition-complete'` en caso de error.
- **Recuperación:** GameScene recibe el evento y procede con `LevelUpCoordinator.processLevelUp()`.
- **Impacto en jugador:** No ve la transición pero el level-up funciona normalmente.

### Jugador presiona "Saltar" durante transición de splash art

- **Condición:** `CinematicPlayer` está en medio de un tween de fade in/out.
- **Comportamiento:** `CinematicPlayer.destroy()` detiene todos los tweens activos. La escena emite completion.
- **Recuperación:** Limpieza completa sin memory leaks.

### Listener 'realm-transition-complete' no consumido (escena crash)

- **Condición:** Si RealmTransitionScene crashea sin emitir el evento.
- **Comportamiento:** GameScene queda pausado indefinidamente.
- **Mitigación:** Registrar un timeout de seguridad (15 segundos). Si el evento no llega, forzar resume + processLevelUp.
- **Implementación:**
```typescript
const safetyTimeout = this.time.delayedCall(15000, () => {
  this.pauseSystem.resume();
  this.levelUpCoordinator.processLevelUp(result);
});
this.events.once('realm-transition-complete', () => {
  safetyTimeout.destroy();
  this.pauseSystem.resume();
  this.levelUpCoordinator.processLevelUp(result);
});
```


## Correctness Properties

### Property 1: Transformer produce CinematicData válida

**Validates: Requirements 5.1, 5.2**

Para toda `RealmTransition` con al menos un elemento en `dialog[]`, `transformTransitionToCinematicData` retorna un `CinematicData` donde:
- `steps[0].type === 'background'` y `steps[0].image === transition.realm.background`
- `steps.length === transition.dialog.length + 1`
- Todos los steps desde índice 1 son de tipo `'dialog'`
- Cada dialog step tiene `name === transition.guide.name` y `portrait === transition.guide.portrait`

### Property 2: DataLoader retorna null para niveles sin transición

**Validates: Requirements 2.2, 2.3**

Para cualquier nivel que no coincide con ningún `triggerLevel` del JSON, `getTransitionForLevel(level)` retorna `null`.

### Property 3: DataLoader retorna datos completos para niveles configurados

**Validates: Requirements 1.2, 1.3**

Para cada `triggerLevel` presente en el JSON, `getTransitionForLevel(level)` retorna un objeto con todos los campos requeridos (`realm`, `guide`, `dialog`, `culture`) no nulos.

### Property 4: Flujo de GameScene preserva orden

**Validates: Requirements 3.1, 3.2, 3.3**

Si existe transición para un nivel: la secuencia de eventos es siempre `pause → RealmTransitionScene → resume → processLevelUp`. Nunca se llama `processLevelUp` antes de que `'realm-transition-complete'` sea emitido.

### Property 5: Skip siempre emite completación

**Validates: Requirements 8.1, 8.2, 8.3**

Independientemente del estado actual de la escena (`dialog` o `culture`), presionar "Saltar" siempre emite `'realm-transition-complete'` exactamente una vez.

## Testing Strategy

### Tests unitarios (sin Phaser)

1. **realm-transition-transformer.test.ts**
   - Verifica que la transformación produce estructura CinematicData correcta.
   - Verifica mapping de campos (speaker, name, portrait, text, background).
   - Verifica caso con un solo diálogo y con múltiples diálogos.
   - Verifica que el id generado sigue el patrón `realm-transition-{id}`.

2. **RealmTransitionDataLoader.test.ts**
   - Mock del cache con datos válidos → consultas retornan datos correctos.
   - Mock del cache vacío → consultas retornan null.
   - Verifica que niveles no configurados retornan null.
   - Verifica que los 9 niveles del JSON se indexan correctamente.

### Tests de integración (con mocks de Phaser)

3. **RealmTransitionScene.test.ts**
   - Verifica máquina de estados: dialog → culture → complete.
   - Verifica que 'realm-transition-complete' se emite al completar.
   - Verifica que 'realm-transition-complete' se emite al saltar.
   - Verifica que CinematicPlayer se destruye correctamente al cerrar.

4. **GameScene integration (onOrbCollected)**
   - Verifica que cuando hay transición, se pausa y se lanza RealmTransitionScene.
   - Verifica que sin transición, se llama directamente a processLevelUp.
   - Verifica que el safety timeout funciona si la escena no responde.
