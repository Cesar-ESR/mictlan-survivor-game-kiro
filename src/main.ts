import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { HUDScene } from './scenes/HUDScene';
import { DefeatScene } from './scenes/DefeatScene';
import { VictoryScene } from './scenes/VictoryScene';
import { TileDebugScene } from './scenes/TileDebugScene';

/**
 * Determina si se debe iniciar en modo debug de tiles.
 * Usar ?debug=tiles en la URL para activar la escena de debug.
 */
const urlParams = new URLSearchParams(window.location.search);
const debugMode = urlParams.get('debug');

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
      debug: false,
    },
  },
  scene: debugMode === 'tiles'
    ? [TileDebugScene]
    : [BootScene, GameScene, HUDScene, DefeatScene, VictoryScene],
};

new Phaser.Game(config);
