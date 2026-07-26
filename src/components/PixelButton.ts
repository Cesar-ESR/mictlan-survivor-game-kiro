import Phaser from 'phaser';
import { BUTTON_ASSETS, type ButtonState, type ButtonAssetsDefinition } from '../config/button-assets';
import { GAME_FONT_FAMILY } from '../config/font-config';

/**
 * Opciones para crear un PixelButton.
 */
export interface PixelButtonOptions {
  /** Escena de Phaser donde se añade el botón. */
  scene: Phaser.Scene;
  /** Posición X del centro del botón. */
  x: number;
  /** Posición Y del centro del botón. */
  y: number;
  /** Ancho total deseado del botón en píxeles. */
  width: number;
  /** Texto a mostrar en el botón. */
  text: string;
  /** Callback al hacer click. */
  callback: () => void;
  /** Estilo del texto (opcional). */
  textStyle?: Phaser.Types.GameObjects.Text.TextStyle;
}

/**
 * PixelButton: Componente reutilizable que construye botones modulares
 * a partir de piezas de imagen (bordes + relleno repetido).
 *
 * El botón se compone de 5 tipos de pieza:
 * [leftEdge][leftFill...][center][rightFill...][rightEdge]
 *
 * Las piezas de relleno (leftFill, rightFill) se repiten automáticamente
 * para alcanzar el ancho solicitado. Los bordes se mantienen siempre en
 * posición correcta en los extremos.
 *
 * Cambia automáticamente entre estados Normal, Hover y Pressed.
 */
export class PixelButton extends Phaser.GameObjects.Container {
  private pieces: Map<string, Phaser.GameObjects.Image[]> = new Map();
  private currentState: ButtonState = 'normal';
  private label: Phaser.GameObjects.Text;
  private buttonWidth: number;
  private buttonHeight: number = 0;
  private hitZone: Phaser.GameObjects.Zone;

  constructor(options: PixelButtonOptions) {
    super(options.scene, options.x, options.y);

    this.buttonWidth = options.width;

    // Build all three states (pieces positioned but only 'normal' visible initially)
    this.buildAllStates();

    // Create text label
    const defaultStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '18px',
      color: '#ffffffff',
      fontStyle: 'bold',
    };
    const mergedStyle = { ...defaultStyle, ...options.textStyle };
    this.label = options.scene.add.text(0, -2, options.text, mergedStyle).setOrigin(0.5);
    this.add(this.label);

    // Create interactive hit zone covering the full button area
    this.hitZone = options.scene.add.zone(0, 0, this.buttonWidth, this.buttonHeight)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.add(this.hitZone);

    // Set up input events on the hit zone
    this.hitZone.on('pointerover', () => {
      this.setButtonState('hover');
    });

    this.hitZone.on('pointerout', () => {
      this.setButtonState('normal');
    });

    this.hitZone.on('pointerdown', () => {
      this.setButtonState('pressed');
    });

    this.hitZone.on('pointerup', () => {
      this.setButtonState('hover');
      options.callback();
    });

    // Show only the normal state initially
    this.showState('normal');

    // Add this container to the scene
    options.scene.add.existing(this as Phaser.GameObjects.GameObject);
  }

  /**
   * Builds the image pieces for all three button states.
   */
  private buildAllStates(): void {
    const states: ButtonState[] = ['normal', 'hover', 'pressed'];
    for (const state of states) {
      const statePieces = this.buildState(state);
      this.pieces.set(state, statePieces);
    }
  }

  /**
   * Builds the images for a single state, positions them, and returns them.
   * All pieces start as invisible.
   */
  private buildState(state: ButtonState): Phaser.GameObjects.Image[] {
    const assets: ButtonAssetsDefinition = BUTTON_ASSETS;
    const images: Phaser.GameObjects.Image[] = [];

    // Get texture dimensions from the loaded textures
    const leftEdgeTex = this.scene.textures.get(assets.leftEdge[state].key);
    const leftFillTex = this.scene.textures.get(assets.leftFill[state].key);
    const centerTex = this.scene.textures.get(assets.center[state].key);
    const rightFillTex = this.scene.textures.get(assets.rightFill[state].key);
    const rightEdgeTex = this.scene.textures.get(assets.rightEdge[state].key);

    const leftEdgeW = leftEdgeTex.getSourceImage().width;
    const leftFillW = leftFillTex.getSourceImage().width;
    const centerW = centerTex.getSourceImage().width;
    const rightFillW = rightFillTex.getSourceImage().width;
    const rightEdgeW = rightEdgeTex.getSourceImage().width;

    // Use the tallest piece as button height
    const heights = [
      leftEdgeTex.getSourceImage().height,
      leftFillTex.getSourceImage().height,
      centerTex.getSourceImage().height,
      rightFillTex.getSourceImage().height,
      rightEdgeTex.getSourceImage().height,
    ];
    this.buttonHeight = Math.max(...heights);

    // Calculate available fill space
    const fixedWidth = leftEdgeW + centerW + rightEdgeW;
    const fillSpace = Math.max(0, this.buttonWidth - fixedWidth);
    const fillPerSide = fillSpace / 2;
    const leftFillCount = Math.max(1, Math.ceil(fillPerSide / leftFillW));
    const rightFillCount = Math.max(1, Math.ceil(fillPerSide / rightFillW));

    // Position everything from left starting at -buttonWidth/2
    let cursorX = -this.buttonWidth / 2;

    // Left edge
    const leftEdgeImg = this.scene.add.image(cursorX + leftEdgeW / 2, 0, assets.leftEdge[state].key)
      .setVisible(false);
    images.push(leftEdgeImg);
    this.add(leftEdgeImg);
    cursorX += leftEdgeW;

    // Left fill (repeated)
    for (let i = 0; i < leftFillCount; i++) {
      const img = this.scene.add.image(cursorX + leftFillW / 2, 0, assets.leftFill[state].key)
        .setVisible(false);
      images.push(img);
      this.add(img);
      cursorX += leftFillW;
    }

    // Center
    const centerImg = this.scene.add.image(cursorX + centerW / 2, 0, assets.center[state].key)
      .setVisible(false);
    images.push(centerImg);
    this.add(centerImg);
    cursorX += centerW;

    // Right fill (repeated)
    for (let i = 0; i < rightFillCount; i++) {
      const img = this.scene.add.image(cursorX + rightFillW / 2, 0, assets.rightFill[state].key)
        .setVisible(false);
      images.push(img);
      this.add(img);
      cursorX += rightFillW;
    }

    // Right edge
    const rightEdgeImg = this.scene.add.image(cursorX + rightEdgeW / 2, 0, assets.rightEdge[state].key)
      .setVisible(false);
    images.push(rightEdgeImg);
    this.add(rightEdgeImg);

    return images;
  }

  /**
   * Shows a specific state and hides the others.
   */
  private showState(state: ButtonState): void {
    for (const [s, imgs] of this.pieces.entries()) {
      const visible = s === state;
      for (const img of imgs) {
        img.setVisible(visible);
      }
    }
  }

  /**
   * Sets the button visual state (Normal, Hover, Pressed) and updates visuals.
   */
  private setButtonState(state: ButtonState): void {
    if (this.currentState === state) return;
    this.currentState = state;
    this.showState(state);
  }

  /**
   * Destroys the button and all its children.
   */
  destroy(fromScene?: boolean): void {
    this.pieces.clear();
    super.destroy(fromScene);
  }
}
