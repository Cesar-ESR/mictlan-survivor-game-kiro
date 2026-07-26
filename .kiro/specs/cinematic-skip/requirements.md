# Requirements Document

## Introduction

Funcionalidad para omitir cinemáticas durante su reproducción en Mictlan Survivor. El jugador puede presionar un botón "Skip" para detener inmediatamente la cinemática en curso y transicionar directamente al gameplay, cancelando todos los efectos pendientes y utilizando el mismo flujo de finalización que la terminación normal.

## Glossary

- **CinematicScene**: Escena Phaser dedicada a reproducir cinemáticas. Configura capas visuales y delega la lógica al CinematicPlayer.
- **CinematicPlayer**: Motor de reproducción que interpreta pasos JSON (background, narration, dialog) y gestiona efectos visuales (typewriter, fade, talking animation).
- **Skip_Button**: Elemento interactivo de UI posicionado en la esquina superior derecha que permite al jugador omitir la cinemática.
- **transitionToNext**: Método existente en CinematicScene que limpia listeners de input, destruye el CinematicPlayer y transiciona a la siguiente escena.
- **Typewriter**: Efecto de texto progresivo (30ms por carácter) utilizado en pasos de diálogo.
- **Talking_Animation**: Tween de Phaser que anima el splash art con variación de escala y movimiento vertical mientras un personaje habla.
- **Fade_Transition**: Tweens de fade out (200ms) y fade in (200ms) aplicados al splash art durante cambios de personaje.

## Requirements

### Requirement 1: Botón Skip visible durante la cinemática

**User Story:** Como jugador, quiero ver un botón "Skip" discreto durante la cinemática, para saber que puedo omitirla en cualquier momento.

#### Acceptance Criteria

1. WHEN la CinematicScene inicia la reproducción, THE Skip_Button SHALL mostrarse en la esquina superior derecha de la pantalla con un margen de 20px desde el borde superior y 20px desde el borde derecho, con el texto "Skip"
2. THE Skip_Button SHALL utilizar la fuente PixelOperator del juego con un tamaño de 14px y color #ffffff con opacidad 0.7 para mantener coherencia visual sin distraer
3. THE Skip_Button SHALL mostrarse con un depth de 50 (superior al depth 30 de las capas de texto de la cinemática) para permanecer siempre visible sobre todos los elementos
4. THE Skip_Button SHALL ser interactivo y responder a eventos pointerdown de Phaser para capturar la pulsación del jugador
5. THE Skip_Button SHALL mostrar un cambio visual al hacer hover (opacidad 1.0) para indicar que es interactivo

### Requirement 2: Omitir la cinemática al presionar Skip

**User Story:** Como jugador, quiero omitir la cinemática presionando el botón Skip, para acceder directamente al gameplay sin esperar.

#### Acceptance Criteria

1. WHEN el jugador presiona el Skip_Button, THE CinematicScene SHALL ejecutar el método transitionToNext para iniciar la transición al gameplay, deteniendo todas las animaciones (tweens) y temporizadores activos del CinematicPlayer antes de destruirlo
2. WHEN el jugador presiona el Skip_Button durante cualquier paso de la cinemática, THE CinematicScene SHALL iniciar la transición a la siguiente escena sin importar si el CinematicPlayer se encuentra en estado isTransitioning o isTypewriting
3. THE CinematicScene SHALL utilizar el mismo método transitionToNext tanto para la finalización normal como para el skip, garantizando que la limpieza de listeners de input, la destrucción del CinematicPlayer y el inicio de la siguiente escena ocurran en ambos flujos
4. IF el jugador presiona el Skip_Button cuando transitionToNext ya se encuentra en ejecución, THEN THE CinematicScene SHALL ignorar la pulsación adicional sin ejecutar la transición nuevamente

### Requirement 3: Cancelación completa de efectos pendientes

**User Story:** Como jugador, quiero que al omitir la cinemática se cancelen todos los efectos activos, para que no persistan animaciones ni timers después de la transición.

#### Acceptance Criteria

