/**
 * Estadísticas de la partida en curso.
 * Usadas para las pantallas de Derrota y Victoria.
 *
 * Requirements: 4.5, 6.4
 */
export interface GameStats {
  /** Tiempo de supervivencia en segundos, acumulado via delta. */
  survivalTime: number;
  /** Cantidad de enemigos derrotados. */
  enemiesDefeated: number;
  /** Oleada máxima alcanzada. */
  maxWave: number;
}
