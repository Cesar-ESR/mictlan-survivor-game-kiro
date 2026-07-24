import Phaser from 'phaser';
import { calculateHealthFill, calculateXPFill, formatTimerMMSS } from '../systems/hud-utils';
import type { Upgrade } from '../types/interfaces';

/**
 * HUDScene: Escena overlay lanzada en paralelo sobre GameScene.
 * Muestra información de estado: HP bar, XP bar, oleada, timer, y panel de level-up.
 * Se actualiza mediante eventos emitidos por GameScene y sus sistemas.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 5.3, 5.5, 5.8
 */
export class HUDScene extends Phaser.Scene {
  // Health bar elements
  private healthBarBg!: Phaser.GameObjects.Rectangle;
  private healthBarFill!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;

  // XP bar elements
  private xpBarBg!: Phaser.GameObjects.Rectangle;
  private xpBarFill!: Phaser.GameObjects.Rectangle;
  private xpText!: Phaser.GameObjects.Text;

  // Wave display
  private waveText!: Phaser.GameObjects.Text;
  private waveAnnouncement!: Phaser.GameObjects.Text;

  // Timer display
  private timerText!: Phaser.GameObjects.Text;
  private elapsedSeconds = 0;

  // Level-up panel
  private levelUpContainer!: Phaser.GameObjects.Container;
  private levelUpOverlay!: Phaser.GameObjects.Rectangle;

  // Bar dimensions
  private static readonly BAR_WIDTH = 200;
  private static readonly BAR_HEIGHT = 18;

  constructor() {
    super({ key: 'HUDScene' });
  }

  create(): void {
    this.createHealthBar();
    this.createXPBar();
    this.createWaveDisplay();
    this.createTimerDisplay();
    this.createLevelUpPanel();
    this.registerEventListeners();
  }

  update(_time: number, delta: number): void {
    // Accumulate elapsed time for timer display
    this.elapsedSeconds += delta / 1000;
    this.timerText.setText(formatTimerMMSS(this.elapsedSeconds));
  }

  // --- Health Bar (Subtask 19.1) ---

  private createHealthBar(): void {
    const x = 16;
    const y = 16;
    const { BAR_WIDTH, BAR_HEIGHT } = HUDScene;

    // Background (dark)
    this.healthBarBg = this.add.rectangle(
      x + BAR_WIDTH / 2, y + BAR_HEIGHT / 2,
      BAR_WIDTH, BAR_HEIGHT,
      0x333333,
    );
    this.healthBarBg.setStrokeStyle(1, 0x666666);

    // Fill (red/health color)
    this.healthBarFill = this.add.rectangle(
      x + BAR_WIDTH / 2, y + BAR_HEIGHT / 2,
      BAR_WIDTH, BAR_HEIGHT,
      0xff4444,
    );

    // Text label
    this.hpText = this.add.text(x + BAR_WIDTH + 8, y, 'HP: 100/100', {
      fontSize: '14px',
      color: '#ffffff',
    });
  }

  private updateHealthBar(hp: number, maxHp: number): void {
    const fillRatio = calculateHealthFill(hp, maxHp);
    const { BAR_WIDTH, BAR_HEIGHT } = HUDScene;
    const x = 16;
    const y = 16;
    const fillWidth = BAR_WIDTH * fillRatio;

    this.healthBarFill.setSize(fillWidth, BAR_HEIGHT);
    this.healthBarFill.setPosition(x + fillWidth / 2, y + BAR_HEIGHT / 2);
    this.hpText.setText(`HP: ${Math.floor(hp)}/${Math.floor(maxHp)}`);
  }

  // --- XP Bar (Subtask 19.2) ---

  private createXPBar(): void {
    const x = 16;
    const y = 42;
    const { BAR_WIDTH, BAR_HEIGHT } = HUDScene;

    // Background (dark)
    this.xpBarBg = this.add.rectangle(
      x + BAR_WIDTH / 2, y + BAR_HEIGHT / 2,
      BAR_WIDTH, BAR_HEIGHT,
      0x333333,
    );
    this.xpBarBg.setStrokeStyle(1, 0x666666);

    // Fill (blue/xp color)
    this.xpBarFill = this.add.rectangle(
      x + BAR_WIDTH / 2, y + BAR_HEIGHT / 2,
      BAR_WIDTH, BAR_HEIGHT,
      0x44aaff,
    );

    // Text label
    this.xpText = this.add.text(x + BAR_WIDTH + 8, y, 'XP: 0/15 (Nivel 1)', {
      fontSize: '14px',
      color: '#ffffff',
    });
  }

  private updateXPBar(levelXp: number, threshold: number, level: number, isMaxLevel: boolean): void {
    const fillRatio = calculateXPFill(levelXp, threshold, isMaxLevel);
    const { BAR_WIDTH, BAR_HEIGHT } = HUDScene;
    const x = 16;
    const y = 42;
    const fillWidth = BAR_WIDTH * fillRatio;

    this.xpBarFill.setSize(fillWidth, BAR_HEIGHT);
    this.xpBarFill.setPosition(x + fillWidth / 2, y + BAR_HEIGHT / 2);

    if (isMaxLevel) {
      this.xpText.setText(`XP: MAX (Nivel ${level})`);
    } else {
      this.xpText.setText(`XP: ${Math.floor(levelXp)}/${threshold} (Nivel ${level})`);
    }
  }

  // --- Wave Display (Subtask 19.3) ---

