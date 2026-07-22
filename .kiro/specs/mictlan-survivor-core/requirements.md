# Requirements Document

## Introduction

Este documento define los requisitos del núcleo de mecánicas survivor para "Mictlán - El honor del guerrero jaguar". El juego es un survivor-like 2D donde el jugador controla a un guerrero jaguar que debe sobrevivir oleadas de enemigos en el inframundo azteca (Mictlán). El sistema se construye con Phaser 3, TypeScript y Vite.

Las mecánicas core incluyen: game loop principal, movimiento del personaje, spawn y comportamiento de enemigos, sistema de combate automático, progresión por experiencia, y gestión de oleadas con dificultad escalable.

## Glossary

- **Game_Loop**: Ciclo principal del juego que ejecuta actualización de lógica y renderizado en cada frame mediante `requestAnimationFrame` de Phaser.
- **Guerrero_Jaguar**: Personaje jugable controlado por el usuario; entidad principal del juego.
- **Enemigo**: Entidad hostil que persigue al Guerrero_Jaguar e inflige daño al contacto.
- **Arma_Automatica**: Proyectil o efecto de área que el Guerrero_Jaguar dispara automáticamente sin intervención del jugador.
- **Experiencia (XP)**: Recurso numérico que el Guerrero_Jaguar acumula al derrotar enemigos.
- **Nivel**: Umbral de XP que al alcanzarse otorga mejoras al Guerrero_Jaguar.
- **Oleada**: Período de tiempo con una configuración específica de spawn de enemigos y dificultad.
- **HUD**: Interfaz gráfica superpuesta que muestra información de estado del juego al jugador.
- **Hitbox**: Área de colisión asociada a una entidad para detectar contacto con otras entidades.
- **Spawn_Manager**: Subsistema que genera enemigos en posiciones fuera de la pantalla visible.
- **Damage_System**: Subsistema que calcula y aplica daño entre entidades basado en sus atributos.
- **Scene_Manager**: Controlador de Phaser que gestiona transiciones entre escenas del juego.
- **Delta_Time**: Tiempo transcurrido entre el frame actual y el anterior, usado para independizar la lógica del juego de la tasa de frames.
- **Modo_Campaña**: Modo de juego con un número finito de oleadas configuradas; completar la oleada final resulta en Victoria.
- **Modo_Infinito**: Modo de juego donde finalWave es null y las oleadas continúan indefinidamente usando la última configuración disponible sin escalado adicional.

## Requirements

### Requirement 1: Inicialización del Game Loop

**User Story:** Como jugador, quiero que el juego inicie con una escena de juego funcional, para poder comenzar a jugar inmediatamente.

#### Acceptance Criteria

1. WHEN el jugador selecciona "Iniciar Partida", THE Scene_Manager SHALL cargar la escena de juego con el mapa, el Guerrero_Jaguar y el HUD en un máximo de 3 segundos.
2. WHILE la escena de juego está activa, THE Game_Loop SHALL ejecutar la lógica de actualización y renderizado a un mínimo de 60 frames por segundo.
3. WHEN la escena de juego se carga, THE Scene_Manager SHALL posicionar al Guerrero_Jaguar en el centro geométrico del mapa, calculado como (ancho_mapa / 2, alto_mapa / 2) en píxeles.
4. IF la carga de la escena de juego excede los 3 segundos o falla por error de carga de assets, THEN THE Scene_Manager SHALL cancelar la carga, mostrar un mensaje de error indicando que la escena no pudo cargarse, y permitir al jugador reintentar la acción desde el menú principal.
5. WHEN la escena de juego se carga, THE Game_Loop SHALL inicializar al Guerrero_Jaguar con los siguientes valores base: puntos de vida máximos según la configuración del personaje, Nivel 1, XP del nivel actual en 0, XP total de la partida en 0 y el Arma_Automatica inicial asignada.

### Requirement 2: Movimiento del Guerrero Jaguar

**User Story:** Como jugador, quiero mover a mi guerrero jaguar en 8 direcciones, para poder esquivar enemigos y recoger recompensas.

#### Acceptance Criteria

