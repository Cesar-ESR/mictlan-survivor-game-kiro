import type { Upgrade, PlayerState } from '../types/interfaces.js';

/**
 * Pool inicial de mejoras disponibles durante el juego.
 * Cada mejora aplica una transformación pura sobre PlayerState.
 */
export const INITIAL_UPGRADE_POOL: Upgrade[] = [
  {
    id: 'speed_boost_1',
    name: 'Velocidad del Jaguar',
    description: 'Aumenta la velocidad de movimiento en 20 px/s.',
    apply: (state: PlayerState): PlayerState => ({
      ...state,
      speed: state.speed + 20,
    }),
  },
  {
    id: 'max_hp_1',
    name: 'Corazón de Obsidiana',
    description: 'Aumenta los puntos de vida máximos en 20.',
    apply: (state: PlayerState): PlayerState => ({
      ...state,
      maxHp: state.maxHp + 20,
      hp: state.hp + 20,
    }),
  },
  {
    id: 'weapon_damage_1',
    name: 'Filo de Pedernal',
    description: 'Aumenta el daño del arma en 5.',
    apply: (state: PlayerState): PlayerState => ({
      ...state,
      weapon: { ...state.weapon, damage: state.weapon.damage + 5 },
    }),
  },
  {
    id: 'fire_rate_1',
    name: 'Cadencia del Colibrí',
    description: 'Reduce el intervalo de disparo en 100ms.',
    apply: (state: PlayerState): PlayerState => ({
      ...state,
      weapon: { ...state.weapon, fireRate: Math.max(state.weapon.fireRate - 100, 200) },
    }),
  },
  {
    id: 'weapon_range_1',
    name: 'Alcance del Águila',
    description: 'Aumenta el rango del arma en 100px.',
    apply: (state: PlayerState): PlayerState => ({
      ...state,
      weapon: { ...state.weapon, range: state.weapon.range + 100 },
    }),
  },
  {
    id: 'speed_boost_2',
    name: 'Viento de Ehecatl',
    description: 'Aumenta la velocidad de movimiento en 30 px/s.',
    apply: (state: PlayerState): PlayerState => ({
      ...state,
      speed: state.speed + 30,
    }),
  },
  {
    id: 'max_hp_2',
    name: 'Escudo de Jade',
    description: 'Aumenta los puntos de vida máximos en 30.',
    apply: (state: PlayerState): PlayerState => ({
      ...state,
      maxHp: state.maxHp + 30,
      hp: state.hp + 30,
    }),
  },
  {
    id: 'weapon_damage_2',
    name: 'Garras de Ocelotl',
    description: 'Aumenta el daño del arma en 8.',
    apply: (state: PlayerState): PlayerState => ({
      ...state,
      weapon: { ...state.weapon, damage: state.weapon.damage + 8 },
    }),
  },
  {
    id: 'fire_rate_2',
    name: 'Furia de Tlaloc',
    description: 'Reduce el intervalo de disparo en 150ms.',
    apply: (state: PlayerState): PlayerState => ({
      ...state,
      weapon: { ...state.weapon, fireRate: Math.max(state.weapon.fireRate - 150, 200) },
    }),
  },
  {
    id: 'projectile_speed_1',
    name: 'Rayo de Quetzalcóatl',
    description: 'Aumenta la velocidad del proyectil en 100 px/s.',
    apply: (state: PlayerState): PlayerState => ({
      ...state,
      weapon: { ...state.weapon, projectileSpeed: state.weapon.projectileSpeed + 100 },
    }),
  },
  {
    id: 'weapon_range_2',
    name: 'Ojo de Tezcatlipoca',
    description: 'Aumenta el rango del arma en 150px.',
    apply: (state: PlayerState): PlayerState => ({
      ...state,
      weapon: { ...state.weapon, range: state.weapon.range + 150 },
    }),
  },
  {
    id: 'max_distance_1',
    name: 'Aliento de Mictlantecuhtli',
    description: 'Aumenta la distancia máxima del proyectil en 200px.',
    apply: (state: PlayerState): PlayerState => ({
      ...state,
      weapon: { ...state.weapon, maxDistance: state.weapon.maxDistance + 200 },
    }),
  },
];
