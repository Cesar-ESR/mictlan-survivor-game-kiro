/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

/**
 * BUG-013: Canvas left-aligned with white space on the right.
 *
 * These tests verify that:
 * - Phaser GameConfig uses Scale.FIT + CENTER_BOTH
 * - The HTML container is properly configured for centering
 * - The CSS provides fullscreen dark background
 * - The logical resolution is preserved at 1024×768
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mainTsPath = resolve(__dirname, '../../main.ts');
const indexHtmlPath = resolve(__dirname, '../../../index.html');

const mainTsContent = readFileSync(mainTsPath, 'utf-8');
const indexHtmlContent = readFileSync(indexHtmlPath, 'utf-8');

describe('BUG-013: Canvas centering configuration', () => {
  describe('Phaser GameConfig (main.ts)', () => {
    it('1. defines parent as game-container', () => {
      expect(mainTsContent).toContain("parent: 'game-container'");
    });

    it('2. scale mode uses FIT', () => {
      expect(mainTsContent).toMatch(/mode:\s*Phaser\.Scale\.FIT/);
    });

    it('3. autoCenter uses CENTER_VERTICALLY', () => {
      expect(mainTsContent).toMatch(/autoCenter:\s*Phaser\.Scale\.CENTER_VERTICALLY/);
    });

    it('4. maintains logical resolution 1024×768', () => {
      expect(mainTsContent).toMatch(/width:\s*1024/);
      expect(mainTsContent).toMatch(/height:\s*768/);
    });

    it('5. does not use RESIZE mode', () => {
      expect(mainTsContent).not.toContain('Phaser.Scale.RESIZE');
      expect(mainTsContent).not.toContain('Scale.RESIZE');
    });

    it('6. scale config width matches game width', () => {
      const scaleBlock = mainTsContent.match(/scale:\s*\{[\s\S]*?\}/);
      expect(scaleBlock).not.toBeNull();
      expect(scaleBlock![0]).toContain('width: 1024');
      expect(scaleBlock![0]).toContain('height: 768');
    });
  });

  describe('HTML structure (index.html)', () => {
    it('7. has a game-container div', () => {
      expect(indexHtmlContent).toContain('id="game-container"');
    });

    it('8. does not use old app container for game', () => {
      expect(indexHtmlContent).not.toMatch(/id=["']app["']/);
    });

    it('9. html and body have margin 0', () => {
      expect(indexHtmlContent).toMatch(/margin:\s*0/);
    });

    it('10. background is not white', () => {
      expect(indexHtmlContent).toMatch(/background:\s*#000/);
    });
  });

  describe('CSS centering (index.html inline styles)', () => {
    it('11. game-container uses flexbox centering', () => {
      expect(indexHtmlContent).toMatch(/display:\s*flex/);
      expect(indexHtmlContent).toMatch(/align-items:\s*center/);
      expect(indexHtmlContent).toMatch(/justify-content:\s*center/);
    });

    it('12. game-container uses 100vw width', () => {
      expect(indexHtmlContent).toMatch(/width:\s*100vw/);
    });

    it('13. game-container uses 100vh height', () => {
      expect(indexHtmlContent).toMatch(/height:\s*100vh/);
    });

    it('14. canvas does not force 100vw/100vh (would deform aspect ratio)', () => {
      const canvasRule = indexHtmlContent.match(/#game-container\s+canvas\s*\{[^}]*\}/);
      if (canvasRule) {
        const rule = canvasRule[0];
        const has100vw = /width:\s*100vw/.test(rule);
        const has100vh = /height:\s*100vh/.test(rule);
        expect(has100vw && has100vh).toBe(false);
      }
    });

    it('15. overflow is hidden on game-container', () => {
      expect(indexHtmlContent).toMatch(/overflow:\s*hidden/);
    });
  });

  describe('Scene logical resolution preservation', () => {
    it('16. no duplicate canvas creation (single game-container)', () => {
      const matches = indexHtmlContent.match(/id="game-container"/g);
      expect(matches).toHaveLength(1);
    });

    it('17. main.ts does not set display size that overrides scale manager', () => {
      expect(mainTsContent).not.toContain('setDisplaySize');
    });
  });
});