1. WHILE el jugador mantiene presionada una tecla de dirección (W/A/S/D o flechas), THE Guerrero_Jaguar SHALL desplazarse en la dirección correspondiente a una velocidad base de 200 píxeles por segundo.
2. WHEN el jugador presiona dos teclas de dirección simultáneamente, THE Guerrero_Jaguar SHALL desplazarse en la dirección diagonal resultante con magnitud normalizada igual a la velocidad base (200 píxeles por segundo).
3. WHEN el jugador deja de presionar todas las teclas de dirección, THE Guerrero_Jaguar SHALL detenerse completamente en un máximo de 1 frame.
4. WHILE el Guerrero_Jaguar se desplaza, THE Game_Loop SHALL actualizar la posición de la cámara para mantener al Guerrero_Jaguar centrado en la pantalla, excepto cuando la cámara alcance los límites del mapa.
5. IF el Guerrero_Jaguar alcanza el límite del mapa, THEN THE Game_Loop SHALL restringir el movimiento para que el Guerrero_Jaguar permanezca dentro de los límites del mapa (dimensiones: 3200 x 3200 píxeles).
6. WHEN el jugador presiona dos teclas de dirección opuestas en el mismo eje simultáneamente, THE Guerrero_Jaguar SHALL cancelar el movimiento únicamente en ese eje, conservando el movimiento del eje perpendicular si existe input activo (e.g., W + S + D produce movimiento hacia la derecha; A + D sin input vertical produce velocidad cero).

### Requirement 3: Spawn y Comportamiento de Enemigos

**User Story:** Como jugador, quiero enfrentarme a enemigos que me persigan, para tener un desafío constante durante la partida.

#### Acceptance Criteria

1. WHILE una oleada está activa, THE Spawn_Manager SHALL generar enemigos en posiciones aleatorias que cumplan simultáneamente: estar fuera del viewport de la cámara, estar dentro de los límites del mapa (3200 × 3200 píxeles), y estar a una distancia entre 50 y 300 píxeles del borde visible de la cámara, con un intervalo base de 2 segundos entre spawns.
2. IF no existe una posición válida que cumpla las tres condiciones de spawn (fuera del viewport, dentro del mapa, entre 50 y 300 píxeles del borde visible), THEN THE Spawn_Manager SHALL cancelar el intento de spawn actual y reintentarlo en el siguiente intervalo de spawn.
3. WHILE un Enemigo está activo, THE Enemigo SHALL desplazarse en dirección al Guerrero_Jaguar a una velocidad definida por su tipo, recalculando la dirección cada frame.
4. WHEN un Enemigo es derrotado, THE Enemigo SHALL desaparecer de la escena y liberar un orbe de XP en su posición con un valor determinado por el tipo de Enemigo.
5. IF la cantidad de enemigos activos alcanza o supera el límite máximo configurado para la oleada (valor predeterminado: 100, configurable por oleada), THEN THE Spawn_Manager SHALL detener la generación de nuevos enemigos hasta que la cantidad descienda por debajo del límite.
6. WHEN un Enemigo se encuentra a una distancia mayor a 1500 píxeles del Guerrero_Jaguar, THE Spawn_Manager SHALL eliminar al Enemigo sin otorgar XP y sin liberar orbe.
7. WHEN una oleada finaliza y comienza la siguiente, THE Spawn_Manager SHALL mantener activos a los enemigos existentes de la oleada anterior.

### Requirement 4: Sistema de Combate Automático

**User Story:** Como jugador, quiero que mi guerrero ataque automáticamente a los enemigos cercanos, para poder concentrarme en el movimiento y la estrategia de supervivencia.

#### Acceptance Criteria

