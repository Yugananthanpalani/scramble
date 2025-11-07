import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: true,      // allows access from network (e.g., via phone or other device)
    port: 5173,      // change this to your preferred port (e.g., 3000)
  },
});
