/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// `pnpm build:demo` (VITE_DEMO=1): one self-contained bundle for sandboxed hosts: relative base, no service worker, no code splitting.
declare const process: { env: Record<string, string | undefined> }; // avoids pulling @types/node into the app's types
const demo = process.env.VITE_DEMO === '1';

export default defineConfig({
  base: demo ? './' : '/',
  // a hard compile-time constant, so normal builds contain none of the demo code
  define: { 'import.meta.env.VITE_DEMO': JSON.stringify(demo ? '1' : '') },
  build: demo ? { outDir: 'dist-demo', rolldownOptions: { output: { codeSplitting: false } } } : {},
  plugins: [
    react(),
    tailwindcss(),
    // Installable + works offline after the first visit, so the guided tours (which need no API key) keep working with no network.
    VitePWA({
      disable: demo,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: '3D School',
        short_name: '3D School',
        description: 'Learn Biology, Physics and Chemistry through 3D simulations with AI teachers.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//], // never serve the app shell for API calls
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  server: {
    fs: { allow: ['..'] }, // lesson content lives in ../content
    proxy: { '/api': 'http://localhost:8000' },
  },
  preview: { proxy: { '/api': 'http://localhost:8000' } },
  test: { environment: 'jsdom', globals: false },
});
