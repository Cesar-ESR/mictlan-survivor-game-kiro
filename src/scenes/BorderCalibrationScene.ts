import Phaser from 'phaser';
import { TILESET_METADATA, TILE_SIZE } from '../config/tile-catalog-data';
import {
  WATER_BORDER_CANDIDATES,
  LAVA_BORDER_CANDIDATES,
  BORDER_PRIORITY_MASKS,
} from '../map/VisualTileMappings';
import type { TileRotation } from '../map/VisualTileMappings';

/**
 * BorderCalibrationScene: Interactive tool for identifying border frame mappings.
 *
 * Shows controlled liquid regions (5×5) surrounded by Ground, with candidate
 * border frames placed at each mask position for visual comparison.
 *
 * Interactive controls:
 * - A/D: previous/next mask
 * - W/S: previous/next frame candidate
 * - Q/E: rotate -90/+90
 * - X: toggle flipX
 * - Y: toggle flipY
 * - F: toggle Water/Lava family
 * - R: reset to initial candidate
 * - 4: jump to Water section
 * - 5: jump to Lava section
 * - G: back to top
 *
 * Displays copiable output: `water mask 1: { frame: 9, rotation: 0, flipX: false, flipY: false }`
 *
 * Activated via ?debug=borders
 */
export class BorderCalibrationScene extends Phaser.Scene {
  // State
  private currentFamily: 'water' | 'lava' = 'water';
  private currentMaskIndex = 0;
  private currentFrameIndex = 0;
  private currentRotation: TileRotation = 0;
  private currentFlipX = false;
  private currentFlipY = false;

  // Display
  private statusText!: Phaser.GameObjects.Text;
  private outputText!: Phaser.GameObjects.Text;
  private previewContainer!: Phaser.GameObjects.Container;

  // Section positions for navigation
  private waterSectionY = 0;
  private lavaSectionY = 0;
  private totalHeight = 0;
  private isDragging = false;
  private dragStartY = 0;
  private cameraStartY = 0;

  constructor() {
    super({ key: 'BorderCalibrationScene' });
  }

  preload(): void {
    for (const meta of TILESET_METADATA) {
      this.load.spritesheet(meta.phaserKey, meta.assetPath, {
        frameWidth: TILE_SIZE,
        frameHeight: TILE_SIZE,
      });
    }
  }

  create(): void {
    let y = 20;

    // Header
    this.add.text(10, y, 'BORDER CALIBRATION — Interactive Frame Selector', {
      fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
    });
    y += 30;
    this.add.text(10, y, [
      'A/D=mask | W/S=frame | Q/E=rotate | X=flipX | Y=flipY | F=family | R=reset',
      '4=Water | 5=Lava | G=Top | Scroll=wheel | Drag=click+move',
    ].join('\n'), { fontSize: '10px', color: '#aaaaaa' });
    y += 36;

    // Status display
    this.statusText = this.add.text(10, y, '', { fontSize: '13px', color: '#00ff00' });
    y += 20;
    this.outputText = this.add.text(10, y, '', { fontSize: '12px', color: '#ffcc00', fontFamily: 'monospace' });
    y += 24;

    // Interactive preview area
    this.previewContainer = this.add.container(10, y);
    y += 200;

    // Water static calibration section
    this.waterSectionY = y;
    y = this.renderStaticCalibrationSection(y, 'water', WATER_BORDER_CANDIDATES, 0);
    y += 60;

    // Lava static calibration section
    this.lavaSectionY = y;
    y = this.renderStaticCalibrationSection(y, 'lava', LAVA_BORDER_CANDIDATES, 20);
    y += 60;

    this.totalHeight = y + 200;
    this.cameras.main.setBounds(0, 0, 1200, this.totalHeight);

    this.setupControls();
    this.updateDisplay();
  }

  private get candidates(): readonly number[] {
    return this.currentFamily === 'water' ? WATER_BORDER_CANDIDATES : LAVA_BORDER_CANDIDATES;
  }

  private get liquidFrame(): number {
    return this.currentFamily === 'water' ? 0 : 20;
  }

  private updateDisplay(): void {
    const mask = BORDER_PRIORITY_MASKS[this.currentMaskIndex];
    const frame = this.candidates[this.currentFrameIndex % this.candidates.length];

    this.statusText.setText(
      `Family: ${this.currentFamily.toUpperCase()} | Mask: ${mask} | Frame: ${frame} | Rot: ${this.currentRotation}° | FlipX: ${this.currentFlipX} | FlipY: ${this.currentFlipY}`
    );
    this.outputText.setText(
      `${this.currentFamily} mask ${mask}: { frame: ${frame}, rotation: ${this.currentRotation}, flipX: ${this.currentFlipX}, flipY: ${this.currentFlipY} }`
    );

    // Update preview
    this.previewContainer.removeAll(true);
    this.renderInteractivePreview(mask, frame);
  }

