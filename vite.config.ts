import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/AI-Powered-Interview-Coaching/',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api/ollama': {
        target: 'http://127.0.0.1:11434/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            // Silently handle proxy errors to avoid console spam when Ollama is off
          });
        }
      }
    }
  }
});