1. WHILE la escena de juego está activa y al menos un Enemigo se encuentra a una distancia máxima de 800 píxeles del Guerrero_Jaguar, THE Arma_Automatica SHALL disparar un proyectil hacia el Enemigo más cercano al Guerrero_Jaguar cada 1000 milisegundos (cadencia base del arma).
2. WHEN un proyectil del Arma_Automatica colisiona con la Hitbox de un Enemigo, THE Damage_System SHALL reducir los puntos de vida del Enemigo en una cantidad igual al daño base del arma (valor inicial: 10 puntos) y destruir el proyectil tras el impacto.
3. WHEN los puntos de vida de un Enemigo alcanzan cero o menos, THE Damage_System SHALL marcar al Enemigo como derrotado.
4. WHEN un Enemigo hace contacto con la Hitbox del Guerrero_Jaguar, THE Damage_System SHALL reducir los puntos de vida del Guerrero_Jaguar (valor inicial: 100 puntos de vida) en una cantidad igual al daño de contacto del Enemigo, aplicable una vez por segundo como máximo por cada Enemigo.
5. IF los puntos de vida del Guerrero_Jaguar alcanzan cero, THEN THE Scene_Manager SHALL mostrar la pantalla de "Derrota" con el tiempo de supervivencia y la XP total obtenida.
6. IF un proyectil del Arma_Automatica no colisiona con ningún Enemigo tras recorrer 1000 píxeles desde su punto de origen, THEN THE Game_Loop SHALL eliminar el proyectil de la escena.

### Requirement 5: Sistema de Experiencia y Nivelación

**User Story:** Como jugador, quiero subir de nivel al acumular experiencia, para sentir progresión y volverme más poderoso durante la partida.

#### Acceptance Criteria

1. WHEN el Guerrero_Jaguar recoge un orbe de XP, THE Game_Loop SHALL incrementar la XP del nivel actual del Guerrero_Jaguar en el valor del orbe, y SHALL incrementar la XP total de la partida en el mismo valor.
2. WHEN la XP del nivel actual del Guerrero_Jaguar alcanza o supera el umbral del siguiente Nivel, THE Game_Loop SHALL incrementar el Nivel en 1 y restar el umbral anterior, conservando el exceso como progreso hacia el siguiente nivel. IF el nuevo Nivel es menor que 20, THEN THE Game_Loop SHALL pausar el juego para mostrar la selección de mejoras.
3. WHEN el Guerrero_Jaguar sube de Nivel, THE HUD SHALL mostrar un panel de selección con 3 mejoras aleatorias únicas (sin repetición) elegidas de un pool de mejoras disponibles.
4. WHILE el panel de selección de mejoras está visible, THE Game_Loop SHALL pausar completamente: movimiento del Guerrero_Jaguar y enemigos, proyectiles, armas automáticas y sus cooldowns, físicas y colisiones, aplicación de daño, generación de enemigos (spawns), temporizadores de oleada y supervivencia, y movimiento y recolección de orbes.
5. WHEN el jugador selecciona una mejora del panel, THE Game_Loop SHALL aplicar la mejora al Guerrero_Jaguar y reanudar todos los sistemas desde el estado y tiempo restante anteriores a la pausa.
6. THE Game_Loop SHALL calcular el umbral de XP para el siguiente Nivel usando la fórmula: umbral = nivel_actual * 10 + 5.
7. WHEN el Guerrero_Jaguar se inicializa, THE Game_Loop SHALL establecer el Nivel en 1 con XP del nivel actual en 0, XP total en 0, y un umbral inicial de 15 XP.
8. IF el pool de mejoras disponibles contiene una o dos opciones, THEN THE HUD SHALL mostrar todas las opciones disponibles en el panel de selección.
9. IF el pool de mejoras disponibles no contiene ninguna opción, THEN THE Game_Loop SHALL omitir el panel de selección y reanudar el juego inmediatamente.
10. IF el Guerrero_Jaguar alcanza el Nivel 20, THEN THE Game_Loop SHALL dejar de incrementar el Nivel, no mostrar más paneles de mejora, y continuar acumulando XP total para las estadísticas de la partida; la barra de XP del HUD SHALL permanecer al 100% sin excederlo.
11. IF el incremento de Nivel hace que el Guerrero_Jaguar alcance el Nivel 20, THEN THE Game_Loop SHALL no pausar la partida ni mostrar el panel de selección de mejoras.

### Requirement 6: Gestión de Oleadas y Dificultad

**User Story:** Como jugador, quiero que la dificultad aumente progresivamente, para mantener el desafío a medida que me vuelvo más fuerte.

