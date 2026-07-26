import { describe, it, expect } from 'vitest';

/**
 * DefeatScene unit tests — validates the visual background change
 * and confirms defeat logic is preserved.
 */

describe('DefeatScene Background Visual Change', () => {
  let defeatSceneSrc: string;
  let bootSceneSrc: string;

  it('setup: load source files', async () => {
    // @ts-ignore -- node:fs available in vitest runtime
    const nodeFs: { readFileSync(p: string, enc: string): string } = await import('node:fs');
    // @ts-ignore -- node:path available in vitest runtime
    const nodePath: { resolve(...args: string[]): string } = await import('node:path');
    // @ts-ignore
    const dir: string = __dirname;
    defeatSceneSrc = nodeFs.readFileSync(
      nodePath.resolve(dir, '../DefeatScene.ts'), 'utf-8',
    );
    bootSceneSrc = nodeFs.readFileSync(
      nodePath.resolve(dir, '../BootScene.ts'), 'utf-8',
    );
    expect(defeatSceneSrc.length).toBeGreaterThan(0);
    expect(bootSceneSrc.length).toBeGreaterThan(0);
  });

  describe('Asset loading', () => {
    it('1. defeat-background key is loaded in BootScene', async () => {
      // @ts-ignore
      const nodeFs = await import('node:fs');
      // @ts-ignore
      const nodePath = await import('node:path');
      // @ts-ignore
      const src = nodeFs.readFileSync(nodePath.resolve(__dirname, '../BootScene.ts'), 'utf-8');
      expect(src).toContain("'defeat-background'");
      expect(src).toContain('BackgroundNivel6Dialogs.png');
    });

    it('2. background is positioned at center', async () => {
      // @ts-ignore
      const nodeFs = await import('node:fs');
      // @ts-ignore
      const nodePath = await import('node:path');
      // @ts-ignore
      const src = nodeFs.readFileSync(nodePath.resolve(__dirname, '../DefeatScene.ts'), 'utf-8');
      expect(src).toContain("this.add.image(centerX, centerY, 'defeat-background')");
    });

    it('3. cover scaling strategy is applied', async () => {
      // @ts-ignore
      const nodeFs = await import('node:fs');
      // @ts-ignore
      const nodePath = await import('node:path');
      // @ts-ignore
      const src = nodeFs.readFileSync(nodePath.resolve(__dirname, '../DefeatScene.ts'), 'utf-8');
      expect(src).toContain('Math.max(width / bg.width, height / bg.height)');
      expect(src).toContain('bg.setScale(scale)');
    });

    it('4. background has lowest depth (0)', async () => {
      // @ts-ignore
      const nodeFs = await import('node:fs');
      // @ts-ignore
      const nodePath = await import('node:path');
      // @ts-ignore
      const src = nodeFs.readFileSync(nodePath.resolve(__dirname, '../DefeatScene.ts'), 'utf-8');
      expect(src).toContain('bg.setDepth(0)');
    });
  });

  describe('Overlay', () => {
    it('5. semi-transparent overlay exists with alpha 0.35', async () => {
      // @ts-ignore
      const nodeFs = await import('node:fs');
      // @ts-ignore
      const nodePath = await import('node:path');
      // @ts-ignore
      const src = nodeFs.readFileSync(nodePath.resolve(__dirname, '../DefeatScene.ts'), 'utf-8');
      expect(src).toContain('0x000000, 0.35');
    });

    it('6. overlay is not interactive', async () => {
      // @ts-ignore
      const nodeFs = await import('node:fs');
      // @ts-ignore
      const nodePath = await import('node:path');
      // @ts-ignore
      const src = nodeFs.readFileSync(nodePath.resolve(__dirname, '../DefeatScene.ts'), 'utf-8');
      const lines = src.split('\n');
      const overlayLines = lines.filter((l: string) => l.includes('overlay'));
      const hasInteractive = overlayLines.some((l: string) => l.includes('setInteractive'));
      expect(hasInteractive).toBe(false);
    });
  });

  describe('Content preservation', () => {
    it('7. DERROTA title still exists', async () => {
      // @ts-ignore
      const nodeFs = await import('node:fs');
      // @ts-ignore
      const nodePath = await import('node:path');
      // @ts-ignore
      const src = nodeFs.readFileSync(nodePath.resolve(__dirname, '../DefeatScene.ts'), 'utf-8');
      expect(src).toContain("'DERROTA'");
    });

    it('8. survival time is dynamic', async () => {
      // @ts-ignore
      const nodeFs = await import('node:fs');
      // @ts-ignore
      const nodePath = await import('node:path');
      // @ts-ignore
      const src = nodeFs.readFileSync(nodePath.resolve(__dirname, '../DefeatScene.ts'), 'utf-8');
      expect(src).toContain('this.defeatData.survivalTime');
    });

    it('9. XP total is dynamic', async () => {
      // @ts-ignore
      const nodeFs = await import('node:fs');
      // @ts-ignore
      const nodePath = await import('node:path');
      // @ts-ignore
      const src = nodeFs.readFileSync(nodePath.resolve(__dirname, '../DefeatScene.ts'), 'utf-8');
      expect(src).toContain('this.defeatData.totalXp');
    });

    it('10. retry button starts GameScene with gameMode', async () => {
      // @ts-ignore
      const nodeFs = await import('node:fs');
      // @ts-ignore
      const nodePath = await import('node:path');
      // @ts-ignore
      const src = nodeFs.readFileSync(nodePath.resolve(__dirname, '../DefeatScene.ts'), 'utf-8');
      expect(src).toContain("this.scene.start('GameScene'");
      expect(src).toContain('gameMode: this.defeatData.gameMode');
    });

    it('11. menu button starts MainMenuScene', async () => {
      // @ts-ignore
      const nodeFs = await import('node:fs');
      // @ts-ignore
      const nodePath = await import('node:path');
      // @ts-ignore
      const src = nodeFs.readFileSync(nodePath.resolve(__dirname, '../DefeatScene.ts'), 'utf-8');
      expect(src).toContain("this.scene.start('MainMenuScene')");
    });
  });

  describe('Rendering order and safety', () => {
    it('12. content elements have depth >= 2', async () => {
      // @ts-ignore
      const nodeFs = await import('node:fs');
      // @ts-ignore
      const nodePath = await import('node:path');
      // @ts-ignore
      const src = nodeFs.readFileSync(nodePath.resolve(__dirname, '../DefeatScene.ts'), 'utf-8');
      const contentDepths = src.match(/\.setDepth\(2\)/g);
      expect(contentDepths!.length).toBeGreaterThanOrEqual(5);
    });

    it('13. no removeAllListeners on shared events', async () => {
      // @ts-ignore
      const nodeFs = await import('node:fs');
      // @ts-ignore
      const nodePath = await import('node:path');
      // @ts-ignore
      const src = nodeFs.readFileSync(nodePath.resolve(__dirname, '../DefeatScene.ts'), 'utf-8');
      expect(src).not.toContain('removeAllListeners');
    });

    it('14. no persistent accumulating state across re-entries', async () => {
      // @ts-ignore
      const nodeFs = await import('node:fs');
      // @ts-ignore
      const nodePath = await import('node:path');
      // @ts-ignore
      const src = nodeFs.readFileSync(nodePath.resolve(__dirname, '../DefeatScene.ts'), 'utf-8');
      expect(src).not.toContain('.push(');
    });
  });
});
