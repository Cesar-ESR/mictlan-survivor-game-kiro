import Phaser from 'phaser';
import { TILESET_METADATA, TILE_SIZE } from '../config/tile-catalog-data';
import {
  LIQUID_FAMILIES,
  WALL_FRAME_MAPPING_BY_MASK,
  OBSTACLE_FRAMES,
  CLIFF_OR_CHASM_CANDIDATES,
  DOOR_OR_OPENING_CANDIDATES,
  WATER_BORDER_CANDIDATES,
  LAVA_BORDER_CANDIDATES,
  BORDER_PRIORITY_MASKS,
} from '../map/VisualTileMappings';
import type { MappingStatus, TileRotation } from '../map/VisualTileMappings';
import { SPECTRAL_TEMPLATES } from '../map/SpectralTemplates';

/**
 * MappingsDebugScene: Herramienta de calibración visual real para mapeos.
 *
 * Secciones:
 * 1. LIQUIDS — Candidatos de centros por familia (bloques 3×3)
 * 2. BORDERS — Galería completa de frames 0–15 con rotaciones sobre distintos fondos
 * 3. WALLS  — Galería de frames 0–34, repeticiones, rotaciones + patrones por máscara
 *
 * Controles:
 * - Scroll: rueda del ratón
 * - Drag: click + mover
 * - 1: saltar a Liquids
 * - 2: saltar a Borders
 * - 3: saltar a Walls
 * - G: volver al inicio
 *
 * Activada via ?debug=mappings
 */
export class MappingsDebugScene extends Phaser.Scene {
  private static readonly SECTION_GAP = 80;
  private static readonly MAX_WIDTH = 1600;

  private dragStartY = 0;
  private cameraStartY = 0;
  private isDragging = false;
  private totalHeight = 0;

  /** Y positions for section navigation */
  private sectionPositions = { liquids: 0, borders: 0, walls: 0, borderCalibration: 0 };

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
    currentY = this.renderHeader(currentY);

    // Section 1: Liquids
    this.sectionPositions.liquids = currentY;
    currentY = this.renderLiquidsCalibration(currentY);
    currentY += MappingsDebugScene.SECTION_GAP;

    // Section 2: Borders
    this.sectionPositions.borders = currentY;
    currentY = this.renderBordersGallery(currentY);
    currentY += MappingsDebugScene.SECTION_GAP;

    // Section 3: Walls
    this.sectionPositions.walls = currentY;
    currentY = this.renderWallsGallery(currentY);
    currentY += MappingsDebugScene.SECTION_GAP;

    // Section 3b: Wall mask patterns
    currentY = this.renderWallMaskPatterns(currentY);
    currentY += MappingsDebugScene.SECTION_GAP;

    // Section 3c: Special frames (obstacles, cliffs, doors)
    currentY = this.renderSpecialFramesSection(currentY);
    currentY += MappingsDebugScene.SECTION_GAP;

    // Section 4: Spectral templates
    currentY = this.renderSpectralTemplates(currentY);
    currentY += MappingsDebugScene.SECTION_GAP;

    // Section 5: Border calibration summary
    this.sectionPositions.borderCalibration = currentY;
    currentY = this.renderBorderCalibrationSummary(currentY);
    currentY += MappingsDebugScene.SECTION_GAP;

