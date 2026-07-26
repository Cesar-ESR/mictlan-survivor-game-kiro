import type { RealmTransition, LevelProgressData } from './realm-transition-types';

export class RealmTransitionDataLoader {
  private transitionMap: Map<number, RealmTransition> = new Map();

  constructor(cache: Phaser.Cache.CacheManager) {
    const data = cache.json.get('LevelProgressText') as LevelProgressData | undefined;
    if (data?.transitions) {
      for (const t of data.transitions) {
        this.transitionMap.set(t.triggerLevel, t);
      }
    }
  }

  getTransitionForLevel(level: number): RealmTransition | null {
    return this.transitionMap.get(level) ?? null;
  }
}
