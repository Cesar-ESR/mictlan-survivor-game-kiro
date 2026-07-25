/**
 * BlessingManager: Almacena la selección de bendiciones del jugador.
 *
 * Responsabilidades:
 * - Guardar la bendición principal y secundaria elegida.
 * - Exponer la información necesaria para el futuro HUD (medallas, niveles).
 * - No implementa efectos, mejoras ni escalado por nivel.
 *
 * Sigue el patrón singleton del proyecto (ver AudioManager).
 */

export interface BlessingSelection {
  /** ID de la ruta elegida (e.g. "mictlantecuhtli") */
  choiceId: string;
  primary: {
    id: string;
    name: string;
    badge: string;
    level: number;
    maxLevel: number;
  };
  secondary: {
    id: string;
    name: string;
    badge: string;
    level: number;
    maxLevel: number;
  };
}

export class BlessingManager {
  private static instance: BlessingManager | null = null;
  private selection: BlessingSelection | null = null;

  private constructor() {}

  static getInstance(): BlessingManager {
    if (!BlessingManager.instance) {
      BlessingManager.instance = new BlessingManager();
    }
    return BlessingManager.instance;
  }

  /** Registra la selección realizada por el jugador. */
  setSelection(selection: BlessingSelection): void {
    this.selection = selection;
  }

  /** Obtiene la selección actual (null si no se ha elegido). */
  getSelection(): BlessingSelection | null {
    return this.selection;
  }

  /** Resetea la selección (útil para reinicio de partida). */
  clear(): void {
    this.selection = null;
  }
}
