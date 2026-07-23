import Phaser from 'phaser';
import { TILESET_METADATA, TILE_SIZE } from '../config/tile-catalog-data';
import {
  LIQUID_FAMILIES,
  BORDER_FRAME_MAPPING,
  STRUCTURE_FRAME_MAPPING,
} from '../map/VisualTileMappings';

/**
 * MappingsDebugScene: Visual calibration tool for verifying mask→frame mappings.
 *
 * Shows 3 sections:
 * - Liquids: each family's centerFrame repeated in a 3×3 block
 * - Borders: masks 0–15 with the frame each maps to
 * - Structures: masks 0–15 for walls with frames
 *
 * Activated via ?debug=mappings
 * Scrollable, similar layout to TileDebugScene.
 */
export class MappingsDebugScene extends Phaser.Scene {
  private static readonly CELL_SIZE = 48;
  private static readonly SECTION_GAP = 60;

  private dragStartY = 0;
  private cameraStartY = 0;
  private isDragging = false;

  constructor() {
    super({ key: 'MappingsDebugScene' });
  }

  preload(): void {
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
    let currentY = 20;

    // Title
    this.add.text(10, currentY, 'MAPPINGS DEBUG - Calibration View', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    currentY += 40;

    this.add.text(10, currentY, 'Scroll: mouse wheel | Drag: click + move', {
      fontSize: '12px',
      color: '#aaaaaa',
    });
    currentY += 30;

    // Section 1: Liquids
    currentY = this.renderLiquidsSection(currentY);
    currentY += MappingsDebugScene.SECTION_GAP;

    // Section 2: Borders
    currentY = this.renderBordersSection(currentY);
    currentY += MappingsDebugScene.SECTION_GAP;

    // Section 3: Structures (Walls)
    currentY = this.renderStructuresSection(currentY);
    currentY += MappingsDebugScene.SECTION_GAP;

    // Configure camera for scrolling
    const totalHeight = currentY + 100;
    this.cameras.main.setBounds(0, 0, 1024, totalHeight);

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _deltaX: number, deltaY: number) => {
      this.cameras.main.scrollY += deltaY * 0.5;
      this.cameras.main.scrollY = Phaser.Math.Clamp(
        this.cameras.main.scrollY,
        0,
        Math.max(0, totalHeight - 768),
      );
    });

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
          Math.max(0, totalHeight - 768),
        );
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }

  private renderLiquidsSection(startY: number): number {
    let y = startY;

    this.add.text(10, y, 'LIQUIDS — Family centerFrame (3×3 blocks)', {
      fontSize: '16px',
      color: '#00ccff',
      fontStyle: 'bold',
    });
    y += 28;

    let xOffset = 20;
    for (const family of LIQUID_FAMILIES) {
      // Family label
      this.add.text(xOffset, y, `${family.family} (frame ${family.centerFrame}, weight ${family.weight})`, {
        fontSize: '11px',
        color: '#ffffff',
      });

      const blockY = y + 16;
      // 3x3 block of the same frame
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const x = xOffset + col * (TILE_SIZE + 2);
          const ty = blockY + row * (TILE_SIZE + 2);

          this.add.rectangle(x + TILE_SIZE / 2, ty + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, 0x1a1a2e);
          this.add.image(x + TILE_SIZE / 2, ty + TILE_SIZE / 2, 'tileset_liquids', family.centerFrame);
          const border = this.add.rectangle(x + TILE_SIZE / 2, ty + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
          border.setStrokeStyle(1, 0x444444);
        }
      }

      xOffset += 3 * (TILE_SIZE + 2) + 60;
    }

    y += 16 + 3 * (TILE_SIZE + 2) + 10;
    return y;
  }

  private renderBordersSection(startY: number): number {
    const cellSize = MappingsDebugScene.CELL_SIZE;
    let y = startY;

    this.add.text(10, y, 'BORDERS — Mask → Frame (0–15)', {
      fontSize: '16px',
      color: '#ffcc00',
      fontStyle: 'bold',
    });
    y += 28;

    for (let mask = 0; mask < 16; mask++) {
      const col = mask % 8;
      const row = Math.floor(mask / 8);
      const x = 20 + col * (cellSize + 20);
      const ty = y + row * (cellSize + 30);
      const frame = BORDER_FRAME_MAPPING[mask] ?? 0;

      this.add.rectangle(x + TILE_SIZE / 2, ty + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, 0xff00ff, 0.3);
      this.add.image(x + TILE_SIZE / 2, ty + TILE_SIZE / 2, 'tileset_borders', frame);
      const border = this.add.rectangle(x + TILE_SIZE / 2, ty + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
      border.setStrokeStyle(1, 0x444444);
      this.add.text(x, ty + TILE_SIZE + 2, `m${mask}→f${frame}`, {
        fontSize: '9px',
        color: '#cccccc',
      });
    }

    y += 2 * (cellSize + 30) + 10;
    return y;
  }

  private renderStructuresSection(startY: number): number {
    const cellSize = MappingsDebugScene.CELL_SIZE;
    let y = startY;

    this.add.text(10, y, 'STRUCTURES (Walls) — Mask → Frame (0–15)', {
      fontSize: '16px',
      color: '#ff6644',
      fontStyle: 'bold',
    });
    y += 28;

    const wallMapping = STRUCTURE_FRAME_MAPPING.wall;
    for (let mask = 0; mask < 16; mask++) {
      const col = mask % 8;
      const row = Math.floor(mask / 8);
      const x = 20 + col * (cellSize + 20);
      const ty = y + row * (cellSize + 30);
      const frame = wallMapping[mask] ?? 0;

      this.add.rectangle(x + TILE_SIZE / 2, ty + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, 0xff00ff, 0.3);
      this.add.image(x + TILE_SIZE / 2, ty + TILE_SIZE / 2, 'tileset_walls', frame);
      const border = this.add.rectangle(x + TILE_SIZE / 2, ty + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
      border.setStrokeStyle(1, 0x444444);
      this.add.text(x, ty + TILE_SIZE + 2, `m${mask}→f${frame}`, {
        fontSize: '9px',
        color: '#cccccc',
      });
    }

    y += 2 * (cellSize + 30) + 10;
    return y;
  }
}
