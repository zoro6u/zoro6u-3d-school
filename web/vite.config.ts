/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    fs: { allow: ['..'] }, // lesson content lives in ../content
    proxy: { '/api': 'http://localhost:8000' },
  },
  test: { environment: 'jsdom', globals: false },
});
