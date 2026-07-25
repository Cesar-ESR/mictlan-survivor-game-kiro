import Phaser from 'phaser';
import { calculateHealthFill, calculateXPFill, formatTimerMMSS } from '../systems/hud-utils';
import type { WaveChangedPayload } from '../types/interfaces';
import type { MemoryUpgrade } from '../config/memory-upgrades';
import type { MemoryLevelUpPayload } from '../systems/LevelUpCoordinator';
import { GAME_FONT_FAMILY } from '../config/font-config';
import { AudioManager } from '../managers/AudioManager';
import { BlessingManager } from '../managers/BlessingManager';

/**
 * HUDScene: Escena overlay lanzada en paralelo sobre GameScene.
 * Muestra información de estado: HP bar, XP bar, oleada, timer, y panel de level-up.
 * Se actualiza mediante eventos emitidos por GameScene y sus sistemas.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 5.3, 5.5, 5.8
 */
export class HUDScene extends Phaser.Scene {
  // Health bar elements (sprite-based)
  private healthFrame!: Phaser.GameObjects.Image;
  private healthFill!: Phaser.GameObjects.Image;
  private healthDamage!: Phaser.GameObjects.Image;
  private healthGlow!: Phaser.GameObjects.Image;
  private hpText!: Phaser.GameObjects.Text;
  private healthFillFullWidth = 0;

  // XP bar elements (sprite-based)
  private xpFill!: Phaser.GameObjects.Image;
  private xpFrame!: Phaser.GameObjects.Image;
  private xpText!: Phaser.GameObjects.Text;
  private xpFillFullWidth = 0;

  // Blessing medals
  private primaryMedal: Phaser.GameObjects.Image | null = null;
  private secondaryMedal: Phaser.GameObjects.Image | null = null;

  // Wave display
  private waveText!: Phaser.GameObjects.Text;
  private waveAnnouncement!: Phaser.GameObjects.Text;

  // Timer display
  private timerText!: Phaser.GameObjects.Text;
  private elapsedSeconds = 0;

