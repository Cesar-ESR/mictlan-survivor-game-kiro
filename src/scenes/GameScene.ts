import Phaser from 'phaser';
import { GAME_CONSTANTS } from '../config/constants';
import { TILESET_BY_KEY } from '../config/tile-catalog-data';

const { MAP_WIDTH, MAP_HEIGHT } = GAME_CONSTANTS;

/**
 * GameScene: Escena principal del juego.
 * Crea el mapa 3200×3200 con un tile de suelo repetido (PROVISIONAL — será
 * reemplazado por MapGenerator en Task 3.9+), configura los world bounds,
 * y lanza el HUD como overlay.
 *
 * NOTA: El uso actual de add.image en loop es temporal y será reemplazado
 * por Phaser Tilemap layers cuando se complete la generación procedural.
 *
 * Requirements: 1.1, 1.3, 1.5, 2.5
 */
export class GameScene extends Phaser.Scene {
  private isPaused = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Crear suelo 3200×3200 usando un solo frame sólido del spritesheet (PROVISIONAL)
    const tileSize = 32;
    const cols = MAP_WIDTH / tileSize;
    const rows = MAP_HEIGHT / tileSize;
    const groundKey = TILESET_BY_KEY.ground.phaserKey;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        this.add.image(
          col * tileSize + tileSize / 2,
          row * tileSize + tileSize / 2,
          groundKey,
          0, // frame 0 — provisional until MapGenerator replaces this
        );
      }
    }

    // Configurar límites del mundo de física
    this.physics.world.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // Lanzar HUD como escena overlay en paralelo
    this.scene.launch('HUDScene');

    // TODO: Reemplazar el loop de add.image por MapGenerator.generate() (Task 3.23)
    // TODO: Instanciar Player en centro del mapa (Task 5)
    // TODO: Configurar cámara para seguir al Player (Task 6)
    // TODO: Instanciar sistemas (SpawnManager, WaveManager, etc.) (Task 23)
  }

  update(_time: number, _delta: number): void {
    // Verificar pausa global
    if (this.isPaused) {
      return;
    }

    // TODO: Delegar actualización a sistemas en orden (Task 23):
    // PlayerManager → WaveManager → SpawnManager → Enemies → WeaponSystem → DamageSystem → OrbCollector
  }
}
