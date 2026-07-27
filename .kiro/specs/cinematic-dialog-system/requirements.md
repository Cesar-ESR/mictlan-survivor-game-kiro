# Requirements: Sistema Reutilizable de Cinemáticas/Diálogos

## Resumen
Sistema genérico y reutilizable para reproducir cinemáticas basadas en archivos JSON. La primera cinemática será la introducción del modo campaña, pero el sistema no está acoplado a ella.

## Requisitos Funcionales

### REQ-1: Escena de Cinemáticas
- Crear una escena Phaser dedicada (`CinematicScene`) capaz de reproducir cualquier archivo JSON que siga la estructura definida.
- Al finalizar la cinemática, la escena transiciona automáticamente a la siguiente escena indicada.

### REQ-2: Estructura JSON
- Los pasos soportan tipos: `background`, `narration`, `dialog`.
- Los diálogos incluyen: `speaker`, `name`, `portrait`, `text`.
- Las narraciones incluyen: `text`.
- Los cambios de fondo incluyen: `image`.

### REQ-3: Fondos
- El sistema muestra el fondo indicado por el JSON.
- Mientras no haya un nuevo paso `background`, se mantiene el fondo actual.
- Los fondos se registran como assets y se referencian por key.

### REQ-4: Splash Art de Personajes
- Un solo Splash Art visible a la vez, centrado, ocupando gran parte de la pantalla.
- Cambia automáticamente cuando el personaje cambia en el JSON.
- Se mantiene mientras el mismo personaje continúa hablando.
- Se oculta solo cuando el siguiente paso lo requiera (narración sin portrait previo).

### REQ-5: Transiciones entre Personajes
- Fade Out del Splash Art actual → Fade In del nuevo.
- Transición rápida y elegante (no instantánea).

### REQ-6: Animación del Personaje que Habla
- Mientras un personaje habla: ligera variación de escala + pequeño movimiento vertical, repetido suavemente.
- Si es narración: Splash Art estático.

### REQ-7: Texto - Typewriter vs Inmediato
- Diálogos: efecto typewriter (letras aparecen progresivamente).
- Narraciones: texto completo inmediato.

### REQ-8: Caja de Diálogo
- Mostrar nombre del personaje cuando es diálogo.
- Ocultar nombre cuando es narración.

### REQ-9: Navegación
- El jugador avanza manualmente (input existente de continuar).
- No avance automático.

### REQ-10: Integración con Modo Campaña
- Al seleccionar "Modo Campaña", se inicia la cinemática de introducción.
- Al finalizar la cinemática, comienza automáticamente el gameplay.
- No modificar lógica de gameplay.

### REQ-11: Extensibilidad
- Arquitectura preparada para soportar: sonidos, voces, música, efectos, pausas, eventos custom, etc.
- No implementar aún, solo preparar la estructura.
