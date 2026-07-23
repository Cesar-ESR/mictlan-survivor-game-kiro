import Phaser from 'phaser';

/**
 * HUDScene: Escena overlay lanzada en paralelo sobre GameScene.
 * Muestra información de estado: HP, XP, oleada y timer.
 * Se actualiza mediante eventos emitidos por GameScene y sus sistemas.
 * Requirements: 7.1, 7.2, 7.3
 */
export class HUDScene extends Phaser.Scene {
  private hpText!: Phaser.GameObjects.Text;
  private xpText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'HUDScene' });
  }

  create(): void {
    // Placeholder de elementos visuales de HUD
    this.hpText = this.add.text(16, 16, 'HP: 100/100', {
      fontSize: '16px',
      color: '#ff4444',
    });

    this.xpText = this.add.text(16, 40, 'XP: 0/15 (Nivel 1)', {
      fontSize: '16px',
      color: '#44ff44',
    });

    this.waveText = this.add.text(16, 64, 'Oleada: 1', {
      fontSize: '16px',
      color: '#ffff44',
    });

    this.timerText = this.add.text(16, 88, '00:00', {
      fontSize: '16px',
      color: '#ffffff',
    });

    // Registrar event listeners en GameScene
    const gameScene = this.scene.get('GameScene');

    gameScene.events.on('hp-changed', (hp: number, maxHp: number) => {
      this.hpText.setText(`HP: ${hp}/${maxHp}`);
    });

    gameScene.events.on('xp-changed', (levelXp: number, threshold: number, level: number) => {
      this.xpText.setText(`XP: ${levelXp}/${threshold} (Nivel ${level})`);
    });

    gameScene.events.on('wave-changed', (wave: number) => {
      this.waveText.setText(`Oleada: ${wave}`);
    });

    gameScene.events.on('level-up', (_upgrades: unknown[]) => {
      // TODO: Mostrar LevelUpPanel con las opciones de mejora (Task 17.4)
    });

    gameScene.events.on('time-updated', (elapsedSeconds: number) => {
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = Math.floor(elapsedSeconds % 60);
      this.timerText.setText(
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    });
  }
}
