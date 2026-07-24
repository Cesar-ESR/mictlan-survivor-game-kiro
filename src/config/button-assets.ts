/**
 * Registro centralizado de assets modulares para botones (PixelButton).
 * Única fuente de verdad para texture keys, rutas y estados del botón.
 *
 * El botón se construye con 5 piezas modulares:
 * - leftEdge: borde izquierdo
 * - leftFill: relleno izquierdo (repetible)
 * - center: pieza central
 * - rightFill: relleno derecho (repetible)
 * - rightEdge: borde derecho
 *
 * Cada pieza existe en 3 estados: normal, hover, pressed.
 */

export type ButtonState = 'normal' | 'hover' | 'pressed';

export interface ButtonPieceConfig {
  key: string;
  path: string;
}

export interface ButtonPieceStates {
  normal: ButtonPieceConfig;
  hover: ButtonPieceConfig;
  pressed: ButtonPieceConfig;
}

export interface ButtonAssetsDefinition {
  leftEdge: ButtonPieceStates;
  leftFill: ButtonPieceStates;
  center: ButtonPieceStates;
  rightFill: ButtonPieceStates;
  rightEdge: ButtonPieceStates;
}

const BASE_PATH = 'src/assets/ButtonsParts';

export const BUTTON_ASSETS: ButtonAssetsDefinition = {
  leftEdge: {
    normal: { key: 'btn_left_edge_normal', path: `${BASE_PATH}/ButtonLeftSideP1Normal.png` },
    hover: { key: 'btn_left_edge_hover', path: `${BASE_PATH}/ButtonLeftSideP1Hover.png` },
    pressed: { key: 'btn_left_edge_pressed', path: `${BASE_PATH}/ButtonLeftSideP1Pressed.png` },
  },
  leftFill: {
    normal: { key: 'btn_left_fill_normal', path: `${BASE_PATH}/ButtonMiddleLeftSideP2Normal.png` },
    hover: { key: 'btn_left_fill_hover', path: `${BASE_PATH}/ButtonMiddleLeftSideP2Hover.png` },
    pressed: { key: 'btn_left_fill_pressed', path: `${BASE_PATH}/ButtonMiddleLeftSideP2Pressed.png` },
  },
  center: {
    normal: { key: 'btn_center_normal', path: `${BASE_PATH}/ButtonCenterSideNormal.png` },
    hover: { key: 'btn_center_hover', path: `${BASE_PATH}/ButtonCenterSideHover.png` },
    pressed: { key: 'btn_center_pressed', path: `${BASE_PATH}/ButtonCenterSidePressed.png` },
  },
  rightFill: {
    normal: { key: 'btn_right_fill_normal', path: `${BASE_PATH}/ButtonRightSideP1Normal.png` },
    hover: { key: 'btn_right_fill_hover', path: `${BASE_PATH}/ButtonRightSideP1Hover.png` },
    pressed: { key: 'btn_right_fill_pressed', path: `${BASE_PATH}/ButtonRightSideP1Pressed.png` },
  },
  rightEdge: {
    normal: { key: 'btn_right_edge_normal', path: `${BASE_PATH}/ButtonRightSideNormal.png` },
    hover: { key: 'btn_right_edge_hover', path: `${BASE_PATH}/ButtonRightSideHover.png` },
    pressed: { key: 'btn_right_edge_pressed', path: `${BASE_PATH}/ButtonRightSidePressed.png` },
  },
};

/**
 * Carga todos los assets de piezas de botón.
 * Llamar desde BootScene.preload().
 */
export function loadButtonAssets(loader: Phaser.Loader.LoaderPlugin): void {
  const pieces: ButtonPieceStates[] = [
    BUTTON_ASSETS.leftEdge,
    BUTTON_ASSETS.leftFill,
    BUTTON_ASSETS.center,
    BUTTON_ASSETS.rightFill,
    BUTTON_ASSETS.rightEdge,
  ];

  for (const piece of pieces) {
    loader.image(piece.normal.key, piece.normal.path);
    loader.image(piece.hover.key, piece.hover.path);
    loader.image(piece.pressed.key, piece.pressed.path);
  }
}
