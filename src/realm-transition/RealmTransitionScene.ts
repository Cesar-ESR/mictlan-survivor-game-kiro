/**
 * RealmTransitionScene: Escena Phaser dedicada a mostrar transiciones narrativas
 * entre reinos del Mictlán durante el gameplay.
 *
 * Flujo de estados: 'dialog' → 'culture' → 'complete'
 *
 * - Estado 'dialog': CinematicPlayer reproduce diálogos con typewriter.
 * - Estado 'culture': Muestra ficha cultural (título + descripción) con botón "Continuar".
 * - Estado 'complete': Emite 'realm-transition-complete' a GameScene y se detiene.
 *
 * El jugador puede saltar en cualquier momento con el botón "Saltar".
 */

import Phaser from 'phaser';
import type { RealmTransitionSceneData } from './realm-transition-types';
import type { RealmTransition } from './realm-transition-types';
import { transformTransitionToCinematicData } from './realm-transition-transformer';
import { CinematicPlayer } from '../cinematic/CinematicPlayer';
import { GAME_FONT_FAMILY } from '../config/font-config';

type RealmTransitionState = 'dialog' | 'culture' | 'complete';

export class RealmTransitionScene extends Phaser.Scene {
  private state: RealmTransitionState = 'dialog';
  private transition: RealmTransition | null = null;
  private cinematicPlayer: CinematicPlayer | null = null;
  private hasCompleted = false;