    // Set total height and configure scrolling
    this.totalHeight = currentY + 200;
    this.cameras.main.setBounds(0, 0, MappingsDebugScene.MAX_WIDTH, this.totalHeight);
    this.setupInput();
  }

  // ═══════════════════════════════════════════════════════════════
  // HEADER
  // ═══════════════════════════════════════════════════════════════

  private renderHeader(startY: number): number {
    let y = startY;
    this.add.text(10, y, 'MAPPINGS CALIBRATION — Visual Verification Tool', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    y += 32;

    this.add.text(10, y, [
      'Controls: Scroll=wheel | Drag=click+move | 1=Liquids | 2=Borders | 3=Walls | 6=BorderCal | G=Top',
      'Each candidate must be visually inspected. Nothing is auto-confirmed.',
    ].join('\n'), {
      fontSize: '11px',
      color: '#aaaaaa',
    });
    y += 40;
    return y;
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1: LIQUIDS CALIBRATION
  // ═══════════════════════════════════════════════════════════════

  private renderLiquidsCalibration(startY: number): number {
    let y = startY;
    this.add.text(10, y, '§1 LIQUIDS — Center Frame Candidates (3×3 blocks)', {
      fontSize: '16px',
      color: '#00ccff',
      fontStyle: 'bold',
    });
    y += 24;
    this.add.text(10, y, 'Look for seamless tiles with NO visible grid/seams between cells.', {
      fontSize: '10px',
      color: '#88aacc',
    });
    y += 20;

    // Water candidates
    y = this.renderLiquidFamilyCandidates(y, 'water', [0, 3, 8, 16], 0);

    // Lava candidates
    y = this.renderLiquidFamilyCandidates(y, 'lava', [20, 21, 22, 23], 20);

    // Spectral candidates
    y = this.renderLiquidFamilyCandidates(
      y, 'spectral',
      [32, 33, 34, 35, 36, 37, 38, 39, 40, 41],
      -1, // no confirmed candidate
    );

    return y;
  }

  private renderLiquidFamilyCandidates(
    startY: number,
    family: string,
    candidates: number[],
    currentCenter: number,
  ): number {
    let y = startY;
    const familyConfig = LIQUID_FAMILIES.find(f => f.family === family);
    const weightLabel = familyConfig ? `weight=${familyConfig.weight}` : '';
    const familyCenterStatus = familyConfig?.centerStatus ?? 'missing';

    this.add.text(10, y, `${family.toUpperCase()} — ${weightLabel} — currentCenter=${currentCenter >= 0 ? currentCenter : 'NONE'} — ${familyCenterStatus.toUpperCase()}`, {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    y += 18;

    const blockSize = 3 * (TILE_SIZE + 2);
    const blockSpacing = blockSize + 80;
    const maxCols = Math.floor((MappingsDebugScene.MAX_WIDTH - 20) / blockSpacing);

    for (let i = 0; i < candidates.length; i++) {
      const frame = candidates[i];
      const col = i % maxCols;
      const row = Math.floor(i / maxCols);
      const x = 20 + col * blockSpacing;
      const blockY = y + row * (blockSize + 50);

      // Determine status for this specific frame
      let status: MappingStatus = 'missing';
      if (frame === currentCenter) status = familyCenterStatus;

      const statusColor = status === 'confirmed' ? '#00ff00'
        : status === 'provisional' ? '#ffcc00'
        : '#666666';
      const statusLabel = status === 'confirmed' ? 'CONFIRMED'
        : status === 'provisional' ? 'PROVISIONAL'
        : 'CANDIDATE';

      // Label above block
      this.add.text(x, blockY, `frame ${frame} — ${statusLabel}`, {
        fontSize: '10px',
        color: statusColor,
      });
      this.add.text(x, blockY + 12, 'center candidate', {
        fontSize: '9px',
        color: '#555555',
      });

      // 3×3 block
      const tileY = blockY + 24;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const tx = x + c * (TILE_SIZE + 2);
          const ty = tileY + r * (TILE_SIZE + 2);
          // Dark background
          this.add.rectangle(tx + TILE_SIZE / 2, ty + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, 0x0a0a0a);
          // Tile
          this.add.image(tx + TILE_SIZE / 2, ty + TILE_SIZE / 2, 'tileset_liquids', frame);
          // Border
          const border = this.add.rectangle(tx + TILE_SIZE / 2, ty + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
          border.setStrokeStyle(1, status === 'confirmed' ? 0x00ff00 : status === 'provisional' ? 0xffcc00 : 0x333333);
        }
      }
    }

    const totalRows = Math.ceil(candidates.length / maxCols);
    y += totalRows * (blockSize + 50) + 20;
    return y;
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 2: BORDERS GALLERY
  // ═══════════════════════════════════════════════════════════════

  private renderBordersGallery(startY: number): number {
    let y = startY;
    this.add.text(10, y, '§2 BORDERS — Frame Gallery (0–15) × 4 rotations × 4 backgrounds', {
      fontSize: '16px',
      color: '#ffcc00',
      fontStyle: 'bold',
    });
    y += 24;
    this.add.text(10, y, [
      'Each frame shown at 0°/90°/180°/270° on: Ground, Water(f0), Lava(f20), Spectral(f32).',
      'Checkerboard = transparency. Identify: edge N/E/S/W, corner, transition type, unusable.',
    ].join('\n'), {
      fontSize: '10px',
      color: '#aaaa66',
    });
    y += 28;

    const rotations: TileRotation[] = [0, 90, 180, 270];
    const backgrounds: Array<{ label: string; tileset: string; frame: number } | { label: string; checker: true }> = [
      { label: 'Ground', tileset: 'tileset_ground', frame: 0 },
      { label: 'Water', tileset: 'tileset_liquids', frame: 0 },
      { label: 'Lava', tileset: 'tileset_liquids', frame: 20 },
      { label: 'Check', checker: true },
    ];

    const cellW = TILE_SIZE + 4;
    const rotGroupW = rotations.length * cellW + 8;

    // Column headers
    for (let bgIdx = 0; bgIdx < backgrounds.length; bgIdx++) {
      const bg = backgrounds[bgIdx];
      const xBase = 60 + bgIdx * rotGroupW;
      this.add.text(xBase, y, bg.label, { fontSize: '9px', color: '#888888' });
    }
    y += 14;

    // Each frame row
    for (let frameIdx = 0; frameIdx < 16; frameIdx++) {
      const rowY = y + frameIdx * (cellW + 18);

      // Frame label
      this.add.text(10, rowY + 8, `f${frameIdx}`, {
        fontSize: '10px',
        color: '#ffffff',
      });

      for (let bgIdx = 0; bgIdx < backgrounds.length; bgIdx++) {
        const bg = backgrounds[bgIdx];
        for (let rotIdx = 0; rotIdx < rotations.length; rotIdx++) {
          const rot = rotations[rotIdx];
          const tx = 60 + bgIdx * rotGroupW + rotIdx * cellW;
          const ty = rowY;
          const cx = tx + TILE_SIZE / 2;
          const cy = ty + TILE_SIZE / 2;

          // Background
          if ('checker' in bg) {
            this.renderCheckerboard(tx, ty, TILE_SIZE);
          } else {
            this.add.image(cx, cy, bg.tileset, bg.frame);
          }

          // Border frame with rotation
          const img = this.add.image(cx, cy, 'tileset_borders', frameIdx);
          img.setAngle(rot);

          // Outline
          const outline = this.add.rectangle(cx, cy, TILE_SIZE, TILE_SIZE);
          outline.setStrokeStyle(1, 0x444444);
        }
      }

      // Rotation labels on first frame row only
      if (frameIdx === 0) {
        for (let rotIdx = 0; rotIdx < rotations.length; rotIdx++) {
          const tx = 60 + rotIdx * cellW;
          this.add.text(tx, y - 12, `${rotations[rotIdx]}°`, {
            fontSize: '8px',
            color: '#666666',
          });
        }
      }
    }

    y += 16 * (cellW + 18) + 20;
    return y;
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 3: WALLS GALLERY
  // ═══════════════════════════════════════════════════════════════

  private renderWallsGallery(startY: number): number {
    let y = startY;
    this.add.text(10, y, '§3 WALLS — Frame Gallery (0–34) + rotations + repetitions', {
      fontSize: '16px',
      color: '#ff6644',
      fontStyle: 'bold',
    });
    y += 24;
    this.add.text(10, y, [
      'Frames 35–47 are EMPTY (not shown). Each valid frame shown at 4 rotations,',
      'with 3×1 horizontal and 1×3 vertical repetitions. Checkerboard = transparency.',
    ].join('\n'), {
      fontSize: '10px',
      color: '#aa6644',
    });
    y += 28;

    const rotations: TileRotation[] = [0, 90, 180, 270];
    const validFrames = Array.from({ length: 35 }, (_, i) => i); // 0–34

    for (let fi = 0; fi < validFrames.length; fi++) {
      const frame = validFrames[fi];
      const rowY = y;

      // Frame label
      this.add.text(10, rowY + 6, `f${frame}`, {
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: 'bold',
      });

      let xCursor = 50;

      // Single frame at 4 rotations
      for (const rot of rotations) {
        const cx = xCursor + TILE_SIZE / 2;
        const cy = rowY + TILE_SIZE / 2;
        this.renderCheckerboard(xCursor, rowY, TILE_SIZE);
        const img = this.add.image(cx, cy, 'tileset_walls', frame);
        img.setAngle(rot);
        const outline = this.add.rectangle(cx, cy, TILE_SIZE, TILE_SIZE);
        outline.setStrokeStyle(1, 0x444444);
        xCursor += TILE_SIZE + 4;
      }

      xCursor += 12;

      // 3×1 horizontal repetition
      this.add.text(xCursor, rowY - 8, '3×1', { fontSize: '8px', color: '#666666' });
      for (let c = 0; c < 3; c++) {
        const cx = xCursor + TILE_SIZE / 2;
        const cy = rowY + TILE_SIZE / 2;
        this.renderCheckerboard(xCursor, rowY, TILE_SIZE);
        this.add.image(cx, cy, 'tileset_walls', frame);
        const outline = this.add.rectangle(cx, cy, TILE_SIZE, TILE_SIZE);
        outline.setStrokeStyle(1, 0x333333);
        xCursor += TILE_SIZE + 1;
      }

      xCursor += 12;

      // 1×3 vertical repetition
      this.add.text(xCursor, rowY - 8, '1×3', { fontSize: '8px', color: '#666666' });
      for (let r = 0; r < 3; r++) {
        const cx = xCursor + TILE_SIZE / 2;
        const cy = rowY + r * (TILE_SIZE + 1) + TILE_SIZE / 2;
        this.renderCheckerboard(xCursor, rowY + r * (TILE_SIZE + 1), TILE_SIZE);
        this.add.image(cx, cy, 'tileset_walls', frame);
        const outline = this.add.rectangle(cx, cy, TILE_SIZE, TILE_SIZE);
        outline.setStrokeStyle(1, 0x333333);
      }

      // Row height accommodates vertical repetition
      y += Math.max(TILE_SIZE + 12, 3 * (TILE_SIZE + 1) + 12);
    }

    return y;
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 3b: WALL MASK PATTERNS
  // ═══════════════════════════════════════════════════════════════

  private renderWallMaskPatterns(startY: number): number {
    let y = startY;
    this.add.text(10, y, '§3b WALLS — Mask Patterns (0–15) with assigned frames', {
      fontSize: '16px',
      color: '#ff8844',
      fontStyle: 'bold',
    });
    y += 24;
    this.add.text(10, y, [
      'Each mask shows: neighbor diagram, assigned frame, rotation, flip, status.',
      'FALLBACK — NOT CALIBRATED means frame 0 is used by default.',
    ].join('\n'), {
      fontSize: '10px',
      color: '#aa7744',
    });
    y += 28;

    const cellW = 120;
    const cellH = 100;
    const cols = 4;

    for (let mask = 0; mask < 16; mask++) {
      const col = mask % cols;
      const row = Math.floor(mask / cols);
      const x = 20 + col * cellW;
      const maskY = y + row * cellH;

      const placement = WALL_FRAME_MAPPING_BY_MASK[mask];
      const frame = placement?.frame ?? 0;
      const rotation = placement?.rotation ?? 0;
      const flipX = placement?.flipX ?? false;
      const flipY = placement?.flipY ?? false;
      const status = placement?.status ?? 'missing';

      // Background
      this.add.rectangle(x + cellW / 2, maskY + cellH / 2, cellW - 4, cellH - 4, 0x1a1a1a);

      // Neighbor diagram (5×5 mini grid showing neighbors)
      this.renderNeighborDiagram(x + 8, maskY + 8, mask);

      // Frame preview
      const previewX = x + 60;
      const previewY = maskY + 20;
      this.renderCheckerboard(previewX, previewY, TILE_SIZE);
      const img = this.add.image(
        previewX + TILE_SIZE / 2,
        previewY + TILE_SIZE / 2,
        'tileset_walls',
        frame,
      );
      img.setAngle(rotation);
      if (flipX) img.setFlipX(true);
      if (flipY) img.setFlipY(true);

      // Status label
      const statusColor = status === 'confirmed' ? '#00ff00'
        : status === 'provisional' ? '#ffcc00'
        : '#ff4444';
      const statusText = status === 'provisional' ? 'FALLBACK — NOT CALIBRATED' : status.toUpperCase();

      this.add.text(x + 4, maskY + 58, `mask ${mask}  f${frame}  r${rotation}°`, {
        fontSize: '9px',
        color: '#cccccc',
      });
      this.add.text(x + 4, maskY + 70, `flip: x=${flipX} y=${flipY}`, {
        fontSize: '8px',
        color: '#999999',
      });
      this.add.text(x + 4, maskY + 82, statusText, {
        fontSize: '8px',
        color: statusColor,
        fontStyle: 'bold',
      });
    }

    y += Math.ceil(16 / cols) * cellH + 10;
    return y;
  }

  /**
   * Renders a 3×3 mini diagram showing which cardinal neighbors are present.
   * Center = cell, N/E/S/W highlighted based on mask bits.
   */
  private renderNeighborDiagram(x: number, y: number, mask: number): void {
    const s = 10; // mini cell size
    const gap = 1;
    // Grid positions: [row][col] — center is (1,1)
    const positions: Array<{ r: number; c: number; label: string; bit: number }> = [
      { r: 0, c: 1, label: 'N', bit: 1 },
      { r: 1, c: 2, label: 'E', bit: 2 },
      { r: 2, c: 1, label: 'S', bit: 4 },
      { r: 1, c: 0, label: 'W', bit: 8 },
    ];

    // Center cell
    const cx = x + 1 * (s + gap) + s / 2;
    const cy = y + 1 * (s + gap) + s / 2;
    this.add.rectangle(cx, cy, s, s, 0x4444ff);

    // Neighbor cells
    for (const pos of positions) {
      const px = x + pos.c * (s + gap) + s / 2;
      const py = y + pos.r * (s + gap) + s / 2;
      const active = (mask & pos.bit) !== 0;
      const color = active ? 0x00cc00 : 0x333333;
      this.add.rectangle(px, py, s, s, color);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 3c: SPECIAL FRAMES (Obstacles, Cliffs, Doors)
  // ═══════════════════════════════════════════════════════════════

  private renderSpecialFramesSection(startY: number): number {
    let y = startY;
    this.add.text(10, y, '§3c WALLS — Special Frames (Obstacles, Cliffs, Doors)', {
      fontSize: '16px',
      color: '#cc88ff',
      fontStyle: 'bold',
    });
    y += 24;

    const cellW = TILE_SIZE + 4;
    let xCursor: number;

    // Obstacle frames
    this.add.text(10, y, 'OBSTACLE (provisional)', {
      fontSize: '12px',
      color: '#ffcc00',
      fontStyle: 'bold',
    });
    y += 18;
    xCursor = 20;
    for (const frame of OBSTACLE_FRAMES) {
      const cx = xCursor + TILE_SIZE / 2;
      const cy = y + TILE_SIZE / 2;
      this.renderCheckerboard(xCursor, y, TILE_SIZE);
      this.add.image(cx, cy, 'tileset_walls', frame);
      this.add.text(xCursor, y + TILE_SIZE + 2, `f${frame}`, {
        fontSize: '9px',
        color: '#cccccc',
      });
      xCursor += cellW + 20;
    }
    y += TILE_SIZE + 20;

    // Cliff/chasm frames
    this.add.text(10, y, 'DEFERRED CLIFF/CHASM', {
      fontSize: '12px',
      color: '#ff4444',
      fontStyle: 'bold',
    });
    y += 18;
    xCursor = 20;
    for (const frame of CLIFF_OR_CHASM_CANDIDATES) {
      const cx = xCursor + TILE_SIZE / 2;
      const cy = y + TILE_SIZE / 2;
      this.renderCheckerboard(xCursor, y, TILE_SIZE);
      this.add.image(cx, cy, 'tileset_walls', frame);
      this.add.text(xCursor, y + TILE_SIZE + 2, `f${frame}`, {
        fontSize: '9px',
        color: '#cccccc',
      });
      xCursor += cellW + 20;
    }
    y += TILE_SIZE + 20;

    // Door/opening frames
    this.add.text(10, y, 'DOOR/OPENING CANDIDATE', {
      fontSize: '12px',
      color: '#00ccff',
      fontStyle: 'bold',
    });
    y += 18;
    xCursor = 20;
    for (const frame of DOOR_OR_OPENING_CANDIDATES) {
      const cx = xCursor + TILE_SIZE / 2;
      const cy = y + TILE_SIZE / 2;
      this.renderCheckerboard(xCursor, y, TILE_SIZE);
      this.add.image(cx, cy, 'tileset_walls', frame);
      this.add.text(xCursor, y + TILE_SIZE + 2, `f${frame}`, {
        fontSize: '9px',
        color: '#cccccc',
      });
      xCursor += cellW + 20;
    }
    y += TILE_SIZE + 20;

    return y;
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 4: SPECTRAL TEMPLATES
  // ═══════════════════════════════════════════════════════════════

  private renderSpectralTemplates(startY: number): number {
    let y = startY;
    this.add.text(10, y, '§4 SPECTRAL — Template Candidates (frames 32–41)', {
      fontSize: '16px',
      color: '#aa44ff',
      fontStyle: 'bold',
    });
    y += 24;
    this.add.text(10, y, 'Each template shown at actual size. Status must be CONFIRMED before generation.', {
      fontSize: '10px',
      color: '#8844aa',
    });
    y += 20;

    for (const template of SPECTRAL_TEMPLATES) {
      const statusColor = template.status === 'confirmed' ? '#00ff00' : '#ffcc00';
      this.add.text(10, y, `${template.id} — ${template.description} — ${template.status.toUpperCase()}`, {
        fontSize: '11px',
        color: statusColor,
      });
      y += 16;

      // Render the template
      const originX = 20;
      for (const cell of template.cells) {
        const tx = originX + cell.x * (TILE_SIZE + 2);
        const ty = y + cell.y * (TILE_SIZE + 2);
        const cx = tx + TILE_SIZE / 2;
        const cy = ty + TILE_SIZE / 2;

        this.add.rectangle(cx, cy, TILE_SIZE, TILE_SIZE, 0x0a0a0a);
        const img = this.add.image(cx, cy, 'tileset_liquids', cell.frame);
        img.setAngle(cell.rotation);
        if (cell.flipX) img.setFlipX(true);
        if (cell.flipY) img.setFlipY(true);
        const border = this.add.rectangle(cx, cy, TILE_SIZE, TILE_SIZE);
        border.setStrokeStyle(1, template.status === 'confirmed' ? 0x00ff00 : 0xaa44ff);
      }

      y += template.height * (TILE_SIZE + 2) + 16;
    }

    return y;
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 5: BORDER CALIBRATION SUMMARY
  // ═══════════════════════════════════════════════════════════════

  private renderBorderCalibrationSummary(startY: number): number {
    let y = startY;
    this.add.text(10, y, '§5 BORDER CALIBRATION — Candidate Summary per Family', {
      fontSize: '16px',
      color: '#44ffaa',
      fontStyle: 'bold',
    });
    y += 24;
    this.add.text(10, y, 'Use ?debug=borders for interactive selector. This is a static reference grid.', {
      fontSize: '10px',
      color: '#44aa88',
    });
    y += 20;

    const rotations: TileRotation[] = [0, 90, 180, 270];
    const cellW = TILE_SIZE + 4;

    // Water section
    this.add.text(10, y, 'WATER — frames 9–12 on Water(f0) background', {
      fontSize: '13px', color: '#00ccff', fontStyle: 'bold',
    });
    y += 18;

    for (const mask of BORDER_PRIORITY_MASKS) {
      this.add.text(10, y, `mask ${mask}`, { fontSize: '10px', color: '#ffffff' });
      let xCursor = 60;
      for (const frame of WATER_BORDER_CANDIDATES) {
        for (const rot of rotations) {
          const cx = xCursor + TILE_SIZE / 2;
          const cy = y + TILE_SIZE / 2;
          this.add.image(cx, cy, 'tileset_liquids', 0);
          const img = this.add.image(cx, cy, 'tileset_borders', frame);
          img.setAngle(rot);
          const outline = this.add.rectangle(cx, cy, TILE_SIZE, TILE_SIZE);
          outline.setStrokeStyle(1, 0x333333);
          xCursor += cellW;
        }
        xCursor += 6;
      }
      y += TILE_SIZE + 6;
    }
    y += 20;

    // Lava section
    this.add.text(10, y, 'LAVA — frames 5–8, 13–15 on Lava(f20) background', {
      fontSize: '13px', color: '#ff6644', fontStyle: 'bold',
    });
    y += 18;

    for (const mask of BORDER_PRIORITY_MASKS) {
      this.add.text(10, y, `mask ${mask}`, { fontSize: '10px', color: '#ffffff' });
      let xCursor = 60;
      for (const frame of LAVA_BORDER_CANDIDATES) {
        for (const rot of rotations) {
          const cx = xCursor + TILE_SIZE / 2;
          const cy = y + TILE_SIZE / 2;
          this.add.image(cx, cy, 'tileset_liquids', 20);
          const img = this.add.image(cx, cy, 'tileset_borders', frame);
          img.setAngle(rot);
          const outline = this.add.rectangle(cx, cy, TILE_SIZE, TILE_SIZE);
          outline.setStrokeStyle(1, 0x333333);
          xCursor += cellW;
        }
        xCursor += 6;
      }
      y += TILE_SIZE + 6;
    }
    y += 10;

    return y;
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════

  /**
   * Renders a checkerboard pattern at position to distinguish transparency.
   */
  private renderCheckerboard(x: number, y: number, size: number): void {
    const cellSize = 8;
    const cols = Math.ceil(size / cellSize);
    const rows = Math.ceil(size / cellSize);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isDark = (r + c) % 2 === 0;
        const color = isDark ? 0x222222 : 0x3a3a3a;
        const cx = x + c * cellSize + cellSize / 2;
        const cy = y + r * cellSize + cellSize / 2;
        // Only draw within bounds
        if (cx - cellSize / 2 < x + size && cy - cellSize / 2 < y + size) {
          this.add.rectangle(cx, cy, cellSize, cellSize, color);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // INPUT / NAVIGATION
  // ═══════════════════════════════════════════════════════════════

  private setupInput(): void {
    const maxScroll = Math.max(0, this.totalHeight - 768);

    // Scroll
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _deltaX: number, deltaY: number) => {
      this.cameras.main.scrollY = Phaser.Math.Clamp(
        this.cameras.main.scrollY + deltaY * 0.6,
        0,
        maxScroll,
      );
    });

    // Drag
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
          maxScroll,
        );
      }
    });
    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    // Keyboard navigation
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-ONE', () => {
        this.cameras.main.scrollY = Phaser.Math.Clamp(this.sectionPositions.liquids, 0, maxScroll);
      });
      this.input.keyboard.on('keydown-TWO', () => {
        this.cameras.main.scrollY = Phaser.Math.Clamp(this.sectionPositions.borders, 0, maxScroll);
      });
      this.input.keyboard.on('keydown-THREE', () => {
        this.cameras.main.scrollY = Phaser.Math.Clamp(this.sectionPositions.walls, 0, maxScroll);
      });
      this.input.keyboard.on('keydown-SIX', () => {
        this.cameras.main.scrollY = Phaser.Math.Clamp(this.sectionPositions.borderCalibration, 0, maxScroll);
      });
      this.input.keyboard.on('keydown-G', () => {
        this.cameras.main.scrollY = 0;
      });
    }
  }
}
