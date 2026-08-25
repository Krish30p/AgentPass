import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      },
      '/passports': {
        target: 'http://localhost:5001',
        changeOrigin: true
      },
      '/audit-log': {
        target: 'http://localhost:5001',
        changeOrigin: true
      },
      '/transaction-request': {
        target: 'http://localhost:5001',
        changeOrigin: true
      }
    }
  }
});
