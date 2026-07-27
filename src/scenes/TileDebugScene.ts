import Phaser from 'phaser';
import { TILESET_METADATA, TILE_SIZE } from '../config/tile-catalog-data';
import type { TilesetMetadata } from '../map/TileCatalog';

/**
 * TileDebugScene: Herramienta de desarrollo para visualizar todos los frames
 * de cada tileset con su clave, índice y posición en la cuadrícula.
 *
 * Permite identificar visualmente frames vacíos/transparentes y clasificar
 * cada frame correctamente en el TileCatalog.
 *
 * Controles:
 * - Scroll con rueda del ratón o arrastrar para navegar
 * - Cada tileset se muestra en una sección separada con encabezado
 * - Cada frame muestra: tileset key, frame index, posición (col, row)
 *
 * Requirements: 10.14 (herramienta de clasificación de frames)
 */
export class TileDebugScene extends Phaser.Scene {
  /** Padding entre frames para evitar superposición. */
  private static readonly FRAME_DISPLAY_SIZE = 48;
  /** Espacio adicional para el texto debajo de cada frame. */
  private static readonly LABEL_HEIGHT = 28;
  /** Margen entre secciones de tileset. */
  private static readonly SECTION_GAP = 60;
  /** Columnas máximas de frames en la visualización. */
  private static readonly DISPLAY_COLS = 16;

  private dragStartY = 0;
  private cameraStartY = 0;
  private isDragging = false;

  constructor() {
    super({ key: 'TileDebugScene' });
  }

  preload(): void {
    // Cargar todos los tilesets como spritesheets de 32×32
    for (const meta of TILESET_METADATA) {
      this.load.spritesheet(meta.phaserKey, meta.assetPath, {
        frameWidth: TILE_SIZE,
        frameHeight: TILE_SIZE,
        margin: 0,
        spacing: 0,
      });
    }
  }

  create(): void {
    const cellSize = TileDebugScene.FRAME_DISPLAY_SIZE + TileDebugScene.LABEL_HEIGHT;
    let currentY = 20;

    // Título principal
    this.add.text(10, currentY, 'TILE DEBUG - Inspección de Frames', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    currentY += 40;

    this.add.text(10, currentY, 'Scroll: rueda del ratón | Arrastrar: click + mover', {
      fontSize: '12px',
      color: '#aaaaaa',
    });
    currentY += 30;

    // Renderizar cada tileset
    for (const meta of TILESET_METADATA) {
      currentY = this.renderTilesetSection(meta, currentY, cellSize);
      currentY += TileDebugScene.SECTION_GAP;
    }

    // Configurar cámara para scroll vertical
    const totalHeight = currentY + 100;
    this.cameras.main.setBounds(0, 0, 1024, totalHeight);

    // Scroll con rueda del ratón
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _deltaX: number, deltaY: number) => {
      this.cameras.main.scrollY += deltaY * 0.5;
      this.cameras.main.scrollY = Phaser.Math.Clamp(
        this.cameras.main.scrollY,
        0,
        totalHeight - 768,
      );
    });

    // Drag para scroll
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartY = pointer.y;
      this.cameraStartY = this.cameras.main.scrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const dy = this.dragStartY - pointer.y;
        this.cameras.main.scrollY = Phaser.Math.Clamp(
          this.cameraStartY + dy,
          0,
          totalHeight - 768,
        );
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }

  /**
   * Renderiza una sección completa para un tileset: encabezado + todos los frames.
   */
  private renderTilesetSection(meta: TilesetMetadata, startY: number, cellSize: number): number {
    const cols = TileDebugScene.DISPLAY_COLS;
    let y = startY;

    // Encabezado de la sección
    const headerText = `${meta.key.toUpperCase()} — "${meta.fileName}" — ${meta.width}×${meta.height}px — ${meta.columns}c × ${meta.rows}r — ${meta.totalFrames} frames`;
    this.add.text(10, y, headerText, {
      fontSize: '14px',
      color: '#ffcc00',
      fontStyle: 'bold',
    });
    y += 24;

    // Fondo oscuro para la sección
    const totalRows = Math.ceil(meta.totalFrames / cols);
    const sectionHeight = totalRows * cellSize;
    this.add.rectangle(
      10 + (cols * cellSize) / 2,
      y + sectionHeight / 2,
      cols * cellSize + 10,
      sectionHeight + 10,
      0x1a1a2e,
      0.5,
    );

    // Renderizar cada frame
    for (let frameIdx = 0; frameIdx < meta.totalFrames; frameIdx++) {
      const col = frameIdx % cols;
      const row = Math.floor(frameIdx / cols);
      const x = 20 + col * cellSize;
      const frameY = y + row * cellSize;

      // Fondo del tile (para detectar transparencia)
      this.add.rectangle(
        x + TILE_SIZE / 2,
        frameY + TILE_SIZE / 2,
        TILE_SIZE,
        TILE_SIZE,
        0xff00ff, // Magenta background - transparent tiles will show this
        0.3,
      );

      // El frame del spritesheet
      this.add.image(
        x + TILE_SIZE / 2,
        frameY + TILE_SIZE / 2,
        meta.phaserKey,
        frameIdx,
      );

      // Borde del frame
      const border = this.add.rectangle(
        x + TILE_SIZE / 2,
        frameY + TILE_SIZE / 2,
        TILE_SIZE,
        TILE_SIZE,
      );
      border.setStrokeStyle(1, 0x444444);

      // Label: frame index
      this.add.text(x, frameY + TILE_SIZE + 2, `${frameIdx}`, {
        fontSize: '9px',
        color: '#ffffff',
      });

      // Label: posición en grid (col,row del spritesheet original)
      const srcCol = frameIdx % meta.columns;
      const srcRow = Math.floor(frameIdx / meta.columns);
      this.add.text(x, frameY + TILE_SIZE + 12, `(${srcCol},${srcRow})`, {
        fontSize: '8px',
        color: '#888888',
      });
    }

    return y + totalRows * cellSize;
  }
}