  // Visual elements
  private culturePanel: Phaser.GameObjects.Container | null = null;
  private dialogBox: Phaser.GameObjects.Rectangle | null = null;
  private nameText: Phaser.GameObjects.Text | null = null;
  private dialogText: Phaser.GameObjects.Text | null = null;
  private realmTitleText: Phaser.GameObjects.Text | null = null;
  private realmNameText: Phaser.GameObjects.Text | null = null;
  private continueIndicator: Phaser.GameObjects.Text | null = null;
  private skipButton: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: 'RealmTransitionScene' });
  }

  init(data: RealmTransitionSceneData): void {
    this.transition = data?.transition ?? null;
    this.state = 'dialog';
    this.hasCompleted = false;
  }

  create(): void {
    try {
      if (!this.transition) {
        this.emitComplete();
        return;
      }

      const { width, height } = this.cameras.main;
      const centerX = width / 2;
      const centerY = height / 2;

      // ─── Layer 1: Background (depth 0) ──────────────────────────────────────
      const bgKey = this.transition.realm.background;
      let background: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

      if (this.textures.exists(bgKey)) {
        background = this.add.image(centerX, centerY, bgKey);
        const bgScaleX = width / background.width;
        const bgScaleY = height / background.height;
        (background as Phaser.GameObjects.Image).setScale(Math.max(bgScaleX, bgScaleY));
      } else {
        // Fallback: dark rectangle when texture is missing
        background = this.add.rectangle(centerX, centerY, width, height, 0x0a0a0a, 1);
      }
      background.setDepth(0);

      // ─── Layer 2: Splash Art (depth 10) ─────────────────────────────────────
      const splashArt = this.add.image(centerX, centerY - 80, '__DEFAULT');
      splashArt.setDepth(10);
      splashArt.setAlpha(0);

      // ─── Layer 3: Realm Title (depth 15) ────────────────────────────────────
      this.realmTitleText = this.add.text(centerX, 30, this.transition.realm.title, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '14px',
        color: '#c0a050',
        align: 'center',
      }).setOrigin(0.5).setDepth(15).setAlpha(0);

      this.realmNameText = this.add.text(centerX, 52, this.transition.realm.name, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '24px',
        color: '#ffdd00',
        fontStyle: 'bold',
        align: 'center',
      }).setOrigin(0.5).setDepth(15).setAlpha(0);

      // Fade in realm title
      this.tweens.add({
        targets: [this.realmTitleText, this.realmNameText],
        alpha: 1,
        duration: 600,
        ease: 'Power2',
      });

      // ─── Layer 4: Dialog Box (depth 20) ─────────────────────────────────────
      const boxHeight = 160;
      const boxY = height - boxHeight / 2 - 10;
      this.dialogBox = this.add.rectangle(centerX, boxY, width - 40, boxHeight, 0x000000, 0.75);
      this.dialogBox.setDepth(20);
      this.dialogBox.setStrokeStyle(2, 0x8b6914);

      // ─── Layer 5: Name + Dialog Texts (depth 30) ────────────────────────────
      this.nameText = this.add.text(40, height - boxHeight + 10, '', {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '18px',
        color: '#ffdd00',
        fontStyle: 'bold',
      }).setDepth(30);

      this.dialogText = this.add.text(40, height - boxHeight + 35, '', {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '16px',
        color: '#ffffff',
        wordWrap: { width: width - 80 },
        lineSpacing: 6,
      }).setDepth(30);

      // Continue indicator (blinking triangle)
      this.continueIndicator = this.add.text(width - 60, height - 30, '▼', {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '16px',
        color: '#ffffff',
      }).setDepth(30).setAlpha(0.6);

      this.tweens.add({
        targets: this.continueIndicator,
        alpha: 0.2,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // ─── Layer 6: Culture Panel (depth 40, initially hidden) ────────────────
      this.createCulturePanel();

      // ─── Layer 7: Skip Button (depth 50) ────────────────────────────────────
      this.createSkipButton();

      // ─── Transform data and start CinematicPlayer ───────────────────────────
      const cinematicData = transformTransitionToCinematicData(this.transition);

      this.cinematicPlayer = new CinematicPlayer(this, cinematicData);
      this.cinematicPlayer.start(
        background as Phaser.GameObjects.Image,
        splashArt,
        this.nameText,
        this.dialogText,
      );

      // ─── Input: advance with click, Space, or Enter ─────────────────────────
      this.input.on('pointerdown', this.onAdvance, this);
      if (this.input.keyboard) {
        this.input.keyboard.on('keydown-SPACE', this.onAdvance, this);
        this.input.keyboard.on('keydown-ENTER', this.onAdvance, this);
      }

      // ─── Listen for cinematic completion → transition to culture ─────────────
      this.events.on('cinematic-complete', this.onCinematicComplete, this);
    } catch (error) {
      console.error('[RealmTransitionScene] Error in create():', error);
      this.emitComplete();
    }
  }

  // ─── Culture Panel ────────────────────────────────────────────────────────────

  private createCulturePanel(): void {
    if (!this.transition) return;

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    const panelWidth = width - 80;
    const panelHeight = 220;

    this.culturePanel = this.add.container(centerX, centerY);
    this.culturePanel.setDepth(40);
    this.culturePanel.setAlpha(0);
    this.culturePanel.setVisible(false);

    // Panel background
    const panelBg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x1a1a2e, 0.92);
    panelBg.setStrokeStyle(2, 0x8b6914);
    this.culturePanel.add(panelBg);

    // Culture title
    const cultureTitle = this.add.text(0, -panelHeight / 2 + 24, this.transition.culture.title, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '18px',
      color: '#ffdd00',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.culturePanel.add(cultureTitle);

    // Culture description
    const cultureDesc = this.add.text(0, -panelHeight / 2 + 54, this.transition.culture.description, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '14px',
      color: '#dddddd',
      wordWrap: { width: panelWidth - 40 },
      lineSpacing: 6,
      align: 'center',
    }).setOrigin(0.5, 0);
    this.culturePanel.add(cultureDesc);

    // "Continuar" button
    const btnY = panelHeight / 2 - 36;
    const btnBg = this.add.rectangle(0, btnY, 160, 36, 0x4a2800, 1);
    btnBg.setStrokeStyle(2, 0xffdd00);
    btnBg.setInteractive({ useHandCursor: true });
    this.culturePanel.add(btnBg);

    const btnText = this.add.text(0, btnY, 'Continuar', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '16px',
      color: '#ffdd00',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.culturePanel.add(btnText);

    // Button hover effects
    btnBg.on('pointerover', () => {
      btnBg.setFillStyle(0x6a3800);
      btnText.setColor('#ffffff');
    });
    btnBg.on('pointerout', () => {
      btnBg.setFillStyle(0x4a2800);
      btnText.setColor('#ffdd00');
    });
    btnBg.on('pointerdown', () => {
      this.onContinue();
    });
  }

  // ─── Skip Button ──────────────────────────────────────────────────────────────

  private createSkipButton(): void {
    const { width } = this.cameras.main;

    this.skipButton = this.add.text(width - 20, 20, 'Saltar', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '14px',
      color: '#ffffff',
    })
      .setOrigin(1, 0)
      .setDepth(50)
      .setAlpha(0.7)
      .setInteractive({ useHandCursor: true });

    this.skipButton.on('pointerover', () => {
      this.skipButton?.setAlpha(1.0);
    });
    this.skipButton.on('pointerout', () => {
      this.skipButton?.setAlpha(0.7);
    });
    this.skipButton.on('pointerdown', () => {
      this.handleSkip();
    });
  }

  // ─── State Transitions ────────────────────────────────────────────────────────

  private onAdvance = (): void => {
    if (this.state === 'dialog') {
      this.cinematicPlayer?.advance();
    }
  };

  private onCinematicComplete = (): void => {
    if (this.state !== 'dialog') return;
    this.transitionToCulture();
  };

  private transitionToCulture(): void {
    this.state = 'culture';

    // Remove dialog input listeners (culture uses button only)
    this.input.off('pointerdown', this.onAdvance, this);
    if (this.input.keyboard) {
      this.input.keyboard.off('keydown-SPACE', this.onAdvance, this);
      this.input.keyboard.off('keydown-ENTER', this.onAdvance, this);
    }

    // Fade out dialog elements
    this.tweens.add({
      targets: [this.dialogBox, this.nameText, this.dialogText, this.continueIndicator],
      alpha: 0,
      duration: 300,
      ease: 'Power2',
    });

    // Show culture panel with fade in
    if (this.culturePanel) {
      this.culturePanel.setVisible(true);
      this.tweens.add({
        targets: this.culturePanel,
        alpha: 1,
        duration: 400,
        delay: 200,
        ease: 'Power2',
      });
    }
  }

  private onContinue(): void {
    if (this.state !== 'culture') return;
    this.state = 'complete';
    this.emitComplete();
  }

  private handleSkip(): void {
    if (this.hasCompleted) return;

    // Kill all active tweens and timers
    this.tweens.killAll();
    this.time.removeAllEvents();

    // Destroy CinematicPlayer
    this.cinematicPlayer?.destroy();
    this.cinematicPlayer = null;

    this.emitComplete();
  }

  // ─── Completion ───────────────────────────────────────────────────────────────

  private emitComplete(): void {
    if (this.hasCompleted) return;
    this.hasCompleted = true;

    // Clean up input listeners
    this.input.off('pointerdown', this.onAdvance, this);
    if (this.input.keyboard) {
      this.input.keyboard.off('keydown-SPACE', this.onAdvance, this);
      this.input.keyboard.off('keydown-ENTER', this.onAdvance, this);
    }
    this.events.off('cinematic-complete', this.onCinematicComplete, this);

    // Hide skip button
    if (this.skipButton) {
      this.skipButton.disableInteractive();
      this.skipButton.setVisible(false);
    }

    // Destroy CinematicPlayer if still active
    this.cinematicPlayer?.destroy();
    this.cinematicPlayer = null;

    // Emit completion to parent GameScene
    const gameScene = this.scene.get('GameScene');
    if (gameScene) {
      gameScene.events.emit('realm-transition-complete');
    }

    // Stop this scene
    this.scene.stop();
  }

  shutdown(): void {
    this.cinematicPlayer?.destroy();
    this.cinematicPlayer = null;
    this.events.off('cinematic-complete', this.onCinematicComplete, this);
  }
}
