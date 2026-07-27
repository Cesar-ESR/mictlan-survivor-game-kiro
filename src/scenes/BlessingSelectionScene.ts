/**
 * BlessingSelectionScene: Pantalla de selección de bendición inicial.
 *
 * Aparece después de la cinemática y antes del gameplay.
 * Muestra dos tarjetas (una por gobernante) con toda la información
 * obtenida exclusivamente desde BendicionesText.json.
 *
 * El gameplay no inicia hasta que el jugador seleccione una bendición.
 */

import Phaser from 'phaser';
import { GAME_FONT_FAMILY } from '../config/font-config';
import { BlessingManager } from '../managers/BlessingManager';
import type { BlessingSelection } from '../managers/BlessingManager';

/** Datos recibidos al iniciar esta escena. */
interface BlessingSelectionSceneData {
  /** Datos opcionales para pasar a GameScene. */
  gameSceneData?: Record<string, unknown>;
}

/** Estructura de una opción del JSON de bendiciones. */
interface BlessingChoice {
  id: string;
  ruler: {
    id: string;
    name: string;
    portrait: string;
  };
  primaryBlessing: {
    id: string;
    name: string;
    badge: string;
    image: string;
    level: number;
    maxLevel: number;
    description: string;
    style: string;
    effects: string[];
  };
  secondaryBlessing: {
    id: string;
    name: string;
    badge: string;
    image: string;
    level: number;
    maxLevel: number;
    trigger: string;
    effects: string[];
  };
}

interface BlessingData {
  id: string;
  title: string;
  subtitle: string;
  choices: BlessingChoice[];
}

export class BlessingSelectionScene extends Phaser.Scene {
  private sceneData: BlessingSelectionSceneData = {};
  private hasSelected = false;

  constructor() {
    super({ key: 'BlessingSelectionScene' });
  }

  init(data: BlessingSelectionSceneData): void {
    this.sceneData = data || {};
  }

