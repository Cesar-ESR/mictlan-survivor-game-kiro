export interface RealmInfo {
  order: number;
  title: string;      // ej: "NOVENO NIVEL"
  name: string;       // ej: "Chiconahuapan"
  background: string; // key del asset de fondo
}

export interface GuideInfo {
  name: string;       // "Xólotl"
  portrait: string;   // key del splash art
}

export interface DialogLine {
  speaker: string;
  text: string;
}

export interface CultureInfo {
  title: string;
  description: string;
}

export interface RealmTransition {
  id: number;
  isIntroduction: boolean;
  triggerLevel: number;
  realm: RealmInfo;
  guide: GuideInfo;
  dialog: DialogLine[];
  culture: CultureInfo;
}

export interface LevelProgressData {
  transitions: RealmTransition[];
}

export interface RealmTransitionSceneData {
  transition: RealmTransition;
  levelUpResult: { leveledUp: boolean; showPanel: boolean; newLevel: number };
}
