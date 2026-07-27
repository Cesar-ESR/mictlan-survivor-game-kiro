/**
 * Configuración centralizada de tipografía del juego.
 * Utiliza Pixel Operator como fuente principal en toda la UI.
 *
 * La fuente se carga vía @font-face en index.html desde:
 * src/assets/Fonts/pixel-operator/PixelOperator.ttf
 */

/** Nombre de la fuente principal del juego. */
export const GAME_FONT_FAMILY = 'PixelOperator';

/** Estilos base reutilizables para textos de UI. */
export const FONT_STYLES = {
  /** Título principal del menú */
  title: {
    fontFamily: GAME_FONT_FAMILY,
    fontSize: '42px',
    color: '#ffdd00',
    fontStyle: 'bold',
  },
  /** Subtítulo del menú */
  subtitle: {
    fontFamily: GAME_FONT_FAMILY,
    fontSize: '20px',
    color: '#eed8adff',
  },
  /** Texto de botones */
  button: {
    fontFamily: GAME_FONT_FAMILY,
    fontSize: '18px',
    color: '#ffffff',
    fontStyle: 'bold',
  },
  /** Descripciones bajo botones */
  description: {
    fontFamily: GAME_FONT_FAMILY,
    fontSize: '14px',
    color: '#bfc0b8ff',
  },
  /** Encabezados grandes (victoria, derrota, anuncios) */
  heading: {
    fontFamily: GAME_FONT_FAMILY,
    fontSize: '48px',
    fontStyle: 'bold',
  },
  /** Texto estándar de HUD */
  hud: {
    fontFamily: GAME_FONT_FAMILY,
    fontSize: '14px',
    color: '#ffffff',
  },
  /** Texto de HUD destacado */
  hudHighlight: {
    fontFamily: GAME_FONT_FAMILY,
    fontSize: '16px',
    color: '#ffff44',
  },
  /** Texto genérico mediano */
  body: {
    fontFamily: GAME_FONT_FAMILY,
    fontSize: '22px',
    color: '#ffffff',
  },
  /** Texto de botones de acción (reintentar, volver) */
  actionButton: {
    fontFamily: GAME_FONT_FAMILY,
    fontSize: '24px',
    color: '#ffffff',
    backgroundColor: '#444444',
    padding: { x: 24, y: 12 },
  },
} as const;
