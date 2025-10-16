import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from .env files
  const env = loadEnv(mode, '.', '');

  return {
    // ✅ Essential for Capacitor / Android builds
    // Ensures all JS, CSS, and assets load correctly in file:// scheme
    base: './',

    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    plugins: [react()],

    define: {
      // Expose environment variables to your app
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    // ✅ Ensures Vite outputs to the folder Capacitor expects
    build: {
      outDir: 'dist',
      sourcemap: false,
      emptyOutDir: true, // Cleans old builds automatically
      rollupOptions: {
        output: {
          // Optional: helps with debugging and smaller bundle naming
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  };
});
