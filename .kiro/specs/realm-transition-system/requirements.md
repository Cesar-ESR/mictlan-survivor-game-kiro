# Requirements Document

## Introduction

Sistema narrativo de transición entre reinos del Mictlán que se muestra al jugador cuando alcanza un nivel de progresión configurado. La transición aparece DESPUÉS de la subida de nivel y ANTES del panel de selección de recuerdos (Blessing Selection), mostrando una imagen de fondo del reino, diálogo de Xólotl usando el sistema typewriter existente (CinematicPlayer), e información cultural/histórica sobre el reino actual.

## Glossary

- **RealmTransitionScene**: Escena Phaser dedicada a mostrar la transición narrativa entre reinos del Mictlán.
- **RealmTransitionDataLoader**: Módulo que carga y consulta los datos de transición desde LevelProgressText.json.
- **CinematicPlayer**: Motor reutilizable existente que gestiona el efecto typewriter, transiciones de splash art y animaciones de diálogo.
- **CinematicData**: Formato de datos que consume CinematicPlayer (id, title, steps[]).
- **LevelUpCoordinator**: Sistema existente que coordina el flujo de level-up (pausa → panel de selección → reanudación).
- **PauseSystem**: Sistema existente que controla la pausa global del juego.
- **LevelProgressText.json**: Archivo JSON (src/assets/History/LevelProgressText.json) que contiene las 9 transiciones de reinos.
- **Ficha Cultural**: Sección con título y descripción histórica/cultural del reino que se revela al finalizar el diálogo de Xólotl.
- **Blessing Selection**: Panel de selección de recuerdos/mejoras que aparece durante el gameplay cuando el jugador sube de nivel.

## Requirements

### Requisito 1: Carga de Datos de Transición desde JSON

**Historia de Usuario:** Como desarrollador, quiero que todo el contenido de transición se cargue desde LevelProgressText.json, para que no exista contenido hardcodeado y sea fácil agregar o modificar reinos.

#### Criterios de Aceptación

1. WHEN el juego inicia, THE Sistema SHALL cargar el archivo src/assets/History/LevelProgressText.json desde el pipeline de assets
2. THE RealmTransitionDataLoader SHALL exponer un método para consultar si existe una transición para un nivel dado (triggerLevel)
3. WHEN se consulta una transición por nivel, THE RealmTransitionDataLoader SHALL retornar los datos completos (realm, guide, dialog, culture) o null si no existe
4. THE Sistema SHALL no contener diálogos, nombres de reinos, niveles de activación ni descripciones históricas hardcodeadas en el código

### Requisito 2: Activación de Transición en Niveles Configurados

**Historia de Usuario:** Como jugador, quiero que la transición de reino se muestre únicamente cuando alcanzo un nivel de progresión configurado en el JSON, para que la narrativa se integre naturalmente con la progresión.

#### Criterios de Aceptación

1. WHEN el jugador sube de nivel y el nuevo nivel coincide con un triggerLevel del JSON, THE Sistema SHALL activar la transición de reino
2. WHEN el jugador sube de nivel y el nuevo nivel NO coincide con ningún triggerLevel, THE Sistema SHALL continuar el flujo normal sin mostrar transición
3. THE Sistema SHALL determinar las transiciones exclusivamente a partir de los valores de triggerLevel definidos en el JSON

### Requisito 3: Orden del Flujo — Transición ANTES de Blessing Selection

**Historia de Usuario:** Como jugador, quiero que la Blessing Selection NO se abra inmediatamente al subir de nivel cuando hay transición, sino que primero vea la transición de reino y después el panel de selección.

#### Criterios de Aceptación

1. WHEN se activa una transición de reino, THE Sistema SHALL impedir que la Blessing Selection se abra inmediatamente
2. WHEN se activa una transición de reino, THE Sistema SHALL mostrar primero la RealmTransitionScene completa
3. WHEN la RealmTransitionScene finaliza, THE Sistema SHALL abrir la Blessing Selection existente como siguiente paso
4. THE Sistema SHALL mantener el juego en pausa durante toda la secuencia (transición + Blessing Selection)
5. WHEN el jugador completa la Blessing Selection después de una transición, THE Sistema SHALL reanudar el gameplay normalmente

### Requisito 4: Contenido Visual de la Transición

**Historia de Usuario:** Como jugador, quiero ver una presentación del nuevo reino que incluya ilustración, título, diálogo de Xólotl e información cultural, para sentir la progresión a través del Mictlán.

#### Criterios de Aceptación

