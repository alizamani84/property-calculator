import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const entry = process.env.VITE_ENTRY || 'calculator';

const inputs = {
  calculator: 'index.html',
  methodology: 'methodology.html',
};

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    rollupOptions: {
      input: inputs[entry],
    },
    outDir: '../dist',
  },
});
