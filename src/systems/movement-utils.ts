import { GAME_CONSTANTS } from '../config/constants';

/**
 * Interfaz para representar el estado de input de dirección
 * de forma pura (sin dependencia de Phaser).
 */
export interface DirectionInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

/**
 * Función pura: calcula el vector de dirección normalizado a partir del estado de input.
 * - Teclas opuestas se cancelan independientemente en su eje (W+S → Y=0, A+D → X=0)
 * - Movimiento diagonal se normaliza para mantener magnitud = 1
 * - Sin input retorna (0, 0)
 *
 * Requirements: 2.1, 2.2, 2.3
 */
export function calculateDirectionFromInput(input: DirectionInput): { x: number; y: number } {
  let x = 0;
  let y = 0;

  // Cancelación independiente por eje
  if (input.left && !input.right) x = -1;
  else if (input.right && !input.left) x = 1;
  // Si ambas están presionadas, x permanece 0

  if (input.up && !input.down) y = -1;
  else if (input.down && !input.up) y = 1;
  // Si ambas están presionadas, y permanece 0

  // Normalizar diagonal para que magnitud = 1
  if (x !== 0 && y !== 0) {
    const magnitude = Math.sqrt(x * x + y * y);
    x /= magnitude;
    y /= magnitude;
  }

  return { x, y };
}

/**
 * Función pura: aplica clamping de posición dentro de los límites del mapa.
 * Retorna la posición clampeada.
 *
 * Requirements: 2.5, 2.6
 */
export function clampPosition(
  x: number,
  y: number,
  minX: number = 0,
  minY: number = 0,
  maxX: number = GAME_CONSTANTS.MAP_WIDTH,
  maxY: number = GAME_CONSTANTS.MAP_HEIGHT
): { x: number; y: number } {
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}