1. WHEN el skip se ejecuta, THE CinematicPlayer.destroy() SHALL cancelar el typewriterTimer invocando destroy() sobre el TimerEvent de Phaser si está activo y estableciendo la referencia a null
2. WHEN el skip se ejecuta, THE CinematicPlayer.destroy() SHALL detener la Talking_Animation invocando stop() sobre el tween de Phaser y reseteando la escala y posición del splash art a sus valores base
3. WHEN el skip se ejecuta, THE CinematicScene SHALL invocar this.tweens.killAll() para cancelar todos los tweens activos de la escena, eliminando Fade_Transitions pendientes y el parpadeo del indicador de continuar
4. WHEN el skip se ejecuta, THE CinematicScene SHALL invocar this.time.removeAllEvents() para cancelar todos los timers programados en la escena
5. WHEN el skip se ejecuta durante una Fade_Transition en progreso (isTransitioning === true en CinematicPlayer), THE CinematicScene SHALL cancelar el tween de fade sin esperar su callback onComplete, evitando que se ejecute showNewSplashArt() o cualquier lógica posterior al fade

### Requirement 4: Desaparición del botón Skip

**User Story:** Como jugador, quiero que el botón Skip desaparezca automáticamente cuando la cinemática termina, para que no interfiera con el gameplay.

#### Acceptance Criteria

1. WHEN la cinemática finaliza normalmente (evento cinematic-complete), THE Skip_Button SHALL establecer su visibilidad a false y desactivar su interactividad antes de que se invoque la transición a la siguiente escena
2. WHEN el jugador presiona el Skip_Button, THE Skip_Button SHALL desactivar su interactividad inmediatamente y establecer su visibilidad a false
3. IF el jugador presiona el Skip_Button mientras una transición de escena está en curso, THEN THE Skip_Button SHALL ignorar la pulsación sin producir efectos adicionales
4. WHEN la CinematicScene se destruye mediante scene.start(), THE Skip_Button SHALL ser eliminado como parte de la destrucción automática de GameObjects de Phaser junto con los demás elementos de la escena

### Requirement 5: Compatibilidad con el flujo existente

**User Story:** Como desarrollador, quiero que la funcionalidad de skip no modifique el flujo normal de la cinemática, para mantener la estabilidad del sistema actual.

#### Acceptance Criteria

1. IF el jugador no presiona el Skip_Button, THEN THE CinematicScene SHALL reproducir todos los pasos de la cinemática secuencialmente (background, narration, dialog) permitiendo el avance manual mediante click, Space o Enter, hasta que CinematicPlayer emita el evento 'cinematic-complete'
2. THE CinematicPlayer SHALL procesar los pasos secuencialmente mediante su método advance(), aplicando el efecto typewriter en diálogos y mostrando narraciones de forma inmediata, sin que la existencia del Skip_Button altere esta lógica de reproducción
3. WHEN la cinemática finaliza por skip o por reproducción completa, THE CinematicScene SHALL invocar transitionToNext() pasando el mismo nextScene y nextSceneData definidos en CinematicSceneData, de modo que la escena destino reciba los datos esperados (incluyendo gameMode si aplica)
4. WHEN la transición por skip se ejecuta, THE CinematicScene SHALL destruir el CinematicPlayer, cancelar todos los tweens y timers, y remover los listeners de input (pointerdown, keydown-SPACE, keydown-ENTER) y el listener del evento 'cinematic-complete', de modo que no existan eventos pendientes ni callbacks activos tras la transición

### Requirement 6: Restricciones de implementación

**User Story:** Como desarrollador, quiero que la implementación del skip respete los límites del sistema, para evitar regresiones en otros módulos.

#### Acceptance Criteria

1. THE CinematicScene SHALL implementar el skip sin alterar el contenido de ningún archivo JSON dentro de src/assets/History/
2. THE CinematicScene SHALL implementar el skip sin alterar el contenido narrativo (textos, orden de steps, speakers, portraits) definido en los archivos JSON de cinemáticas
3. THE CinematicScene SHALL implementar el skip sin modificar el archivo src/scenes/GameScene.ts
4. THE CinematicScene SHALL implementar el skip sin modificar el archivo src/config/audio-assets.ts
5. WHEN se ejecuta `npx tsc --noEmit`, THE proyecto SHALL completar con código de salida 0 y sin errores de tipo
6. WHEN se ejecuta `npx vite build`, THE proyecto SHALL completar con código de salida 0 y generar el bundle en el directorio dist/ sin errores