  create(): void {
    this.hasSelected = false;

    const { width, height } = this.cameras.main;
    const centerX = width / 2;

    // ─── Background ─────────────────────────────────────────────────────────
    const bg = this.add.image(centerX, height / 2, 'menuBackGround');
    const bgScale = Math.max(width / bg.width, height / bg.height);
    bg.setScale(bgScale).setDepth(0);

    // Overlay oscuro para legibilidad
    this.add.rectangle(centerX, height / 2, width, height, 0x000000, 0.6).setDepth(1);

    // ─── Cargar datos del JSON ──────────────────────────────────────────────
    const blessingData = this.cache.json.get('blessings_data') as BlessingData;
    if (!blessingData) {
      console.error('[BlessingSelectionScene] JSON "blessings_data" no encontrado en cache.');
      this.startGameplay();
      return;
    }

    // ─── Títulos ────────────────────────────────────────────────────────────
    this.add.text(centerX, 30, blessingData.title, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '22px',
      color: '#ffdd00',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(10);

    this.add.text(centerX, 58, blessingData.subtitle, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '14px',
      color: '#eed8adff',
      align: 'center',
    }).setOrigin(0.5).setDepth(10);

    // ─── Tarjetas ───────────────────────────────────────────────────────────
    const cardWidth = 460;
    const cardSpacing = 30;
    const totalWidth = cardWidth * 2 + cardSpacing;
    const startX = (width - totalWidth) / 2 + cardWidth / 2;

    blessingData.choices.forEach((choice, index) => {
      const cardX = startX + index * (cardWidth + cardSpacing);
      this.createBlessingCard(cardX, 80, cardWidth, height - 100, choice);
    });

    // ─── Fade in ────────────────────────────────────────────────────────────
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  private createBlessingCard(
    x: number,
    y: number,
    cardWidth: number,
    cardHeight: number,
    choice: BlessingChoice,
  ): void {
    const depth = 10;
    const padding = 16;
    const innerWidth = cardWidth - padding * 2;

    // Contenedor de fondo de la tarjeta
    const cardBg = this.add.rectangle(x, y + cardHeight / 2, cardWidth, cardHeight, 0x1a1a2e, 0.85);
    cardBg.setStrokeStyle(2, 0x8b6914);
    cardBg.setDepth(depth);

    let currentY = y + padding;

    // ─── Splash Art del gobernante ──────────────────────────────────────────
    const portrait = this.add.image(x, currentY + 70, choice.ruler.portrait);
    const portraitMaxW = innerWidth * 0.6;
    const portraitMaxH = 140;
    const portraitScale = Math.min(portraitMaxW / portrait.width, portraitMaxH / portrait.height);
    portrait.setScale(portraitScale).setDepth(depth + 1);
    currentY += 140 + 8;

    // Nombre del gobernante
    this.add.text(x, currentY, choice.ruler.name, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '14px',
      color: '#c0a050',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(depth + 1);
    currentY += 22;

    // ─── Imagen principal de la bendición ───────────────────────────────────
    const primaryImg = this.add.image(x, currentY + 30, choice.primaryBlessing.image);
    const pImgMaxW = 60;
    const pImgMaxH = 60;
    const pImgScale = Math.min(pImgMaxW / primaryImg.width, pImgMaxH / primaryImg.height);
    primaryImg.setScale(pImgScale).setDepth(depth + 1);
    currentY += 60 + 10;

    // Nombre de la bendición principal
    this.add.text(x, currentY, choice.primaryBlessing.name, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '16px',
      color: '#ffdd00',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(depth + 1);
    currentY += 22;

    // Descripción
    this.add.text(x, currentY, choice.primaryBlessing.description, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '11px',
      color: '#dddddd',
      wordWrap: { width: innerWidth },
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(depth + 1);
    currentY += 36;

    // Estilo
    this.add.text(x, currentY, choice.primaryBlessing.style, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '11px',
      color: '#aabbff',
      fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(depth + 1);
    currentY += 20;

    // Efectos iniciales
    this.add.text(x, currentY, 'Efectos:', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '11px',
      color: '#88cc88',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(depth + 1);
    currentY += 16;

    for (const effect of choice.primaryBlessing.effects) {
      this.add.text(x, currentY, `• ${effect}`, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '10px',
        color: '#ccffcc',
        wordWrap: { width: innerWidth },
        align: 'center',
      }).setOrigin(0.5, 0).setDepth(depth + 1);
      currentY += 18;
    }

    currentY += 10;

    // ─── Separador ──────────────────────────────────────────────────────────
    this.add.rectangle(x, currentY, innerWidth * 0.8, 1, 0x8b6914, 0.6).setDepth(depth + 1);
    currentY += 12;

    // ─── Bendición secundaria ───────────────────────────────────────────────
    const secImg = this.add.image(x - 110, currentY + 15, choice.secondaryBlessing.image);
    const sImgScale = Math.min(30 / secImg.width, 30 / secImg.height);
    secImg.setScale(sImgScale).setDepth(depth + 1);

    this.add.text(x - 90, currentY + 8, choice.secondaryBlessing.name, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '12px',
      color: '#ffcc66',
      fontStyle: 'bold',
    }).setOrigin(0, 0).setDepth(depth + 1);
    currentY += 34;

    // Condición de activación
    this.add.text(x, currentY, choice.secondaryBlessing.trigger, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '10px',
      color: '#aaaaaa',
      wordWrap: { width: innerWidth },
      align: 'center',
      fontStyle: 'italic',
    }).setOrigin(0.5, 0).setDepth(depth + 1);
    currentY += 24;

    // Efectos secundarios
    for (const effect of choice.secondaryBlessing.effects) {
      this.add.text(x, currentY, `• ${effect}`, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '10px',
        color: '#ffffaa',
        wordWrap: { width: innerWidth },
        align: 'center',
      }).setOrigin(0.5, 0).setDepth(depth + 1);
      currentY += 16;
    }

    currentY += 14;

    // ─── Botón "Elegir" ─────────────────────────────────────────────────────
    const btnY = y + cardHeight - 40;
    const btnBg = this.add.rectangle(x, btnY, 140, 36, 0x4a2800, 1);
    btnBg.setStrokeStyle(2, 0xffdd00);
    btnBg.setDepth(depth + 2);
    btnBg.setInteractive({ useHandCursor: true });

    const btnText = this.add.text(x, btnY, 'Elegir', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '16px',
      color: '#ffdd00',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(depth + 3);

    // Hover effects
    btnBg.on('pointerover', () => {
      btnBg.setFillStyle(0x6a3800);
      btnText.setColor('#ffffff');
      cardBg.setStrokeStyle(3, 0xffdd00);
    });
    btnBg.on('pointerout', () => {
      btnBg.setFillStyle(0x4a2800);
      btnText.setColor('#ffdd00');
      cardBg.setStrokeStyle(2, 0x8b6914);
    });
    btnBg.on('pointerdown', () => {
      if (this.hasSelected) return;
      this.hasSelected = true;
      this.onBlessingSelected(choice);
    });
  }

  private onBlessingSelected(choice: BlessingChoice): void {
    // Registrar selección en BlessingManager
    const selection: BlessingSelection = {
      choiceId: choice.id,
      primary: {
        id: choice.primaryBlessing.id,
        name: choice.primaryBlessing.name,
        badge: choice.primaryBlessing.badge,
        level: choice.primaryBlessing.level,
        maxLevel: choice.primaryBlessing.maxLevel,
      },
      secondary: {
        id: choice.secondaryBlessing.id,
        name: choice.secondaryBlessing.name,
        badge: choice.secondaryBlessing.badge,
        level: choice.secondaryBlessing.level,
        maxLevel: choice.secondaryBlessing.maxLevel,
      },
    };

    BlessingManager.getInstance().setSelection(selection);

    // Fade out y transición al gameplay
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.startGameplay();
    });
  }

  private startGameplay(): void {
    this.scene.start('GameScene', this.sceneData.gameSceneData || {});
  }
}