1. WHEN se lanza la RealmTransitionScene, THE Scene SHALL mostrar la imagen de fondo correspondiente al campo `realm.background` del JSON
2. THE Scene SHALL usar los assets de fondo ubicados en src/assets/BackgroundsLevelsMenu/ según la correspondencia definida en el JSON
3. WHEN se lanza la RealmTransitionScene, THE Scene SHALL mostrar el título del reino (campo `realm.title` y `realm.name`)
4. WHEN se lanza la RealmTransitionScene, THE Scene SHALL mostrar el retrato de Xólotl (campo `guide.portrait`)
5. WHEN se lanza la RealmTransitionScene, THE Scene SHALL reproducir cada línea de diálogo del array `dialog` usando efecto typewriter
6. WHEN todas las líneas de diálogo finalizan, THE Scene SHALL revelar la ficha cultural (campos `culture.title` y `culture.description`)
7. WHEN la ficha cultural está visible, THE Scene SHALL esperar confirmación del jugador para cerrar

### Requisito 5: Reutilización del Sistema de Cinemáticas Existente

**Historia de Usuario:** Como desarrollador, quiero reutilizar el CinematicPlayer existente para diálogos y typewriter, para mantener consistencia visual y evitar duplicar implementación.

#### Criterios de Aceptación

1. THE RealmTransitionScene SHALL reutilizar el CinematicPlayer existente para el efecto typewriter y la animación de hablando
2. THE Sistema SHALL transformar los datos de transición del JSON al formato CinematicData que CinematicPlayer consume
3. THE Sistema SHALL no duplicar lógica de typewriter, splash art ni animaciones de diálogo que ya existen en CinematicPlayer

### Requisito 6: Registro de Assets en Pipeline de Carga

**Historia de Usuario:** Como desarrollador, quiero que las imágenes de fondo de reinos y el JSON de transiciones estén registrados en el pipeline de carga existente, para que estén disponibles cuando se necesiten.

#### Criterios de Aceptación

1. THE Sistema SHALL registrar las imágenes de fondo de los 9 reinos con keys que correspondan a los valores del campo `realm.background` en el JSON
2. THE Sistema SHALL registrar el archivo LevelProgressText.json para su carga junto con los demás assets de cinemáticas
3. WHEN BootScene carga los assets, THE Sistema SHALL incluir los fondos de reinos y el JSON de transiciones

### Requisito 7: Integridad de Sistemas Existentes

**Historia de Usuario:** Como jugador, quiero que la introducción de transiciones no afecte ningún sistema de gameplay existente.

#### Criterios de Aceptación

1. THE Sistema SHALL no modificar la lógica de progresión del jugador ni cálculos de XP
2. THE Sistema SHALL no modificar el sistema de bendiciones ni sus efectos
3. THE Sistema SHALL no modificar combate, spawn de enemigos, oleadas ni HUD
4. THE Intro Cinematic SHALL continuar funcionando exactamente como antes sin cambios de comportamiento
5. WHEN no hay transición de reino pendiente, THE flujo de Blessing Selection SHALL funcionar idénticamente al flujo actual

### Requisito 8: Funcionalidad de Saltar Transición

**Historia de Usuario:** Como jugador, quiero poder saltar la transición de reino si no deseo ver el contenido narrativo, para continuar jugando rápidamente.

#### Criterios de Aceptación

1. WHEN la RealmTransitionScene está activa, THE Scene SHALL mostrar un botón/opción de saltar visible
2. WHEN el jugador salta la transición, THE Scene SHALL finalizar inmediatamente y señalizar completación
3. WHEN se salta la transición, THE Sistema SHALL proceder directamente a la Blessing Selection

### Requisito 9: Arquitectura Modular

**Historia de Usuario:** Como desarrollador, quiero que el sistema tenga responsabilidades bien separadas, para facilitar mantenimiento y extensibilidad.

#### Criterios de Aceptación

1. THE Sistema SHALL implementar la carga/consulta de datos de transición en un módulo independiente (RealmTransitionDataLoader)
2. THE Sistema SHALL implementar la escena de transición como escena Phaser independiente (RealmTransitionScene)
3. THE Sistema SHALL implementar la transformación de datos JSON → CinematicData como lógica separada de la escena
4. THE punto de integración con el flujo de level-up SHALL estar localizado en un solo lugar (LevelUpCoordinator o GameScene), sin dispersar lógica de transición en múltiples archivos

### Requisito 10: Contenido Independiente de la Intro Cinemática

**Historia de Usuario:** Como jugador, quiero que las transiciones de reino sean contenido nuevo que no repita la cinemática de introducción.

#### Criterios de Aceptación

1. THE RealmTransitionScene SHALL mostrar únicamente el contenido definido en LevelProgressText.json
2. THE Sistema SHALL no reproducir ni referenciar contenido del archivo Prologo.json durante las transiciones
3. WHEN la transición de triggerLevel=1 se activa, THE Sistema SHALL tratarla como cualquier otra transición (mostrar transición, luego Blessing Selection)
