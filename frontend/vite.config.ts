import { defineConfig } from 'vite';

export default defineConfig(() => {
  const backendZiel = 'http://127.0.0.1:8081';

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
      sourcemap: 'hidden' as const,
      emptyOutDir: true,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            'phaser-vendor': ['phaser'],
            'vendor': ['@sentry/browser', '@stomp/stompjs']
          }
        }
      }
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      setupFiles: ['src/test/setup.ts'],
      coverage: {
        provider: 'v8' as const,
        include: ['src/**/*.ts'],
        exclude: [
          'src/**/*.test.ts',
          'src/generated/**',
          'src/main.ts',
          'src/anwendung.ts',
          'src/szenen/TischSzene.ts',
          'src/services/AnimationenService.ts',
          'src/szenen/SpielverwaltungsSzene.ts'
        ],
        all: true
      }
    }
  };
});