  private createWaveDisplay(): void {
    this.waveText = this.add.text(16, 68, 'Oleada: 1', {
      fontSize: '16px',
      color: '#ffff44',
    });

    // Wave announcement (large text, initially hidden)
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 3;
    this.waveAnnouncement = this.add.text(centerX, centerY, '', {
      fontSize: '48px',
      color: '#ffdd00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    });
    this.waveAnnouncement.setOrigin(0.5);
    this.waveAnnouncement.setAlpha(0);
  }

  private updateWaveDisplay(wave: number): void {
    this.waveText.setText(`Oleada: ${wave}`);
    this.showWaveAnnouncement(wave);
  }

  private showWaveAnnouncement(wave: number): void {
    this.waveAnnouncement.setText(`¡Oleada ${wave}!`);
    this.waveAnnouncement.setAlpha(1);

    // Fade out over 2 seconds
    this.tweens.add({
      targets: this.waveAnnouncement,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
    });
  }

  // --- Timer Display (Subtask 19.3) ---

  private createTimerDisplay(): void {
    const rightX = this.cameras.main.width - 80;
    this.timerText = this.add.text(rightX, 16, '00:00', {
      fontSize: '16px',
      color: '#ffffff',
    });
  }

  // --- Level-Up Panel (Subtask 19.4) ---

  private createLevelUpPanel(): void {
    // Create container (hidden by default)
    this.levelUpContainer = this.add.container(0, 0);
    this.levelUpContainer.setVisible(false);
    this.levelUpContainer.setDepth(1000);

    // Semi-transparent overlay
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    this.levelUpOverlay = this.add.rectangle(
      width / 2, height / 2,
      width, height,
      0x000000, 0.6,
    );
    this.levelUpContainer.add(this.levelUpOverlay);
  }

  private showLevelUpPanel(upgrades: Upgrade[]): void {
    // Clear previous cards (keep overlay)
    this.levelUpContainer.removeAll(true);

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Re-create overlay
    this.levelUpOverlay = this.add.rectangle(
      width / 2, height / 2,
      width, height,
      0x000000, 0.6,
    );
    this.levelUpContainer.add(this.levelUpOverlay);

    // Title
    const title = this.add.text(width / 2, height * 0.15, '¡Subiste de nivel!', {
      fontSize: '32px',
      color: '#ffdd00',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    this.levelUpContainer.add(title);

    const subtitle = this.add.text(width / 2, height * 0.22, 'Elige una mejora:', {
      fontSize: '18px',
      color: '#ffffff',
    });
    subtitle.setOrigin(0.5);
    this.levelUpContainer.add(subtitle);

    // Create upgrade cards
    const cardWidth = 220;
    const cardHeight = 140;
    const cardSpacing = 20;
    const totalWidth = upgrades.length * cardWidth + (upgrades.length - 1) * cardSpacing;
    const startX = (width - totalWidth) / 2 + cardWidth / 2;
    const cardY = height * 0.5;

    upgrades.forEach((upgrade, index) => {
      const cardX = startX + index * (cardWidth + cardSpacing);
      this.createUpgradeCard(cardX, cardY, cardWidth, cardHeight, upgrade);
    });

    this.levelUpContainer.setVisible(true);
  }

  private createUpgradeCard(x: number, y: number, w: number, h: number, upgrade: Upgrade): void {
    // Card background
    const cardBg = this.add.rectangle(x, y, w, h, 0x222244);
    cardBg.setStrokeStyle(2, 0x6666ff);
    cardBg.setInteractive({ useHandCursor: true });
    this.levelUpContainer.add(cardBg);

    // Upgrade name
    const nameText = this.add.text(x, y - 30, upgrade.name, {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
      wordWrap: { width: w - 20 },
      align: 'center',
    });
    nameText.setOrigin(0.5);
    this.levelUpContainer.add(nameText);

    // Upgrade description
    const descText = this.add.text(x, y + 15, upgrade.description, {
      fontSize: '12px',
      color: '#cccccc',
      wordWrap: { width: w - 20 },
      align: 'center',
    });
    descText.setOrigin(0.5);
    this.levelUpContainer.add(descText);

    // Hover effect
    cardBg.on('pointerover', () => {
      cardBg.setFillStyle(0x333366);
      cardBg.setStrokeStyle(2, 0xaaaaff);
    });

    cardBg.on('pointerout', () => {
      cardBg.setFillStyle(0x222244);
      cardBg.setStrokeStyle(2, 0x6666ff);
    });

    // Click → emit upgrade-selected on GameScene events, then hide panel
    cardBg.on('pointerdown', () => {
      const gameScene = this.scene.get('GameScene');
      gameScene.events.emit('upgrade-selected', upgrade);
      this.hideLevelUpPanel();
    });
  }

  private hideLevelUpPanel(): void {
    this.levelUpContainer.setVisible(false);
  }

  // --- Event Listeners ---

  private registerEventListeners(): void {
    const gameScene = this.scene.get('GameScene');

    gameScene.events.on('hp-changed', (hp: number, maxHp: number) => {
      this.updateHealthBar(hp, maxHp);
    });

    gameScene.events.on('xp-changed', (levelXp: number, threshold: number, level: number, isMaxLevel?: boolean) => {
      this.updateXPBar(levelXp, threshold, level, isMaxLevel ?? false);
    });

    gameScene.events.on('wave-changed', (wave: number) => {
      this.updateWaveDisplay(wave);
    });

    gameScene.events.on('level-up', (upgrades: Upgrade[]) => {
      if (upgrades && upgrades.length > 0) {
        this.showLevelUpPanel(upgrades);
      }
    });

    // Note: Timer is handled by the scene's own update() method accumulating delta
    // The 'time-updated' event is kept for backwards compatibility if emitted externally
    gameScene.events.on('time-updated', (elapsedSeconds: number) => {
      this.elapsedSeconds = elapsedSeconds;
    });
  }
}
