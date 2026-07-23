/**
 * tile-catalog-data.ts
 *
 * Registro centralizado de rutas, dimensiones y clasificación de frames
 * para los 5 tilesets del proyecto.
 *
 * Requirements: 10.14
 *
 * RANGOS CONFIRMADOS VISUALMENTE (TileDebugScene):
 * - ground:      válidos 0–42, vacíos 43–47
 * - borders:     válidos 0–15, vacíos ninguno
 * - liquids:     válidos 0–44, vacíos 45–47
 * - walls:       válidos 0–34, vacíos 35–47
 * - decorations: válidos 0–51, vacíos 52–255
 *
 * NOTA: La clasificación SEMÁNTICA interna de los frames válidos
 * (qué frame es groundBase vs groundVariations, wallTops vs wallCorners, etc.)
 * sigue siendo PROVISIONAL. Solo los rangos vacíos/válidos están confirmados.
 */

import type { TilesetMetadata, TileCatalogDefinition, TileReference, TilesetKey } from '../map/TileCatalog';

// ─── Rutas de assets (imports relativos para Vite) ───
import groundImg from '../assets/EscenariosBackgrounds/michlan_tiled_ground.png';
import bordersImg from '../assets/EscenariosBackgrounds/michlan_tiled_borders.png';
import liquidsImg from '../assets/EscenariosBackgrounds/michlan_tiled_liquids.png';
import wallsImg from '../assets/EscenariosBackgrounds/michlan_tiled_walls_cliff.png';
import decorationsImg from '../assets/EscenariosBackgrounds/Mictlan_decoration.png';

// ─── Constantes ───
export const TILE_SIZE = 32;

// ─── Metadatos de cada tileset ───

export const TILESET_METADATA: TilesetMetadata[] = [
  {
    key: 'ground',
    phaserKey: 'tileset_ground',
    assetPath: groundImg,
    fileName: 'michlan_tiled_ground.png',
    width: 512,
    height: 96,
    tileSize: TILE_SIZE,
    columns: 16,
    rows: 3,
    totalFrames: 48,
  },
  {
    key: 'borders',
    phaserKey: 'tileset_borders',
    assetPath: bordersImg,
    fileName: 'michlan_tiled_borders.png',
    width: 512,
    height: 32,
    tileSize: TILE_SIZE,
    columns: 16,
    rows: 1,
    totalFrames: 16,
  },
  {
    key: 'liquids',
    phaserKey: 'tileset_liquids',
    assetPath: liquidsImg,
    fileName: 'michlan_tiled_liquids.png',
    width: 512,
    height: 96,
    tileSize: TILE_SIZE,
    columns: 16,
    rows: 3,
    totalFrames: 48,
  },
  {
    key: 'walls',
    phaserKey: 'tileset_walls',
    assetPath: wallsImg,
    fileName: 'michlan_tiled_walls_cliff.png',
    width: 512,
    height: 96,
    tileSize: TILE_SIZE,
    columns: 16,
    rows: 3,
    totalFrames: 48,
  },
  {
    key: 'decorations',
    phaserKey: 'tileset_decorations',
    assetPath: decorationsImg,
    fileName: 'Mictlan_decoration.png',
    width: 512,
    height: 512,
    tileSize: TILE_SIZE,
    columns: 16,
    rows: 16,
    totalFrames: 256,
  },
];

/** Mapa de acceso rápido por TilesetKey. */
export const TILESET_BY_KEY: Record<TilesetKey, TilesetMetadata> = {
  ground: TILESET_METADATA[0],
  borders: TILESET_METADATA[1],
  liquids: TILESET_METADATA[2],
  walls: TILESET_METADATA[3],
  decorations: TILESET_METADATA[4],
};

// ─── Helpers para generar rangos de TileReference ───

function range(tileset: TilesetKey, from: number, to: number): TileReference[] {
  const refs: TileReference[] = [];
  for (let i = from; i <= to; i++) {
    refs.push({ tileset, frame: i });
  }
  return refs;
}

