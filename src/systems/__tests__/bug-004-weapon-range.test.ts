import { describe, it, expect } from 'vitest';
import { GAME_CONSTANTS } from '../../config/constants';
import { findClosestEnemy } from '../weapon-utils';
import type { WeaponTarget } from '../weapon-utils';

/**
 * Regression tests for BUG-004: Excessive weapon range.
 * WEAPON_RANGE was 800px (nearly entire viewport). Fixed to 384px (12 tiles × 32px).
 */
describe('BUG-004: Weapon range regression', () => {
  const RANGE = GAME_CONSTANTS.WEAPON_RANGE;

  it('WEAPON_RANGE is 384 (12 tiles × 32px)', () => {
    expect(GAME_CONSTANTS.WEAPON_RANGE).toBe(384);
  });

  it('PROJECTILE_MAX_DISTANCE is 450 (slightly more than range)', () => {
    expect(GAME_CONSTANTS.PROJECTILE_MAX_DISTANCE).toBe(450);
  });

  it('PROJECTILE_MAX_DISTANCE > WEAPON_RANGE', () => {
    expect(GAME_CONSTANTS.PROJECTILE_MAX_DISTANCE).toBeGreaterThan(GAME_CONSTANTS.WEAPON_RANGE);
  });

  it('enemy at exactly 384px is selectable', () => {
    const playerPos = { x: 100, y: 100 };
    const enemy: WeaponTarget = {
      x: playerPos.x + RANGE,
      y: playerPos.y,
      active: true,
      hp: 10,
    };
    const result = findClosestEnemy(playerPos, [enemy], RANGE);
    expect(result).not.toBeNull();
    expect(result).toBe(enemy);
  });

  it('enemy at 385px is NOT selectable', () => {
    const playerPos = { x: 100, y: 100 };
    const enemy: WeaponTarget = {
      x: playerPos.x + 385,
      y: playerPos.y,
      active: true,
      hp: 10,
    };
    const result = findClosestEnemy(playerPos, [enemy], RANGE);
    expect(result).toBeNull();
  });

  it('enemy at old range (800px) is NOT selectable', () => {
    const playerPos = { x: 100, y: 100 };
    const enemy: WeaponTarget = {
      x: playerPos.x + 800,
      y: playerPos.y,
      active: true,
      hp: 10,
    };
    const result = findClosestEnemy(playerPos, [enemy], RANGE);
    expect(result).toBeNull();
  });

  it('enemy within 12 tiles diagonally is selectable', () => {
    const playerPos = { x: 100, y: 100 };
    // 8 tiles on each axis → distance = 8*32*√2 ≈ 362 < 384
    const enemy: WeaponTarget = {
      x: playerPos.x + 256,
      y: playerPos.y + 256,
      active: true,
      hp: 10,
    };
    const result = findClosestEnemy(playerPos, [enemy], RANGE);
    expect(result).not.toBeNull();
  });
});
