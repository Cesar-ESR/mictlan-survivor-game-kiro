import Phaser from 'phaser';

export interface IEnemy {
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  xpReward: number;
  update(delta: number, playerPos: { x: number; y: number }): void;
  takeDamage(amount: number): void;
  onDefeat(): void;
}

export abstract class Enemy extends Phaser.Physics.Arcade.Sprite implements IEnemy {
  declare hp: number;
  declare maxHp: number;
  declare speed: number;
  declare damage: number;
  declare xpReward: number;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
  }

  abstract update(delta: number, playerPos: { x: number; y: number }): void;

  takeDamage(amount: number): void {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.onDefeat();
    }
  }

  onDefeat(): void {
    this.scene.events.emit('enemy-defeated', {
      x: this.x,
      y: this.y,
      xpReward: this.xpReward,
    });
    this.setActive(false);
    this.setVisible(false);
    if (this.body) {
      this.body.enable = false;
    }
  }
}
