/**
 * MapGenerationConfig: Interfaz y valores predeterminados para la generación
 * procedural del mapa.
 *
 * Requirements: 10.1, 10.8, 10.11, 10.15
 */

export interface MapGenerationConfig {
  /** Ancho del mapa en tiles. Default: 100 */
  widthInTiles: number;
  /** Alto del mapa en tiles. Default: 100 */
  heightInTiles: number;
  /** Tamaño de cada tile en píxeles. Default: 32 */
  tileSize: number;
  /** Semilla para la generación determinista. */
  seed: string | number;
  /** Radio de la zona segura central en tiles. Default: 5 */
  safeZoneRadius: number;
  /** Porcentaje mínimo de celdas transitables accesibles. Default: 0.85 */
  minimumReachableRatio: number;
  /** Densidad de muros [0, 1). Parámetro de balance configurable. */
  wallDensity: number;
  /** Densidad de obstáculos [0, 1). Parámetro de balance configurable. */
  obstacleDensity: number;
  /** Densidad de líquidos [0, 1). Parámetro de balance configurable. */
  liquidDensity: number;
  /** Densidad de decoración [0, 1). Parámetro de balance configurable. */
  decorationDensity: number;
  /** Número máximo de intentos de generación. Default: 5 */
  maxGenerationAttempts: number;
  /** Tiempo máximo total de generación+validación en ms. Default: 3000 */
  maxGenerationTimeMs: number;
}

/** Valores predeterminados de la configuración de generación. */
export const DEFAULT_MAP_GENERATION_CONFIG: Omit<MapGenerationConfig, 'seed'> = {
  widthInTiles: 100,
  heightInTiles: 100,
  tileSize: 32,
  safeZoneRadius: 5,
  minimumReachableRatio: 0.85,
  wallDensity: 0.03,
  obstacleDensity: 0.01,
  liquidDensity: 0.04,
  decorationDensity: 0.02,
  maxGenerationAttempts: 5,
  maxGenerationTimeMs: 3000,
};

/**
 * Crea una configuración completa a partir de un seed y overrides opcionales.
 * Valida que los parámetros estén en rangos válidos.
 *
 * @throws Error si la configuración es inválida
 */
export function createMapGenerationConfig(
  seed: string | number,
  overrides?: Partial<Omit<MapGenerationConfig, 'seed'>>,
): MapGenerationConfig {
  const config: MapGenerationConfig = {
    ...DEFAULT_MAP_GENERATION_CONFIG,
    ...overrides,
    seed,
  };

  validateMapGenerationConfig(config);
  return config;
}

/**
 * Valida la integridad de una MapGenerationConfig.
 * @throws Error si algún parámetro es inválido
 */
export function validateMapGenerationConfig(config: MapGenerationConfig): void {
  if (config.widthInTiles < 1 || !Number.isInteger(config.widthInTiles)) {
    throw new Error(`widthInTiles must be a positive integer, got ${config.widthInTiles}`);
  }
  if (config.heightInTiles < 1 || !Number.isInteger(config.heightInTiles)) {
    throw new Error(`heightInTiles must be a positive integer, got ${config.heightInTiles}`);
  }
  if (config.tileSize < 1 || !Number.isInteger(config.tileSize)) {
    throw new Error(`tileSize must be a positive integer, got ${config.tileSize}`);
  }
  if (config.safeZoneRadius < 0) {
    throw new Error(`safeZoneRadius must be >= 0, got ${config.safeZoneRadius}`);
  }
  if (config.minimumReachableRatio < 0 || config.minimumReachableRatio > 1) {
    throw new Error(`minimumReachableRatio must be in [0, 1], got ${config.minimumReachableRatio}`);
  }
  if (config.wallDensity < 0 || config.wallDensity >= 1) {
    throw new Error(`wallDensity must be in [0, 1), got ${config.wallDensity}`);
  }
  if (config.obstacleDensity < 0 || config.obstacleDensity >= 1) {
    throw new Error(`obstacleDensity must be in [0, 1), got ${config.obstacleDensity}`);
  }
  if (config.liquidDensity < 0 || config.liquidDensity >= 1) {
    throw new Error(`liquidDensity must be in [0, 1), got ${config.liquidDensity}`);
  }
  if (config.decorationDensity < 0 || config.decorationDensity >= 1) {
    throw new Error(`decorationDensity must be in [0, 1), got ${config.decorationDensity}`);
  }
  if (config.maxGenerationAttempts < 1 || !Number.isInteger(config.maxGenerationAttempts)) {
    throw new Error(`maxGenerationAttempts must be a positive integer, got ${config.maxGenerationAttempts}`);
  }
  if (config.maxGenerationTimeMs < 1) {
    throw new Error(`maxGenerationTimeMs must be > 0, got ${config.maxGenerationTimeMs}`);
  }
}
