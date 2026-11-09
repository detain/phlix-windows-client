import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue(), vueJsx()],
  root: 'src/renderer',
  // MW-124 [review windows__crossfe 1]: the SPA is served under the /app
  // prefix (router base + the app:// handler's prefix law), and the handler
  // answers EVERY route (deep-route reloads included) with this index.html.
  // With base './' the emitted asset URLs resolved against the ROUTE on a
  // 2-segment reload (/app/player/3 → /app/player/assets/…) → ENOENT →
  // index.html served as a module script → text/html refused → boot-splash
  // death. Origin-rooted '/app/' makes resolution route-depth-independent.
  base: '/app/',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/renderer/index.html')
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer')
    }
  }
});
