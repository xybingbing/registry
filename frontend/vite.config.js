// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react({
      include: '**/*.{jsx,js}'
    })
  ],
  publicDir: 'public',
  resolve: {
    alias: {
      api: path.resolve(__dirname, './src/api.js'),
      utilities: path.resolve(__dirname, './src/utilities'),
      components: path.resolve(__dirname, './src/components'),
      pages: path.resolve(__dirname, './src/pages'),
      assets: path.resolve(__dirname, './src/assets'),
      __mocks__: path.resolve(__dirname, './src/__mocks__'),
      host: path.resolve(__dirname, './src/host.js'),
      session: path.resolve(__dirname, './src/session.js')
    }
  },
  build: {
    outDir: 'build',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router') ||
            id.includes('/@mui/') ||
            id.includes('/@emotion/')
          ) {
            return 'vendor-ui';
          }
          if (id.includes('/xlsx/') || id.includes('/export-from-json/')) return 'vendor-export';
          return undefined;
        }
      }
    },
    chunkSizeWarningLimit: 850
  },
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.[jt]sx?$/,
    exclude: []
  }
});