  private renderInteractivePreview(mask: number, frame: number): void {
    const size = TILE_SIZE;
    const gap = 2;
    const gridSize = 5;
    const offsetX = 40;
    const offsetY = 10;

    // Draw 5x5 liquid region with ground border
    for (let r = 0; r < gridSize + 2; r++) {
      for (let c = 0; c < gridSize + 2; c++) {
        const x = offsetX + c * (size + gap);
        const y = offsetY + r * (size + gap);
        const cx = x + size / 2;
        const cy = y + size / 2;

        const isLiquid = r >= 1 && r <= gridSize && c >= 1 && c <= gridSize;
        const isBorderCell = !isLiquid && this.isBorderPosition(r, c, gridSize, mask);

        if (isLiquid) {
          // Liquid tile
          this.previewContainer.add(this.add.image(cx, cy, 'tileset_liquids', this.liquidFrame));
        } else {
          // Ground tile
          this.previewContainer.add(this.add.image(cx, cy, 'tileset_ground', 0));
        }

        if (isBorderCell) {
          // Border candidate overlay
          const img = this.add.image(cx, cy, 'tileset_borders', frame);
          img.setAngle(this.currentRotation);
          if (this.currentFlipX) img.setFlipX(true);
          if (this.currentFlipY) img.setFlipY(true);
          this.previewContainer.add(img);

          // Highlight border cell
          const highlight = this.add.rectangle(cx, cy, size, size);
          highlight.setStrokeStyle(2, 0x00ff00);
          this.previewContainer.add(highlight);
        }
      }
    }

    // Mask diagram
    const diagramX = offsetX + (gridSize + 3) * (size + gap) + 20;
    const diagramY = offsetY + 30;
    this.renderMaskDiagram(diagramX, diagramY, mask);
  }

  /** Determines if a position around the liquid grid should show a border for the given mask. */
  private isBorderPosition(row: number, col: number, gridSize: number, _mask: number): boolean {
    // Show border on cells immediately adjacent to the liquid region
    // For simplicity in the calibration tool, show on the middle cell of each edge
    const midRow = Math.floor(gridSize / 2) + 1;
    const midCol = Math.floor(gridSize / 2) + 1;

    // North edge (row 0, middle col)
    if (row === 0 && col === midCol) return true;
    // South edge (row gridSize+1, middle col)
    if (row === gridSize + 1 && col === midCol) return true;
    // West edge (middle row, col 0)
    if (col === 0 && row === midRow) return true;
    // East edge (middle row, col gridSize+1)
    if (col === gridSize + 1 && row === midRow) return true;

    return false;
  }

  private renderMaskDiagram(x: number, y: number, mask: number): void {
    const s = 16;
    const positions = [
      { r: 0, c: 1, bit: 1, label: 'N' },
      { r: 1, c: 2, bit: 2, label: 'E' },
      { r: 2, c: 1, bit: 4, label: 'S' },
      { r: 1, c: 0, bit: 8, label: 'W' },
    ];

    // Center
    const centerRect = this.add.rectangle(x + s, y + s, s, s, 0x4444ff);
    this.previewContainer.add(centerRect);

    for (const pos of positions) {
      const px = x + pos.c * s;
      const py = y + pos.r * s;
      const active = (mask & pos.bit) !== 0;
      const rect = this.add.rectangle(px + s / 2, py + s / 2, s - 2, s - 2, active ? 0x00ccff : 0x333333);
      this.previewContainer.add(rect);
      const label = this.add.text(px + 2, py + 2, pos.label, { fontSize: '9px', color: active ? '#ffffff' : '#666666' });
      this.previewContainer.add(label);
    }
  }