  // Level-up panel
  private levelUpContainer!: Phaser.GameObjects.Container;
  private levelUpOverlay!: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: 'HUDScene' });
  }

  create(): void {
    this.createHealthBar();
    this.createXPBar();
    this.createBlessingMedals();
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
    const x = 10;
    const y = 16;

    // Fill layer (below frame) — uses setCrop for reduction
    this.healthFill = this.add.image(x, y, 'health_fill').setOrigin(-0.12, -0.5);
    this.healthFillFullWidth = this.healthFill.width;

    // Damage layer (positioned same as fill, hidden for now)
    this.healthDamage = this.add.image(x, y, 'health_damage').setOrigin(-0.12, -0.5);
    this.healthDamage.setVisible(false);

    // Glow layer (positioned same as frame, hidden for now)
    this.healthGlow = this.add.image(x, y, 'health_glow').setOrigin(-0.12, -0.5);
    this.healthGlow.setVisible(false);

    // Frame layer (always on top, never deformed)
    this.healthFrame = this.add.image(x, y, 'health_frame').setOrigin(0, 0);

    // Text label to the right of the frame
    this.hpText = this.add.text(x + this.healthFrame.width + 8, y + 10, 'HP: 100/100', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '14px',
      color: '#ffffff',
    });
  }

  private updateHealthBar(hp: number, maxHp: number): void {
    const fillRatio = calculateHealthFill(hp, maxHp);

    // Use setCrop to show only the portion corresponding to fillRatio.
    // Crops from left (0) to fillRatio * fullWidth, keeping left edge fixed.
    const cropWidth = Math.round(this.healthFillFullWidth * fillRatio);
    this.healthFill.setCrop(0, 0, cropWidth, this.healthFill.height);

    this.hpText.setText(`HP: ${Math.floor(hp)}/${Math.floor(maxHp)}`);
  }

  // --- XP Bar (Subtask 19.2) ---

  private createXPBar(): void {
    const x = 10;
    const y = 16 + this.healthFrame.height + 4;

    // Fill layer (below frame) — uses health_damage.png as XP fill color
    this.xpFill = this.add.image(x, y, 'health_damage').setOrigin(-0.12, -0.5);
    this.xpFillFullWidth = this.xpFill.width;

    // Frame layer (always on top, never deformed)
    this.xpFrame = this.add.image(x, y, 'health_frame').setOrigin(0, 0);

    // Text label to the right of the frame
    this.xpText = this.add.text(x + this.xpFrame.width + 8, y + 10, 'XP: 0/15 (Nivel 1)', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '14px',
      color: '#ffffff',
    });
  }

  private updateXPBar(levelXp: number, threshold: number, level: number, isMaxLevel: boolean): void {
    const fillRatio = calculateXPFill(levelXp, threshold, isMaxLevel);

    // Use setCrop to show only the portion corresponding to fillRatio.
    const cropWidth = Math.round(this.xpFillFullWidth * fillRatio);
    this.xpFill.setCrop(0, 0, cropWidth, this.xpFill.height);

    if (isMaxLevel) {
      this.xpText.setText(`XP: MAX (Nivel ${level})`);
    } else {
      this.xpText.setText(`XP: ${Math.floor(levelXp)}/${threshold} (Nivel ${level})`);
    }
  }

  // --- Blessing Medals ---

  /**
   * Creates medal images below the XP bar using the selection stored in BlessingManager.
   * Fully data-driven: reads badge keys from the selection, no hardcoded blessing logic.
   */
  private createBlessingMedals(): void {
    const selection = BlessingManager.getInstance().getSelection();
    if (!selection) return;

    const x = 10;
    const y = 16 + this.healthFrame.height + 4 + this.xpFrame.height + 8;
    const medalSize = 32;
    const spacing = 8;

    // Primary medal
    this.primaryMedal = this.add.image(x + medalSize / 2, y + medalSize / 2, selection.primary.badge);
    const pScale = medalSize / Math.max(this.primaryMedal.width, this.primaryMedal.height);
    this.primaryMedal.setScale(pScale);

    // Secondary medal
    this.secondaryMedal = this.add.image(
      x + medalSize + spacing + medalSize / 2,
      y + medalSize / 2,
      selection.secondary.badge,
    );
    const sScale = medalSize / Math.max(this.secondaryMedal.width, this.secondaryMedal.height);
    this.secondaryMedal.setScale(sScale);
  }

  // --- Wave Display (Subtask 19.3) ---

  private createWaveDisplay(): void {
    this.waveText = this.add.text(100, 100, 'Oleada: 1', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '16px',
      color: '#ffff44',
    });

    // Wave announcement (large text, initially hidden)
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 3;
    this.waveAnnouncement = this.add.text(centerX, centerY, '', {
      fontFamily: GAME_FONT_FAMILY,
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
      fontFamily: GAME_FONT_FAMILY,
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

  private showLevelUpPanel(memories: MemoryUpgrade[]): void {
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
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '32px',
      color: '#ffdd00',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    this.levelUpContainer.add(title);

    const subtitle = this.add.text(width / 2, height * 0.22, 'Elige un Recuerdo:', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '18px',
      color: '#ffffff',
    });
    subtitle.setOrigin(0.5);
    this.levelUpContainer.add(subtitle);

    // Create memory cards
    const cardWidth = 240;
    const cardHeight = 200;
    const cardSpacing = 20;
    const totalWidth = memories.length * cardWidth + (memories.length - 1) * cardSpacing;
    const startX = (width - totalWidth) / 2 + cardWidth / 2;
    const cardY = height * 0.5;

    memories.forEach((memory, index) => {
      const cardX = startX + index * (cardWidth + cardSpacing);
      this.createMemoryCard(cardX, cardY, cardWidth, cardHeight, memory);
    });

    this.levelUpContainer.setVisible(true);
  }

  private createMemoryCard(x: number, y: number, w: number, h: number, memory: MemoryUpgrade): void {
    // Card background
    const cardBg = this.add.rectangle(x, y, w, h, 0x222244);
    cardBg.setStrokeStyle(2, 0x6666ff);
    cardBg.setInteractive({ useHandCursor: true });
    this.levelUpContainer.add(cardBg);

    // Level indicator
    const levelText = this.add.text(x, y - 70, `Nivel ${memory.level} → ${memory.level + 1}`, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '12px',
      color: '#aaaaff',
      align: 'center',
    });
    levelText.setOrigin(0.5);
    this.levelUpContainer.add(levelText);

    // Memory name
    const nameText = this.add.text(x, y - 48, memory.name, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '15px',
      color: '#ffffff',
      fontStyle: 'bold',
      wordWrap: { width: w - 20 },
      align: 'center',
    });
    nameText.setOrigin(0.5);
    this.levelUpContainer.add(nameText);

    // Narrative text
    const narrativeText = this.add.text(x, y - 10, memory.narrative, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '11px',
      color: '#cccccc',
      wordWrap: { width: w - 20 },
      align: 'center',
    });
    narrativeText.setOrigin(0.5);
    this.levelUpContainer.add(narrativeText);

    // Effect text
    const effectText = this.add.text(x, y + 35, memory.effectText, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '12px',
      color: '#88ff88',
      wordWrap: { width: w - 20 },
      align: 'center',
    });
    effectText.setOrigin(0.5);
    this.levelUpContainer.add(effectText);

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
      AudioManager.getInstance(this).playSFX('CONFIRM');
      const gameScene = this.scene.get('GameScene');
      gameScene.events.emit('upgrade-selected', { upgradeId: memory.id });
      this.hideLevelUpPanel();
    });
  }

  private hideLevelUpPanel(): void {
    this.levelUpContainer.setVisible(false);
  }

  // --- Event Listeners ---

  private _hpHandler = (hp: number, maxHp: number) => this.updateHealthBar(hp, maxHp);
  private _xpHandler = (levelXp: number, threshold: number, level: number, isMaxLevel?: boolean) =>
    this.updateXPBar(levelXp, threshold, level, isMaxLevel ?? false);
  private _waveHandler = (payload: WaveChangedPayload) => this.updateWaveDisplay(payload.wave);
  private _levelUpHandler = (payload: MemoryLevelUpPayload) => {
    if (payload && payload.memories.length > 0) {
      this.showLevelUpPanel(payload.memories as MemoryUpgrade[]);
    }
  };
  private _timeHandler = (elapsedSeconds: number) => { this.elapsedSeconds = elapsedSeconds; };
  private _waveAnnouncementTimer: Phaser.Time.TimerEvent | null = null;

  private registerEventListeners(): void {
    const gameScene = this.scene.get('GameScene');

    gameScene.events.on('hp-changed', this._hpHandler);
    gameScene.events.on('xp-changed', this._xpHandler);
    gameScene.events.on('wave-changed', this._waveHandler);
    gameScene.events.on('level-up', this._levelUpHandler);
    gameScene.events.on('time-updated', this._timeHandler);
  }

  /** Cleanup: remove own listeners and cancel timers. Called on scene shutdown. */
  shutdown(): void {
    const gameScene = this.scene.get('GameScene');
    if (gameScene) {
      gameScene.events.off('hp-changed', this._hpHandler);
      gameScene.events.off('xp-changed', this._xpHandler);
      gameScene.events.off('wave-changed', this._waveHandler);
      gameScene.events.off('level-up', this._levelUpHandler);
      gameScene.events.off('time-updated', this._timeHandler);
    }

    // Cancel wave announcement timer
    if (this._waveAnnouncementTimer) {
      this._waveAnnouncementTimer.destroy();
      this._waveAnnouncementTimer = null;
    }

    // Clean up level-up panel
    if (this.levelUpContainer) {
      this.levelUpContainer.removeAll(true);
      this.levelUpContainer.setVisible(false);
    }
  }
}
