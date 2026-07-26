import { defineConfig } from 'vite';
import { resolve } from 'path';
import { cpSync } from 'fs';

export default defineConfig({
  build: {
    outDir: 'dist',
  },
  plugins: [
    {
      name: 'copy-runtime-assets',
      closeBundle() {
        // Copy src/assets to dist/src/assets so Phaser runtime paths resolve correctly
        cpSync(
          resolve(__dirname, 'src/assets'),
          resolve(__dirname, 'dist/src/assets'),
          { recursive: true }
        );
      },
    },
  ],
});