// ─── Rangos confirmados visualmente (TileDebugScene) ───
//
// Estos rangos determinan qué frames son utilizables vs vacíos/transparentes.
// La inspección visual confirmó los siguientes límites:

/** Frames válidos confirmados por tileset. */
export const CONFIRMED_VALID_RANGES: Record<TilesetKey, { from: number; to: number }> = {
  ground: { from: 0, to: 42 },
  borders: { from: 0, to: 15 },
  liquids: { from: 0, to: 44 },
  walls: { from: 0, to: 34 },
  decorations: { from: 0, to: 51 },
};

/** Frames vacíos/transparentes confirmados por tileset. */
export const CONFIRMED_EMPTY_RANGES: Record<TilesetKey, { from: number; to: number } | null> = {
  ground: { from: 43, to: 47 },
  borders: null,  // ningún frame vacío
  liquids: { from: 45, to: 47 },
  walls: { from: 35, to: 47 },
  decorations: { from: 52, to: 255 },
};

// ─── Clasificación semántica de frames ───
//
// IMPORTANTE: La clasificación semántica interna (groundBase vs groundVariations,
// wallTops vs wallCorners, etc.) es PROVISIONAL.
// Solo los rangos válidos/vacíos están visualmente confirmados.
// Los sistemas posteriores NO deben asumir que la división interna es definitiva.
//
// Convención de frames: índice 0 = esquina superior-izquierda,
// recorre de izquierda a derecha, fila por fila.

/**
 * GROUND TILESET (43 frames válidos: 0–42)
 * Clasificación semántica PROVISIONAL.
 * Se asigna la primera fila (0–15) como groundBase y el resto como variaciones.
 */
const groundBase: TileReference[] = range('ground', 0, 15);
const groundVariations: TileReference[] = range('ground', 16, 42);

/**
 * BORDERS TILESET (16 frames válidos: 0–15)
 * Clasificación semántica PROVISIONAL.
 * Todos los frames válidos se clasifican como borders.
 */
const borders: TileReference[] = range('borders', 0, 15);

/**
 * LIQUIDS TILESET (45 frames válidos: 0–44)
 * Clasificación semántica PROVISIONAL.
 * Primera fila como centers, resto como edges.
 */
const liquidCenters: TileReference[] = range('liquids', 0, 15);
const liquidEdges: TileReference[] = range('liquids', 16, 44);

/**
 * WALLS/CLIFF TILESET (35 frames válidos: 0–34)
 * Clasificación semántica PROVISIONAL.
 * División interna estimada; debe refinarse visualmente.
 */
const wallTops: TileReference[] = range('walls', 0, 7);
const wallSides: TileReference[] = range('walls', 8, 11);
const wallCorners: TileReference[] = range('walls', 12, 15);
const cliffs: TileReference[] = range('walls', 16, 26);
const obstacles: TileReference[] = range('walls', 27, 34);

/**
 * DECORATIONS TILESET (52 frames válidos: 0–51)
 * Clasificación semántica PROVISIONAL.
 * Todos los frames válidos se clasifican como decorations.
 */
const decorationTiles: TileReference[] = range('decorations', 0, 51);

/**
 * FRAMES VACÍOS O TRANSPARENTES — CONFIRMADOS VISUALMENTE
 * Estos frames NUNCA deben usarse en Ground ni en ninguna capa funcional.
 */
const emptyOrTransparent: TileReference[] = [
  ...range('ground', 43, 47),       // 5 frames
  ...range('liquids', 45, 47),      // 3 frames
  ...range('walls', 35, 47),        // 13 frames
  ...range('decorations', 52, 255), // 204 frames
];

// ─── Definición exportada del catálogo ───

export const TILE_CATALOG_DEFINITION: TileCatalogDefinition = {
  groundBase,
  groundVariations,
  liquidCenters,
  liquidEdges,
  borders,
  wallTops,
  wallSides,
  wallCorners,
  cliffs,
  obstacles,
  decorations: decorationTiles,
  emptyOrTransparent,
};

// Re-export helpers para uso externo
export { range as tileRange };
