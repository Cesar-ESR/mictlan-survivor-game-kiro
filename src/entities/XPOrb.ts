import Phaser from 'phaser';
import { getXPOrbAsset, DEFAULT_XP_ORB_VARIANT, XP_ORB_FLOAT_CONFIG, XP_ORB_PULSE_CONFIG } from '../config/xp-orb-assets';
import type { XPOrbVariant } from '../config/xp-orb-assets';

/** Global monotonic counter for FIFO ordering without wall-clock dependency */
let orbSequenceCounter = 0;

/**
 * XP Orb entity that drops from defeated enemies.
 * Attracted toward the player when within range and collected on contact.
 * Uses delta-accumulated `age` for expiration and `creationSequence` for FIFO.
 *
 * Incluye una animación de flotación sutil (tween vertical) que se inicia
 * automáticamente al crearse y se detiene al destruirse.
 *
 * BUG-012 V5: Single-authority removal — OrbCollector is the sole owner of
 * the removal lifecycle. XPOrb exposes `consume()` which returns the XP value
 * and marks collected. The caller (OrbCollector) then kills tweens via
 * `scene.tweens.killTweensOf(orb)` and calls `orb.destroy()`.
 *
 * Key fix: Do NOT call `disableBody(true, true)` before `destroy()`.
 * In Phaser 4, disableBody with first param true calls setActive(false) which
 * interferes with the destroy pipeline, leaving the sprite visible.
 * Instead, `destroy()` handles removal from display list + physics world atomically.
 *
 * La variante visual es proporcionada por el sistema que crea el orbe
 * (enemigo, gestor de drops, etc.), no decidida internamente.
 *
 * Requirements: 8.1
 */
export class XPOrb extends Phaser.Physics.Arcade.Sprite {
  value: number;
  /** Monotonically increasing sequence number for deterministic FIFO ordering. */
  creationSequence: number;
  /** Accumulated lifetime in ms, advanced by OrbCollector via delta. */
  age: number;
  isAttracted: boolean;
  /** BUG-011: Guard flag to prevent double-collection in the same frame. */
  collected: boolean;
  /** Variante visual de este orbe. */
  readonly variant: XPOrbVariant;
  /** Tween de flotación vertical. */
  private floatTween: Phaser.Tweens.Tween | null = null;
  /** BUG-012 V4: Tween de pulso alpha para diferenciación visual. */
  private pulseTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, value: number, variant: XPOrbVariant = DEFAULT_XP_ORB_VARIANT) {
    const asset = getXPOrbAsset(variant);
    super(scene, x, y, asset.textureKey);

    this.value = value;
    this.variant = variant;
    this.creationSequence = orbSequenceCounter++;
    this.age = 0;
    this.isAttracted = false;
    this.collected = false;
    this.name = `xp-orb-${this.creationSequence}`;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDisplaySize(asset.scaleX, asset.scaleY);

    // BUG-012 V4: Tint distintivo para que los orbes nunca se confundan
    // con tiles estáticos de decoración del mapa (cristales azules del tileset).
    this.setTint(XP_ORB_PULSE_CONFIG.tint);

    this.startFloatAnimation();
    this.startPulseAnimation();
  }

  /**
   * Marks orb as collected and returns its XP value.
   * Returns 0 if already collected (prevents double-collection).
   * Does NOT destroy itself — the caller (OrbCollector) handles all removal.
   *
   * BUG-012 V5: Single point of consumption. The caller is responsible for
   * killing tweens and destroying the game object after calling this.
   */
  consume(): number {
    if (this.collected) return 0;
    this.collected = true;
    return this.value;
  }

  /**
   * Inicia la animación de flotación vertical usando un tween en loop.
   * El tween modifica únicamente la posición visual (y) sin afectar la física.
   */
  private startFloatAnimation(): void {
    const { amplitude, duration, ease } = XP_ORB_FLOAT_CONFIG;

    this.floatTween = this.scene.tweens.add({
      targets: this,
      y: this.y - amplitude,
      duration,
      ease,
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * BUG-012 V4: Inicia un tween de pulso de alpha que oscila entre 1.0 y alphaMin.
   * Esto da a los XPOrbs un aspecto "vivo" que los diferencia claramente de las
   * decoraciones estáticas del mapa que nunca pulsan.
   */
  private startPulseAnimation(): void {
    const { alphaMin, duration, ease } = XP_ORB_PULSE_CONFIG;

    this.pulseTween = this.scene.tweens.add({
      targets: this,
      alpha: { from: 1, to: alphaMin },
      duration,
      ease,
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * Detiene y limpia los tweens de flotación y pulso, then removes from scene.
   * BUG-012 V5: This is the ONLY removal method. No disableBody before destroy.
   * The destroy() call removes from display list + physics world atomically.
   */
  destroy(fromScene?: boolean): void {
    if (this.floatTween) {
      this.floatTween.destroy();
      this.floatTween = null;
    }
    if (this.pulseTween) {
      this.pulseTween.destroy();
      this.pulseTween = null;
    }
    super.destroy(fromScene);
  }
}
