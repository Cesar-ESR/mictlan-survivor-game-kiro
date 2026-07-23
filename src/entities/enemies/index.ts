import type { EnemyRegistry } from '../../systems/EnemyRegistry';
import { Esqueleto } from './Esqueleto';
import { Murcielago } from './Murcielago';
import { CalaveraLlameante } from './CalaveraLlameante';
import { SerpienteEmplumada } from './SerpienteEmplumada';

export { Esqueleto } from './Esqueleto';
export { Murcielago } from './Murcielago';
export { CalaveraLlameante } from './CalaveraLlameante';
export { SerpienteEmplumada } from './SerpienteEmplumada';

/**
 * Register all 4 enemy archetypes in the given EnemyRegistry.
 * Factories apply hpMultiplier and speedMultiplier from EnemySpawnConfig.
 */
export function registerEnemyTypes(registry: EnemyRegistry): void {
  registry.register('esqueleto', (scene, x, y, config) => {
    return new Esqueleto(scene, x, y, config);
  });

  registry.register('murcielago', (scene, x, y, config) => {
    return new Murcielago(scene, x, y, config);
  });

  registry.register('calavera_llameante', (scene, x, y, config) => {
    return new CalaveraLlameante(scene, x, y, config);
  });

  registry.register('serpiente_emplumada', (scene, x, y, config) => {
    return new SerpienteEmplumada(scene, x, y, config);
  });
}
