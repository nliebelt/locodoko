import { defineConfig } from 'vite';

export default defineConfig(() => {
  const backendZiel = 'http://127.0.0.1:8080';

  return {
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: backendZiel,
          changeOrigin: true
        },
        '/ws': {
          target: backendZiel,
          changeOrigin: true,
          ws: true
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      emptyOutDir: true,
      chunkSizeWarningLimit: 1800
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts']
    }
  };
});
