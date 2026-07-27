# Design: Sistema Reutilizable de Cinemáticas/Diálogos

## Arquitectura

```
src/
├── scenes/
│   └── CinematicScene.ts          # Escena Phaser dedicada a cinemáticas
├── cinematic/
│   ├── CinematicPlayer.ts         # Motor principal que interpreta el JSON
│   ├── cinematic-types.ts         # Tipos/interfaces del sistema
│   └── cinematic-assets.ts        # Registro de assets de cinemáticas (fondos + splash arts)
├── assets/
│   └── History/
│       └── Prologo.json           # (ya existe) Primer JSON de cinemática
└── config/
    └── menu-assets.ts             # (modificar) Registrar assets de cinemática en BootScene
```

## Flujo Principal

1. MainMenuScene → "Modo Campaña" → `scene.start('CinematicScene', { cinematicKey: 'intro_campaign', nextScene: 'GameScene', nextSceneData: { gameMode } })`
2. CinematicScene carga el JSON, instancia CinematicPlayer
3. CinematicPlayer interpreta paso a paso:
   - `background` → cambia fondo
   - `narration` → muestra texto inmediato, sin portrait, sin nombre
   - `dialog` → muestra splash art + nombre + typewriter
4. El jugador avanza con input (click / tecla)
5. Al terminar todos los pasos → transición a nextScene

## Componentes

### CinematicScene
- Recibe: `cinematicKey` (key del JSON en cache), `nextScene`, `nextSceneData`
- Crea layers: background, splash art, dialog box, text
- Delega lógica a CinematicPlayer

### CinematicPlayer
- Interpreta el array `steps` del JSON
- Mantiene estado: currentStep, currentSpeaker, currentBackground
- Gestiona transiciones de splash art (fade in/out)
- Gestiona animación de "hablando" (tween escala + Y)
- Gestiona typewriter para diálogos
- Emite evento `cinematic-complete` al terminar

### cinematic-types.ts
- `CinematicData`: { id, title, steps }
- `CinematicStep`: union de BackgroundStep | NarrationStep | DialogStep
- Interfaces preparadas para extensiones futuras (sound, camera, etc.)

### cinematic-assets.ts
- Registro de imágenes (fondos + splash arts) con key y path
- Función `loadCinematicAssets(loader)` para BootScene

## Decisiones de Diseño

1. **Data-driven**: Todo se define en JSON. No hay lógica específica de una cinemática en el código.
2. **Un splash art a la vez**: Simplifica el sistema visual. Centrado con escala prominente.
3. **Fade transitions**: 200ms fade out, 200ms fade in para cambios de personaje.
4. **Talking animation**: tween loop con scaleX/Y ±0.01 y y ±2px, duration 800ms, yoyo.
5. **Typewriter**: 30ms por carácter para diálogos. Si el jugador avanza durante typewriter, se muestra todo el texto inmediatamente.
6. **Extensibilidad**: Los tipos incluyen campos opcionales (sound, music, delay, etc.) que se ignoran por ahora.