#### Acceptance Criteria

1. WHEN una oleada finaliza tras 30 segundos de duración, THE Spawn_Manager SHALL iniciar la siguiente oleada en un máximo de 2 segundos y THE HUD SHALL mostrar brevemente el número de la nueva oleada.
2. WHILE una oleada está activa, THE Spawn_Manager SHALL generar enemigos respetando el intervalo de spawn y los tipos de enemigos definidos para esa oleada, comenzando con un intervalo base de 2 segundos entre spawns en la oleada 1.
3. WHEN una oleada finaliza, THE Spawn_Manager SHALL calcular la dificultad de la siguiente oleada usando las fórmulas: spawnInterval = max(baseSpawnInterval × 0.9^(wave - 1), 0.5), hpMultiplier = min(1.15^(wave - 1), 5), speedMultiplier = min(1.05^(wave - 1), 2), donde wave es el número de la nueva oleada y baseSpawnInterval es 2 segundos. La fórmula de spawnInterval representa una reducción acumulativa del 10% del intervalo de spawn por cada oleada, hasta alcanzar el mínimo de 0.5 segundos.
4. WHERE el modo de juego es Modo_Campaña, IF el jugador sobrevive la oleada final configurada, THEN THE Scene_Manager SHALL mostrar la pantalla de "Victoria" con las estadísticas de la partida incluyendo: tiempo total de supervivencia, oleada máxima alcanzada, enemigos derrotados, XP total obtenida y nivel alcanzado.
5. WHERE el modo de juego es Modo_Infinito (finalWave es null), THE Spawn_Manager SHALL continuar generando oleadas indefinidamente; cuando el número de oleada supere la última oleada configurada, SHALL repetir los parámetros de la última oleada configurada sin aplicar escalado de dificultad adicional.

### Requirement 7: HUD e Información de Estado

**User Story:** Como jugador, quiero ver mi estado actual en pantalla, para tomar decisiones informadas durante la partida.

#### Acceptance Criteria

1. WHILE la escena de juego está activa, THE HUD SHALL mostrar la barra de vida del Guerrero_Jaguar en la parte superior izquierda de la pantalla, representando la proporción de puntos de vida actuales sobre los puntos de vida máximos mediante un relleno horizontal de 0% a 100%.
2. WHILE la escena de juego está activa, THE HUD SHALL mostrar la barra de experiencia del Guerrero_Jaguar como un relleno horizontal que representa el porcentaje de XP acumulada en el nivel actual respecto al umbral del siguiente Nivel (0% al inicio del nivel, 100% al alcanzar el umbral).
3. WHILE la escena de juego está activa, THE HUD SHALL mostrar el número de oleada actual como un valor entero y el tiempo transcurrido de la partida en formato MM:SS.
4. WHEN los puntos de vida del Guerrero_Jaguar cambian, THE HUD SHALL actualizar la barra de vida en el mismo frame.
5. WHEN la XP del nivel actual del Guerrero_Jaguar cambia, THE HUD SHALL actualizar la barra de experiencia en el mismo frame.
6. WHEN el Guerrero_Jaguar sube de Nivel, THE HUD SHALL actualizar el relleno de la barra de experiencia para representar la XP excedente respecto al nuevo umbral (exceso_XP / nuevo_umbral × 100%); no se reinicia necesariamente a 0%.

### Requirement 8: Recolección de Orbes de XP

**User Story:** Como jugador, quiero que los orbes de experiencia sean atraídos hacia mi personaje, para no tener que recoger cada uno manualmente.

#### Acceptance Criteria

