import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Installable app (Android, iOS, Windows, macOS) that opens and works offline.
      // Clinic data already lives in localStorage; the service worker caches the app itself.
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['icons/*.png', 'icons/icon.svg'],
        manifest: {
          name: 'PilatesFlow - Gestão Clínica',
          short_name: 'PilatesFlow',
          description: 'Agenda, pacientes, exercícios, fichas e financeiro para clínicas de Pilates.',
          lang: 'pt-BR',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          background_color: '#F6F8F7',
          theme_color: '#426B5B',
          categories: ['health', 'medical', 'productivity'],
          icons: [
            {src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png'},
            {src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png'},
            {src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
          ],
          shortcuts: [
            {name: 'Agenda', url: '/#/schedule', icons: [{src: '/icons/icon-192.png', sizes: '192x192'}]},
            {name: 'Exercícios', url: '/#/exercises', icons: [{src: '/icons/icon-192.png', sizes: '192x192'}]},
          ],
        },
        workbox: {
          // app shell + exercise media (~4 MB) are stored on install so everything opens offline
          globPatterns: ['**/*.{js,css,html,svg,png,jpg,gif,ico,webmanifest}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          navigateFallback: '/index.html',
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: ({url}) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts',
                expiration: {maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365},
                cacheableResponse: {statuses: [0, 200]},
              },
            },
            // Supabase (cloud sync/login) is never cached: it must always hit the network
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
