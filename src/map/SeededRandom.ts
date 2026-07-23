/**
 * SeededRandom: Generador de números pseudo-aleatorios determinista.
 *
 * Usa el algoritmo mulberry32 para producir secuencias deterministas a partir
 * de una semilla. La misma semilla + misma secuencia de llamadas = mismos resultados.
 *
 * MapGenerator NUNCA debe usar Math.random(). Solo SeededRandom.
 *
 * Requirements: 10.13, Property 32
 */

export interface WeightedItem<T> {
  item: T;
  weight: number;
}

export class SeededRandom {
  private state: number;

  constructor(seed: string | number) {
    this.state = SeededRandom.normalizeSeed(seed);
    // Ensure state is never 0 (would produce constant output)
    if (this.state === 0) {
      this.state = 1;
    }
  }

  /**
   * Normaliza una semilla string o number a un entero de 32 bits.
   * Strings se convierten mediante un hash simple (djb2).
   */
  private static normalizeSeed(seed: string | number): number {
    if (typeof seed === 'number') {
      // Ensure it's a positive 32-bit integer
      return (seed >>> 0) || 1;
    }
    // djb2 hash for strings
    let hash = 5381;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) + hash + seed.charCodeAt(i)) >>> 0;
    }
    return hash || 1;
  }

  /**
   * Retorna float en [0, 1) — determinista.
   * Implementa mulberry32 PRNG.
   */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Retorna entero en [min, max] inclusive.
   * @throws Error si min > max
   */
  integer(min: number, max: number): number {
    if (min > max) {
      throw new Error(`SeededRandom.integer: min (${min}) must be <= max (${max})`);
    }
    const range = max - min + 1;
    return Math.floor(this.next() * range) + min;
  }

  /**
   * Selecciona un elemento aleatorio del array.
   * @throws Error si items está vacío
   */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('SeededRandom.pick: items array must not be empty');
    }
    const index = this.integer(0, items.length - 1);
    return items[index];
  }

  /**
   * Selecciona con peso — items con mayor weight tienen más probabilidad.
   * @throws Error si items está vacío o todos los weights son <= 0
   */
  weightedPick<T>(items: WeightedItem<T>[]): T {
    if (items.length === 0) {
      throw new Error('SeededRandom.weightedPick: items array must not be empty');
    }
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight <= 0) {
      throw new Error('SeededRandom.weightedPick: total weight must be > 0');
    }
    let roll = this.next() * totalWeight;
    for (const entry of items) {
      roll -= entry.weight;
      if (roll <= 0) {
        return entry.item;
      }
    }
    // Fallback (shouldn't reach due to float precision)
    return items[items.length - 1].item;
  }

  /**
   * Retorna boolean con probabilidad p ∈ [0, 1].
   */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /**
   * Shuffle determinista usando Fisher-Yates.
   * Retorna una NUEVA copia del array mezclado (no muta el original).
   */
  shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.integer(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