1. WHEN un orbe de XP se genera, THE Game_Loop SHALL posicionar el orbe en la ubicación donde el Enemigo fue derrotado y el orbe permanecerá estático hasta ser atraído.
2. WHEN el Guerrero_Jaguar se encuentra a una distancia menor o igual a 100 píxeles de un orbe de XP, THE Game_Loop SHALL mover el orbe hacia el Guerrero_Jaguar a una velocidad de 400 píxeles por segundo, manteniendo la atracción hasta que el orbe sea recogido.
3. WHEN un orbe de XP colisiona con la Hitbox del Guerrero_Jaguar, THE Game_Loop SHALL incrementar la XP del nivel actual y la XP total de la partida en el valor del orbe, y eliminar el orbe de la escena.
4. IF un orbe de XP permanece en la escena durante más de 30 segundos sin ser recogido, THEN THE Game_Loop SHALL eliminar el orbe de la escena.
5. IF la cantidad de orbes activos en la escena supera 200, THEN THE Game_Loop SHALL eliminar los orbes más antiguos para mantener el límite de rendimiento.
6. WHILE el Guerrero_Jaguar se encuentre en el Nivel 20, WHEN recoja un orbe de XP, THE Game_Loop SHALL incrementar únicamente la XP total de la partida, mantener la XP del nivel actual limitada a su umbral máximo y mantener la barra de XP del HUD al 100%.

### Requirement 9: Tipos de Enemigos

**User Story:** Como jugador, quiero enfrentar diferentes tipos de enemigos con comportamientos y estadísticas distintas, para que cada partida sea variada y el desafío aumente progresivamente.

#### Acceptance Criteria

1. THE EnemyRegistry SHALL registrar los siguientes 4 arquetipos de enemigos: Esqueleto (HP: 30, velocidad: 80 px/s, daño: 5, XP: 5, comportamiento: persecución directa hacia el Guerrero_Jaguar), Murciélago (HP: 15, velocidad: 150 px/s, daño: 3, XP: 3, comportamiento: persecución con patrón de movimiento en zigzag oscilando perpendicularmente a la dirección de avance), Calavera Llameante (HP: 50, velocidad: 60 px/s, daño: 10, XP: 10, comportamiento: persecución directa y al morir explota infligiendo 15 puntos de daño únicamente al Guerrero_Jaguar si se encuentra dentro de un radio de 100 píxeles), y Serpiente Emplumada (HP: 80, velocidad inicial: 100 px/s, daño: 8, XP: 15, comportamiento: persecución con aceleración progresiva hasta una velocidad máxima configurable).
2. EACH Enemigo SHALL heredar de una clase base Enemy que defina la interfaz común con propiedades: hp, maxHp, speed, damage, xpReward, y métodos: update(), takeDamage(), onDefeat().
3. EACH Enemigo SHALL definir sus propios puntos de vida, velocidad, daño, recompensa de XP, animaciones de sprite y comportamiento especial según su arquetipo.
4. THE Spawn_Manager SHALL configurar la aparición de enemigos por oleada: oleadas 1-3 solo Esqueletos; oleadas 4-6 Esqueletos y Murciélagos; oleadas 7-8 Esqueletos, Murciélagos y Calaveras Llameantes; oleadas 9-10 los 4 tipos.
5. THE Spawn_Manager SHALL soportar la adición de nuevos tipos de enemigos sin modificar la arquitectura de enemigos existente, mediante un registro de tipos de enemigos (EnemyRegistry).

## Non-Functional Requirements

### Performance

1. THE Game_Loop SHALL mantener un promedio mínimo de 60 frames por segundo durante una prueba continua de 5 minutos con hasta 100 enemigos activos, hasta 200 orbes activos, proyectiles, colisiones y HUD funcionando simultáneamente en la plataforma objetivo documentada.

### Architecture

1. THE code SHALL estar escrito en TypeScript.
2. THE project SHALL utilizar Phaser 3 como motor de juego.
3. THE code SHALL seguir una arquitectura modular con separación clara de responsabilidades.

### Frame-Rate Independence

1. THE Game_Loop SHALL aplicar Delta_Time a todos los movimientos, aceleraciones, cooldowns de armas y daño, temporizadores de spawn y oleada, tiempo de supervivencia, tiempo de vida de proyectiles y orbes, y cualquier otro cálculo dependiente del tiempo, para garantizar que la simulación sea independiente de la tasa de frames.

### Maintainability

1. Cada sistema SHALL tener una única responsabilidad (Single Responsibility Principle).
2. THE game logic SHALL ser independiente del renderizado siempre que sea posible, separando lógica de presentación.
