import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { HUDScene } from './scenes/HUDScene';
import { DefeatScene } from './scenes/DefeatScene';
import { VictoryScene } from './scenes/VictoryScene';
import { TileDebugScene } from './scenes/TileDebugScene';
import { MappingsDebugScene } from './scenes/MappingsDebugScene';
import { BorderCalibrationScene } from './scenes/BorderCalibrationScene';

/**
 * Determina el modo de debug desde la URL.
 * - ?debug=tiles → escena de inspección individual de tiles
 * - ?debug=mappings → escena de calibración de mapeos
 * - ?debug=borders → escena interactiva de calibración de bordes
 * - ?debug=map → juego normal con overlay de info de generación de mapa
 *
 * Requirements: 1.1, 1.2
 */
const urlParams = new URLSearchParams(window.location.search);
const debugMode = urlParams.get('debug');

/**
 * Selecciona escenas según modo debug.
 */
function getScenes(): Phaser.Types.Scenes.SceneType[] {
  if (debugMode === 'tiles') {
    return [TileDebugScene];
  }
  if (debugMode === 'mappings') {
    return [MappingsDebugScene];
  }
  if (debugMode === 'borders') {
    return [BorderCalibrationScene];
  }
  // Normal game (including debug=map which uses GameScene with debug overlay)
  return [BootScene, GameScene, HUDScene, DefeatScene, VictoryScene];
}

/**
 * Configuración principal de Phaser para Mictlán Survivor.
 * Requirements: 1.1, 1.2
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  parent: 'app',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: debugMode === 'map',
    },
  },
  scene: getScenes(),
};

const game = new Phaser.Game(config);

// Store debug mode globally for scenes to check
game.registry.set('debugMode', debugMode);
