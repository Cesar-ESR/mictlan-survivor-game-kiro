/**
 * TileCatalog: Centraliza la clasificación y acceso a todos los tiles de los
 * 5 tilesets del proyecto. Evita que GameScene o MapGenerator contengan frame
 * numbers dispersos.
 *
 * Requirements: 10.14, Property 30
 */

// ─── Tipos base ───

/** Clave normalizada para identificar cada tileset. */
export type TilesetKey = 'ground' | 'borders' | 'liquids' | 'walls' | 'decorations';

/** Referencia a un tile individual: tileset + índice de frame dentro del spritesheet. */
export interface TileReference {
  tileset: TilesetKey;
  frame: number;
}

/** Nombre normalizado de cada capa del mapa. */
export type MapLayerName = 'ground' | 'liquids' | 'borders' | 'walls' | 'obstacles' | 'decorations';

/**
 * Categorías en las que se clasifica cada frame de los tilesets.
 * Cada frame pertenece a exactamente una categoría.
 */
export interface TileCatalogDefinition {
  groundBase: TileReference[];
  groundVariations: TileReference[];
  liquidCenters: TileReference[];
  liquidEdges: TileReference[];
  borders: TileReference[];
  wallTops: TileReference[];
  wallSides: TileReference[];
  wallCorners: TileReference[];
  cliffs: TileReference[];
  obstacles: TileReference[];
  decorations: TileReference[];
  emptyOrTransparent: TileReference[];
}

/** Tipo para las claves de categoría del catálogo. */
export type TileCategoryKey = keyof TileCatalogDefinition;

/** Información de debug para un frame individual. */
export interface DebugTileInfo {
  tileset: TilesetKey;
  frame: number;
  category: TileCategoryKey;
  description?: string;
}

// ─── Metadatos de tilesets ───

/** Metadatos de dimensiones para cada tileset. */
export interface TilesetMetadata {
  key: TilesetKey;
  /** Clave usada al registrar el spritesheet en Phaser. */
  phaserKey: string;
  /** Ruta del asset (import path relativo a src/assets). */
  assetPath: string;
  /** Nombre original del archivo PNG. */
  fileName: string;
  /** Ancho total del spritesheet en píxeles. */
  width: number;
  /** Alto total del spritesheet en píxeles. */
  height: number;
  /** Tamaño de cada frame en píxeles (siempre 32). */
  tileSize: number;
  /** Columnas en la cuadrícula de frames. */
  columns: number;
  /** Filas en la cuadrícula de frames. */
  rows: number;
  /** Número total de frames. */
  totalFrames: number;
}

// ─── Categorías permitidas por capa ───

const PERMITTED_CATEGORIES: Record<MapLayerName, TileCategoryKey[]> = {
  ground: ['groundBase', 'groundVariations'],
  liquids: ['liquidCenters', 'liquidEdges'],
  borders: ['borders'],
  walls: ['wallTops', 'wallSides', 'wallCorners', 'cliffs'],
  obstacles: ['obstacles'],
  decorations: ['decorations'],
};

// ─── Resultado de validación ───

export interface CatalogValidationError {
  code:
    | 'EMPTY_IN_USABLE_CATEGORY'
    | 'DUAL_CLASSIFICATION'
    | 'FRAME_OUT_OF_RANGE'
    | 'MISSING_TILESET_FIELD'
    | 'UNKNOWN_TILESET'
    | 'GROUND_USES_EMPTY';
  message: string;
  tileset?: TilesetKey;
  frame?: number;
  category?: TileCategoryKey;
}

export interface CatalogValidationResult {
  valid: boolean;
  errors: CatalogValidationError[];
}

// ─── Clase TileCatalog ───

export class TileCatalog {
  private catalog: TileCatalogDefinition;

  constructor(definition: TileCatalogDefinition) {
    this.catalog = definition;
  }

  /** Obtiene tiles válidos para la capa Ground (groundBase + groundVariations). */
  getGroundTiles(): TileReference[] {
    return [...this.catalog.groundBase, ...this.catalog.groundVariations];
  }

  /** Obtiene tiles por categoría. */
  getByCategory(category: TileCategoryKey): TileReference[] {
    return this.catalog[category];
  }

  /** Valida que un TileReference pertenezca a una categoría permitida para la capa. */
  isPermittedForLayer(ref: TileReference, layer: MapLayerName): boolean {
    const permitted = PERMITTED_CATEGORIES[layer];
    return permitted.some((cat) => {
      return this.catalog[cat].some(
        (t) => t.tileset === ref.tileset && t.frame === ref.frame,
      );
    });
  }

  /** Verifica que un tile NO sea emptyOrTransparent y SÍ sea Ground válido. */
  isValidGroundTile(ref: TileReference): boolean {
    const isTransparent = this.catalog.emptyOrTransparent.some(
      (t) => t.tileset === ref.tileset && t.frame === ref.frame,
    );
    if (isTransparent) return false;

    const groundTiles = this.getGroundTiles();
    return groundTiles.some(
      (t) => t.tileset === ref.tileset && t.frame === ref.frame,
    );
  }

  /** Retorna todas las categorías permitidas para una capa. */
  getPermittedCategories(layer: MapLayerName): TileCategoryKey[] {
    return PERMITTED_CATEGORIES[layer];
  }

