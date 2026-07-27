/**
 * Interfaces puras para funciones de spawn sin dependencia de Phaser.
 */
export interface CameraViewport {
  x: number;      // left edge
  y: number;      // top edge
  width: number;
  height: number;
}

export interface MapBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Función pura: determina si una posición satisface la triple restricción de spawn.
 * 1. Fuera del viewport de la cámara
 * 2. Dentro de los límites del mapa
 * 3. A una distancia de 50-300px del borde más cercano del viewport
 *
 * Requirements: 3.1, 3.2
 */
export function isValidSpawnPosition(
  pos: { x: number; y: number },
  viewport: CameraViewport,
  bounds: MapBounds,
  minDist: number,
  maxDist: number,
): boolean {
  // Check within map bounds
  if (pos.x < bounds.minX || pos.x > bounds.maxX || pos.y < bounds.minY || pos.y > bounds.maxY) {
    return false;
  }

  // Check outside viewport
  const insideViewport =
    pos.x >= viewport.x &&
    pos.x <= viewport.x + viewport.width &&
    pos.y >= viewport.y &&
    pos.y <= viewport.y + viewport.height;

  if (insideViewport) {
    return false;
  }

  // Calculate distance from nearest viewport edge
  const distFromLeft = viewport.x - pos.x;
  const distFromRight = pos.x - (viewport.x + viewport.width);
  const distFromTop = viewport.y - pos.y;
  const distFromBottom = pos.y - (viewport.y + viewport.height);

  // The minimum positive distance from an edge tells us how far outside we are
  const horizontalDist = Math.max(distFromLeft, distFromRight, 0);
  const verticalDist = Math.max(distFromTop, distFromBottom, 0);

  // For positions that are purely to the side (not diagonal), use the direct distance
  // For diagonal positions, use Euclidean distance from nearest corner
  let distFromEdge: number;
  if (horizontalDist > 0 && verticalDist > 0) {
    // Diagonal: distance from nearest corner
    distFromEdge = Math.sqrt(horizontalDist * horizontalDist + verticalDist * verticalDist);
  } else {
    // Axis-aligned: take the non-zero distance
    distFromEdge = Math.max(horizontalDist, verticalDist);
  }

  return distFromEdge >= minDist && distFromEdge <= maxDist;
}

/**
 * Función pura: genera una posición candidata de spawn usando estrategia de borde + offset.
 * Retorna null si no se encuentra posición válida dentro de maxAttempts.
 *
 * Algoritmo: elige un borde aleatorio del viewport (top/bottom/left/right),
 * luego desplaza por un offset aleatorio entre minDist y maxDist hacia afuera.
 * Valida dentro de los límites del mapa. Si es inválido, intenta otro borde.
 *
 * Requirements: 3.1, 3.2
 */
export function generateSpawnPosition(
  viewport: CameraViewport,
  bounds: MapBounds,
  minDist: number,
  maxDist: number,
  rng: () => number,
  maxAttempts: number = 10,
): { x: number; y: number } | null {
  for (let i = 0; i < maxAttempts; i++) {
    // Pick a random edge: 0=top, 1=bottom, 2=left, 3=right
    const edge = Math.floor(rng() * 4);
    const offset = minDist + rng() * (maxDist - minDist);

    let x: number;
    let y: number;

    switch (edge) {
      case 0: // top
        x = viewport.x + rng() * viewport.width;
        y = viewport.y - offset;
        break;
      case 1: // bottom
        x = viewport.x + rng() * viewport.width;
        y = viewport.y + viewport.height + offset;
        break;
      case 2: // left
        x = viewport.x - offset;
        y = viewport.y + rng() * viewport.height;
        break;
      case 3: // right
        x = viewport.x + viewport.width + offset;
        y = viewport.y + rng() * viewport.height;
        break;
      default:
        x = viewport.x - offset;
        y = viewport.y + rng() * viewport.height;
    }

    // Validate within map bounds
    if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
      return { x, y };
    }
  }

  return null;
}

/**
 * Función pura: selecciona un tipo de enemigo por selección aleatoria ponderada.
 * Total weight = suma de todos los pesos; roll en [0, totalWeight),
 * selecciona el primer tipo cuyo peso acumulado excede el roll.
 *
 * Requirements: 6.2, 9.4
 */
export function selectWeightedType(
  types: Array<{ type: string; weight: number }>,
  roll: number,
): string {
  let cumulative = 0;
  for (const entry of types) {
    cumulative += entry.weight;
    if (roll < cumulative) {
      return entry.type;
    }
  }
  // Fallback: return last type (should not happen with valid roll)
  return types[types.length - 1].type;
}

/**
 * Función pura: verifica si una posición debe ser despawneada basándose en la distancia.
 * Entities >maxDistance del jugador retornan true; ≤maxDistance retornan false.
 *
 * Requirements: 3.5, 3.6
 */
export function shouldDespawn(
  entityPos: { x: number; y: number },
  playerPos: { x: number; y: number },
  maxDistance: number,
): boolean {
  const dx = entityPos.x - playerPos.x;
  const dy = entityPos.y - playerPos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance > maxDistance;
}
