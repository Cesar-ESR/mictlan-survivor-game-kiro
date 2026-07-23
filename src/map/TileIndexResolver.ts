/**
 * TileIndexResolver: Conversión centralizada de TileReference → índice de tile
 * para uso en Phaser Tilemap layers.
 *
 * Para blank tilemaps con un solo tileset por capa, el índice es simplemente
 * el frame number (0-based). Este resolver valida los rangos y la correspondencia
 * tileset↔layer.
 *
 * Requirements: 10.2, 10.14, Property 30
 */

import type { TileReference, TilesetKey, MapLayerName } from './TileCatalog';
import { CONFIRMED_VALID_RANGES } from '../config/tile-catalog-data';

// ─── Mapeo layer → tileset(s) permitidos ───

const LAYER_TILESET_MAP: Record<MapLayerName, TilesetKey[]> = {
  ground: ['ground'],
  liquids: ['liquids'],
  borders: ['borders'],
  walls: ['walls'],
  obstacles: ['walls'], // obstacles use frames from the walls tileset
  decorations: ['decorations'],
};

// ─── Clase TileIndexResolver ───

export class TileIndexResolver {
  /**
   * Resuelve un TileReference a su índice numérico para putTileAt.
   * Para capas con un solo tileset, index = frame directamente.
   *
   * @param ref Referencia al tile (tileset + frame)
   * @returns Índice numérico (0-based) para usar en putTileAt
   * @throws Error si el frame está fuera de rango válido
   */
  resolve(ref: TileReference): number {
    const validRange = CONFIRMED_VALID_RANGES[ref.tileset];
    if (ref.frame < validRange.from || ref.frame > validRange.to) {
      throw new Error(
        `TileIndexResolver: frame ${ref.frame} is out of valid range ` +
        `[${validRange.from}, ${validRange.to}] for tileset "${ref.tileset}"`,
      );
    }
    return ref.frame;
  }

  /**
   * Valida que un TileReference sea adecuado para la capa indicada.
   * Verifica que:
   * 1. El tileset corresponda a la capa.
   * 2. El frame esté en rango válido.
   *
   * @throws Error si la referencia no es válida para la capa
   */
  validateForLayer(ref: TileReference, layerName: MapLayerName): void {
    const permittedTilesets = LAYER_TILESET_MAP[layerName];
    if (!permittedTilesets.includes(ref.tileset)) {
      throw new Error(
        `TileIndexResolver: tileset "${ref.tileset}" is not permitted for layer "${layerName}". ` +
        `Permitted: [${permittedTilesets.join(', ')}]`,
      );
    }

    const validRange = CONFIRMED_VALID_RANGES[ref.tileset];
    if (ref.frame < validRange.from || ref.frame > validRange.to) {
      throw new Error(
        `TileIndexResolver: frame ${ref.frame} is out of valid range ` +
        `[${validRange.from}, ${validRange.to}] for tileset "${ref.tileset}" on layer "${layerName}"`,
      );
    }
  }
}