  /**
   * Modo debug: genera lista de todos los frames clasificados con su índice,
   * tileset y categoría para validación visual.
   */
  debugListAllFrames(): DebugTileInfo[] {
    const result: DebugTileInfo[] = [];
    const categories = Object.keys(this.catalog) as TileCategoryKey[];

    for (const category of categories) {
      for (const ref of this.catalog[category]) {
        result.push({
          tileset: ref.tileset,
          frame: ref.frame,
          category,
        });
      }
    }

    return result;
  }

  /** Retorna la definición completa del catálogo. */
  getDefinition(): TileCatalogDefinition {
    return this.catalog;
  }

  /**
   * Valida la integridad del catálogo. Comprueba:
   * 1. Ningún frame emptyOrTransparent aparece en una categoría utilizable.
   * 2. Ningún frame aparece como válido y vacío simultáneamente.
   * 3. Todos los índices de frame están dentro del rango real de su tileset.
   * 4. Todas las referencias incluyen tileset y frame.
   * 5. Ground nunca utiliza frames emptyOrTransparent.
   * 6. Las claves de tileset existen en el metadata proporcionado.
   *
   * @param tilesetMetadata Mapa de TilesetKey → totalFrames para validar rangos
   */
  validate(tilesetMetadata: Record<TilesetKey, { totalFrames: number }>): CatalogValidationResult {
    const errors: CatalogValidationError[] = [];
    const validTilesets: TilesetKey[] = ['ground', 'borders', 'liquids', 'walls', 'decorations'];

    // Construir set de frames emptyOrTransparent para búsqueda rápida
    const emptySet = new Set(
      this.catalog.emptyOrTransparent.map((r) => `${r.tileset}:${r.frame}`),
    );

    // Categorías "usables" (todo excepto emptyOrTransparent)
    const usableCategories = (Object.keys(this.catalog) as TileCategoryKey[]).filter(
      (k) => k !== 'emptyOrTransparent',
    );

    for (const category of usableCategories) {
      for (const ref of this.catalog[category]) {
        // Check 4: Todas las referencias incluyen tileset y frame
        if (ref.tileset === undefined || ref.tileset === null || ref.frame === undefined || ref.frame === null) {
          errors.push({
            code: 'MISSING_TILESET_FIELD',
            message: `Reference in "${category}" is missing tileset or frame field`,
            category,
          });
          continue;
        }

        // Check 6: Clave de tileset válida
        if (!validTilesets.includes(ref.tileset)) {
          errors.push({
            code: 'UNKNOWN_TILESET',
            message: `Unknown tileset "${ref.tileset}" in category "${category}"`,
            tileset: ref.tileset,
            frame: ref.frame,
            category,
          });
          continue;
        }

        // Check 3: Frame dentro del rango real del tileset
        const meta = tilesetMetadata[ref.tileset];
        if (ref.frame < 0 || ref.frame >= meta.totalFrames) {
          errors.push({
            code: 'FRAME_OUT_OF_RANGE',
            message: `Frame ${ref.frame} is out of range [0, ${meta.totalFrames - 1}] for tileset "${ref.tileset}" in category "${category}"`,
            tileset: ref.tileset,
            frame: ref.frame,
            category,
          });
        }

        // Check 1 & 2: Frame no debe ser emptyOrTransparent si está en categoría usable
        const key = `${ref.tileset}:${ref.frame}`;
        if (emptySet.has(key)) {
          errors.push({
            code: 'EMPTY_IN_USABLE_CATEGORY',
            message: `Frame ${ref.frame} of tileset "${ref.tileset}" is classified as emptyOrTransparent but also appears in category "${category}"`,
            tileset: ref.tileset,
            frame: ref.frame,
            category,
          });
        }
      }
    }

    // Check 5: Ground categories must not include emptyOrTransparent frames
    const groundCategories: TileCategoryKey[] = ['groundBase', 'groundVariations'];
    for (const cat of groundCategories) {
      for (const ref of this.catalog[cat]) {
        const key = `${ref.tileset}:${ref.frame}`;
        if (emptySet.has(key)) {
          errors.push({
            code: 'GROUND_USES_EMPTY',
            message: `Ground category "${cat}" contains empty/transparent frame ${ref.frame} of tileset "${ref.tileset}"`,
            tileset: ref.tileset,
            frame: ref.frame,
            category: cat,
          });
        }
      }
    }

    // Validate emptyOrTransparent entries themselves for range
    for (const ref of this.catalog.emptyOrTransparent) {
      if (ref.tileset === undefined || ref.frame === undefined) continue;
      if (!validTilesets.includes(ref.tileset)) continue;
      const meta = tilesetMetadata[ref.tileset];
      if (ref.frame < 0 || ref.frame >= meta.totalFrames) {
        errors.push({
          code: 'FRAME_OUT_OF_RANGE',
          message: `Empty frame ${ref.frame} is out of range [0, ${meta.totalFrames - 1}] for tileset "${ref.tileset}"`,
          tileset: ref.tileset,
          frame: ref.frame,
          category: 'emptyOrTransparent',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Indica si la clasificación semántica es provisional.
   * Los sistemas posteriores deben tener en cuenta que la clasificación
   * interna de frames válidos (groundBase vs groundVariations, wallTops vs
   * wallCorners, etc.) puede cambiar tras refinamiento visual.
   * Solo los rangos vacíos/válidos están confirmados.
   */
  isSemanticClassificationProvisional(): boolean {
    return true;
  }
}