  /**
   * Renders a static section showing all priority masks with all candidate frames
   * for a given family. This provides a reference grid for visual comparison.
   */
  private renderStaticCalibrationSection(startY: number, family: 'water' | 'lava', candidates: readonly number[], liquidFrame: number): number {
    let y = startY;
    const color = family === 'water' ? '#00ccff' : '#ff6644';

    this.add.text(10, y, `${family.toUpperCase()} BORDER CALIBRATION — Candidates per mask`, {
      fontSize: '14px', color, fontStyle: 'bold',
    });
    y += 22;

    const rotations: TileRotation[] = [0, 90, 180, 270];
    const cellW = TILE_SIZE + 4;

    // For each priority mask, show all candidates at all rotations on liquid background
    for (const mask of BORDER_PRIORITY_MASKS) {
      this.add.text(10, y, `mask ${mask} (${this.maskLabel(mask)})`, { fontSize: '11px', color: '#ffffff' });
      y += 14;

      let xCursor = 20;
      for (const frame of candidates) {
        for (const rot of rotations) {
          const cx = xCursor + TILE_SIZE / 2;
          const cy = y + TILE_SIZE / 2;

          // Liquid background
          this.add.image(cx, cy, 'tileset_liquids', liquidFrame);
          // Border frame with rotation
          const img = this.add.image(cx, cy, 'tileset_borders', frame);
          img.setAngle(rot);
          // Outline
          const outline = this.add.rectangle(cx, cy, TILE_SIZE, TILE_SIZE);
          outline.setStrokeStyle(1, 0x444444);

          xCursor += cellW;
        }
        // Space between frames
        xCursor += 8;
      }
      y += TILE_SIZE + 8;

      // Labels row
      let labelX = 20;
      for (const frame of candidates) {
        this.add.text(labelX, y, `f${frame}`, { fontSize: '8px', color: '#888888' });
        labelX += rotations.length * cellW + 8;
      }
      y += 14;
    }

    return y;
  }

  private maskLabel(mask: number): string {
    const labels: Record<number, string> = {
      1: 'N', 2: 'E', 4: 'S', 8: 'W',
      3: 'NE', 6: 'ES', 12: 'SW', 9: 'NW',
    };
    return labels[mask] ?? `m${mask}`;
  }

  private setupControls(): void {
    const maxScroll = Math.max(0, this.totalHeight - 768);

    // Scroll
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _g: unknown[], _dx: number, dy: number) => {
      this.cameras.main.scrollY = Phaser.Math.Clamp(this.cameras.main.scrollY + dy * 0.6, 0, maxScroll);
    });

    // Drag
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.isDragging = true; this.dragStartY = p.y; this.cameraStartY = this.cameras.main.scrollY;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        this.cameras.main.scrollY = Phaser.Math.Clamp(this.cameraStartY + (this.dragStartY - p.y), 0, maxScroll);
      }
    });
    this.input.on('pointerup', () => { this.isDragging = false; });

    if (!this.input.keyboard) return;

    // Navigation keys
    this.input.keyboard.on('keydown-FOUR', () => { this.cameras.main.scrollY = Phaser.Math.Clamp(this.waterSectionY, 0, maxScroll); });
    this.input.keyboard.on('keydown-FIVE', () => { this.cameras.main.scrollY = Phaser.Math.Clamp(this.lavaSectionY, 0, maxScroll); });
    this.input.keyboard.on('keydown-G', () => { this.cameras.main.scrollY = 0; });

    // Interactive controls
    this.input.keyboard.on('keydown-A', () => {
      this.currentMaskIndex = (this.currentMaskIndex - 1 + BORDER_PRIORITY_MASKS.length) % BORDER_PRIORITY_MASKS.length;
      this.updateDisplay();
    });
    this.input.keyboard.on('keydown-D', () => {
      this.currentMaskIndex = (this.currentMaskIndex + 1) % BORDER_PRIORITY_MASKS.length;
      this.updateDisplay();
    });
    this.input.keyboard.on('keydown-W', () => {
      this.currentFrameIndex = (this.currentFrameIndex - 1 + this.candidates.length) % this.candidates.length;
      this.updateDisplay();
    });
    this.input.keyboard.on('keydown-S', () => {
      this.currentFrameIndex = (this.currentFrameIndex + 1) % this.candidates.length;
      this.updateDisplay();
    });
    this.input.keyboard.on('keydown-Q', () => {
      const rots: TileRotation[] = [0, 90, 180, 270];
      const idx = rots.indexOf(this.currentRotation);
      this.currentRotation = rots[(idx - 1 + 4) % 4];
      this.updateDisplay();
    });
    this.input.keyboard.on('keydown-E', () => {
      const rots: TileRotation[] = [0, 90, 180, 270];
      const idx = rots.indexOf(this.currentRotation);
      this.currentRotation = rots[(idx + 1) % 4];
      this.updateDisplay();
    });
    this.input.keyboard.on('keydown-X', () => {
      this.currentFlipX = !this.currentFlipX;
      this.updateDisplay();
    });
    this.input.keyboard.on('keydown-Y', () => {
      this.currentFlipY = !this.currentFlipY;
      this.updateDisplay();
    });
    this.input.keyboard.on('keydown-F', () => {
      this.currentFamily = this.currentFamily === 'water' ? 'lava' : 'water';
      this.currentFrameIndex = 0;
      this.updateDisplay();
    });
    this.input.keyboard.on('keydown-R', () => {
      this.currentRotation = 0;
      this.currentFlipX = false;
      this.currentFlipY = false;
      this.currentFrameIndex = 0;
      this.updateDisplay();
    });
  }
}
