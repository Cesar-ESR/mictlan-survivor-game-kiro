# Tasks: Sistema Reutilizable de Cinemáticas/Diálogos

## Task 1: Crear tipos e interfaces del sistema de cinemáticas
- [x] 1.1 Crear `src/cinematic/cinematic-types.ts` con interfaces: `CinematicData`, `CinematicStep` (union type), `BackgroundStep`, `NarrationStep`, `DialogStep`
- [x] 1.2 Incluir campos opcionales para extensibilidad futura: `sound`, `music`, `delay`, `camera`, `event`
- [x] 1.3 Crear interface `CinematicSceneData` con: `cinematicKey`, `nextScene`, `nextSceneData`

## Task 2: Crear registro de assets de cinemáticas
- [x] 2.1 Crear `src/cinematic/cinematic-assets.ts` con registros de fondos y splash arts referenciados en el JSON
- [x] 2.2 Implementar `loadCinematicAssets(loader)` que carga todos los fondos de BackgroundsLevelsMenu y splash arts
- [x] 2.3 Cargar el archivo JSON de Prologo como asset de Phaser

## Task 3: Integrar carga de assets en BootScene
- [x] 3.1 Importar y llamar `loadCinematicAssets(this.load)` en `BootScene.preload()`

## Task 4: Crear CinematicPlayer - motor de reproducción
- [x] 4.1 Crear `src/cinematic/CinematicPlayer.ts` que recibe la escena y el JSON parseado
- [x] 4.2 Implementar máquina de estados para avanzar paso a paso
- [x] 4.3 Implementar manejo de paso `background`: cambiar fondo de la escena
- [x] 4.4 Implementar manejo de paso `narration`: mostrar texto inmediato, sin nombre, splash art estático
- [x] 4.5 Implementar manejo de paso `dialog`: mostrar nombre, splash art con animación, typewriter
- [x] 4.6 Implementar transiciones de splash art: fade out/in cuando cambia el personaje
- [x] 4.7 Implementar animación de "hablando": tween sutil de escala + movimiento vertical
- [x] 4.8 Implementar efecto typewriter para diálogos (skip al avanzar durante typewriter)
- [x] 4.9 Emitir evento `cinematic-complete` al finalizar todos los pasos

## Task 5: Crear CinematicScene
- [x] 5.1 Crear `src/scenes/CinematicScene.ts` como escena Phaser dedicada
- [x] 5.2 En `create()`: configurar layers (background, splash art, dialog box, texto)
- [x] 5.3 Instanciar CinematicPlayer con el JSON correspondiente
- [x] 5.4 Configurar input (click/tecla) para avanzar pasos
- [x] 5.5 Al recibir `cinematic-complete`: transicionar a `nextScene` con `nextSceneData`

## Task 6: Integrar CinematicScene en el juego
- [x] 6.1 Registrar CinematicScene en `main.ts` (array de escenas)
- [x] 6.2 Modificar callback de "Modo Campaña" en MainMenuScene para iniciar CinematicScene con datos de la intro
- [x] 6.3 Asegurar que al finalizar la cinemática se inicia GameScene con el gameMode correcto

## Task 7: Verificación final
- [x] 7.1 Ejecutar `tsc` para verificar que no hay errores de tipos
- [x] 7.2 Ejecutar `vite build` para verificar que el proyecto compila correctamente
