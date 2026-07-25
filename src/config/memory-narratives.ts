import type { MemoryId } from './memory-upgrades';

// --- Narrative Types ---

export interface MemoryFragment {
  level: number;
  text: string;
}

export interface MemoryNarrative {
  title: string;
  fragments: readonly MemoryFragment[];
}

// --- Event Payload ---

export interface MemoryFragmentPayload {
  memoryId: MemoryId;
  title: string;
  fragmentNumber: number;
  totalFragments: 6;
  text: string;
}

// --- Fragment Unlock State ---

export type UnlockedMemoryFragments = Record<MemoryId, readonly number[]>;

export function createInitialUnlockedFragments(): UnlockedMemoryFragments {
  return {
    'memory-war': [],
    'memory-family': [],
    'memory-home': [],
  };
}

export function unlockFragment(
  state: UnlockedMemoryFragments,
  memoryId: MemoryId,
  level: number,
): boolean {
  if (level < 1 || level > 6) return false;
  const current = state[memoryId];
  if (current.includes(level)) return false;
  state[memoryId] = [...current, level];
  return true;
}

export function isFragmentUnlocked(
  state: UnlockedMemoryFragments,
  memoryId: MemoryId,
  level: number,
): boolean {
  return state[memoryId].includes(level);
}

export function getUnlockedFragments(
  state: UnlockedMemoryFragments,
  memoryId: MemoryId,
): readonly number[] {
  return state[memoryId];
}

// --- Narrative Data ---

const WAR_NARRATIVE: MemoryNarrative = {
  title: 'Recuerdo I — Ecos de la guerra',
  fragments: [
    { level: 1, text: 'Tambores… cada vez más cerca. Mis manos vuelven a sujetar el arma, aunque ya no tengo cuerpo.' },
    { level: 2, text: 'Veo máscaras de jaguar avanzando entre el humo. Conocía sus nombres… pero ya no puedo recordarlos.' },
    { level: 3, text: 'El metal golpea contra la piedra. Alguien grita que mantengamos la formación. ¿Era mi voz?' },
    { level: 4, text: 'Siento sangre caliente sobre mis brazos. No sé si era mía o de alguno de mis compañeros.' },
    { level: 5, text: 'Por un instante recuerdo el miedo bajo mi máscara. No temía morir… temía no regresar con ellos.' },
    { level: 6, text: 'El cielo gira sobre mí. Los tambores se apagan y una pregunta permanece: ¿mi sacrificio protegió a alguien?' },
  ],
};

const FAMILY_NARRATIVE: MemoryNarrative = {
  title: 'Recuerdo II — Voces junto al fuego',
  fragments: [
    { level: 1, text: 'Escucho una risa pequeña. Dos niños corren hacia mí, pero sus rostros desaparecen cuando intento mirarlos.' },
    { level: 2, text: 'El fuego ilumina unas manos preparando alimento. Conozco esas manos… alguna vez las sostuve entre las mías.' },
    { level: 3, text: 'Una voz me pide que me siente junto a ellos. Por un momento, el peso de la guerra desaparece de mis hombros.' },
    { level: 4, text: 'Mi compañera acomoda mi máscara antes de una batalla. Sus labios se mueven: “Regresa conmigo”.' },
    { level: 5, text: 'Recuerdo haber prometido que volvería. Lo dije sonriendo, como si la muerte nunca pudiera encontrarme.' },
    { level: 6, text: 'Sus rostros se desvanecen entre las llamas. Extiendo la mano, pero solo alcanzo a escuchar: “Te esperamos”.' },
  ],
};

const HOME_NARRATIVE: MemoryNarrative = {
  title: 'Recuerdo III — El camino a casa',
  fragments: [
    { level: 1, text: 'Un sendero de tierra aparece ante mí. Mis pies conocen el camino, aunque mi mente aún no lo ha olvidado.' },
    { level: 2, text: 'El viento mueve el maíz y trae consigo el aroma de las flores. Aquí… aquí podía descansar.' },
    { level: 3, text: 'Veo una pequeña casa bajo la luz del amanecer. Una sombra oscura espera junto a la entrada.' },
    { level: 4, text: 'Un xoloitzcuintle corre hacia mí. Sus patas levantan polvo y su cola se mueve al reconocerme.' },
    { level: 5, text: 'Recuerdo acariciar su cabeza antes de partir. Le pedí que protegiera el hogar hasta que yo regresara.' },
    { level: 6, text: 'Ahora camina conmigo por el Mictlán. Tal vez nunca dejó de esperarme… tal vez vino para llevarme finalmente a casa.' },
  ],
};

const NARRATIVES: Readonly<Record<MemoryId, MemoryNarrative>> = {
  'memory-war': WAR_NARRATIVE,
  'memory-family': FAMILY_NARRATIVE,
  'memory-home': HOME_NARRATIVE,
};

/**
 * Returns the narrative configuration for a given memory.
 */
export function getMemoryNarrative(memoryId: MemoryId): MemoryNarrative {
  return NARRATIVES[memoryId];
}

/**
 * Returns the fragment for a given memory at a given level.
 * Returns null if level is out of range or no content exists for that level.
 * Does NOT mutate the memory.
 */
export function getMemoryFragment(
  memoryId: MemoryId,
  level: number,
): MemoryFragment | null {
  if (level < 1 || level > 6) return null;
  const narrative = NARRATIVES[memoryId];
  if (!narrative || narrative.fragments.length === 0) return null;
  const fragment = narrative.fragments.find((f) => f.level === level);
  return fragment ?? null;
}

/**
 * Checks whether a memory has narrative content available.
 */
export function hasNarrativeContent(memoryId: MemoryId): boolean {
  const narrative = NARRATIVES[memoryId];
  return narrative !== undefined && narrative.fragments.length > 0;
}
